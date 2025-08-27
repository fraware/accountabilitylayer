#!/usr/bin/env node

const autocannon = require('autocannon');
const mongoose = require('mongoose');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// MongoDB connection
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountability';

// Benchmark configuration
const config = {
  url: 'http://localhost:5000',
  connections: 10,
  duration: 30,
  pipelining: 1,
  timeout: 10
};

// Performance metrics storage
const metrics = {
  timestamp: new Date().toISOString(),
  api: {},
  database: {},
  system: {}
};

async function connectDB() {
  try {
    await mongoose.connect(dbUri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function runAPIBenchmarks() {
  console.log('\n🚀 Running API Performance Benchmarks...');
  
  const endpoints = [
    { path: '/api/v1/logs', method: 'GET', name: 'GET Logs' },
    { path: '/api/v1/logs', method: 'POST', name: 'POST Logs' },
    { path: '/api/v1/logs/search', method: 'GET', name: 'Search Logs' }
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📊 Testing ${endpoint.name}...`);
    
    const result = await autocannon({
      ...config,
      url: `${config.url}${endpoint.path}`,
      method: endpoint.method,
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: endpoint.method === 'POST' ? JSON.stringify({
        agent_id: 'benchmark-agent',
        step_id: 1,
        input_data: { test: 'data' },
        output: { result: 'success' },
        reasoning: 'Benchmark test'
      }) : undefined
    });

    metrics.api[endpoint.name] = {
      requests: result.requests,
      throughput: result.throughput,
      latency: {
        p50: result.latency.p50,
        p90: result.latency.p90,
        p99: result.latency.p99
      },
      errors: result.errors,
      timeouts: result.timeouts
    };

    console.log(`   ✅ ${endpoint.name}: ${result.throughput.total} req/s, p99: ${result.latency.p99}ms`);
  }
}

async function runDatabaseBenchmarks() {
  console.log('\n🗄️  Running Database Performance Benchmarks...');
  
  const Log = mongoose.model('Log');
  
  // Test different query patterns
  const queries = [
    {
      name: 'Time Range Query',
      query: { timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      options: { lean: true }
    },
    {
      name: 'Agent Filter Query',
      query: { agent_id: 'benchmark-agent' },
      options: { lean: true }
    },
    {
      name: 'Compound Query',
      query: { 
        agent_id: 'benchmark-agent',
        status: 'success',
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      options: { lean: true }
    }
  ];

  for (const queryTest of queries) {
    console.log(`\n📊 Testing ${queryTest.name}...`);
    
    const start = performance.now();
    const results = await Log.find(queryTest.query, null, queryTest.options).limit(1000);
    const end = performance.now();
    
    const duration = end - start;
    const count = results.length;
    
    metrics.database[queryTest.name] = {
      duration,
      resultCount: count,
      query: queryTest.query
    };
    
    console.log(`   ✅ ${queryTest.name}: ${duration.toFixed(2)}ms, ${count} results`);
  }

  // Test index efficiency
  console.log('\n📊 Testing Index Efficiency...');
  const explainResult = await Log.find({ agent_id: 'benchmark-agent' }).explain('executionStats');
  
  metrics.database.indexEfficiency = {
    totalDocsExamined: explainResult.executionStats.totalDocsExamined,
    totalKeysExamined: explainResult.executionStats.totalKeysExamined,
    executionTimeMillis: explainResult.executionStats.executionTimeMillis,
    winningPlan: explainResult.queryPlanner.winningPlan
  };
  
  console.log(`   ✅ Index Efficiency: ${explainResult.executionStats.executionTimeMillis}ms, ${explainResult.executionStats.totalDocsExamined} docs examined`);
}

async function runSystemBenchmarks() {
  console.log('\n💻 Running System Resource Benchmarks...');
  
  const startMemory = process.memoryUsage();
  const startTime = performance.now();
  
  // Simulate some load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const endMemory = process.memoryUsage();
  const endTime = performance.now();
  
  metrics.system = {
    memory: {
      start: {
        rss: startMemory.rss,
        heapUsed: startMemory.heapUsed,
        heapTotal: startMemory.heapTotal,
        external: startMemory.external
      },
      end: {
        rss: endMemory.rss,
        heapUsed: endMemory.heapUsed,
        heapTotal: endMemory.heapTotal,
        external: endMemory.external
      },
      delta: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed
      }
    },
    duration: endTime - startTime
  };
  
  console.log(`   ✅ Memory Usage: RSS ${(endMemory.rss / 1024 / 1024).toFixed(2)}MB, Heap ${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
}

async function generateReport() {
  console.log('\n📝 Generating Performance Report...');
  
  const reportPath = path.join(__dirname, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));
  
  console.log(`\n📊 Performance Report Generated: ${reportPath}`);
  
  // Summary
  console.log('\n🎯 Performance Summary:');
  console.log('='.repeat(50));
  
  Object.entries(metrics.api).forEach(([name, data]) => {
    console.log(`${name}:`);
    console.log(`  Throughput: ${data.throughput.total} req/s`);
    console.log(`  P99 Latency: ${data.latency.p99}ms`);
    console.log(`  Errors: ${data.errors}`);
  });
  
  console.log('\nDatabase Performance:');
  Object.entries(metrics.database).forEach(([name, data]) => {
    if (typeof data.duration === 'number') {
      console.log(`  ${name}: ${data.duration.toFixed(2)}ms`);
    }
  });
  
  const memoryDelta = metrics.system.memory.delta;
  console.log(`\nMemory Delta: RSS ${(memoryDelta.rss / 1024 / 1024).toFixed(2)}MB, Heap ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
}

async function main() {
  console.log('🔍 Accountability Layer Performance Benchmarks');
  console.log('='.repeat(50));
  
  try {
    await connectDB();
    await runAPIBenchmarks();
    await runDatabaseBenchmarks();
    await runSystemBenchmarks();
    await generateReport();
    
    console.log('\n✅ All benchmarks completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { runAPIBenchmarks, runDatabaseBenchmarks, runSystemBenchmarks };
