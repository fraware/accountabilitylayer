const mongoose = require('mongoose');
const autocannon = require('autocannon');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// MongoDB connection
let db;

async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/accountability?authSource=admin';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    db = mongoose.connection;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function runAPIBenchmarks() {
  console.log('🚀 Running API Performance Benchmarks...');
  
  const results = {
    singleLog: {},
    bulkLogs: {},
    searchLogs: {},
    realtimeUpdates: {}
  };

  // Test single log creation
  console.log('📝 Testing single log creation...');
  const singleLogResult = await autocannon({
    url: 'http://localhost:5000/api/v1/logs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      agent_id: 'test-agent',
      step_id: 1,
      trace_id: 'test-trace',
      user_id: 'test-user',
      input_data: { test: 'data' },
      output: { result: 'success' },
      reasoning: 'Test reasoning',
      status: 'success'
    }),
    connections: 10,
    duration: 30,
    pipelining: 1
  });
  
  results.singleLog = {
    throughput: {
      total: singleLogResult.requests.total,
      average: singleLogResult.requests.average,
      p50: singleLogResult.latency.p50,
      p95: singleLogResult.latency.p95,
      p99: singleLogResult.latency.p99
    },
    latency: {
      average: singleLogResult.latency.average,
      p50: singleLogResult.latency.p50,
      p95: singleLogResult.latency.p95,
      p99: singleLogResult.latency.p99,
      max: singleLogResult.latency.max
    },
    errors: singleLogResult.errors,
    timeouts: singleLogResult.timeouts
  };

  // Test bulk log creation
  console.log('📦 Testing bulk log creation...');
  const bulkLogsResult = await autocannon({
    url: 'http://localhost:5000/api/v1/logs/bulk',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      logs: Array.from({ length: 100 }, (_, i) => ({
        agent_id: `test-agent-${i}`,
        step_id: i,
        trace_id: `test-trace-${i}`,
        user_id: 'test-user',
        input_data: { test: 'data', index: i },
        output: { result: 'success', index: i },
        reasoning: `Test reasoning ${i}`,
        status: 'success'
      }))
    }),
    connections: 5,
    duration: 30,
    pipelining: 1
  });

  results.bulkLogs = {
    throughput: {
      total: bulkLogsResult.requests.total,
      average: bulkLogsResult.requests.average,
      p50: bulkLogsResult.latency.p50,
      p95: bulkLogsResult.latency.p95,
      p99: bulkLogsResult.latency.p99
    },
    latency: {
      average: bulkLogsResult.latency.average,
      p50: bulkLogsResult.latency.p50,
      p95: bulkLogsResult.latency.p95,
      p99: bulkLogsResult.latency.p99,
      max: bulkLogsResult.latency.max
    },
    errors: bulkLogsResult.errors,
    timeouts: bulkLogsResult.timeouts
  };

  // Test search performance
  console.log('🔍 Testing search performance...');
  const searchResult = await autocannon({
    url: 'http://localhost:5000/api/v1/logs/search?agent_id=test-agent&limit=100',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer test-token'
    },
    connections: 20,
    duration: 30,
    pipelining: 1
  });

  results.searchLogs = {
    throughput: {
      total: searchResult.requests.total,
      average: searchResult.requests.average,
      p50: searchResult.latency.p50,
      p95: searchResult.latency.p95,
      p99: searchResult.latency.p99
    },
    latency: {
      average: searchResult.latency.average,
      p50: searchResult.latency.p50,
      p95: searchResult.latency.p95,
      p99: searchResult.latency.p99,
      max: searchResult.latency.max
    },
    errors: searchResult.errors,
    timeouts: searchResult.timeouts
  };

  return results;
}

