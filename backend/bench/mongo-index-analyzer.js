const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

class MongoIndexAnalyzer {
  constructor() {
    this.db = null;
    this.analysis = {
      timestamp: new Date().toISOString(),
      database: {},
      collections: {},
      indexes: {},
      slowQueries: [],
      recommendations: []
    };
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/accountability?authSource=admin';
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      this.db = mongoose.connection;
      console.log('✅ Connected to MongoDB for index analysis');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async analyzeDatabase() {
    console.log('📊 Analyzing database structure...');
    
    try {
      const dbStats = await this.db.db.stats();
      const adminStats = await this.db.db.admin().command({ serverStatus: 1 });
      
      this.analysis.database = {
        name: dbStats.db,
        collections: dbStats.collections,
        views: dbStats.views,
        objects: dbStats.objects,
        avgObjSize: dbStats.avgObjSize,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexes: dbStats.indexes,
        indexSize: dbStats.indexSize,
        fsUsedSize: dbStats.fsUsedSize,
        fsTotalSize: dbStats.fsTotalSize
      };

      // Connection pool analysis
      this.analysis.database.connections = {
        current: adminStats.connections?.current || 0,
        available: adminStats.connections?.available || 0,
        totalCreated: adminStats.connections?.totalCreated || 0,
        active: adminStats.connections?.active || 0
      };

      // Index statistics
      this.analysis.database.indexStats = {
        hits: adminStats.indexCounters?.btree?.hits || 0,
        misses: adminStats.indexCounters?.btree?.misses || 0,
        hitRatio: adminStats.indexCounters?.btree?.hits / 
                 (adminStats.indexCounters?.btree?.hits + adminStats.indexCounters?.btree?.misses) || 0
      };

      console.log('✅ Database analysis completed');
    } catch (error) {
      console.error('❌ Database analysis failed:', error);
    }
  }

  async analyzeCollections() {
    console.log('📋 Analyzing collections...');
    
    try {
      const collections = await this.db.db.listCollections().toArray();
      
      for (const collection of collections) {
        const collectionName = collection.name;
        console.log(`  Analyzing collection: ${collectionName}`);
        
        const collStats = await this.db.db.collection(collectionName).stats();
        const indexes = await this.db.db.collection(collectionName).indexes();
        
        this.analysis.collections[collectionName] = {
          count: collStats.count,
          size: collStats.size,
          avgObjSize: collStats.avgObjSize,
          storageSize: collStats.storageSize,
          totalIndexSize: collStats.totalIndexSize,
          indexes: indexes.map(idx => ({
            name: idx.name,
            key: idx.key,
            unique: idx.unique || false,
            sparse: idx.sparse || false,
            background: idx.background || false,
            partialFilterExpression: idx.partialFilterExpression || null,
            expireAfterSeconds: idx.expireAfterSeconds || null,
            size: idx.size || 0
          }))
        };
      }
      
      console.log('✅ Collections analysis completed');
    } catch (error) {
      console.error('❌ Collections analysis failed:', error);
    }
  }

  async analyzeIndexes() {
    console.log('🔍 Analyzing index performance...');
    
    try {
      for (const [collectionName, collectionData] of Object.entries(this.analysis.collections)) {
        this.analysis.indexes[collectionName] = {};
        
        for (const index of collectionData.indexes) {
          const indexStats = await this.db.db.collection(collectionName).aggregate([
            { $indexStats: {} },
            { $match: { name: index.name } }
          ]).toArray();
          
          if (indexStats.length > 0) {
            const stats = indexStats[0];
            this.analysis.indexes[collectionName][index.name] = {
              key: index.key,
              accesses: stats.accesses || {},
              usage: stats.usage || {},
              size: index.size,
              unique: index.unique,
              sparse: index.sparse,
              background: index.background
            };
          }
        }
      }
      
      console.log('✅ Index analysis completed');
    } catch (error) {
      console.error('❌ Index analysis failed:', error);
    }
  }

  async captureSlowQueries() {
    console.log('🐌 Capturing slow query patterns...');
    
    try {
      // Get current profiler settings
      const profilerStatus = await this.db.db.admin().command({ getProfilerStatus: 1 });
      
      if (profilerStatus.was === 0) {
        console.log('  Enabling profiler for slow query capture...');
        await this.db.db.admin().command({ setProfilerLevel: 1, slowms: 100 });
        
        // Wait for some queries to be captured
        console.log('  Waiting for profiler data...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      // Get slow queries from profiler
      const slowQueries = await this.db.db.system.profile.find({
        millis: { $gt: 100 }
      }).sort({ ts: -1 }).limit(50).toArray();
      
      this.analysis.slowQueries = slowQueries.map(query => ({
        timestamp: query.ts,
        operation: query.op,
        namespace: query.ns,
        duration: query.millis,
        query: query.query || query.command,
        planSummary: query.planSummary,
        executionStats: query.executionStats
      }));
      
      console.log(`✅ Captured ${this.analysis.slowQueries.length} slow queries`);
    } catch (error) {
      console.error('❌ Slow query capture failed:', error);
    }
  }

  async generateRecommendations() {
    console.log('💡 Generating optimization recommendations...');
    
    const recommendations = [];
    
    // Index hit ratio analysis
    const hitRatio = this.analysis.database.indexStats.hitRatio;
    if (hitRatio < 0.95) {
      recommendations.push({
        type: 'critical',
        category: 'indexes',
        message: `Low index hit ratio: ${(hitRatio * 100).toFixed(2)}%. Consider adding missing indexes.`,
        impact: 'high',
        effort: 'medium'
      });
    }
    
    // Missing indexes for common query patterns
    const collections = Object.keys(this.analysis.collections);
    for (const collection of collections) {
      const indexes = this.analysis.collections[collection].indexes;
      const indexKeys = indexes.map(idx => Object.keys(idx.key).join(','));
      
      // Check for common missing compound indexes
      if (collection === 'logs') {
        if (!indexKeys.includes('agent_id,timestamp')) {
          recommendations.push({
            type: 'recommendation',
            category: 'indexes',
            message: `Add compound index on (agent_id, timestamp) for logs collection`,
            impact: 'high',
            effort: 'low'
          });
        }
        
        if (!indexKeys.includes('status,timestamp')) {
          recommendations.push({
            type: 'recommendation',
            category: 'indexes',
            message: `Add compound index on (status, timestamp) for logs collection`,
            impact: 'medium',
            effort: 'low'
          });
        }
      }
    }
    
    // Connection pool analysis
    const connections = this.analysis.database.connections;
    const connectionUtilization = connections.current / connections.available;
    if (connectionUtilization > 0.8) {
      recommendations.push({
        type: 'warning',
        category: 'connections',
        message: `High connection pool utilization: ${(connectionUtilization * 100).toFixed(2)}%. Consider increasing maxPoolSize.`,
        impact: 'medium',
        effort: 'low'
      });
    }
    
    // Storage analysis
    const storageRatio = this.analysis.database.storageSize / this.analysis.database.dataSize;
    if (storageRatio > 2) {
      recommendations.push({
        type: 'recommendation',
        category: 'storage',
        message: `High storage overhead: ${(storageRatio * 100).toFixed(2)}%. Consider data compression or cleanup.`,
        impact: 'medium',
        effort: 'medium'
      });
    }
    
    this.analysis.recommendations = recommendations;
    console.log(`✅ Generated ${recommendations.length} recommendations`);
  }

  async generateReport() {
    console.log('📋 Generating index analysis report...');
    
    const report = {
      ...this.analysis,
      summary: {
        totalCollections: Object.keys(this.analysis.collections).length,
        totalIndexes: Object.values(this.analysis.collections)
          .reduce((sum, coll) => sum + coll.indexes.length, 0),
        slowQueries: this.analysis.slowQueries.length,
        recommendations: this.analysis.recommendations.length,
        criticalIssues: this.analysis.recommendations.filter(r => r.type === 'critical').length
      }
    };
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'mongo-index-analysis.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate summary report
    const summaryPath = path.join(__dirname, 'mongo-index-summary.md');
    const summary = this.generateMarkdownSummary(report);
    await fs.writeFile(summaryPath, summary);
    
    console.log('✅ Index analysis report generated');
    console.log(`📊 Detailed report: ${reportPath}`);
    console.log(`📝 Summary report: ${summaryPath}`);
    
    return report;
  }

  generateMarkdownSummary(report) {
    let markdown = `# MongoDB Index Analysis Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n\n`;
    
    markdown += `## 📊 Summary\n\n`;
    markdown += `- **Collections:** ${report.summary.totalCollections}\n`;
    markdown += `- **Total Indexes:** ${report.summary.totalIndexes}\n`;
    markdown += `- **Slow Queries:** ${report.summary.slowQueries}\n`;
    markdown += `- **Recommendations:** ${report.summary.recommendations}\n`;
    markdown += `- **Critical Issues:** ${report.summary.criticalIssues}\n\n`;
    
    markdown += `## 🔍 Index Hit Ratio\n\n`;
    const hitRatio = report.database.indexStats.hitRatio;
    markdown += `- **Current:** ${(hitRatio * 100).toFixed(2)}%\n`;
    markdown += `- **Target:** > 95%\n`;
    markdown += `- **Status:** ${hitRatio >= 0.95 ? '✅ PASS' : '❌ FAIL'}\n\n`;
    
    markdown += `## 📋 Recommendations\n\n`;
    if (report.recommendations.length === 0) {
      markdown += `✅ No optimization recommendations at this time.\n\n`;
    } else {
      report.recommendations.forEach((rec, i) => {
        markdown += `${i + 1}. **${rec.type.toUpperCase()}** - ${rec.message}\n`;
        markdown += `   - Impact: ${rec.impact}\n`;
        markdown += `   - Effort: ${rec.effort}\n\n`;
      });
    }
    
    markdown += `## 🗄️ Database Statistics\n\n`;
    markdown += `- **Data Size:** ${(report.database.dataSize / 1024 / 1024).toFixed(2)} MB\n`;
    markdown += `- **Storage Size:** ${(report.database.storageSize / 1024 / 1024).toFixed(2)} MB\n`;
    markdown += `- **Index Size:** ${(report.database.indexSize / 1024 / 1024).toFixed(2)} MB\n`;
    markdown += `- **Objects:** ${report.database.objects.toLocaleString()}\n\n`;
    
    return markdown;
  }

  async cleanup() {
    try {
      // Reset profiler level
      await this.db.db.admin().command({ setProfilerLevel: 0 });
      console.log('✅ Profiler reset to normal level');
    } catch (error) {
      console.error('❌ Failed to reset profiler:', error);
    }
  }

  async run() {
    try {
      await this.connect();
      await this.analyzeDatabase();
      await this.analyzeCollections();
      await this.analyzeIndexes();
      await this.captureSlowQueries();
      await this.generateRecommendations();
      const report = await this.generateReport();
      await this.cleanup();
      
      return report;
    } catch (error) {
      console.error('❌ Index analysis failed:', error);
      throw error;
    } finally {
      if (this.db) {
        await mongoose.disconnect();
      }
    }
  }
}

async function main() {
  const analyzer = new MongoIndexAnalyzer();
  
  try {
    console.log('🚀 Starting MongoDB Index Analysis...');
    const report = await analyzer.run();
    
    console.log('🎉 Index analysis completed successfully!');
    console.log(`📊 Found ${report.summary.criticalIssues} critical issues`);
    console.log(`💡 Generated ${report.summary.recommendations} recommendations`);
    
  } catch (error) {
    console.error('❌ Index analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MongoIndexAnalyzer;
