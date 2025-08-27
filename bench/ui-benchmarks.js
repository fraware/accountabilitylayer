#!/usr/bin/env node

const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class UIBenchmark {
  constructor() {
    this.browser = null;
    this.page = null;
    this.metrics = {
      timestamp: new Date().toISOString(),
      navigation: {},
      rendering: {},
      memory: {},
      bundle: {}
    };
  }

  async init() {
    console.log('🌐 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Enable performance monitoring
    await this.page.setCacheEnabled(false);
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    console.log('✅ Browser ready');
  }

  async measureNavigation() {
    console.log('\n🚀 Measuring Navigation Performance...');
    
    const startTime = performance.now();
    
    // Navigate to the app
    await this.page.goto('http://localhost:3000', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    const endTime = performance.now();
    const navigationTime = endTime - startTime;
    
    // Get navigation timing metrics
    const navigationMetrics = await this.page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        domInteractive: perf.domInteractive - perf.domNavigationStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    this.metrics.navigation = {
      totalTime: navigationTime,
      ...navigationMetrics
    };
    
    console.log(`   ✅ Navigation: ${navigationTime.toFixed(2)}ms`);
    console.log(`   ✅ DOM Interactive: ${navigationMetrics.domInteractive.toFixed(2)}ms`);
    console.log(`   ✅ First Paint: ${navigationMetrics.firstPaint.toFixed(2)}ms`);
  }

  async measureRendering() {
    console.log('\n🎨 Measuring Component Rendering Performance...');
    
    // Wait for React to be ready
    await this.page.waitForFunction('window.React !== undefined');
    
    // Measure component render times
    const renderMetrics = await this.page.evaluate(() => {
      const start = performance.now();
      
      // Trigger a re-render by updating state
      if (window.testComponent) {
        window.testComponent.forceUpdate();
      }
      
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          const end = performance.now();
          resolve({
            renderTime: end - start,
            componentCount: document.querySelectorAll('[data-testid]').length
          });
        });
      });
    });
    
    this.metrics.rendering = renderMetrics;
    
    console.log(`   ✅ Render Time: ${renderMetrics.renderTime.toFixed(2)}ms`);
    console.log(`   ✅ Components: ${renderMetrics.componentCount}`);
  }

  async measureMemory() {
    console.log('\n💾 Measuring Memory Usage...');
    
    const memoryMetrics = await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (memoryMetrics) {
      this.metrics.memory = memoryMetrics;
      console.log(`   ✅ Used Heap: ${(memoryMetrics.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   ✅ Total Heap: ${(memoryMetrics.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    } else {
      console.log('   ⚠️  Memory metrics not available');
    }
  }

  async measureBundleSize() {
    console.log('\n📦 Measuring Bundle Size...');
    
    // Get resource sizes
    const resourceMetrics = await this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(r => r.name.endsWith('.js'));
      const cssResources = resources.filter(r => r.name.endsWith('.css'));
      
      return {
        totalJS: jsResources.reduce((sum, r) => sum + r.transferSize, 0),
        totalCSS: cssResources.reduce((sum, r) => sum + r.transferSize, 0),
        jsCount: jsResources.length,
        cssCount: cssResources.length
      };
    });
    
    this.metrics.bundle = resourceMetrics;
    
    console.log(`   ✅ JS Bundle: ${(resourceMetrics.totalJS / 1024).toFixed(2)}KB (${resourceMetrics.jsCount} files)`);
    console.log(`   ✅ CSS Bundle: ${(resourceMetrics.totalCSS / 1024).toFixed(2)}KB (${resourceMetrics.cssCount} files)`);
  }

  async runLoadTest() {
    console.log('\n⚡ Running Load Test...');
    
    const startTime = performance.now();
    
    // Simulate user interactions
    for (let i = 0; i < 10; i++) {
      await this.page.click('button[data-testid="filter-button"]').catch(() => {});
      await this.page.waitForTimeout(100);
      await this.page.click('button[data-testid="clear-button"]').catch(() => {});
      await this.page.waitForTimeout(100);
    }
    
    const endTime = performance.now();
    const loadTestTime = endTime - startTime;
    
    this.metrics.loadTest = {
      duration: loadTestTime,
      interactions: 20
    };
    
    console.log(`   ✅ Load Test: ${loadTestTime.toFixed(2)}ms for 20 interactions`);
  }

  async generateReport() {
    console.log('\n📝 Generating UI Performance Report...');
    
    const reportPath = path.join(__dirname, 'ui-performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.metrics, null, 2));
    
    console.log(`\n📊 UI Performance Report Generated: ${reportPath}`);
    
    // Summary
    console.log('\n🎯 UI Performance Summary:');
    console.log('='.repeat(50));
    
    if (this.metrics.navigation) {
      console.log(`Navigation: ${this.metrics.navigation.totalTime.toFixed(2)}ms`);
      console.log(`DOM Interactive: ${this.metrics.navigation.domInteractive.toFixed(2)}ms`);
      console.log(`First Paint: ${this.metrics.navigation.firstPaint.toFixed(2)}ms`);
    }
    
    if (this.metrics.rendering) {
      console.log(`\nRendering: ${this.metrics.rendering.renderTime.toFixed(2)}ms`);
      console.log(`Components: ${this.metrics.rendering.componentCount}`);
    }
    
    if (this.metrics.bundle) {
      console.log(`\nBundle Size: ${(this.metrics.bundle.totalJS / 1024).toFixed(2)}KB JS + ${(this.metrics.bundle.totalCSS / 1024).toFixed(2)}KB CSS`);
    }
    
    if (this.metrics.loadTest) {
      console.log(`\nLoad Test: ${this.metrics.loadTest.duration.toFixed(2)}ms for ${this.metrics.loadTest.interactions} interactions`);
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const benchmark = new UIBenchmark();
  
  try {
    await benchmark.init();
    await benchmark.measureNavigation();
    await benchmark.measureRendering();
    await benchmark.measureMemory();
    await benchmark.measureBundleSize();
    await benchmark.runLoadTest();
    await benchmark.generateReport();
    
    console.log('\n✅ UI benchmarks completed successfully!');
  } catch (error) {
    console.error('\n❌ UI benchmark failed:', error);
  } finally {
    await benchmark.cleanup();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = UIBenchmark;
