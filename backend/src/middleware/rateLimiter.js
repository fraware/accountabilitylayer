const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

class RateLimiterService {
  constructor() {
    this.redisClient = null;
    this.limiters = new Map();
    this.isInitialized = false;
  }

  async initialize(options = {}) {
    try {
      const {
        redisUrl = process.env.REDIS_URL || 'redis://localhost:6379',
        enableRedis = true
      } = options;

      if (enableRedis) {
        this.redisClient = redis.createClient({ url: redisUrl });
        await this.redisClient.connect();
        console.log('✅ Redis connected for rate limiting');
      }

      this.createLimiters();
      this.isInitialized = true;
      console.log('✅ Rate limiter service initialized');

    } catch (error) {
      console.error('❌ Failed to initialize rate limiter:', error);
      // Fallback to in-memory storage
      this.createLimiters();
      this.isInitialized = true;
      console.log('⚠️  Rate limiter initialized with in-memory storage');
    }
  }

  createLimiters() {
    // Global rate limiter
    this.limiters.set('global', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.redisClient ? new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      }) : undefined
    }));

    // Authentication rate limiter
    this.limiters.set('auth', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Limit each IP to 5 auth attempts per windowMs
      message: {
        error: 'Too many authentication attempts',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.redisClient ? new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      }) : undefined
    }));

    // API rate limiter per user
    this.limiters.set('api', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: (req) => {
        // Different limits based on user role
        const user = req.user;
        if (!user) return 100; // Anonymous users
        
        switch (user.role) {
          case 'admin':
            return 10000;
          case 'moderator':
            return 5000;
          case 'analyst':
            return 2000;
          case 'viewer':
            return 1000;
          default:
            return 500;
        }
      },
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
      },
      message: {
        error: 'API rate limit exceeded',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.redisClient ? new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      }) : undefined
    }));

    // Bulk operations rate limiter
    this.limiters.set('bulk', rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: (req) => {
        const user = req.user;
        if (!user) return 1; // Anonymous users limited to 1 bulk operation per hour
        
        switch (user.role) {
          case 'admin':
            return 100;
          case 'moderator':
            return 50;
          case 'analyst':
            return 20;
          case 'viewer':
            return 5;
          default:
            return 10;
        }
      },
      keyGenerator: (req) => {
        return req.user ? `user:${req.user.id}:bulk` : `ip:${req.ip}:bulk`;
      },
      message: {
        error: 'Bulk operation rate limit exceeded',
        retryAfter: '1 hour'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.redisClient ? new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      }) : undefined
    });

    // Search rate limiter
    this.limiters.set('search', rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: (req) => {
        const user = req.user;
        if (!user) return 10; // Anonymous users limited to 10 searches per 5 minutes
        
        switch (user.role) {
          case 'admin':
            return 1000;
          case 'moderator':
            return 500;
          case 'analyst':
            return 200;
          case 'viewer':
            return 100;
          default:
            return 50;
        }
      },
      keyGenerator: (req) => {
        return req.user ? `user:${req.user.id}:search` : `ip:${req.ip}:search`;
      },
      message: {
        error: 'Search rate limit exceeded',
        retryAfter: '5 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.redisClient ? new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      }) : undefined
    });

    // WebSocket connection rate limiter
    this.limiters.set('websocket', rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: (req) => {
        const user = req.user;
        if (!user) return 3; // Anonymous users limited to 3 connections per minute
        
        switch (user.role) {
          case 'admin':
            return 100;
          case 'moderator':
            return 50;
          case 'analyst':
            return 20;
          case 'viewer':
            return 10;
          default:
            return 15;
        }
      },
      keyGenerator: (req) => {
        return req.user ? `user:${req.user.id}:ws` : `ip:${req.ip}:ws`;
      },
      message: {
        error: 'WebSocket connection rate limit exceeded',
        retryAfter: '1 minute'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.redisClient ? new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      }) : undefined
    });
  }

  // Get limiter by name
  getLimiter(name) {
    if (!this.isInitialized) {
      console.warn('Rate limiter not initialized, returning no-op middleware');
      return (req, res, next) => next();
    }

    const limiter = this.limiters.get(name);
    if (!limiter) {
      throw new Error(`Rate limiter '${name}' not found`);
    }

    return limiter;
  }

  // Create custom rate limiter
  createCustomLimiter(options) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: {
        error: 'Rate limit exceeded',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.redisClient ? new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      }) : undefined
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  // Get rate limit statistics
  async getStats() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    const stats = {
      status: 'active',
      limiters: Array.from(this.limiters.keys()),
      redis: this.redisClient ? 'connected' : 'not_connected'
    };

    // Get Redis stats if available
    if (this.redisClient) {
      try {
        const info = await this.redisClient.info('stats');
        stats.redisStats = info;
      } catch (error) {
        stats.redisStats = 'error_retrieving_stats';
      }
    }

    return stats;
  }

  // Reset rate limit for a specific key
  async resetLimit(limiterName, key) {
    if (!this.isInitialized || !this.redisClient) {
      return false;
    }

    try {
      const limiter = this.limiters.get(limiterName);
      if (!limiter) {
        throw new Error(`Limiter '${limiterName}' not found`);
      }

      // Reset the key in Redis
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      return false;
    }
  }

  // Get current usage for a key
  async getCurrentUsage(limiterName, key) {
    if (!this.isInitialized || !this.redisClient) {
      return null;
    }

    try {
      const limiter = this.limiters.get(limiterName);
      if (!limiter) {
        throw new Error(`Limiter '${limiterName}' not found`);
      }

      // Get current count from Redis
      const count = await this.redisClient.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Failed to get current usage:', error);
      return null;
    }
  }

  // Middleware to add rate limit headers
  addRateLimitHeaders() {
    return (req, res, next) => {
      // Add rate limit info to response headers
      res.set('X-RateLimit-Info', 'Rate limiting enabled');
      
      // Add user role info if available
      if (req.user) {
        res.set('X-User-Role', req.user.role);
        res.set('X-User-ID', req.user.id);
      }

      next();
    };
  }

  // Middleware to check if user has exceeded their budget
  checkUserBudget() {
    return (req, res, next) => {
      if (!req.user) {
        return next();
      }

      const user = req.user;
      const currentTime = new Date();
      const startOfDay = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());

      // Check daily budget based on user role
      let dailyBudget;
      switch (user.role) {
        case 'admin':
          dailyBudget = 100000;
          break;
        case 'moderator':
          dailyBudget = 50000;
          break;
        case 'analyst':
          dailyBudget = 20000;
          break;
        case 'viewer':
          dailyBudget = 10000;
          break;
        default:
          dailyBudget = 15000;
      }

      // TODO: Implement daily budget tracking in Redis
      // For now, just pass through
      next();
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.isInitialized = false;
      console.log('✅ Rate limiter service shutdown completed');
    }
  }
}

module.exports = RateLimiterService;
