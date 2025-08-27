#!/usr/bin/env node

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// MongoDB connection
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountability';

// Import the new model
const Log = require('../src/models/logModel');

class TimeSeriesMigration {
  constructor() {
    this.stats = {
      totalProcessed: 0,
      totalMigrated: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null
    };
  }

  async connect() {
    try {
      await mongoose.connect(dbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async createTimeSeriesCollection() {
    console.log('\n🗄️  Creating time-series collection...');
    
    try {
      // Drop existing collection if it exists
      await mongoose.connection.db.dropCollection('logs').catch(() => {
        console.log('   ℹ️  No existing logs collection to drop');
      });
      
      // Create the new time-series collection
      await mongoose.connection.db.createCollection('logs', {
        timeseries: {
          timeField: 'timestamp',
          metaField: 'agent_id',
          granularity: 'hours'
        }
      });
      
      console.log('   ✅ Time-series collection created');
      
      // Create indexes
      await Log.createIndexes();
      console.log('   ✅ Indexes created');
      
    } catch (error) {
      console.error('   ❌ Failed to create time-series collection:', error);
      throw error;
    }
  }

  async migrateData() {
    console.log('\n📊 Starting data migration...');
    
    this.stats.startTime = new Date();
    
    try {
      // Get the old collection
      const oldCollection = mongoose.connection.db.collection('logs_old');
      
      // Check if old collection exists
      const collections = await mongoose.connection.db.listCollections().toArray();
      const oldCollectionExists = collections.some(col => col.name === 'logs_old');
      
      if (!oldCollectionExists) {
        console.log('   ℹ️  No old collection found, creating sample data...');
        await this.createSampleData();
        return;
      }
      
      console.log('   📥 Found old collection, migrating data...');
      
      // Process in batches for memory efficiency
      const batchSize = 1000;
      let processed = 0;
      
      const cursor = oldCollection.find({});
      
      while (await cursor.hasNext()) {
        const batch = [];
        
        // Collect batch
        for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
          const doc = await cursor.next();
          batch.push(doc);
        }
        
        if (batch.length === 0) break;
        
        // Transform and insert batch
        const transformedBatch = batch.map(doc => this.transformDocument(doc));
        
        try {
          await Log.insertMany(transformedBatch, { ordered: false });
          processed += batch.length;
          this.stats.totalMigrated += batch.length;
          
          console.log(`   📦 Processed batch: ${processed} documents`);
          
        } catch (error) {
          console.error(`   ❌ Batch processing error:`, error.message);
          this.stats.totalErrors += batch.length;
        }
        
        this.stats.totalProcessed += batch.length;
      }
      
      console.log(`   ✅ Migration completed: ${this.stats.totalMigrated} documents migrated`);
      
    } catch (error) {
      console.error('   ❌ Migration failed:', error);
      throw error;
    }
  }

  transformDocument(oldDoc) {
    // Transform old document format to new format
    return {
      agent_id: oldDoc.agent_id,
      step_id: oldDoc.step_id,
      trace_id: oldDoc.trace_id,
      user_id: oldDoc.user_id,
      timestamp: oldDoc.timestamp || new Date(),
      input_data: oldDoc.input_data,
      output: oldDoc.output,
      reasoning: oldDoc.reasoning,
      status: oldDoc.status || 'success',
      reviewed: oldDoc.reviewed || false,
      review_comments: oldDoc.review_comments || '',
      metadata: oldDoc.metadata || {},
      version: oldDoc.version || 1,
      retention_tier: this.calculateRetentionTier(oldDoc.timestamp),
      createdAt: oldDoc.createdAt || oldDoc.timestamp || new Date(),
      updatedAt: oldDoc.updatedAt || oldDoc.timestamp || new Date()
    };
  }

  calculateRetentionTier(timestamp) {
    if (!timestamp) return 'hot';
    
    const now = new Date();
    const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24);
    
    if (ageInDays <= 30) return 'hot';
    if (ageInDays <= 365) return 'warm';
    return 'cold';
  }

  async createSampleData() {
    console.log('   📝 Creating sample data for testing...');
    
    const sampleLogs = [];
    const now = new Date();
    
    // Create sample data for the last 30 days
    for (let i = 0; i < 1000; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      
      sampleLogs.push({
        agent_id: `agent-${Math.floor(Math.random() * 10) + 1}`,
        step_id: Math.floor(Math.random() * 1000) + 1,
        trace_id: `trace-${Math.random().toString(36).substr(2, 9)}`,
        user_id: `user-${Math.floor(Math.random() * 5) + 1}`,
        timestamp,
        input_data: { test: true, iteration: i },
        output: { success: true, result: `result-${i}` },
        reasoning: `Sample reasoning for iteration ${i}`,
        status: ['success', 'failure', 'anomaly'][Math.floor(Math.random() * 3)],
        reviewed: Math.random() > 0.7,
        review_comments: Math.random() > 0.8 ? 'Sample review comment' : '',
        metadata: { environment: 'test', version: '1.0.0' },
        version: 1,
        retention_tier: this.calculateRetentionTier(timestamp)
      });
    }
    
    try {
      await Log.insertMany(sampleLogs, { ordered: false });
      this.stats.totalMigrated = sampleLogs.length;
      console.log(`   ✅ Created ${sampleLogs.length} sample documents`);
    } catch (error) {
      console.error('   ❌ Failed to create sample data:', error);
      throw error;
    }
  }

  async validateMigration() {
    console.log('\n🔍 Validating migration...');
    
    try {
      // Check collection stats
      const stats = await mongoose.connection.db.collection('logs').stats();
      console.log(`   📊 Collection size: ${stats.size} bytes`);
      console.log(`   📊 Document count: ${stats.count}`);
      
      // Check indexes
      const indexes = await mongoose.connection.db.collection('logs').indexes();
      console.log(`   🔍 Indexes: ${indexes.length} created`);
      
      // Test queries
      const recentLogs = await Log.findByTimeRange(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date()
      );
      console.log(`   ✅ Recent logs query: ${recentLogs.length} results`);
      
      // Test aggregation
      const statsQuery = await Log.getStats({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      });
      console.log(`   ✅ Stats aggregation: ${statsQuery.length} groups`);
      
      console.log('   ✅ Migration validation successful');
      
    } catch (error) {
      console.error('   ❌ Migration validation failed:', error);
      throw error;
    }
  }

  async generateReport() {
    this.stats.endTime = new Date();
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    const report = {
      timestamp: new Date().toISOString(),
      migration: {
        ...this.stats,
        durationSeconds: duration,
        throughput: this.stats.totalProcessed / duration
      }
    };
    
    const reportPath = path.join(__dirname, 'migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📝 Migration Report Generated:');
    console.log('='.repeat(50));
    console.log(`Total Processed: ${this.stats.totalProcessed.toLocaleString()}`);
    console.log(`Total Migrated: ${this.stats.totalMigrated.toLocaleString()}`);
    console.log(`Total Errors: ${this.stats.totalErrors.toLocaleString()}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Throughput: ${(this.stats.totalProcessed / duration).toFixed(2)} docs/s`);
    console.log(`Report saved to: ${reportPath}`);
  }

  async run() {
    console.log('🚀 Time-Series Collection Migration');
    console.log('='.repeat(50));
    
    try {
      await this.connect();
      await this.createTimeSeriesCollection();
      await this.migrateData();
      await this.validateMigration();
      await this.generateReport();
      
      console.log('\n✅ Migration completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    } finally {
      await mongoose.connection.close();
      process.exit(0);
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new TimeSeriesMigration();
  migration.run();
}

module.exports = TimeSeriesMigration;
