# Accountability Layer

A state-of-the-art accountability and audit logging system built with modern software engineering practices.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Log Worker    │
│   (React)       │◄──►│   (Express)     │◄──►│   (Event Bus)   │
│   + Virtualized │    │   + OpenTelemetry│   │   + Audit Chain │
│   + React Query │    │   + Compression │   │   + Merkle Tree │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Notifier      │    │   NATS          │    │   MongoDB       │
│   (Socket.IO)   │    │   JetStream     │    │   Time-Series   │
│   + Redis       │    │   + Streams     │    │   + TTL Indexes │
│   + Rate Limit  │    │   + DLQ         │    │   + Compression │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Redis         │    │   Prometheus    │    │   Grafana       │
│   (Adapter)     │    │   (Metrics)     │    │   (Dashboards)  │
│   + Rate Limit  │    │   + OTLP        │    │   + Alerts      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Running Benchmarks

```bash
# Comprehensive end-to-end benchmarking (recommended)
cd backend && npm run bench:comprehensive

# MongoDB index analysis
cd backend && npm run bench:mongo

# End-to-end performance profiling
cd backend && npm run bench:e2e

# Traditional backend benchmarks
cd backend && npm run bench

# Frontend performance tests
cd frontend && npm run bench

# Load testing
cd bench
node load-test.js --users 1000 --duration 300

# CPU profiling with flamegraphs
cd backend && npm run profile

# UI performance with Lighthouse
cd frontend && npm run lighthouse
```

**Benchmark Outputs:**
- `comprehensive-benchmark-report.json` - Complete performance analysis
- `comprehensive-benchmark-summary.md` - Human-readable summary with recommendations
- `mongo-index-analysis.json` - MongoDB performance analysis
- `performance-plots.html` - Interactive performance charts
- `profile/` - CPU and memory profiling data with flamegraphs

## Database Schema

### Time-Series Collections

The system uses MongoDB time-series collections for optimal performance:

```javascript
// Log Schema with Time-Series Support
{
  agent_id: String,           // Meta field for time-series
  timestamp: Date,            // Time field for time-series
  step_id: Number,
  trace_id: String,
  user_id: String,
  input_data: Mixed,
  output: Mixed,
  reasoning: String,
  status: String,             // success|failure|anomaly
  reviewed: Boolean,
  review_comments: String,
  metadata: Mixed,
  version: Number,
  retention_tier: String,     // hot|warm|cold
  hash: String,               // Cryptographic hash
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

- **Compound Indexes**: `(agent_id, timestamp)`, `(status, timestamp)` 
- **TTL Indexes**: Automatic data expiration based on retention tier 
- **Text Indexes**: Full-text search on reasoning and comments 
- **Covering Indexes**: Optimized for common query patterns 

## Event Bus Architecture

### NATS JetStream Streams

- **LOGS**: Main log event stream 
- **LOGS_DLQ**: Dead letter queue for failed events 
- **AUDIT**: Audit event stream 
- **RETRY**: Exponential backoff retry mechanism 

### Event Types

```javascript
// Log Creation Event
{
  subject: 'logs.create',
  data: { /* log data */ },
  metadata: { userId, ip, userAgent },
  idempotencyKey: 'uuid',
  timestamp: 'iso-string'
}

// Log Update Event
{
  subject: 'logs.update',
  data: { logId, updates },
  metadata: { userId, ip, userAgent },
  auditTrail: true
}

// Bulk Logs Event
{
  subject: 'logs.bulk',
  data: { logs: [/* array of logs */] },
  metadata: { userId, ip, userAgent, count },
  batchId: 'uuid'
}
```

## Real-time Communication

### Socket.IO with Redis Adapter

- **Horizontal Scaling**: Multiple notifier instances 
- **Room Management**: Dynamic room creation based on filters 
- **Backpressure Handling**: Automatic throttling for large rooms 
- **Connection Tracking**: Real-time connection monitoring 
- **Rate Limiting**: Per-user WebSocket connection limits 

### WebSocket Events

```javascript
// Join room with filters
socket.emit('join-room', {
  room: 'agent-logs',
  filters: { agentId: 'agent-1' },
  userId: 'user-123'
});

// Receive real-time updates
socket.on('log-created', (data) => {
  console.log('New log:', data);
});
```

## Monitoring & Observability

### OpenTelemetry Instrumentation 

- **Distributed Tracing**: End-to-end request tracking
- **Custom Metrics**: Request rates, latencies, database operations
- **Auto-instrumentation**: HTTP, MongoDB, Redis, NATS
- **OTLP Export**: Prometheus and Jaeger integration

### Health Endpoints

- **`/healthz`**: Liveness probe 
- **`/readyz`**: Readiness probe 
- **`/metrics`**: Prometheus metrics 
- **`/telemetry`**: OpenTelemetry status 

### Metrics

- **System Metrics**: CPU, memory, uptime 
- **Application Metrics**: Request rates, latencies, errors 
- **Business Metrics**: Log creation rates, anomaly detection 
- **Custom Metrics**: Event bus throughput, WebSocket connections 

### Dashboards

Access Grafana at `http://localhost:3002` (admin/admin123):

- **System Overview**: Service health and performance 
- **Log Analytics**: Creation rates, query performance 
- **Event Bus**: NATS stream health and throughput 
- **Real-time**: WebSocket connections and notifications 
- **OpenTelemetry**: Distributed traces and metrics 

## Testing

### Test Suite

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
cd frontend
npm run cypress:run

# Performance tests
npm run bench

# Security tests
npm audit
```

## API Documentation

### Endpoints

#### Logs

- `POST /api/v1/logs` - Create single log 
- `POST /api/v1/logs/bulk` - Create multiple logs 
- `GET /api/v1/logs/:agent_id` - Get logs by agent 
- `GET /api/v1/logs/:agent_id/:step_id` - Get specific log 
- `PUT /api/v1/logs/:agent_id/:step_id` - Update log review 
- `GET /api/v1/logs/search` - Search logs with filters 
- `GET /api/v1/logs/summary/:agent_id` - Get log summary 

#### Health

- `GET /healthz` - Health check 
- `GET /readyz` - Readiness check 
- `GET /metrics` - Prometheus metrics 
- `GET /telemetry` - OpenTelemetry status 

### Authentication

All API endpoints (except health checks) require a valid JWT token:

```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:5000/api/v1/logs
```

## Configuration

### Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb://admin:password@localhost:27017/accountability

# NATS
NATS_URL=nats://localhost:4222

# Redis
REDIS_URL=redis://localhost:6379

# OpenTelemetry
OTLP_ENDPOINT=http://localhost:4318

# Service Ports
PORT=5000
NOTIFIER_PORT=3001

# Frontend URLs
FRONTEND_URL=http://localhost:3000

# Security
JWT_SECRET=your-secret-key
RATE_LIMIT_ENABLED=true
COMPRESSION_ENABLED=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Development Guidelines

- Follow the existing code style
- Add comprehensive tests
- Update documentation
- Run performance benchmarks
- Ensure all health checks pass
- Follow security best practices

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- MongoDB for time-series collections
- NATS for reliable event streaming
- Socket.IO for real-time communication
- OpenTelemetry for observability
- Prometheus and Grafana for monitoring
- The open-source community for inspiration

## Support

For questions and support:

- Create an issue on GitHub
- Check the documentation
- Review the performance benchmarks
- Monitor the health endpoints
