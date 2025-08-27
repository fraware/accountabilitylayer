const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class PerformanceProfiler {
  constructor() {
    this.profiles = [];
    this.startTime = null;
  }

  async startProfiling() {
    console.log('🚀 Starting Performance Profiling...');
    this.startTime = performance.now();
    
    // Start CPU profiling
    await this.startCPUProfile();
    
    // Start memory profiling
    await this.startMemoryProfile();
    
    // Start heap profiling
    await this.startHeapProfile();
    
    console.log('✅ Profiling started. Running load test...');
  }

  async startCPUProfile() {
    console.log('🔥 Starting CPU profiling with 0x...');
    
    try {
      // Start 0x profiling
      const profileProcess = spawn('npx', ['0x', '--output', 'profile', '--', 'node', 'src/app.js'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      // Wait for 0x to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('✅ CPU profiling started with 0x');
      
      // Store process for later cleanup
      this.cpuProfileProcess = profileProcess;
      
    } catch (error) {
      console.error('❌ Failed to start CPU profiling:', error);
    }
  }

  async startMemoryProfile() {
    console.log('💾 Starting memory profiling...');
    
    try {
      // Start clinic heap profiler
      const heapProcess = spawn('npx', ['clinic', 'heap', '--output', 'profile', '--', 'node', 'src/app.js'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      // Wait for clinic to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Memory profiling started with clinic');
      
      // Store process for later cleanup
      this.heapProfileProcess = heapProcess;
      
    } catch (error) {
      console.error('❌ Failed to start memory profiling:', error);
    }
  }

  async startHeapProfile() {
    console.log('🗑️ Starting heap profiling...');
    
    try {
      // Start clinic doctor for comprehensive profiling
      const doctorProcess = spawn('npx', ['clinic', 'doctor', '--output', 'profile', '--', 'node', 'src/app.js'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      // Wait for clinic doctor to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Heap profiling started with clinic doctor');
      
      // Store process for later cleanup
      this.doctorProfileProcess = doctorProcess;
      
    } catch (error) {
      console.error('❌ Failed to start heap profiling:', error);
    }
  }

  async runLoadTest() {
    console.log('📊 Running load test for profiling...');
    
    try {
      // Run autocannon load test
      const loadTest = spawn('npx', ['autocannon', 
        '--url', 'http://localhost:5000/api/v1/logs',
        '--method', 'POST',
        '--headers', '{"Content-Type": "application/json", "Authorization": "Bearer test-token"}',
        '--body', JSON.stringify({
          agent_id: 'profile-agent',
          step_id: 1,
          trace_id: 'profile-trace',
          user_id: 'profile-user',
          input_data: { test: 'profiling' },
          output: { result: 'success' },
          reasoning: 'Performance profiling test',
          status: 'success'
        }),
        '--connections', '50',
        '--duration', '60',
        '--pipelining', '1'
      ], {
        stdio: 'pipe'
      });

      // Wait for load test to complete
      await new Promise((resolve, reject) => {
        loadTest.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Load test failed with code ${code}`));
          }
        });
      });

      console.log('✅ Load test completed');
      
    } catch (error) {
      console.error('❌ Load test failed:', error);
    }
  }

  async stopProfiling() {
    console.log('🛑 Stopping profiling...');
    
    // Stop CPU profiling
    if (this.cpuProfileProcess) {
      this.cpuProfileProcess.kill('SIGTERM');
      console.log('✅ CPU profiling stopped');
    }
    
    // Stop memory profiling
    if (this.heapProfileProcess) {
      this.heapProfileProcess.kill('SIGTERM');
      console.log('✅ Memory profiling stopped');
    }
    
    // Stop heap profiling
    if (this.doctorProfileProcess) {
      this.doctorProfileProcess.kill('SIGTERM');
      console.log('✅ Heap profiling stopped');
    }
    
    // Wait for processes to clean up
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  async generateFlamegraph() {
    console.log('🔥 Generating flamegraph...');
    
    try {
      // Use 0x to generate flamegraph
      const flamegraphProcess = spawn('npx', ['0x', '--output', 'profile', '--flamegraph'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      // Wait for flamegraph generation
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

  async collectSystemMetrics() {
    console.log('📊 Collecting system metrics...');
    
    const metrics = {
      timestamp: new Date().toISOString(),
      duration: performance.now() - this.startTime,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime()
    };

    // Save metrics
    const metricsPath = path.join(__dirname, 'profile', 'system-metrics.json');
    await fs.mkdir(path.dirname(metricsPath), { recursive: true });
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
    
    console.log('✅ System metrics collected');
    return metrics;
  }

  async generateReport() {
    console.log('📋 Generating profiling report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: performance.now() - this.startTime,
      profiles: this.profiles,
      recommendations: []
    };

    // Analyze memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.rss > 512 * 1024 * 1024) { // 512MB
      report.recommendations.push('High memory usage detected - consider memory optimization');
    }

    // Analyze CPU usage
    const cpuUsage = process.cpuUsage();
    if (cpuUsage.user + cpuUsage.system > 1000000) { // 1 second
      report.recommendations.push('High CPU usage detected - consider CPU optimization');
    }

    // Save report
    const reportPath = path.join(__dirname, 'profile', 'profiling-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('✅ Profiling report generated');
    return report;
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
}

async function main() {
  const profiler = new PerformanceProfiler();
  
  try {
    // Start profiling
    await profiler.startProfiling();
    
    // Run load test
    await profiler.runLoadTest();
    
    // Stop profiling
    await profiler.stopProfiling();
    
    // Generate flamegraph
    await profiler.generateFlamegraph();
    
    // Collect metrics
    await profiler.collectSystemMetrics();
    
    // Generate report
    const report = await profiler.generateReport();
    
    // Cleanup
    await profiler.cleanup();
    
    console.log('🎉 Performance profiling completed!');
    console.log('📊 Report saved to: profile/profiling-report.json');
    console.log('🔥 Flamegraph saved to: profile/');
    
    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
  } catch (error) {
    console.error('❌ Profiling failed:', error);
    await profiler.cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceProfiler;
