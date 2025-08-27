#!/usr/bin/env node

const autocannon = require('autocannon');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class LoadTest {
  constructor(options = {}) {
    this.options = {
      users: options.users || 100,
      duration: options.duration || 300,
      rampUp: options.rampUp || 60,
      target: options.target || 'http://localhost:5000',
      ...options
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      config: this.options,
      scenarios: {},
      summary: {}
    };
  }

  async runScenario(name, config) {
    console.log(`\n🚀 Running ${name} scenario...`);
    
    const result = await autocannon({
      ...config,
      url: `${this.options.target}${config.path}`,
      connections: config.connections || 10,
      duration: config.duration || 30,
      pipelining: config.pipelining || 1,
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
        ...config.headers
      }
    });
    
    this.results.scenarios[name] = {
      requests: result.requests,
      throughput: result.throughput,
      latency: result.latency,
      errors: result.errors,
      timeouts: result.timeouts,
      duration: result.duration
    };
    
    console.log(`   ✅ ${name}: ${result.throughput.total} req/s, p99: ${result.latency.p99}ms`);
    
    return result;
  }

  async runBaselineLoad() {
    console.log('\n📊 Running Baseline Load Test...');
    
    await this.runScenario('Baseline GET Logs', {
      path: '/api/v1/logs',
      method: 'GET',
      connections: 20,
      duration: 60
    });
    
    await this.runScenario('Baseline POST Logs', {
      path: '/api/v1/logs',
      method: 'POST',
      connections: 10,
      duration: 60,
      body: JSON.stringify({
        agent_id: 'load-test-agent',
        step_id: 1,
        input_data: { test: 'load-test' },
        output: { result: 'success' },
        reasoning: 'Load test data'
      })
    });
  }

  async runBurstLoad() {
    console.log('\n💥 Running Burst Load Test...');
    
    await this.runScenario('Burst GET Logs', {
      path: '/api/v1/logs',
      method: 'GET',
      connections: 100,
      duration: 30
    });
    
    await this.runScenario('Burst POST Logs', {
      path: '/api/v1/logs',
      method: 'POST',
      connections: 50,
      duration: 30,
      body: JSON.stringify({
        agent_id: 'burst-test-agent',
        step_id: 1,
        input_data: { test: 'burst-test' },
        output: { result: 'success' },
        reasoning: 'Burst test data'
      })
    });
  }

  async runSearchLoad() {
    console.log('\n🔍 Running Search Load Test...');
    
    const searchQueries = [
      'agent_id=load-test-agent',
      'status=success',
      'timestamp=2024-01-01'
    ];
    
    for (const query of searchQueries) {
      await this.runScenario(`Search: ${query}`, {
        path: `/api/v1/logs/search?${query}`,
        method: 'GET',
        connections: 15,
        duration: 45
      });
    }
  }

  async runConcurrentUsers() {
    console.log('\n👥 Running Concurrent Users Test...');
    
    const userScenarios = [
      { name: 'Light Users', connections: 50, duration: 120 },
      { name: 'Medium Users', connections: 100, duration: 120 },
      { name: 'Heavy Users', connections: 200, duration: 120 }
    ];
    
    for (const scenario of userScenarios) {
      await this.runScenario(`Concurrent ${scenario.name}`, {
        path: '/api/v1/logs',
        method: 'GET',
        connections: scenario.connections,
        duration: scenario.duration
      });
    }
  }

  async runStressTest() {
    console.log('\n🔥 Running Stress Test...');
    
    // Gradually increase load until system breaks
    const stressLevels = [50, 100, 200, 400, 800];
    
    for (const connections of stressLevels) {
      try {
        console.log(`\n   Testing with ${connections} connections...`);
        
        const result = await this.runScenario(`Stress ${connections}`, {
          path: '/api/v1/logs',
          method: 'GET',
          connections,
          duration: 30
        });
        
        // Check if system is still responding
        if (result.errors > result.requests.total * 0.1) {
          console.log(`   ⚠️  System showing stress at ${connections} connections`);
          break;
        }
        
      } catch (error) {
        console.log(`   💥 System failed at ${connections} connections: ${error.message}`);
        break;
      }
    }
  }

  async runWebSocketTest() {
    console.log('\n🔌 Running WebSocket Load Test...');
    
    // This would require a separate WebSocket testing tool
    // For now, we'll simulate WebSocket-like load through HTTP
    await this.runScenario('WebSocket Simulation', {
      path: '/api/v1/logs/stream',
      method: 'GET',
      connections: 25,
      duration: 90,
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
  }

  async generateSummary() {
    console.log('\n📝 Generating Load Test Summary...');
    
    const scenarios = Object.values(this.results.scenarios);
    
    this.results.summary = {
      totalRequests: scenarios.reduce((sum, s) => sum + s.requests.total, 0),
      totalErrors: scenarios.reduce((sum, s) => sum + s.errors, 0),
      averageThroughput: scenarios.reduce((sum, s) => sum + s.throughput.average, 0) / scenarios.length,
      maxLatency: Math.max(...scenarios.map(s => s.latency.p99)),
      errorRate: scenarios.reduce((sum, s) => sum + s.errors, 0) / scenarios.reduce((sum, s) => sum + s.requests.total, 0)
    };
    
    console.log('\n🎯 Load Test Summary:');
    console.log('='.repeat(50));
    console.log(`Total Requests: ${this.results.summary.totalRequests.toLocaleString()}`);
    console.log(`Total Errors: ${this.results.summary.totalErrors.toLocaleString()}`);
    console.log(`Error Rate: ${(this.results.summary.errorRate * 100).toFixed(2)}%`);
    console.log(`Average Throughput: ${this.results.summary.averageThroughput.toFixed(2)} req/s`);
    console.log(`Max P99 Latency: ${this.results.summary.maxLatency}ms`);
  }

  async saveResults() {
    const reportPath = path.join(__dirname, 'load-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log(`\n📊 Load Test Results Saved: ${reportPath}`);
  }

  async run() {
    console.log('🚀 Accountability Layer Load Testing Suite');
    console.log('='.repeat(50));
    console.log(`Target: ${this.options.target}`);
    console.log(`Duration: ${this.options.duration}s`);
    console.log(`Max Users: ${this.options.users}`);
    
    const startTime = performance.now();
    
    try {
      await this.runBaselineLoad();
      await this.runBurstLoad();
      await this.runSearchLoad();
      await this.runConcurrentUsers();
      await this.runStressTest();
      await this.runWebSocketTest();
      
      await this.generateSummary();
      await this.saveResults();
      
      const totalTime = (performance.now() - startTime) / 1000;
      console.log(`\n✅ Load testing completed in ${totalTime.toFixed(2)}s`);
      
    } catch (error) {
      console.error('\n❌ Load testing failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      options[key] = value;
    }
  }
  
  const loadTest = new LoadTest(options);
  await loadTest.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LoadTest;
