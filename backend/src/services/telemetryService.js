const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { trace, metrics, context, SpanStatusCode } = require('@opentelemetry/api');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

class TelemetryService {
  constructor() {
    this.sdk = null;
    this.tracer = null;
    this.meter = null;
    this.isInitialized = false;
    this.customMetrics = new Map();
    this.customSpans = new Map();
  }

  async initialize(options = {}) {
    if (this.isInitialized) {
      console.log('Telemetry service already initialized');
      return;
    }

    try {
      const {
        serviceName = 'accountability-backend',
        serviceVersion = '1.0.0',
        environment = process.env.NODE_ENV || 'development',
        otlpEndpoint = process.env.OTLP_ENDPOINT || 'http://localhost:4318',
        enableAutoInstrumentation = true
      } = options;

      // Create resource
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
        [SemanticResourceAttributes.HOST_NAME]: require('os').hostname(),
        [SemanticResourceAttributes.PROCESS_PID]: process.pid
      });

      // Create exporters
      const traceExporter = new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`
      });

      const metricExporter = new OTLPMetricExporter({
        url: `${otlpEndpoint}/v1/metrics`
      });

      // Create SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricExporter,
        instrumentations: enableAutoInstrumentation ? [getNodeAutoInstrumentations()] : []
      });

      // Register instrumentations
      if (enableAutoInstrumentation) {
        registerInstrumentations({
          instrumentations: [getNodeAutoInstrumentations()]
        });
      }

      // Start SDK
      await this.sdk.start();

      // Get tracer and meter
      this.tracer = trace.getTracer(serviceName, serviceVersion);
      this.meter = metrics.getMeter(serviceName, serviceVersion);

      // Create custom metrics
      this.createCustomMetrics();

      this.isInitialized = true;
      console.log('✅ OpenTelemetry initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize OpenTelemetry:', error);
      throw error;
    }
  }

  createCustomMetrics() {
    // Request metrics
    this.customMetrics.set('requests_total', this.meter.createCounter('requests_total', {
      description: 'Total number of requests',
      unit: '1'
    }));

    this.customMetrics.set('request_duration', this.meter.createHistogram('request_duration', {
      description: 'Request duration in milliseconds',
      unit: 'ms',
      boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
    }));

    this.customMetrics.set('requests_active', this.meter.createUpDownCounter('requests_active', {
      description: 'Number of active requests'
    }));

    // Database metrics
    this.customMetrics.set('db_operations_total', this.meter.createCounter('db_operations_total', {
      description: 'Total number of database operations',
      unit: '1'
    }));

    this.customMetrics.set('db_operation_duration', this.meter.createHistogram('db_operation_duration', {
      description: 'Database operation duration in milliseconds',
      unit: 'ms',
      boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
    }));

    // Event bus metrics
    this.customMetrics.set('events_published_total', this.meter.createCounter('events_published_total', {
      description: 'Total number of events published',
      unit: '1'
    }));

    this.customMetrics.set('events_consumed_total', this.meter.createCounter('events_consumed_total', {
      description: 'Total number of events consumed',
      unit: '1'
    }));

    // WebSocket metrics
    this.customMetrics.set('websocket_connections_active', this.meter.createUpDownCounter('websocket_connections_active', {
      description: 'Number of active WebSocket connections'
    }));

    this.customMetrics.set('websocket_messages_total', this.meter.createCounter('websocket_messages_total', {
      description: 'Total number of WebSocket messages sent',
      unit: '1'
    }));

    // Memory metrics
    this.customMetrics.set('memory_usage_bytes', this.meter.createUpDownCounter('memory_usage_bytes', {
      description: 'Memory usage in bytes'
    }));

    // Error metrics
    this.customMetrics.set('errors_total', this.meter.createCounter('errors_total', {
      description: 'Total number of errors',
      unit: '1'
    });
  }

  // Create a span for tracing
  createSpan(name, options = {}) {
    if (!this.isInitialized) {
      return { end: () => {}, setAttributes: () => {}, setStatus: () => {} };
    }

    const span = this.tracer.startSpan(name, options);
    return span;
  }

  // Create a span with automatic context propagation
  async withSpan(name, fn, options = {}) {
    if (!this.isInitialized) {
      return await fn();
    }

    const span = this.tracer.startSpan(name, options);
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Record metrics
  recordMetric(name, value, attributes = {}) {
    if (!this.isInitialized || !this.customMetrics.has(name)) {
      return;
    }

    const metric = this.customMetrics.get(name);
    
    if (metric.constructor.name === 'Counter') {
      metric.add(value, attributes);
    } else if (metric.constructor.name === 'UpDownCounter') {
      metric.add(value, attributes);
    } else if (metric.constructor.name === 'Histogram') {
      metric.record(value, attributes);
    }
  }

  // Increment counter metric
  incrementCounter(name, attributes = {}) {
    this.recordMetric(name, 1, attributes);
  }

  // Record request metrics
  recordRequest(method, path, statusCode, duration, attributes = {}) {
    const baseAttributes = {
      method,
      path,
      status_code: statusCode.toString(),
      ...attributes
    };

    this.incrementCounter('requests_total', baseAttributes);
    this.recordMetric('request_duration', duration, baseAttributes);
    
    if (statusCode >= 400) {
      this.incrementCounter('errors_total', baseAttributes);
    }
  }

  // Record database operation metrics
  recordDatabaseOperation(operation, collection, duration, success, attributes = {}) {
    const baseAttributes = {
      operation,
      collection,
      success: success.toString(),
      ...attributes
    };

    this.incrementCounter('db_operations_total', baseAttributes);
    this.recordMetric('db_operation_duration', duration, baseAttributes);
    
    if (!success) {
      this.incrementCounter('errors_total', baseAttributes);
    }
  }

  // Record event metrics
  recordEventPublished(subject, success, attributes = {}) {
    const baseAttributes = {
      subject,
      success: success.toString(),
      ...attributes
    };

    this.incrementCounter('events_published_total', baseAttributes);
    
    if (!success) {
      this.incrementCounter('errors_total', baseAttributes);
    }
  }

  recordEventConsumed(subject, success, attributes = {}) {
    const baseAttributes = {
      subject,
      success: success.toString(),
      ...attributes
    };

    this.incrementCounter('events_consumed_total', baseAttributes);
    
    if (!success) {
      this.incrementCounter('errors_total', baseAttributes);
    }
  }

  // Record WebSocket metrics
  recordWebSocketConnection(connected, attributes = {}) {
    const value = connected ? 1 : -1;
    this.recordMetric('websocket_connections_active', value, attributes);
  }

  recordWebSocketMessage(sent, attributes = {}) {
    if (sent) {
      this.incrementCounter('websocket_messages_total', attributes);
    }
  }

  // Record memory usage
  recordMemoryUsage() {
    if (!this.isInitialized) return;

    const memUsage = process.memoryUsage();
    
    this.recordMetric('memory_usage_bytes', memUsage.rss, { type: 'rss' });
    this.recordMetric('memory_usage_bytes', memUsage.heapUsed, { type: 'heap_used' });
    this.recordMetric('memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
    this.recordMetric('memory_usage_bytes', memUsage.external, { type: 'external' });
  }

  // Start periodic metrics collection
  startMetricsCollection(intervalMs = 15000) {
    if (!this.isInitialized) return;

    setInterval(() => {
      this.recordMemoryUsage();
    }, intervalMs);

    console.log(`📊 Started metrics collection every ${intervalMs}ms`);
  }

  // Create middleware for Express
  createMiddleware() {
    return (req, res, next) => {
      if (!this.isInitialized) {
        return next();
      }

      const startTime = Date.now();
      const method = req.method;
      const path = req.route?.path || req.path;

      // Create span for the request
      const span = this.createSpan(`${method} ${path}`, {
        attributes: {
          'http.method': method,
          'http.url': req.url,
          'http.route': path,
          'user.id': req.user?.id || 'anonymous',
          'request.id': req.headers['x-request-id'] || 'unknown'
        }
      });

      // Set span in context
      const ctx = trace.setSpan(context.active(), span);

      // Override response methods to capture metrics
      const originalSend = res.send;
      const originalJson = res.json;

      res.send = function(data) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // Record metrics
        this.recordRequest(method, path, statusCode, duration, {
          'user.id': req.user?.id || 'anonymous',
          'request.id': req.headers['x-request-id'] || 'unknown'
        });

        // Set span attributes
        span.setAttributes({
          'http.status_code': statusCode,
          'http.response_size': Buffer.byteLength(data),
          'request.duration_ms': duration
        });

        span.end();
        return originalSend.call(this, data);
      }.bind(this);

      res.json = function(data) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const responseSize = Buffer.byteLength(JSON.stringify(data));
        
        // Record metrics
        this.recordRequest(method, path, statusCode, duration, {
          'user.id': req.user?.id || 'anonymous',
          'request.id': req.headers['x-request-id'] || 'unknown'
        });

        // Set span attributes
        span.setAttributes({
          'http.status_code': statusCode,
          'http.response_size': responseSize,
          'request.duration_ms': duration
        });

        span.end();
        return originalJson.call(this, data);
      }.bind(this);

      // Set request context
      req.telemetryContext = ctx;
      req.telemetrySpan = span;

      next();
    };
  }

  // Get telemetry statistics
  getStats() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'active',
      service: this.tracer.name,
      version: this.tracer.version,
      metrics: Array.from(this.customMetrics.keys()),
      autoInstrumentation: true
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.isInitialized = false;
      console.log('✅ OpenTelemetry shutdown completed');
    }
  }
}

module.exports = TelemetryService;
