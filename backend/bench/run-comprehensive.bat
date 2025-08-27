@echo off
REM Comprehensive Performance Benchmark Runner for Windows
REM This script runs the full performance analysis suite

echo 🚀 Starting Comprehensive Performance Benchmark Suite...
echo ==================================================

REM Check if we're in the right directory
if not exist "comprehensive-benchmark.js" (
    echo ❌ Error: Please run this script from the backend\bench directory
    echo    cd backend\bench ^&^& run-comprehensive.bat
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if required dependencies are installed
echo 📦 Checking dependencies...
if not exist "..\node_modules" (
    echo    Installing dependencies...
    cd .. && npm install && cd bench
)

REM Create profile directory
if not exist "profile" mkdir profile

REM Set environment variables if not already set
set MONGODB_URI=%MONGODB_URI%
if "%MONGODB_URI%"=="" set MONGODB_URI=mongodb://admin:password123@localhost:27017/accountability?authSource=admin

set NATS_URL=%NATS_URL%
if "%NATS_URL%"=="" set NATS_URL=nats://localhost:4222

set REDIS_URL=%REDIS_URL%
if "%REDIS_URL%"=="" set REDIS_URL=redis://localhost:6379

echo 🔧 Environment Configuration:
echo    MongoDB: %MONGODB_URI%
echo    NATS: %NATS_URL%
echo    Redis: %REDIS_URL%
echo.

REM Check if services are running
echo 🔍 Checking service availability...

REM Check MongoDB (basic check)
curl -s "mongodb://localhost:27017" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Warning: MongoDB may not be running on localhost:27017
    echo    Consider starting with: docker-compose up mongodb
)

REM Check NATS
curl -s "http://localhost:8222/healthz" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Warning: NATS may not be running on localhost:8222
    echo    Consider starting with: docker-compose up nats
)

REM Check Redis (basic check)
curl -s "redis://localhost:6379" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Warning: Redis may not be running on localhost:6379
    echo    Consider starting with: docker-compose up redis
)

echo.

REM Run the comprehensive benchmark
echo 🎯 Running comprehensive benchmark...
echo    This may take 10-15 minutes depending on your system...
echo.

node comprehensive-benchmark.js

echo.
echo 🎉 Comprehensive benchmark completed!
echo 📊 Check the profile\ directory for results:
echo    - comprehensive-benchmark-report.json
echo    - comprehensive-benchmark-summary.md
echo    - mongo-index-analysis.json
echo    - performance-plots.html
echo.

REM Check if there were critical issues
if exist "profile\comprehensive-benchmark-report.json" (
    for /f "tokens=*" %%i in ('node -e "const report = require('./profile/comprehensive-benchmark-report.json'); console.log(report.analysis?.criticalIssues || 0);"') do set CRITICAL_ISSUES=%%i
    
    if %CRITICAL_ISSUES% gtr 0 (
        echo ⚠️  Critical issues found: %CRITICAL_ISSUES%
        echo    Please review the recommendations in the report
        pause
        exit /b 1
    ) else (
        echo ✅ No critical issues found - all benchmarks passed!
    )
)

echo.
echo 🔍 For detailed analysis:
echo    - Open performance-plots.html in your browser for charts
echo    - Review mongo-index-summary.md for database recommendations
echo    - Check comprehensive-benchmark-summary.md for overall status

pause