async function runDatabaseBenchmarks() {
  console.log('🗄️ Running Database Performance Benchmarks...');
  
  const results = {
    writePerformance: {},
    readPerformance: {},
    indexEfficiency: {},
    connectionPool: {}
  };

  // Test write performance
  console.log('✍️ Testing write performance...');
  const writeStart = performance.now();
  const writeBatch = Array.from({ length: 1000 }, (_, i) => ({
    agent_id: `perf-agent-${i % 10}`,
    step_id: i,
    trace_id: `perf-trace-${i}`,
    user_id: 'perf-user',
    input_data: { test: 'performance', index: i },
    output: { result: 'success', index: i },
    reasoning: `Performance test reasoning ${i}`,
    status: 'success',
    timestamp: new Date(Date.now() - Math.random() * 86400000), // Random timestamp in last 24h
    retention_tier: i % 3 === 0 ? 'hot' : i % 3 === 1 ? 'warm' : 'cold'
  }));

  try {
    const Log = mongoose.model('Log');
    const writeStartTime = performance.now();
    
    // Test ordered vs unordered inserts
    const orderedStart = performance.now();
    await Log.insertMany(writeBatch, { ordered: true });
    const orderedTime = performance.now() - orderedStart;
    
    // Clear and test unordered
    await Log.deleteMany({ agent_id: { $regex: /^perf-agent-/ } });
    
    const unorderedStart = performance.now();
    await Log.insertMany(writeBatch, { ordered: false });
    const unorderedTime = performance.now() - unorderedStart;
    
    results.writePerformance = {
      ordered: {
        time: orderedTime,
        throughput: writeBatch.length / (orderedTime / 1000)
      },
      unordered: {
        time: unorderedTime,
        throughput: writeBatch.length / (unorderedTime / 1000)
      },
      improvement: ((orderedTime - unorderedTime) / orderedTime * 100).toFixed(2) + '%'
    };
  } catch (error) {
    console.error('Write performance test failed:', error);
  }

  // Test read performance with different query patterns
  console.log('📖 Testing read performance...');
  try {
    const Log = mongoose.model('Log');
    
    // Test compound index queries
    const compoundQueryStart = performance.now();
    const compoundResults = await Log.find({
      agent_id: 'perf-agent-1',
      timestamp: { $gte: new Date(Date.now() - 86400000) }
    }).lean().limit(100);
    const compoundQueryTime = performance.now() - compoundQueryStart;
    
    // Test status-based queries
    const statusQueryStart = performance.now();
    const statusResults = await Log.find({
      status: 'success',
      timestamp: { $gte: new Date(Date.now() - 86400000) }
    }).lean().limit(100);
    const statusQueryTime = performance.now() - statusQueryStart;
    
    results.readPerformance = {
      compoundIndex: {
        time: compoundQueryTime,
        results: compoundResults.length
      },
      statusQuery: {
        time: statusQueryTime,
        results: statusResults.length
      }
    };
  } catch (error) {
    console.error('Read performance test failed:', error);
  }

  // Get MongoDB statistics
  console.log('📊 Collecting MongoDB statistics...');
  try {
    const stats = await db.db.admin().command({ serverStatus: 1 });
    const dbStats = await db.db.stats();
    
    results.indexEfficiency = {
      indexHits: stats.indexCounters?.btree?.hits || 0,
      indexMisses: stats.indexCounters?.btree?.misses || 0,
      indexHitRatio: stats.indexCounters?.btree?.hits / (stats.indexCounters?.btree?.hits + stats.indexCounters?.btree?.misses) || 0
    };
    
    results.connectionPool = {
      current: stats.connections?.current || 0,
      available: stats.connections?.available || 0,
      totalCreated: stats.connections?.totalCreated || 0
    };
  } catch (error) {
    console.error('Failed to collect MongoDB stats:', error);
  }

  return results;
}

async function runSystemBenchmarks() {
  console.log('💻 Running System Performance Benchmarks...');
  
  const results = {
    memory: {},
    cpu: {},
    network: {},
    process: {}
  };

  // Memory usage
  const memUsage = process.memoryUsage();
  results.memory = {
    rss: memUsage.rss,
    heapTotal: memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    external: memUsage.external,
    arrayBuffers: memUsage.arrayBuffers
  };

  // Process info
  results.process = {
    uptime: process.uptime(),
    pid: process.pid,
    version: process.version,
    platform: process.platform,
    arch: process.arch
  };

  // CPU usage (basic)
  const startUsage = process.cpuUsage();
  await new Promise(resolve => setTimeout(resolve, 100));
  const endUsage = process.cpuUsage(startUsage);
  
  results.cpu = {
    user: endUsage.user,
    system: endUsage.system,
    total: endUsage.user + endUsage.system
  };

  return results;
}

