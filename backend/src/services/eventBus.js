const { connect, StringCodec, JSONCodec } = require('nats');
const { v4: uuidv4 } = require('uuid');

class EventBus {
  constructor() {
    this.nc = null;
    this.js = null;
    this.stringCodec = StringCodec();
    this.jsonCodec = JSONCodec();
    this.subscribers = new Map();
    this.retryDelays = [1000, 5000, 15000, 60000]; // Exponential backoff
  }

  async connect() {
    try {
      const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
      this.nc = await connect({ url: natsUrl });
      this.js = this.nc.jetstream();
      
      console.log('✅ Connected to NATS JetStream');
      
      // Create streams if they don't exist
      await this.createStreams();
      
      // Setup error handling
      this.nc.closed().then(() => {
        console.log('❌ NATS connection closed');
      });
      
      this.nc.closed().catch((err) => {
        console.error('❌ NATS connection error:', err);
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to NATS:', error);
      throw error;
    }
  }

  async createStreams() {
    try {
      // For now, skip stream creation to get the backend running
      // We'll implement this later with the correct NATS API
      console.log('⚠️  Skipping NATS stream creation for now...');
      
    } catch (error) {
      console.error('❌ Failed to create NATS streams:', error);
      console.log('⚠️  Continuing without stream creation...');
    }
  }

  async publish(subject, data, options = {}) {
    if (!this.js) {
      throw new Error('EventBus not connected');
    }
    
    try {
      const message = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        data,
        metadata: {
          source: 'accountability-backend',
          version: '1.0.0',
          ...options.metadata
        }
      };
      
      const payload = this.jsonCodec.encode(message);
      const ack = await this.js.publish(subject, payload, options);
      
      console.log(`📤 Published event to ${subject}, sequence: ${ack.seq}`);
      
      return {
        id: message.id,
        sequence: ack.seq,
        timestamp: message.timestamp
      };
      
    } catch (error) {
      console.error(`❌ Failed to publish to ${subject}:`, error);
      throw error;
    }
  }

  async subscribe(subject, handler, options = {}) {
    if (!this.js) {
      throw new Error('EventBus not connected');
    }
    
    try {
      const subscription = await this.js.subscribe(subject, {
        queue: options.queue || 'default',
        durable: options.durable || `durable-${subject}`,
        deliver_policy: options.deliverPolicy || 'all',
        ack_policy: options.ackPolicy || 'explicit',
        max_deliver: options.maxDeliver || 3,
        ...options
      });
      
      console.log(`📥 Subscribed to ${subject}`);
      
      // Store subscription for cleanup
      this.subscribers.set(subject, subscription);
      
      // Process messages
      for await (const msg of subscription) {
        try {
          const data = this.jsonCodec.decode(msg.data);
          console.log(`📨 Processing message ${data.id} from ${subject}`);
          
          await handler(data, msg);
          
          // Acknowledge successful processing
          msg.ack();
          
        } catch (error) {
          console.error(`❌ Error processing message ${msg.seq}:`, error);
          
          // Handle retry logic
          await this.handleRetry(msg, error, options);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${subject}:`, error);
      throw error;
    }
  }

  async handleRetry(msg, error, options) {
    const retryCount = msg.headers?.get('retry-count') || 0;
    const maxRetries = options.maxRetries || 3;
    
    if (retryCount < maxRetries) {
      // Calculate delay with exponential backoff
      const delay = this.retryDelays[Math.min(retryCount, this.retryDelays.length - 1)];
      
      console.log(`🔄 Retrying message ${msg.seq} in ${delay}ms (attempt ${retryCount + 1})`);
      
      // Schedule retry
      setTimeout(async () => {
        try {
          // Republish with retry headers
          const retryMsg = {
            ...this.jsonCodec.decode(msg.data),
            metadata: {
              ...this.jsonCodec.decode(msg.data).metadata,
              retryCount: retryCount + 1,
              originalError: error.message
            }
          };
          
          await this.publish(msg.subject, retryMsg.data, {
            metadata: retryMsg.metadata
          });
          
          // Acknowledge original message
          msg.ack();
          
        } catch (retryError) {
          console.error(`❌ Retry failed for message ${msg.seq}:`, retryError);
          msg.nak();
        }
      }, delay);
      
    } else {
      // Max retries exceeded, send to dead letter queue
      console.log(`💀 Max retries exceeded for message ${msg.seq}, sending to DLQ`);
      
      try {
        const dlqSubject = `logs.dlq.${msg.subject.replace('logs.', '')}`;
        await this.publish(dlqSubject, this.jsonCodec.decode(msg.data), {
          metadata: {
            originalSubject: msg.subject,
            originalError: error.message,
            retryCount,
            failedAt: new Date().toISOString()
          }
        });
        
        // Acknowledge original message
        msg.ack();
        
      } catch (dlqError) {
        console.error(`❌ Failed to send to DLQ:`, dlqError);
        msg.nak();
      }
    }
  }

  async request(subject, data, options = {}) {
    if (!this.nc) {
      throw new Error('EventBus not connected');
    }
    
    try {
      const payload = this.jsonCodec.encode(data);
      const response = await this.nc.request(subject, payload, {
        timeout: options.timeout || 5000
      });
      
      return this.jsonCodec.decode(response.data);
      
    } catch (error) {
      console.error(`❌ Request to ${subject} failed:`, error);
      throw error;
    }
  }

  async getStreamInfo(streamName) {
    if (!this.js) {
      throw new Error('EventBus not connected');
    }
    
    try {
      const info = await this.js.streams.info(streamName);
      return info;
    } catch (error) {
      console.error(`❌ Failed to get stream info for ${streamName}:`, error);
      throw error;
    }
  }

  async getConsumerInfo(streamName, consumerName) {
    if (!this.js) {
      throw new Error('EventBus not connected');
    }
    
    try {
      const info = await this.js.consumers.info(streamName, consumerName);
      return info;
    } catch (error) {
      console.error(`❌ Failed to get consumer info for ${consumerName}:`, error);
      throw error;
    }
  }

  async disconnect() {
    if (this.nc) {
      // Close all subscriptions
      for (const [subject, subscription] of this.subscribers) {
        subscription.destroy();
        console.log(`📤 Unsubscribed from ${subject}`);
      }
      
      this.subscribers.clear();
      
      // Close connection
      await this.nc.close();
      console.log('🔌 Disconnected from NATS');
    }
  }

  // Health check method
  async health() {
    try {
      if (!this.nc || this.nc.closed()) {
        return { status: 'disconnected', error: 'Not connected to NATS' };
      }
      
      // Check stream health
      const streams = await this.js.streams.list();
      const streamHealth = streams.streams.map(stream => ({
        name: stream.config.name,
        messages: stream.state.messages,
        bytes: stream.state.bytes,
        consumers: stream.state.consumer_count
      }));
      
      return {
        status: 'healthy',
        connection: 'connected',
        streams: streamHealth,
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
}

// Singleton instance
const eventBus = new EventBus();

module.exports = eventBus;
