const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const io = require('socket.io-client');

class EndToEndProfiler {
  constructor(options = {}) {
    this.options = {
      backendUrl: options.backendUrl || 'http://localhost:5000',
      frontendUrl: options.frontendUrl || 'http://localhost:3000',
      duration: options.duration || 300, // 5 minutes
      concurrentUsers: options.concurrentUsers || 100,
      ...options
    };
    
    this.startTime = null;
    this.metrics = {
      frontend: {},
      api: {},
      database: {},
      websocket: {},
      system: {}
    };
    
    this.processes = {};
    this.socket = null;
  }

  async startProfiling() {
    console.log('🚀 Starting End-to-End Performance Profiling...');
    this.startTime = performance.now();
    
    // Start system monitoring
    await this.startSystemMonitoring();
    
    // Start backend profiling
    await this.startBackendProfiling();
    
    // Start frontend profiling
    await this.startFrontendProfiling();
    
    console.log('✅ All profiling components started');
  }

  async startSystemMonitoring() {
    console.log('💻 Starting system monitoring...');
    
    try {
      // Start htop-like monitoring
      const htopProcess = spawn('top', ['-b', '-n', '1'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.processes.htop = htopProcess;
      
      // Start iostat for I/O monitoring
      const iostatProcess = spawn('iostat', ['1'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.processes.iostat = iostatProcess;
      
      console.log('✅ System monitoring started');
    } catch (error) {
      console.error('❌ Failed to start system monitoring:', error);
    }
  }

  async startBackendProfiling() {
    console.log('🔧 Starting backend profiling...');
    
    try {
      // Start 0x CPU profiling
      const cpuProfileProcess = spawn('npx', ['0x', '--output', 'profile', '--', 'node', 'src/app.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      this.processes.cpuProfile = cpuProfileProcess;
      
      // Start clinic heap profiling
      const heapProfileProcess = spawn('npx', ['clinic', 'heap', '--output', 'profile', '--', 'node', 'src/app.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      this.processes.heapProfile = heapProfileProcess;
      
      // Start clinic doctor for comprehensive profiling
      const doctorProfileProcess = spawn('npx', ['clinic', 'doctor', '--output', 'profile', '--', 'node', 'src/app.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      this.processes.doctorProfile = doctorProfileProcess;
      
      // Wait for processes to start
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log('✅ Backend profiling started');
    } catch (error) {
      console.error('❌ Failed to start backend profiling:', error);
    }
  }

  async startFrontendProfiling() {
    console.log('🌐 Starting frontend profiling...');
    
    try {
      // Start Lighthouse CI for frontend performance
      const lighthouseProcess = spawn('npx', ['lighthouse', '--output=json', '--output-path=profile/lighthouse-report.json', '--chrome-flags="--headless --no-sandbox"'], {
        cwd: path.join(__dirname, '../../frontend'),
        stdio: 'pipe'
      });
      
      this.processes.lighthouse = lighthouseProcess;
      
      // Start Puppeteer for frontend metrics
      const puppeteerProcess = spawn('node', ['bench/ui-benchmarks.js'], {
        cwd: path.join(__dirname, '../../frontend'),
        stdio: 'pipe'
      });
      
      this.processes.puppeteer = puppeteerProcess;
      
      console.log('✅ Frontend profiling started');
    } catch (error) {
      console.error('❌ Failed to start frontend profiling:', error);
    }
  }

  async runLoadTest() {
    console.log('📊 Running comprehensive load test...');
    
    const testScenarios = [
      { name: 'single_log_creation', endpoint: '/api/v1/logs', method: 'POST' },
      { name: 'bulk_log_creation', endpoint: '/api/v1/logs/bulk', method: 'POST' },
      { name: 'log_search', endpoint: '/api/v1/logs/search', method: 'GET' },
      { name: 'log_retrieval', endpoint: '/api/v1/logs', method: 'GET' }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`  Testing: ${scenario.name}`);
      await this.runScenario(scenario);
    }
    
    // Test WebSocket performance
    await this.testWebSocketPerformance();
    
    console.log('✅ Load testing completed');
  }

  async runScenario(scenario) {
    const { name, endpoint, method } = scenario;
    
    try {
      const startTime = performance.now();
      const requests = [];
      const latencies = [];
      
      // Generate test data
      const testData = this.generateTestData(scenario);
      
      // Run concurrent requests
      const promises = Array.from({ length: this.options.concurrentUsers }, async (_, i) => {
        const requestStart = performance.now();
        
        try {
          const response = await axios({
            method,
            url: `${this.options.backendUrl}${endpoint}`,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            },
            data: method === 'POST' ? testData : undefined,
            params: method === 'GET' ? testData : undefined,
            timeout: 30000
          });
          
          const latency = performance.now() - requestStart;
          latencies.push(latency);
          
          return {
            success: true,
            status: response.status,
            latency,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          const latency = performance.now() - requestStart;
          latencies.push(latency);
          
          return {
            success: false,
            error: error.message,
            latency,
            timestamp: new Date().toISOString()
          };
        }
      });
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      // Calculate metrics
      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      
      this.metrics.api[name] = {
        totalRequests: results.length,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        successRate: (successfulRequests.length / results.length) * 100,
        duration: endTime - startTime,
        throughput: results.length / ((endTime - startTime) / 1000),
        latency: {
          min: Math.min(...latencies),
          max: Math.max(...latencies),
          average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
          p50,
          p95,
          p99
        },
        requests: results
      };
      
      console.log(`    ✅ ${name}: ${successfulRequests.length}/${results.length} successful, p99: ${p99.toFixed(2)}ms`);
      
    } catch (error) {
      console.error(`    ❌ ${name} failed:`, error.message);
    }
  }

  generateTestData(scenario) {
    switch (scenario.name) {
      case 'single_log_creation':
        return {
          agent_id: `test-agent-${Date.now()}`,
          step_id: 1,
          trace_id: `test-trace-${Date.now()}`,
          user_id: 'test-user',
          input_data: { test: 'performance', timestamp: Date.now() },
          output: { result: 'success', timestamp: Date.now() },
          reasoning: 'Performance test reasoning',
          status: 'success'
        };
      
      case 'bulk_log_creation':
        return {
          logs: Array.from({ length: 100 }, (_, i) => ({
            agent_id: `test-agent-${i}-${Date.now()}`,
            step_id: i,
            trace_id: `test-trace-${i}-${Date.now()}`,
            user_id: 'test-user',
            input_data: { test: 'performance', index: i, timestamp: Date.now() },
            output: { result: 'success', index: i, timestamp: Date.now() },
            reasoning: `Performance test reasoning ${i}`,
            status: 'success'
          }))
        };
      
      case 'log_search':
        return {
          agent_id: 'test-agent',
          limit: 100,
          offset: 0
        };
      
      case 'log_retrieval':
        return {
          limit: 100,
          offset: 0
        };
      
      default:
        return {};
    }
  }

  async testWebSocketPerformance() {
    console.log('🔌 Testing WebSocket performance...');
    
    try {
      // Connect to WebSocket
      this.socket = io(this.options.backendUrl, {
        transports: ['websocket'],
        timeout: 10000
      });
      
      const connectionStart = performance.now();
      
      await new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          const connectionTime = performance.now() - connectionStart;
          console.log(`    ✅ WebSocket connected in ${connectionTime.toFixed(2)}ms`);
          resolve();
        });
        
        this.socket.on('connect_error', (error) => {
          reject(error);
        });
        
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
      });
      
      // Test message latency
      const messageLatencies = [];
      const messageCount = 100;
      
      for (let i = 0; i < messageCount; i++) {
        const startTime = performance.now();
        
        await new Promise((resolve) => {
          this.socket.emit('ping', { timestamp: Date.now(), index: i }, (response) => {
            const latency = performance.now() - startTime;
            messageLatencies.push(latency);
            resolve();
          });
          
          setTimeout(resolve, 1000); // Timeout after 1 second
        });
      }
      
      // Calculate WebSocket metrics
      messageLatencies.sort((a, b) => a - b);
      const p50 = messageLatencies[Math.floor(messageLatencies.length * 0.5)];
      const p95 = messageLatencies[Math.floor(messageLatencies.length * 0.95)];
      const p99 = messageLatencies[Math.floor(messageLatencies.length * 0.99)];
      
      this.metrics.websocket = {
        connectionTime: performance.now() - connectionStart,
        messageCount,
        latency: {
          min: Math.min(...messageLatencies),
          max: Math.max(...messageLatencies),
          average: messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length,
          p50,
          p95,
          p99
        }
      };
      
      console.log(`    ✅ WebSocket: ${messageCount} messages, p99: ${p99.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('    ❌ WebSocket test failed:', error.message);
    }
  }

  async collectSystemMetrics() {
    console.log('📊 Collecting system metrics...');
    
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.system = {
        timestamp: new Date().toISOString(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          total: cpuUsage.user + cpuUsage.system
        },
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch
        },
        duration: performance.now() - this.startTime
      };
      
      console.log('✅ System metrics collected');
    } catch (error) {
      console.error('❌ Failed to collect system metrics:', error);
    }
  }

  async generateFlamegraph() {
    console.log('🔥 Generating flamegraph...');
    
    try {
      // Use 0x to generate flamegraph
      const flamegraphProcess = spawn('npx', ['0x', '--output', 'profile', '--flamegraph'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      await new Promise((resolve, reject) => {
        flamegraphProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Flamegraph generation failed with code ${code}`));
          }
        });
      });
      
      console.log('✅ Flamegraph generated');
    } catch (error) {
      console.error('❌ Failed to generate flamegraph:', error);
    }
  }

  async generateReport() {
    console.log('📋 Generating comprehensive performance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: performance.now() - this.startTime,
      summary: {
        overall: 'PASS',
        criticalIssues: [],
        recommendations: []
      },
      metrics: this.metrics,
      bottlenecks: [],
      slas: {}
    };
    
    // Analyze bottlenecks
    const bottlenecks = [];
    
    // API latency analysis
    Object.entries(this.metrics.api).forEach(([endpoint, data]) => {
      if (data.latency.p99 > 200) {
        bottlenecks.push(`High p99 latency for ${endpoint}: ${data.latency.p99.toFixed(2)}ms`);
        report.summary.overall = 'FAIL';
      }
      
      if (data.successRate < 95) {
        bottlenecks.push(`Low success rate for ${endpoint}: ${data.successRate.toFixed(2)}%`);
        report.summary.overall = 'FAIL';
      }
    });
    
    // WebSocket analysis
    if (this.metrics.websocket) {
      if (this.metrics.websocket.latency.p99 > 50) {
        bottlenecks.push(`High WebSocket p99 latency: ${this.metrics.websocket.latency.p99.toFixed(2)}ms`);
        report.summary.overall = 'FAIL';
      }
    }
    
    // Memory analysis
    if (this.metrics.system.memory.rss > 512 * 1024 * 1024) { // 512MB
      bottlenecks.push(`High memory usage: ${(this.metrics.system.memory.rss / 1024 / 1024).toFixed(2)}MB`);
      report.summary.overall = 'WARN';
    }
    
    report.bottlenecks = bottlenecks;
    
    // SLA compliance
    report.slas = {
      apiLatency: {
        target: 'p99 < 200ms',
        actual: Math.max(...Object.values(this.metrics.api).map(r => r.latency.p99)),
        status: Math.max(...Object.values(this.metrics.api).map(r => r.latency.p99)) < 200 ? 'PASS' : 'FAIL'
      },
      websocketLatency: {
        target: 'p99 < 50ms',
        actual: this.metrics.websocket?.latency.p99 || 0,
        status: (this.metrics.websocket?.latency.p99 || 0) < 50 ? 'PASS' : 'FAIL'
      },
      memoryUsage: {
        target: '< 512MB',
        actual: `${(this.metrics.system.memory.rss / 1024 / 1024).toFixed(2)}MB`,
        status: this.metrics.system.memory.rss < 512 * 1024 * 1024 ? 'PASS' : 'FAIL'
      }
    };
    
    // Generate recommendations
    if (bottlenecks.length > 0) {
      report.summary.recommendations = [
        'Consider implementing connection pooling optimization',
        'Review database indexes for slow queries',
        'Implement caching for frequently accessed data',
        'Consider horizontal scaling for high-traffic endpoints',
        'Optimize WebSocket message handling',
        'Review memory allocation patterns'
      ];
    }
    
    return report;
  }

  async stopProfiling() {
    console.log('🛑 Stopping profiling...');
    
    // Stop all profiling processes
    for (const [name, process] of Object.entries(this.processes)) {
      if (process && !process.killed) {
        process.kill('SIGTERM');
        console.log(`✅ Stopped ${name} profiling`);
      }
    }
    
    // Disconnect WebSocket
    if (this.socket) {
      this.socket.disconnect();
      console.log('✅ WebSocket disconnected');
    }
    
    // Wait for processes to clean up
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  async cleanup() {
    console.log('🧹 Cleaning up profiling artifacts...');
    
    try {
      // Clean up temporary files
      const tempFiles = await fs.readdir(__dirname);
      for (const file of tempFiles) {
        if (file.endsWith('.log') || file.endsWith('.tmp')) {
          await fs.unlink(path.join(__dirname, file));
        }
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  async run() {
    try {
      // Start profiling
      await this.startProfiling();
      
      // Run load test
      await this.runLoadTest();
      
      // Collect system metrics
      await this.collectSystemMetrics();
      
      // Generate flamegraph
      await this.generateFlamegraph();
      
      // Generate report
      const report = await this.generateReport();
      
      // Stop profiling
      await this.stopProfiling();
      
      // Save report
      const reportPath = path.join(__dirname, 'profile', 'end-to-end-performance-report.json');
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Cleanup
      await this.cleanup();
      
      console.log('🎉 End-to-end performance profiling completed!');
      console.log(`📊 Report saved to: ${reportPath}`);
      
      if (report.bottlenecks.length > 0) {
        console.log('⚠️  Bottlenecks identified:');
        report.bottlenecks.forEach(bottleneck => console.log('   -', bottleneck));
      }
      
      return report;
      
    } catch (error) {
      console.error('❌ End-to-end profiling failed:', error);
      await this.stopProfiling();
      await this.cleanup();
      throw error;
    }
  }
}

async function main() {
  const profiler = new EndToEndProfiler({
    duration: 300,
    concurrentUsers: 100
  });
  
  try {
    const report = await profiler.run();
    
    console.log('🎉 End-to-end performance profiling completed successfully!');
    console.log(`📊 Overall Status: ${report.summary.overall}`);
    console.log(`🔍 Found ${report.bottlenecks.length} bottlenecks`);
    console.log(`💡 Generated ${report.summary.recommendations.length} recommendations`);
    
  } catch (error) {
    console.error('❌ End-to-end profiling failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = EndToEndProfiler;
