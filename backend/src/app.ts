import 'dotenv/config';
import { randomUUID } from 'crypto';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import client from 'prom-client';
import pino from 'pino';
import pinoHttp from 'pino-http';

import authRoutes from './routes/authRoutes';
import logRoutes from './routes/logRoutes';
import { verifyToken } from './middleware/auth';
import usageLogger from './middleware/usageLogger';
import errorHandler from './middleware/errorHandler';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const eventBus = require('./services/eventBus');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const promRegister = new client.Registry();
client.collectDefaultMetrics({ register: promRegister });

const app = express();

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = (req.headers['x-request-id'] as string) || randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
  })
);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(usageLogger);

app.get('/healthz', async (_req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const eventBusStatus = await eventBus.health();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        eventBus: eventBusStatus.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(503).json({
      status: 'unhealthy',
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/readyz', async (_req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1;
    const eventBusStatus = await eventBus.health();

    if (mongoStatus && eventBusStatus.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          mongodb: mongoStatus,
          eventBus: eventBusStatus.status,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(503).json({
      status: 'not ready',
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promRegister.contentType);
  res.end(await promRegister.metrics());
});

app.use('/api/v1/auth', authRoutes);

app.use('/api/v1', verifyToken);
app.use('/api/v1', logRoutes);

if (process.env.SERVE_OPENAPI === 'true') {
  const path = require('path');
  const fs = require('fs');
  const yaml = require('yaml');
  const swaggerUi = require('swagger-ui-express');
  const candidates = [
    path.join(process.cwd(), '..', 'docs', 'api-spec.yaml'),
    path.join(process.cwd(), 'docs', 'api-spec.yaml'),
  ];
  const specPath = candidates.find((p) => fs.existsSync(p));
  if (specPath) {
    const spec = yaml.parse(fs.readFileSync(specPath, 'utf8'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
    logger.info({ specPath }, 'OpenAPI UI mounted at /api-docs');
  }
}

app.use(errorHandler);

async function startServices(): Promise<void> {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountability';
  await mongoose.connect(dbUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  logger.info('Connected to MongoDB');

  try {
    await eventBus.connect();
    logger.info('Connected to Event Bus');
  } catch (error) {
    logger.error({ err: error }, 'Event Bus connection failed; continuing without Event Bus');
  }

  const PORT = Number(process.env.PORT) || 5000;
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server listening');
  });
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  try {
    await eventBus.disconnect();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Shutdown error');
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received');
  try {
    await eventBus.disconnect();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Shutdown error');
    process.exit(1);
  }
});

void startServices().catch((error) => {
  logger.error({ err: error }, 'Failed to start services');
  process.exit(1);
});
