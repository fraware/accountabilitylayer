#!/usr/bin/env node
/**
 * Short autocannon run against /healthz for CI when a backend is already up.
 */
const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const target = process.env.TARGET_URL || 'http://127.0.0.1:5000';

async function main() {
  const result = await autocannon({
    url: `${target.replace(/\/$/, '')}/healthz`,
    connections: 5,
    duration: 15,
    method: 'GET',
  });

  const out = {
    timestamp: new Date().toISOString(),
    config: { target, path: '/healthz', duration: 15 },
    scenarios: {
      healthz: {
        requests: result.requests,
        throughput: result.throughput,
        latency: result.latency,
        errors: result.errors,
        duration: result.duration,
      },
    },
    summary: {
      totalRequests: result.requests.total,
      maxLatency: result.latency.p99,
    },
  };

  fs.writeFileSync(path.join(__dirname, 'load-test-results.json'), JSON.stringify(out, null, 2));
  console.log('quick-health-bench done', out.summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
