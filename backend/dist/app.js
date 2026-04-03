"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const crypto_1 = require("crypto");
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const prom_client_1 = __importDefault(require("prom-client"));
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const logRoutes_1 = __importDefault(require("./routes/logRoutes"));
const auth_1 = require("./middleware/auth");
const usageLogger_1 = __importDefault(require("./middleware/usageLogger"));
const errorHandler_1 = __importDefault(require("./middleware/errorHandler"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const eventBus = require('./services/eventBus');
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
});
const promRegister = new prom_client_1.default.Registry();
prom_client_1.default.collectDefaultMetrics({ register: promRegister });
const app = (0, express_1.default)();
app.use((0, pino_http_1.default)({
    logger,
    genReqId: (req, res) => {
        const id = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
        res.setHeader('x-request-id', id);
        return id;
    },
}));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, morgan_1.default)('dev'));
app.use(usageLogger_1.default);
app.get('/healthz', async (_req, res) => {
    try {
        const mongoStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
        const eventBusStatus = await eventBus.health();
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                mongodb: mongoStatus,
                eventBus: eventBusStatus.status,
            },
        });
    }
    catch (error) {
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
        const mongoStatus = mongoose_1.default.connection.readyState === 1;
        const eventBusStatus = await eventBus.health();
        if (mongoStatus && eventBusStatus.status === 'healthy') {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
            });
        }
        else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                services: {
                    mongodb: mongoStatus,
                    eventBus: eventBusStatus.status,
                },
            });
        }
    }
    catch (error) {
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
app.use('/api/v1/auth', authRoutes_1.default);
app.use('/api/v1', auth_1.verifyToken);
app.use('/api/v1', logRoutes_1.default);
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
app.use(errorHandler_1.default);
async function startServices() {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountability';
    await mongoose_1.default.connect(dbUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
    logger.info('Connected to MongoDB');
    try {
        await eventBus.connect();
        logger.info('Connected to Event Bus');
    }
    catch (error) {
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
        await mongoose_1.default.connection.close();
        process.exit(0);
    }
    catch (error) {
        logger.error({ err: error }, 'Shutdown error');
        process.exit(1);
    }
});
process.on('SIGINT', async () => {
    logger.info('SIGINT received');
    try {
        await eventBus.disconnect();
        await mongoose_1.default.connection.close();
        process.exit(0);
    }
    catch (error) {
        logger.error({ err: error }, 'Shutdown error');
        process.exit(1);
    }
});
void startServices().catch((error) => {
    logger.error({ err: error }, 'Failed to start services');
    process.exit(1);
});
