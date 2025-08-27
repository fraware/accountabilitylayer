# Accountability Layer Performance Benchmarks

This directory contains comprehensive performance benchmarks for the Accountability Layer system.

## Quick Start

```bash
# Backend benchmarks
cd backend && npm run bench

# Frontend benchmarks  
cd frontend && npm run bench

# Generate flamegraphs
cd backend && npm run profile
```

## Benchmark Categories

### 1. Backend Performance (P0)
- **API Latency**: p50/p95/p99 response times
- **Throughput**: Requests per second under load
- **Database Performance**: MongoDB query latency and index efficiency
- **Memory Usage**: RSS and heap usage patterns
- **CPU Profiling**: Flamegraphs and hotspots

### 2. Frontend Performance (P0)
- **Time to Interactive**: React component render times
- **Bundle Analysis**: Code splitting and optimization
- **Memory Leaks**: Component lifecycle memory usage
- **Network Performance**: API call efficiency

### 3. End-to-End Performance
- **Full Request Path**: Frontend → API → MongoDB → WebSocket
- **Real-time Updates**: Socket.IO performance under load
- **Concurrent Users**: System behavior with multiple active sessions

## Current Bottlenecks

*To be identified through benchmarking*

## Performance Targets

- **API Response**: p99 < 200ms
- **Database Queries**: p99 < 100ms  
- **WebSocket Updates**: p99 < 50ms
- **Frontend TTI**: < 2s
- **Memory Usage**: < 512MB per service

## Running Benchmarks

### Backend Benchmarks
```bash
cd backend
npm run bench
```

### Frontend Benchmarks
```bash
cd frontend
npm run bench
```

### Load Testing
```bash
cd bench
node load-test.js --users 1000 --duration 300
```

### Memory Profiling
```bash
cd backend
npm run profile
```

## Interpreting Results

1. **Latency Percentiles**: Focus on p95 and p99 for production readiness
2. **Throughput**: Ensure system can handle expected load with headroom
3. **Memory**: Watch for leaks and excessive usage
4. **CPU**: Identify hotspots for optimization

## Continuous Monitoring

Benchmarks run automatically in CI/CD pipeline and results are published to:
- Grafana dashboards
- Performance regression alerts
- Historical trend analysis
