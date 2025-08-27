#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔥 Generating CPU Profile and Flamegraph...');

// Start the application with profiling enabled
const app = spawn('node', ['--prof', '--prof-process', 'src/app.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'pipe'
});

console.log('🚀 Application started with profiling...');
console.log('⏱️  Let it run for 30 seconds to collect data...');

// Let it run for 30 seconds
setTimeout(async () => {
  console.log('🛑 Stopping application...');
  app.kill('SIGINT');
  
  // Wait for graceful shutdown
  setTimeout(() => {
    console.log('📊 Profiling completed!');
    console.log('\n📁 Generated files:');
    console.log('  - isolate-*.log (CPU profile)');
    console.log('  - flamegraph.svg (if 0x is available)');
    
    // Try to generate flamegraph if 0x is available
    try {
      const isolateLogs = fs.readdirSync(path.join(__dirname, '..'))
        .filter(file => file.startsWith('isolate-') && file.endsWith('.log'));
      
      if (isolateLogs.length > 0) {
        console.log('\n🔍 To analyze the profile:');
        console.log(`  node --prof-process ${isolateLogs[0]} > profile-analysis.txt`);
        console.log('\n📈 To generate flamegraph (requires 0x):');
        console.log(`  0x --output flamegraph.svg ${isolateLogs[0]}`);
      }
    } catch (error) {
      console.log('⚠️  Could not find isolate logs');
    }
    
    process.exit(0);
  }, 2000);
}, 30000);

// Handle app output
app.stdout.on('data', (data) => {
  console.log(`[APP] ${data.toString().trim()}`);
});

app.stderr.on('data', (data) => {
  console.error(`[APP ERROR] ${data.toString().trim()}`);
});

app.on('close', (code) => {
  console.log(`[APP] Process exited with code ${code}`);
});
