const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const logRoutes = require('./routes/logRoutes');
const authRoutes = require('./routes/authRoutes');
const { verifyToken } = require('./middleware/auth');
const usageLogger = require('./middleware/usageLogger');
const errorHandler = require('./middleware/errorHandler');
const eventBus = require('./services/eventBus');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for bulk operations
app.use(morgan('dev'));

// Log API usage
app.use(usageLogger);

// Health check endpoint (unprotected)
app.get('/healthz', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const eventBusStatus = await eventBus.health();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        eventBus: eventBusStatus.status
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check endpoint
app.get('/readyz', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1;
    const eventBusStatus = await eventBus.health();
    
    if (mongoStatus && eventBusStatus.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          mongodb: mongoStatus,
          eventBus: eventBusStatus.status
        }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP nodejs_heap_size_total Process heap size from Node.js in bytes.
# TYPE nodejs_heap_size_total gauge
nodejs_heap_size_total ${memUsage.heapTotal}

# HELP nodejs_heap_size_used Process heap size used from Node.js in bytes.
# TYPE nodejs_heap_size_used gauge
nodejs_heap_size_used ${memUsage.heapUsed}

# HELP nodejs_heap_size_available Process heap size available from Node.js in bytes.
# TYPE nodejs_heap_size_available gauge
nodejs_heap_size_available ${memUsage.heapTotal - memUsage.heapUsed}

# HELP nodejs_rss_memory_bytes Resident memory size in bytes.
# TYPE nodejs_rss_memory_bytes gauge
nodejs_rss_memory_bytes ${memUsage.rss}

# HELP nodejs_external_memory_bytes Node.js external memory size in bytes.
# TYPE nodejs_external_memory_bytes gauge
nodejs_external_memory_bytes ${memUsage.external}

# HELP nodejs_process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE nodejs_process_cpu_seconds_total counter
nodejs_process_cpu_seconds_total ${uptime}

# HELP nodejs_process_start_time_seconds Start time of the process since unix epoch in seconds.
# TYPE nodejs_process_start_time_seconds gauge
nodejs_process_start_time_seconds ${Math.floor(process.uptime())}
  `);
});

// Unprotected auth endpoint
app.use('/api/v1/auth', authRoutes);

// All endpoints below require a valid JWT
app.use('/api/v1', verifyToken);
app.use('/api/v1', logRoutes);

// Enhanced error handling middleware
app.use(errorHandler);

// Connect to MongoDB and Event Bus
async function startServices() {
  try {
    // Connect to MongoDB
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountability';
    await mongoose.connect(dbUri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Connect to Event Bus
    try {
      await eventBus.connect();
      console.log('✅ Connected to Event Bus');
    } catch (error) {
      console.error('❌ Event Bus connection failed:', error);
      // Continue without event bus for now
      console.log('⚠️  Continuing without Event Bus...');
    }
    
    // Start HTTP server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/healthz`);
      console.log(`🔍 Readiness check: http://localhost:${PORT}/readyz`);
      console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  try {
    await eventBus.disconnect();
    await mongoose.connection.close();
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  
  try {
    await eventBus.disconnect();
    await mongoose.connection.close();
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start services
startServices();