async function generateReport(apiResults, dbResults, systemResults) {
  console.log('📊 Generating Performance Report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      overall: 'PASS',
      criticalIssues: [],
      recommendations: []
    },
    api: apiResults,
    database: dbResults,
    system: systemResults,
    bottlenecks: [],
    slas: {}
  };

  // Analyze bottlenecks
  const bottlenecks = [];
  
  // API latency analysis
  Object.entries(apiResults).forEach(([endpoint, data]) => {
    if (data.latency.p99 > 200) {
      bottlenecks.push(`High p99 latency for ${endpoint}: ${data.latency.p99}ms`);
      report.summary.overall = 'FAIL';
    }
  });

  // Database performance analysis
  if (dbResults.writePerformance.unordered.throughput < 1000) {
    bottlenecks.push(`Low write throughput: ${dbResults.writePerformance.unordered.throughput.toFixed(2)} ops/s`);
    report.summary.overall = 'FAIL';
  }

  if (dbResults.readPerformance.compoundIndex.time > 100) {
    bottlenecks.push(`Slow compound index queries: ${dbResults.readPerformance.compoundIndex.time.toFixed(2)}ms`);
    report.summary.overall = 'FAIL';
  }

  // Memory analysis
  if (systemResults.memory.rss > 512 * 1024 * 1024) { // 512MB
    bottlenecks.push(`High memory usage: ${(systemResults.memory.rss / 1024 / 1024).toFixed(2)}MB`);
    report.summary.overall = 'WARN';
  }

  report.bottlenecks = bottlenecks;

  // SLA compliance
  report.slas = {
    apiLatency: {
      target: 'p99 < 200ms',
      actual: Math.max(...Object.values(apiResults).map(r => r.latency.p99)),
      status: Math.max(...Object.values(apiResults).map(r => r.latency.p99)) < 200 ? 'PASS' : 'FAIL'
    },
    writeThroughput: {
      target: '> 1000 ops/s',
      actual: dbResults.writePerformance.unordered.throughput,
      status: dbResults.writePerformance.unordered.throughput > 1000 ? 'PASS' : 'FAIL'
    },
    memoryUsage: {
      target: '< 512MB',
      actual: `${(systemResults.memory.rss / 1024 / 1024).toFixed(2)}MB`,
      status: systemResults.memory.rss < 512 * 1024 * 1024 ? 'PASS' : 'FAIL'
    }
  };

  // Generate recommendations
  if (bottlenecks.length > 0) {
    report.summary.recommendations = [
      'Consider implementing connection pooling optimization',
      'Review database indexes for slow queries',
      'Implement caching for frequently accessed data',
      'Consider horizontal scaling for high-traffic endpoints'
    ];
  }

  return report;
}

async function main() {
  try {
    console.log('🚀 Starting Accountability Layer Performance Benchmarks...');
    
    await connectDB();
    
    const apiResults = await runAPIBenchmarks();
    const dbResults = await runDatabaseBenchmarks();
    const systemResults = await runSystemBenchmarks();
    
    const report = await generateReport(apiResults, dbResults, systemResults);
    
    // Save report
    const reportPath = path.join(__dirname, 'performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('✅ Performance benchmarks completed!');
    console.log('📊 Report saved to:', reportPath);
    console.log('📈 Overall Status:', report.summary.overall);
    
    if (report.bottlenecks.length > 0) {
      console.log('⚠️  Bottlenecks identified:');
      report.bottlenecks.forEach(bottleneck => console.log('   -', bottleneck));
    }
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runAPIBenchmarks,
  runDatabaseBenchmarks,
  runSystemBenchmarks,
  generateReport
};
