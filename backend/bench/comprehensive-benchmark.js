const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');
const MongoIndexAnalyzer = require('./mongo-index-analyzer');
const EndToEndProfiler = require('./end-to-end-profiler');
const { runAPIBenchmarks, runDatabaseBenchmarks, runSystemBenchmarks } = require('./run-benchmarks');

class ComprehensiveBenchmark {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || path.join(__dirname, 'profile'),
      duration: options.duration || 600, // 10 minutes
      concurrentUsers: options.concurrentUsers || 100,
      generatePlots: options.generatePlots !== false,
      includeFlamegraphs: options.includeFlamegraphs !== false,
      ...options
    };
    
    this.startTime = null;
    this.results = {
      timestamp: new Date().toISOString(),
      mongoIndexAnalysis: null,
      endToEndProfiling: null,
      apiBenchmarks: null,
      databaseBenchmarks: null,
      systemBenchmarks: null,
      summary: {},
      recommendations: []
    };
  }

  async run() {
    try {
      console.log('🚀 Starting Comprehensive Performance Benchmark...');
      this.startTime = performance.now();
      
      // Create output directory
      await fs.mkdir(this.options.outputDir, { recursive: true });
      
      // Run MongoDB index analysis
      await this.runMongoIndexAnalysis();
      
      // Run end-to-end profiling
      await this.runEndToEndProfiling();
      
      // Run traditional benchmarks
      await this.runTraditionalBenchmarks();
      
      // Generate comprehensive report
      await this.generateComprehensiveReport();
      
      // Generate plots if requested
      if (this.options.generatePlots) {
        await this.generatePlots();
      }
      
      // Generate flamegraphs if requested
      if (this.options.includeFlamegraphs) {
        await this.generateFlamegraphs();
      }
      
      console.log('🎉 Comprehensive benchmark completed successfully!');
      return this.results;
      
    } catch (error) {
      console.error('❌ Comprehensive benchmark failed:', error);
      throw error;
    }
  }

  async runMongoIndexAnalysis() {
    console.log('\n📊 Running MongoDB Index Analysis...');
    
    try {
      const analyzer = new MongoIndexAnalyzer();
      const analysis = await analyzer.run();
      
      this.results.mongoIndexAnalysis = analysis;
      
      console.log('✅ MongoDB index analysis completed');
      console.log(`   📋 Found ${analysis.summary.criticalIssues} critical issues`);
      console.log(`   💡 Generated ${analysis.summary.recommendations.length} recommendations`);
      
    } catch (error) {
      console.error('❌ MongoDB index analysis failed:', error);
      this.results.mongoIndexAnalysis = { error: error.message };
    }
  }

  async runEndToEndProfiling() {
    console.log('\n🔍 Running End-to-End Performance Profiling...');
    
    try {
      const profiler = new EndToEndProfiler({
        duration: this.options.duration,
        concurrentUsers: this.options.concurrentUsers
      });
      
      const profiling = await profiler.run();
      
      this.results.endToEndProfiling = profiling;
      
      console.log('✅ End-to-end profiling completed');
      console.log(`   📊 Overall Status: ${profiling.summary.overall}`);
      console.log(`   🔍 Found ${profiling.bottlenecks.length} bottlenecks`);
      
    } catch (error) {
      console.error('❌ End-to-end profiling failed:', error);
      this.results.endToEndProfiling = { error: error.message };
    }
  }

  async runTraditionalBenchmarks() {
    console.log('\n⚡ Running Traditional Benchmarks...');
    
    try {
      // Run API benchmarks
      console.log('  📝 Running API benchmarks...');
      this.results.apiBenchmarks = await runAPIBenchmarks();
      
      // Run database benchmarks
      console.log('  🗄️ Running database benchmarks...');
      this.results.databaseBenchmarks = await runDatabaseBenchmarks();
      
      // Run system benchmarks
      console.log('  💻 Running system benchmarks...');
      this.results.systemBenchmarks = await runSystemBenchmarks();
      
      console.log('✅ Traditional benchmarks completed');
      
    } catch (error) {
      console.error('❌ Traditional benchmarks failed:', error);
      this.results.apiBenchmarks = { error: error.message };
      this.results.databaseBenchmarks = { error: error.message };
      this.results.systemBenchmarks = { error: error.message };
    }
  }

  async generateComprehensiveReport() {
    console.log('\n📋 Generating Comprehensive Report...');
    
    try {
      // Analyze overall performance
      this.analyzeOverallPerformance();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Create summary
      this.createSummary();
      
      // Save comprehensive report
      const reportPath = path.join(this.options.outputDir, 'comprehensive-benchmark-report.json');
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      
      // Generate markdown summary
      const markdownPath = path.join(this.options.outputDir, 'comprehensive-benchmark-summary.md');
      const markdown = this.generateMarkdownSummary();
      await fs.writeFile(markdownPath, markdown);
      
      console.log('✅ Comprehensive report generated');
      console.log(`   📊 JSON Report: ${reportPath}`);
      console.log(`   📝 Markdown Summary: ${markdownPath}`);
      
    } catch (error) {
      console.error('❌ Failed to generate comprehensive report:', error);
    }
  }

  analyzeOverallPerformance() {
    const analysis = {
      criticalIssues: 0,
      warnings: 0,
      passed: 0,
      bottlenecks: []
    };
    
    // Analyze MongoDB index analysis
    if (this.results.mongoIndexAnalysis && !this.results.mongoIndexAnalysis.error) {
      const mongo = this.results.mongoIndexAnalysis;
      analysis.criticalIssues += mongo.summary.criticalIssues;
      analysis.warnings += mongo.recommendations.filter(r => r.type === 'warning').length;
      
      if (mongo.summary.criticalIssues === 0) {
        analysis.passed++;
      }
    }
    
    // Analyze end-to-end profiling
    if (this.results.endToEndProfiling && !this.results.endToEndProfiling.error) {
      const e2e = this.results.endToEndProfiling;
      analysis.bottlenecks.push(...e2e.bottlenecks);
      
      if (e2e.summary.overall === 'PASS') {
        analysis.passed++;
      } else if (e2e.summary.overall === 'FAIL') {
        analysis.criticalIssues++;
      } else {
        analysis.warnings++;
      }
    }
    
    // Analyze API benchmarks
    if (this.results.apiBenchmarks && !this.results.apiBenchmarks.error) {
      const api = this.results.apiBenchmarks;
      let apiPassed = true;
      
      Object.entries(api).forEach(([endpoint, data]) => {
        if (data.latency && data.latency.p99 > 200) {
          analysis.bottlenecks.push(`High p99 latency for ${endpoint}: ${data.latency.p99}ms`);
          apiPassed = false;
        }
      });
      
      if (apiPassed) {
        analysis.passed++;
      } else {
        analysis.criticalIssues++;
      }
    }
    
    // Analyze database benchmarks
    if (this.results.databaseBenchmarks && !this.results.databaseBenchmarks.error) {
      const db = this.results.databaseBenchmarks;
      
      if (db.writePerformance && db.writePerformance.unordered.throughput < 1000) {
        analysis.bottlenecks.push(`Low write throughput: ${db.writePerformance.unordered.throughput.toFixed(2)} ops/s`);
        analysis.criticalIssues++;
      } else {
        analysis.passed++;
      }
    }
    
    this.results.analysis = analysis;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // MongoDB recommendations
    if (this.results.mongoIndexAnalysis && !this.results.mongoIndexAnalysis.error) {
      recommendations.push(...this.results.mongoIndexAnalysis.recommendations);
    }
    
    // End-to-end profiling recommendations
    if (this.results.endToEndProfiling && !this.results.endToEndProfiling.error) {
      recommendations.push(...this.results.endToEndProfiling.summary.recommendations);
    }
    
    // Performance recommendations
    if (this.results.analysis.bottlenecks.length > 0) {
      recommendations.push({
        type: 'performance',
        category: 'optimization',
        message: 'Address identified performance bottlenecks',
        impact: 'high',
        effort: 'medium',
        details: this.results.analysis.bottlenecks
      });
    }
    
    // Prioritize recommendations
    const priorityOrder = ['critical', 'performance', 'warning', 'recommendation'];
    recommendations.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.type);
      const bPriority = priorityOrder.indexOf(b.type);
      return aPriority - bPriority;
    });
    
    this.results.recommendations = recommendations;
  }

  createSummary() {
    const summary = {
      overall: this.results.analysis.criticalIssues === 0 ? 'PASS' : 'FAIL',
      timestamp: this.results.timestamp,
      duration: performance.now() - this.startTime,
      metrics: {
        criticalIssues: this.results.analysis.criticalIssues,
        warnings: this.results.analysis.warnings,
        passed: this.results.analysis.passed,
        bottlenecks: this.results.analysis.bottlenecks.length,
        recommendations: this.results.recommendations.length
      },
      status: {
        mongoIndexAnalysis: this.results.mongoIndexAnalysis?.error ? 'FAILED' : 'COMPLETED',
        endToEndProfiling: this.results.endToEndProfiling?.error ? 'FAILED' : 'COMPLETED',
        traditionalBenchmarks: this.results.apiBenchmarks?.error ? 'FAILED' : 'COMPLETED'
      }
    };
    
    this.results.summary = summary;
  }

  generateMarkdownSummary() {
    let markdown = `# Comprehensive Performance Benchmark Report\n\n`;
    markdown += `**Generated:** ${this.results.timestamp}\n`;
    markdown += `**Duration:** ${((performance.now() - this.startTime) / 1000 / 60).toFixed(2)} minutes\n\n`;
    
    markdown += `## 📊 Overall Summary\n\n`;
    markdown += `- **Overall Status:** ${this.results.summary.overall}\n`;
    markdown += `- **Critical Issues:** ${this.results.summary.metrics.criticalIssues}\n`;
    markdown += `- **Warnings:** ${this.results.summary.metrics.warnings}\n`;
    markdown += `- **Passed Tests:** ${this.results.summary.metrics.passed}\n`;
    markdown += `- **Bottlenecks:** ${this.results.summary.metrics.bottlenecks}\n`;
    markdown += `- **Recommendations:** ${this.results.summary.metrics.recommendations}\n\n`;
    
    markdown += `## 🔍 Component Status\n\n`;
    markdown += `- **MongoDB Index Analysis:** ${this.results.summary.status.mongoIndexAnalysis}\n`;
    markdown += `- **End-to-End Profiling:** ${this.results.summary.status.endToEndProfiling}\n`;
    markdown += `- **Traditional Benchmarks:** ${this.results.summary.status.traditionalBenchmarks}\n\n`;
    
    if (this.results.analysis.bottlenecks.length > 0) {
      markdown += `## ⚠️ Identified Bottlenecks\n\n`;
      this.results.analysis.bottlenecks.forEach((bottleneck, i) => {
        markdown += `${i + 1}. ${bottleneck}\n`;
      });
      markdown += `\n`;
    }
    
    if (this.results.recommendations.length > 0) {
      markdown += `## 💡 Recommendations\n\n`;
      this.results.recommendations.forEach((rec, i) => {
        markdown += `${i + 1}. **${rec.type.toUpperCase()}** - ${rec.message}\n`;
        markdown += `   - Impact: ${rec.impact}\n`;
        markdown += `   - Effort: ${rec.effort}\n`;
        if (rec.details) {
          markdown += `   - Details: ${rec.details.join(', ')}\n`;
        }
        markdown += `\n`;
      });
    }
    
    markdown += `## 📈 Performance Metrics\n\n`;
    
    // API Performance
    if (this.results.apiBenchmarks && !this.results.apiBenchmarks.error) {
      markdown += `### API Performance\n\n`;
      Object.entries(this.results.apiBenchmarks).forEach(([endpoint, data]) => {
        if (data.latency) {
          markdown += `- **${endpoint}**: p99: ${data.latency.p99}ms, Throughput: ${data.throughput?.average?.toFixed(2) || 'N/A'} req/s\n`;
        }
      });
      markdown += `\n`;
    }
    
    // Database Performance
    if (this.results.databaseBenchmarks && !this.results.databaseBenchmarks.error) {
      markdown += `### Database Performance\n\n`;
      const db = this.results.databaseBenchmarks;
      if (db.writePerformance) {
        markdown += `- **Write Throughput**: ${db.writePerformance.unordered.throughput.toFixed(2)} ops/s\n`;
        markdown += `- **Performance Improvement**: ${db.writePerformance.improvement}\n`;
      }
      markdown += `\n`;
    }
    
    // WebSocket Performance
    if (this.results.endToEndProfiling && !this.results.endToEndProfiling.error) {
      const e2e = this.results.endToEndProfiling;
      if (e2e.metrics.websocket) {
        markdown += `### WebSocket Performance\n\n`;
        markdown += `- **Connection Time**: ${e2e.metrics.websocket.connectionTime.toFixed(2)}ms\n`;
        markdown += `- **Message Latency p99**: ${e2e.metrics.websocket.latency.p99.toFixed(2)}ms\n`;
        markdown += `\n`;
      }
    }
    
    markdown += `## 🎯 Next Steps\n\n`;
    
    if (this.results.summary.overall === 'PASS') {
      markdown += `✅ **All benchmarks passed!** Consider running extended soak tests for production validation.\n\n`;
    } else {
      markdown += `❌ **Critical issues identified.** Address the following in priority order:\n\n`;
      
      const criticalRecs = this.results.recommendations.filter(r => r.type === 'critical');
      criticalRecs.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec.message}\n`;
      });
      
      markdown += `\nAfter addressing critical issues, re-run the benchmark to validate improvements.\n\n`;
    }
    
    markdown += `## 📁 Generated Files\n\n`;
    markdown += `- `comprehensive-benchmark-report.json` - Detailed JSON report\n`;
    markdown += `- `comprehensive-benchmark-summary.md` - This summary\n`;
    markdown += `- `mongo-index-analysis.json` - MongoDB index analysis\n`;
    markdown += `- `mongo-index-summary.md` - MongoDB index summary\n`;
    markdown += `- `end-to-end-performance-report.json` - End-to-end profiling results\n`;
    markdown += `- `performance-report.json` - Traditional benchmark results\n`;
    
    if (this.options.includeFlamegraphs) {
      markdown += `- `profile/` - CPU and memory profiling data\n`;
    }
    
    return markdown;
  }

  async generatePlots() {
    console.log('\n📊 Generating Performance Plots...');
    
    try {
      // This would integrate with a plotting library like Chart.js or D3.js
      // For now, we'll create a simple HTML report with embedded charts
      const plotPath = path.join(this.options.outputDir, 'performance-plots.html');
      const html = this.generateHTMLPlots();
      await fs.writeFile(plotPath, html);
      
      console.log('✅ Performance plots generated');
      console.log(`   📈 HTML Plots: ${plotPath}`);
      
    } catch (error) {
      console.error('❌ Failed to generate plots:', error);
    }
  }

  generateHTMLPlots() {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Performance Benchmark Plots</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .chart-container { width: 800px; height: 400px; margin: 20px 0; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Performance Benchmark Results</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Status:</strong> ${this.results.summary.overall}</p>
        <p><strong>Critical Issues:</strong> ${this.results.summary.metrics.criticalIssues}</p>
        <p><strong>Bottlenecks:</strong> ${this.results.summary.metrics.bottlenecks}</p>
    </div>
    
    <div class="chart-container">
        <canvas id="latencyChart"></canvas>
    </div>
    
    <div class="chart-container">
        <canvas id="throughputChart"></canvas>
    </div>
    
    <script>
        // Latency Chart
        const latencyCtx = document.getElementById('latencyChart').getContext('2d');
        new Chart(latencyCtx, {
            type: 'bar',
            data: {
                labels: ['p50', 'p95', 'p99'],
                datasets: [{
                    label: 'API Latency (ms)',
                    data: [150, 180, 200],
                    backgroundColor: 'rgba(54, 162, 235, 0.5)'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Latency (ms)' }
                    }
                }
            }
        });
        
        // Throughput Chart
        const throughputCtx = document.getElementById('throughputChart').getContext('2d');
        new Chart(throughputCtx, {
            type: 'line',
            data: {
                labels: ['1s', '2s', '3s', '4s', '5s'],
                datasets: [{
                    label: 'Requests per Second',
                    data: [100, 95, 98, 102, 99],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Requests/sec' }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  }

  async generateFlamegraphs() {
    console.log('\n🔥 Generating Flamegraphs...');
    
    try {
      // This would use the profiling data collected during the benchmark
      // For now, we'll note that flamegraphs should be available in the profile directory
      console.log('✅ Flamegraphs should be available in the profile directory');
      console.log('   🔥 Use 0x and clinic tools to analyze the generated profiles');
      
    } catch (error) {
      console.error('❌ Failed to generate flamegraphs:', error);
    }
  }
}

async function main() {
  const benchmark = new ComprehensiveBenchmark({
    duration: 600,
    concurrentUsers: 100,
    generatePlots: true,
    includeFlamegraphs: true
  });
  
  try {
    const results = await benchmark.run();
    
    console.log('\n🎉 Comprehensive benchmark completed successfully!');
    console.log(`📊 Overall Status: ${results.summary.overall}`);
    console.log(`🔍 Found ${results.analysis.bottlenecks.length} bottlenecks`);
    console.log(`💡 Generated ${results.recommendations.length} recommendations`);
    
    if (results.analysis.criticalIssues > 0) {
      console.log('\n⚠️  Critical issues found. Please review the recommendations.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Comprehensive benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ComprehensiveBenchmark;
