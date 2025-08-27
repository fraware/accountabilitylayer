const eventBus = require('./eventBus');
const { Server } = require('socket.io');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

class NotifierService {
  constructor() {
    this.io = null;
    this.server = null;
    this.rooms = new Map(); // Track active rooms
    this.connections = new Map(); // Track active connections
    this.isRunning = false;
    this.notificationCount = 0;
    this.startTime = null;
  }

  async start(port = 3001) {
    if (this.isRunning) {
      console.log('⚠️  Notifier service is already running');
      return;
    }

    try {
      console.log('🚀 Starting Notifier Service...');
      
      // Connect to event bus
      await eventBus.connect();
      
      // Create HTTP server
      this.server = http.createServer();
      
      // Initialize Socket.IO with Redis adapter for scaling
      this.io = new Server(this.server, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:3000",
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
      });
      
      // Setup Socket.IO event handlers
      this.setupSocketHandlers();
      
      // Subscribe to notification events
      await this.subscribeToEvents();
      
      // Start server
      this.server.listen(port, () => {
        console.log(`✅ Notifier service listening on port ${port}`);
      });
      
      this.isRunning = true;
      this.startTime = new Date();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error('❌ Failed to start Notifier Service:', error);
      throw error;
    }
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 New connection: ${socket.id}`);
      
      // Track connection
      this.connections.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        rooms: new Set(),
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      });
      
      // Handle room joins
      socket.on('join-room', (roomData) => {
        const { room, filters, userId } = roomData;
        
        if (room) {
          socket.join(room);
          this.connections.get(socket.id).rooms.add(room);
          
          // Track room membership
          if (!this.rooms.has(room)) {
            this.rooms.set(room, {
              name: room,
              connections: new Set(),
              filters: filters || {},
              createdAt: new Date(),
              lastActivity: new Date()
            });
          }
          
          this.rooms.get(room).connections.add(socket.id);
          this.rooms.get(room).lastActivity = new Date();
          
          console.log(`📥 Socket ${socket.id} joined room: ${room}`);
          
          // Send room info
          socket.emit('room-joined', {
            room,
            memberCount: this.rooms.get(room).connections.size,
            filters: this.rooms.get(room).filters
          });
        }
      });
      
      // Handle room leaves
      socket.on('leave-room', (room) => {
        if (room) {
          socket.leave(room);
          this.connections.get(socket.id).rooms.delete(room);
          
          if (this.rooms.has(room)) {
            this.rooms.get(room).connections.delete(socket.id);
            
            // Remove room if empty
            if (this.rooms.get(room).connections.size === 0) {
              this.rooms.delete(room);
              console.log(`🗑️  Room ${room} removed (no members)`);
            }
          }
          
          console.log(`📤 Socket ${socket.id} left room: ${room}`);
        }
      });
      
      // Handle custom events
      socket.on('custom-event', (data) => {
        console.log(`📡 Custom event from ${socket.id}:`, data);
        // Handle custom events as needed
      });
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket ${socket.id} disconnected: ${reason}`);
        
        // Clean up connection tracking
        const connection = this.connections.get(socket.id);
        if (connection) {
          // Remove from all rooms
          connection.rooms.forEach(room => {
            if (this.rooms.has(room)) {
              this.rooms.get(room).connections.delete(socket.id);
              
              if (this.rooms.get(room).connections.size === 0) {
                this.rooms.delete(room);
                console.log(`🗑️  Room ${room} removed (no members)`);
              }
            }
          });
          
          this.connections.delete(socket.id);
        }
      });
      
      // Send welcome message
      socket.emit('welcome', {
        message: 'Connected to Accountability Layer Notifier Service',
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    });
  }

  async subscribeToEvents() {
    try {
      // Subscribe to log creation events
      await eventBus.subscribe('logs.created', this.handleLogCreated.bind(this), {
        queue: 'notifiers',
        durable: 'notifier-durable'
      });
      
      // Subscribe to log update events
      await eventBus.subscribe('logs.updated', this.handleLogUpdated.bind(this), {
        queue: 'notifiers',
        durable: 'notifier-durable'
      });
      
      // Subscribe to bulk log events
      await eventBus.subscribe('logs.bulk-created', this.handleBulkLogsCreated.bind(this), {
        queue: 'notifiers',
        durable: 'notifier-durable'
      });
      
      // Subscribe to audit events
      await eventBus.subscribe('audit.*', this.handleAuditEvent.bind(this), {
        queue: 'notifiers',
        durable: 'notifier-durable'
      });
      
      console.log('📥 Subscribed to notification events');
      
    } catch (error) {
      console.error('❌ Failed to subscribe to events:', error);
      throw error;
    }
  }

  async handleLogCreated(event, msg) {
    try {
      const { logId, agentId, timestamp } = event.data;
      
      console.log(`📢 Notifying log creation: ${logId}`);
      
      // Notify relevant rooms
      await this.notifyRooms('log-created', {
        type: 'log-created',
        logId,
        agentId,
        timestamp,
        eventId: event.id
      }, {
        filters: { agentId }
      });
      
      this.notificationCount++;
      
    } catch (error) {
      console.error('❌ Failed to handle log creation notification:', error);
      throw error;
    }
  }

  async handleLogUpdated(event, msg) {
    try {
      const { logId, agentId, timestamp, version } = event.data;
      
      console.log(`📢 Notifying log update: ${logId}`);
      
      // Notify relevant rooms
      await this.notifyRooms('log-updated', {
        type: 'log-updated',
        logId,
        agentId,
        timestamp,
        version,
        eventId: event.id
      }, {
        filters: { agentId }
      });
      
      this.notificationCount++;
      
    } catch (error) {
      console.error('❌ Failed to handle log update notification:', error);
      throw error;
    }
  }

  async handleBulkLogsCreated(event, msg) {
    try {
      const { count, agentIds, timestamp } = event.data;
      
      console.log(`📢 Notifying bulk logs creation: ${count} logs`);
      
      // Notify relevant rooms
      await this.notifyRooms('bulk-logs-created', {
        type: 'bulk-logs-created',
        count,
        agentIds,
        timestamp,
        eventId: event.id
      }, {
        filters: { agentIds }
      });
      
      this.notificationCount++;
      
    } catch (error) {
      console.error('❌ Failed to handle bulk logs notification:', error);
      throw error;
    }
  }

  async handleAuditEvent(event, msg) {
    try {
      const eventType = event.subject.replace('audit.', '');
      
      console.log(`📢 Notifying audit event: ${eventType}`);
      
      // Notify audit rooms
      await this.notifyRooms('audit-event', {
        type: 'audit-event',
        eventType,
        data: event.data,
        timestamp: event.timestamp,
        eventId: event.id
      }, {
        filters: { eventType }
      });
      
      this.notificationCount++;
      
    } catch (error) {
      console.error('❌ Failed to handle audit event notification:', error);
      throw error;
    }
  }

  async notifyRooms(eventName, data, options = {}) {
    try {
      const { filters } = options;
      
      // Find relevant rooms based on filters
      const relevantRooms = Array.from(this.rooms.values()).filter(room => {
        if (!filters) return true;
        
        // Check if room filters match event filters
        return Object.entries(filters).every(([key, value]) => {
          if (Array.isArray(value)) {
            return value.some(v => room.filters[key] === v);
          }
          return room.filters[key] === value;
        });
      });
      
      // Send notifications to relevant rooms
      for (const room of relevantRooms) {
        try {
          // Check room size for backpressure
          if (room.connections.size > 1000) {
            console.log(`⚠️  Room ${room.name} has ${room.connections.size} connections, applying backpressure`);
            continue;
          }
          
          this.io.to(room.name).emit(eventName, {
            ...data,
            room: room.name,
            timestamp: new Date().toISOString()
          });
          
          console.log(`📢 Sent ${eventName} to room ${room.name} (${room.connections.size} connections)`);
          
        } catch (error) {
          console.error(`❌ Failed to notify room ${room.name}:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to notify rooms:', error);
      throw error;
    }
  }

  // Direct notification to specific socket
  notifySocket(socketId, eventName, data) {
    try {
      this.io.to(socketId).emit(eventName, {
        ...data,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📢 Sent ${eventName} to socket ${socketId}`);
      
    } catch (error) {
      console.error(`❌ Failed to notify socket ${socketId}:`, error);
    }
  }

  // Broadcast to all connected clients
  broadcast(eventName, data) {
    try {
      this.io.emit(eventName, {
        ...data,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📢 Broadcasted ${eventName} to all clients`);
      
    } catch (error) {
      console.error('❌ Failed to broadcast:', error);
    }
  }

  async getStats() {
    return {
      status: this.isRunning ? 'running' : 'stopped',
      connections: this.connections.size,
      rooms: this.rooms.size,
      notificationCount: this.notificationCount,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      timestamp: new Date().toISOString()
    };
  }

  async health() {
    try {
      const eventBusHealth = await eventBus.health();
      
      return {
        status: this.isRunning ? 'healthy' : 'unhealthy',
        eventBus: eventBusHealth,
        socketIO: {
          connections: this.connections.size,
          rooms: this.rooms.size
        },
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
        
        // Close Socket.IO server
        if (this.io) {
          this.io.close();
        }
        
        // Close HTTP server
        if (this.server) {
          this.server.close();
        }
        
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
      console.log('⚠️  Notifier service is not running');
      return;
    }
    
    console.log('🛑 Stopping Notifier Service...');
    
    this.isRunning = false;
    
    try {
      await eventBus.disconnect();
      
      if (this.io) {
        this.io.close();
      }
      
      if (this.server) {
        this.server.close();
      }
      
      console.log('✅ Notifier Service stopped');
      
    } catch (error) {
      console.error('❌ Error stopping service:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const notifier = new NotifierService();
  
  try {
    const port = process.env.NOTIFIER_PORT || 3001;
    await notifier.start(port);
    
    // Keep the process running
    process.stdin.resume();
    
    // Log stats every 30 seconds
    setInterval(async () => {
      const stats = await notifier.getStats();
      console.log(`📊 Notifier Stats: ${stats.connections} connections, ${stats.rooms} rooms, ${stats.notificationCount} notifications`);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Failed to start notifier:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = NotifierService;
