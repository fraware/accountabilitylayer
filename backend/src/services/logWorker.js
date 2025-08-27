const eventBus = require('./eventBus');
const Log = require('../models/logModel');
const mongoose = require('mongoose');
require('dotenv').config();

class LogWorker {
  constructor() {
    this.isRunning = false;
    this.processedCount = 0;
    this.errorCount = 0;
    this.startTime = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Log worker is already running');
      return;
    }

    try {
      console.log('🚀 Starting Log Worker Service...');
      
      // Connect to event bus
      await eventBus.connect();
      
      // Connect to MongoDB
      const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountability';
      await mongoose.connect(dbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Connected to MongoDB');
      
      // Subscribe to log events
      await this.subscribeToEvents();
      
      this.isRunning = true;
      this.startTime = new Date();
      
      console.log('✅ Log Worker Service started successfully');
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error('❌ Failed to start Log Worker Service:', error);
      throw error;
    }
  }

  async subscribeToEvents() {
    try {
      // Subscribe to log creation events
      await eventBus.subscribe('logs.create', this.handleLogCreation.bind(this), {
        queue: 'log-workers',
        durable: 'log-worker-durable',
        deliverPolicy: 'all',
        ackPolicy: 'explicit',
        maxDeliver: 3
      });
      
      // Subscribe to log update events
      await eventBus.subscribe('logs.update', this.handleLogUpdate.bind(this), {
        queue: 'log-workers',
        durable: 'log-worker-durable',
        deliverPolicy: 'all',
        ackPolicy: 'explicit',
        maxDeliver: 3
      });
      
      // Subscribe to bulk log events
      await eventBus.subscribe('logs.bulk', this.handleBulkLogs.bind(this), {
        queue: 'log-workers',
        durable: 'log-worker-durable',
        deliverPolicy: 'all',
        ackPolicy: 'explicit',
        maxDeliver: 3
      });
      
      console.log('📥 Subscribed to log events');
      
    } catch (error) {
      console.error('❌ Failed to subscribe to events:', error);
      throw error;
    }
  }

  async handleLogCreation(event, msg) {
    try {
      console.log(`📝 Processing log creation: ${event.id}`);
      
      const logData = event.data;
      
      // Validate required fields
      if (!logData.agent_id || !logData.step_id || !logData.input_data || !logData.output || !logData.reasoning) {
        throw new Error('Missing required fields for log creation');
      }
      
      // Create new log
      const log = new Log(logData);
      
      // Generate hash for data integrity
      log.hash = log.generateHash();
      
      // Save to database
      await log.save();
      
      this.processedCount++;
      
      console.log(`✅ Log created successfully: ${log._id}`);
      
      // Publish success event
      await eventBus.publish('logs.created', {
        logId: log._id,
        agentId: log.agent_id,
        timestamp: log.timestamp
      });
      
    } catch (error) {
      this.errorCount++;
      console.error(`❌ Failed to create log: ${event.id}`, error);
      throw error; // This will trigger retry logic
    }
  }

  async handleLogUpdate(event, msg) {
    try {
      console.log(`📝 Processing log update: ${event.id}`);
      
      const { logId, updates } = event.data;
      
      if (!logId) {
        throw new Error('Missing logId for update');
      }
      
      // Find and update log
      const log = await Log.findById(logId);
      if (!log) {
        throw new Error(`Log not found: ${logId}`);
      }
      
      // Apply updates
      Object.assign(log, updates);
      log.version += 1;
      log.hash = log.generateHash();
      
      await log.save();
      
      this.processedCount++;
      
      console.log(`✅ Log updated successfully: ${logId}`);
      
      // Publish update event
      await eventBus.publish('logs.updated', {
        logId: log._id,
        agentId: log.agent_id,
        timestamp: log.timestamp,
        version: log.version
      });
      
    } catch (error) {
      this.errorCount++;
      console.error(`❌ Failed to update log: ${event.id}`, error);
      throw error;
    }
  }

  async handleBulkLogs(event, msg) {
    try {
      console.log(`📝 Processing bulk logs: ${event.id}`);
      
      const { logs } = event.data;
      
      if (!Array.isArray(logs) || logs.length === 0) {
        throw new Error('Invalid or empty logs array');
      }
      
      // Transform logs and add hashes
      const transformedLogs = logs.map(logData => {
        const log = new Log(logData);
        log.hash = log.generateHash();
        return log;
      });
      
      // Bulk insert with better performance
      const result = await Log.bulkInsert(transformedLogs);
      
      this.processedCount += result.length;
      
      console.log(`✅ Bulk logs processed: ${result.length} logs`);
      
      // Publish bulk success event
      await eventBus.publish('logs.bulk-created', {
        count: result.length,
        agentIds: [...new Set(result.map(log => log.agent_id))],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.errorCount++;
      console.error(`❌ Failed to process bulk logs: ${event.id}`, error);
      throw error;
    }
  }

  async getStats() {
    return {
      status: this.isRunning ? 'running' : 'stopped',
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      timestamp: new Date().toISOString()
    };
  }

  async health() {
    try {
      const eventBusHealth = await eventBus.health();
      const mongoHealth = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      return {
        status: this.isRunning ? 'healthy' : 'unhealthy',
        eventBus: eventBusHealth,
        mongodb: mongoHealth,
        stats: await this.getStats(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      this.isRunning = false;
      
      try {
        // Disconnect from event bus
        await eventBus.disconnect();
        
        // Close MongoDB connection
        await mongoose.connection.close();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
        
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async stop() {
    if (!this.isRunning) {
      console.log('⚠️  Log worker is not running');
      return;
    }
    
    console.log('🛑 Stopping Log Worker Service...');
    
    this.isRunning = false;
    
    try {
      await eventBus.disconnect();
      await mongoose.connection.close();
      
      console.log('✅ Log Worker Service stopped');
      
    } catch (error) {
      console.error('❌ Error stopping service:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const worker = new LogWorker();
  
  try {
    await worker.start();
    
    // Keep the process running
    process.stdin.resume();
    
    // Log stats every 30 seconds
    setInterval(async () => {
      const stats = await worker.getStats();
      console.log(`📊 Worker Stats: ${stats.processedCount} processed, ${stats.errorCount} errors`);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LogWorker;
