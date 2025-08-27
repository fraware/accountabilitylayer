const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class UIBenchmark {
  constructor() {
    this.browser = null;
    this.page = null;
    this.metrics = {};
    this.startTime = null;
  }

  async init() {
    console.log('🚀 Initializing UI Performance Benchmark...');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Enable performance monitoring
    await this.page.setCacheEnabled(false);
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Listen to console messages
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser Error:', msg.text());
      }
    });

    console.log('✅ Browser initialized');
  }

  async measureNavigation() {
    console.log('🧭 Measuring navigation performance...');
    
    const navigationMetrics = {};
    
    // Measure initial page load
    const startTime = performance.now();
    
    await this.page.goto('http://localhost:3000', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    const loadTime = performance.now() - startTime;
    
    // Get navigation timing
    const navigationTiming = await this.page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
        loadComplete: timing.loadEventEnd - timing.loadEventStart,
        domInteractive: timing.domInteractive - timing.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    navigationMetrics.loadTime = loadTime;
    navigationMetrics.navigationTiming = navigationTiming;
    
    // Measure time to interactive
    const tti = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        let lastTime = performance.now();
        const checkInteractive = () => {
          const currentTime = performance.now();
          if (currentTime - lastTime > 50) { // 50ms threshold
            resolve(currentTime);
          } else {
            lastTime = currentTime;
            requestIdleCallback(checkInteractive);
          }
        };
        checkInteractive();
      });
    });
    
    navigationMetrics.timeToInteractive = tti;
    
    this.metrics.navigation = navigationMetrics;
    console.log('✅ Navigation metrics collected');
  }

  async measureRendering() {
    console.log('🎨 Measuring rendering performance...');
    
    const renderingMetrics = {};
    
    // Measure component render times
    const renderTimes = await this.page.evaluate(() => {
      const measures = [];
      
      // Measure React component render times
      if (window.React && window.ReactDOM) {
        const originalRender = window.ReactDOM.render;
        window.ReactDOM.render = function(...args) {
          const start = performance.now();
          const result = originalRender.apply(this, args);
          const end = performance.now();
          measures.push({
            type: 'react-render',
            duration: end - start
          });
          return result;
        };
      }
      
      // Measure DOM updates
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'measure') {
            measures.push({
              type: 'dom-update',
              name: entry.name,
              duration: entry.duration
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['measure'] });
      
      return measures;
    });
    
    renderingMetrics.renderTimes = renderTimes;
    
    // Measure paint performance
    const paintMetrics = await this.page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      return paintEntries.map(entry => ({
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration
      }));
    });
    
    renderingMetrics.paintMetrics = paintMetrics;
    
    // Measure layout performance
    const layoutMetrics = await this.page.evaluate(() => {
      const layoutEntries = performance.getEntriesByType('layout-shift');
      return layoutEntries.map(entry => ({
        value: entry.value,
        sources: entry.sources
      }));
    });
    
    renderingMetrics.layoutMetrics = layoutMetrics;
    
    this.metrics.rendering = renderingMetrics;
    console.log('✅ Rendering metrics collected');
  }

  async measureMemory() {
    console.log('💾 Measuring memory usage...');
    
    const memoryMetrics = {};
    
    // Get memory info if available
    const memoryInfo = await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    memoryMetrics.memoryInfo = memoryInfo;
    
    // Measure memory usage over time
    const memoryOverTime = [];
    for (let i = 0; i < 10; i++) {
      await this.page.waitForTimeout(1000);
      
      const currentMemory = await this.page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return null;
      });
      
      if (currentMemory !== null) {
        memoryOverTime.push({
          timestamp: Date.now(),
          memory: currentMemory
        });
      }
    }
    
    memoryMetrics.memoryOverTime = memoryOverTime;
    
    // Check for memory leaks
    if (memoryOverTime.length > 1) {
      const first = memoryOverTime[0].memory;
      const last = memoryOverTime[memoryOverTime.length - 1].memory;
      const increase = ((last - first) / first) * 100;
      
      memoryMetrics.memoryLeak = {
        increase: increase,
        isLeaking: increase > 10 // 10% increase threshold
      };
    }
    
    this.metrics.memory = memoryMetrics;
    console.log('✅ Memory metrics collected');
  }

  async measureBundleSize() {
    console.log('📦 Measuring bundle size...');
    
    const bundleMetrics = {};
    
    // Get resource timing for JS bundles
    const resourceTiming = await this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(r => r.name.endsWith('.js'));
      
      return jsResources.map(r => ({
        name: r.name,
        size: r.transferSize || r.encodedBodySize || 0,
        duration: r.duration,
        startTime: r.startTime
      }));
    });
    
    bundleMetrics.resourceTiming = resourceTiming;
    
    // Calculate total bundle size
    const totalSize = resourceTiming.reduce((sum, r) => sum + r.size, 0);
    bundleMetrics.totalSize = totalSize;
    bundleMetrics.totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    // Check for large bundles
    const largeBundles = resourceTiming.filter(r => r.size > 1024 * 1024); // > 1MB
    bundleMetrics.largeBundles = largeBundles;
    
    this.metrics.bundle = bundleMetrics;
    console.log('✅ Bundle metrics collected');
  }

  async runLoadTest() {
    console.log('⚡ Running load test...');
    
    const loadMetrics = {};
    
    // Simulate user interactions
    const interactions = [
      { action: 'click', selector: 'button[data-testid="login"]', wait: 1000 },
      { action: 'type', selector: 'input[name="username"]', text: 'testuser', wait: 500 },
      { action: 'type', selector: 'input[name="password"]', text: 'testpass', wait: 500 },
      { action: 'click', selector: 'button[type="submit"]', wait: 2000 },
      { action: 'click', selector: 'button[data-testid="logs-tab"]', wait: 1000 },
      { action: 'scroll', selector: '.logs-container', wait: 1000 },
      { action: 'click', selector: 'button[data-testid="filter"]', wait: 1000 }
    ];
    
    const interactionTimes = [];
    
    for (const interaction of interactions) {
      try {
        const startTime = performance.now();
        
        switch (interaction.action) {
          case 'click':
            await this.page.click(interaction.selector);
            break;
          case 'type':
            await this.page.type(interaction.selector, interaction.text);
            break;
          case 'scroll':
            await this.page.evaluate((selector) => {
              const element = document.querySelector(selector);
              if (element) element.scrollTop = element.scrollHeight;
            }, interaction.selector);
            break;
        }
        
        await this.page.waitForTimeout(interaction.wait);
        
        const endTime = performance.now();
        interactionTimes.push({
          action: interaction.action,
          selector: interaction.selector,
          duration: endTime - startTime
        });
        
      } catch (error) {
        console.warn(`Interaction failed: ${interaction.action} on ${interaction.selector}`);
      }
    }
    
    loadMetrics.interactionTimes = interactionTimes;
    loadMetrics.averageInteractionTime = interactionTimes.reduce((sum, i) => sum + i.duration, 0) / interactionTimes.length;
    
    this.metrics.loadTest = loadMetrics;
    console.log('✅ Load test completed');
  }

  async generateReport() {
    console.log('📋 Generating UI performance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: performance.now() - this.startTime,
      metrics: this.metrics,
      summary: {
        overall: 'PASS',
        criticalIssues: [],
        recommendations: []
      },
      slas: {}
    };
    
    // Analyze navigation performance
    if (this.metrics.navigation) {
      const nav = this.metrics.navigation;
      
      if (nav.loadTime > 3000) {
        report.summary.criticalIssues.push(`Slow page load: ${nav.loadTime.toFixed(2)}ms`);
        report.summary.overall = 'FAIL';
      }
      
      if (nav.timeToInteractive > 5000) {
        report.summary.criticalIssues.push(`Slow time to interactive: ${nav.timeToInteractive.toFixed(2)}ms`);
        report.summary.overall = 'FAIL';
      }
      
      report.slas.navigation = {
        loadTime: { target: '< 3s', actual: `${nav.loadTime.toFixed(2)}ms`, status: nav.loadTime < 3000 ? 'PASS' : 'FAIL' },
        timeToInteractive: { target: '< 5s', actual: `${nav.timeToInteractive.toFixed(2)}ms`, status: nav.timeToInteractive < 5000 ? 'PASS' : 'FAIL' }
      };
    }
    
    // Analyze bundle size
    if (this.metrics.bundle) {
      const bundle = this.metrics.bundle;
      
      if (bundle.totalSize > 5 * 1024 * 1024) { // 5MB
        report.summary.criticalIssues.push(`Large bundle size: ${bundle.totalSizeMB}MB`);
        report.summary.overall = 'FAIL';
      }
      
      report.slas.bundleSize = {
        target: '< 5MB',
        actual: `${bundle.totalSizeMB}MB`,
        status: bundle.totalSize < 5 * 1024 * 1024 ? 'PASS' : 'FAIL'
      };
    }
    
    // Analyze memory usage
    if (this.metrics.memory && this.metrics.memory.memoryLeak) {
      const memory = this.metrics.memory.memoryLeak;
      
      if (memory.isLeaking) {
        report.summary.criticalIssues.push(`Memory leak detected: ${memory.increase.toFixed(2)}% increase`);
        report.summary.overall = 'FAIL';
      }
      
      report.slas.memoryLeak = {
        target: '< 10% increase',
        actual: `${memory.increase.toFixed(2)}%`,
        status: !memory.isLeaking ? 'PASS' : 'FAIL'
      };
    }
    
    // Generate recommendations
    if (report.summary.criticalIssues.length > 0) {
      report.summary.recommendations = [
        'Implement code splitting for large bundles',
        'Optimize component render performance',
        'Add memory leak detection and cleanup',
        'Consider implementing virtual scrolling for large lists',
        'Optimize images and assets'
      ];
    }
    
    return report;
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    if (this.page) {
      await this.page.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('✅ Cleanup completed');
  }
}

async function main() {
  const benchmark = new UIBenchmark();
  
  try {
    benchmark.startTime = performance.now();
    
    await benchmark.init();
    await benchmark.measureNavigation();
    await benchmark.measureRendering();
    await benchmark.measureMemory();
    await benchmark.measureBundleSize();
    await benchmark.runLoadTest();
    
    const report = await benchmark.generateReport();
    
    // Save report
    const reportPath = path.join(__dirname, 'ui-performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('🎉 UI Performance Benchmark completed!');
    console.log('📊 Report saved to:', reportPath);
    console.log('📈 Overall Status:', report.summary.overall);
    
    if (report.summary.criticalIssues.length > 0) {
      console.log('⚠️  Critical Issues:');
      report.summary.criticalIssues.forEach(issue => console.log('   -', issue));
    }
    
    if (report.summary.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.summary.recommendations.forEach(rec => console.log('   -', rec));
    }
    
  } catch (error) {
    console.error('❌ UI Benchmark failed:', error);
  } finally {
    await benchmark.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = UIBenchmark;
