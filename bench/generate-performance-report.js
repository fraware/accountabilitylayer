#!/usr/bin/env node
/**
 * Merges bench outputs into performance-report.json for CI summaries.
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const loadPath = path.join(dir, 'load-test-results.json');
const k6SummaryPath = path.join(dir, 'k6-summary.json');

const report = {
  timestamp: new Date().toISOString(),
  source: 'generate-performance-report',
};

if (fs.existsSync(loadPath)) {
  try {
    const load = JSON.parse(fs.readFileSync(loadPath, 'utf8'));
    report.loadTest = load;
    const scenarios = load.scenarios ? Object.values(load.scenarios) : [];
    const p99s = scenarios.map((s) => s.latency?.p99).filter((n) => typeof n === 'number');
    const maxP99 = p99s.length ? Math.max(...p99s) : 0;
    const totalReq = scenarios.reduce((sum, s) => sum + (s.requests?.total || 0), 0);
    report.api = {
      singleLog: {
        latency: { p99: maxP99 },
      },
    };
    report.database = {
      writePerformance: {
        unordered: {
          throughput: totalReq > 0 ? totalReq / Math.max(load.config?.duration || 1, 1) : 0,
        },
      },
    };
  } catch (e) {
    report.loadTestError = String(e.message);
  }
}

if (fs.existsSync(k6SummaryPath)) {
  try {
    report.k6 = JSON.parse(fs.readFileSync(k6SummaryPath, 'utf8'));
  } catch (e) {
    report.k6Error = String(e.message);
  }
}

const outPath = path.join(dir, 'performance-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log('Wrote', outPath);
