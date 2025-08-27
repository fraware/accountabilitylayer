#!/bin/bash

# Comprehensive Performance Benchmark Runner
# This script runs the full performance analysis suite

set -e

echo "🚀 Starting Comprehensive Performance Benchmark Suite..."
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "comprehensive-benchmark.js" ]; then
    echo "❌ Error: Please run this script from the backend/bench directory"
    echo "   cd backend/bench && ./run-comprehensive.sh"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if required dependencies are installed
echo "📦 Checking dependencies..."
if [ ! -d "../node_modules" ]; then
    echo "   Installing dependencies..."
    cd .. && npm install && cd bench
fi

# Create profile directory
mkdir -p profile

# Set environment variables if not already set
export MONGODB_URI=${MONGODB_URI:-"mongodb://admin:password123@localhost:27017/accountability?authSource=admin"}
export NATS_URL=${NATS_URL:-"nats://localhost:4222"}
export REDIS_URL=${REDIS_URL:-"redis://localhost:6379"}

echo "🔧 Environment Configuration:"
echo "   MongoDB: $MONGODB_URI"
echo "   NATS: $NATS_URL"
echo "   Redis: $REDIS_URL"
echo ""

# Check if services are running
echo "🔍 Checking service availability..."

# Check MongoDB
if ! curl -s "mongodb://localhost:27017" > /dev/null 2>&1; then
    echo "⚠️  Warning: MongoDB may not be running on localhost:27017"
    echo "   Consider starting with: docker-compose up mongodb"
fi

# Check NATS
if ! curl -s "http://localhost:8222/healthz" > /dev/null 2>&1; then
    echo "⚠️  Warning: NATS may not be running on localhost:8222"
    echo "   Consider starting with: docker-compose up nats"
fi

# Check Redis
if ! redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
    echo "⚠️  Warning: Redis may not be running on localhost:6379"
    echo "   Consider starting with: docker-compose up redis"
fi

echo ""

# Run the comprehensive benchmark
echo "🎯 Running comprehensive benchmark..."
echo "   This may take 10-15 minutes depending on your system..."
echo ""

node comprehensive-benchmark.js

echo ""
echo "🎉 Comprehensive benchmark completed!"
echo "📊 Check the profile/ directory for results:"
echo "   - comprehensive-benchmark-report.json"
echo "   - comprehensive-benchmark-summary.md"
echo "   - mongo-index-analysis.json"
echo "   - performance-plots.html"
echo ""

# Check if there were critical issues
if [ -f "profile/comprehensive-benchmark-report.json" ]; then
    CRITICAL_ISSUES=$(node -e "
        const report = require('./profile/comprehensive-benchmark-report.json');
        console.log(report.analysis?.criticalIssues || 0);
    ")
    
    if [ "$CRITICAL_ISSUES" -gt 0 ]; then
        echo "⚠️  Critical issues found: $CRITICAL_ISSUES"
        echo "   Please review the recommendations in the report"
        exit 1
    else
        echo "✅ No critical issues found - all benchmarks passed!"
    fi
fi

echo ""
echo "🔍 For detailed analysis:"
echo "   - Open performance-plots.html in your browser for charts"
echo "   - Review mongo-index-summary.md for database recommendations"
echo "   - Check comprehensive-benchmark-summary.md for overall status"
