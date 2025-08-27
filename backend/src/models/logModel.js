const mongoose = require('mongoose');

// Time-series collection options for better performance
const timeSeriesOptions = {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'agent_id',
    granularity: 'hours'
  },
  expireAfterSeconds: 7776000 // 90 days TTL
};

const logSchema = new mongoose.Schema({
  agent_id: { type: String, required: true, index: true },
  step_id: { type: Number, required: true },
  trace_id: { type: String, index: true },               // Unique identifier for distributed tracing
  user_id: { type: String, index: true },                // User or system that initiated the action
  timestamp: { type: Date, default: Date.now, index: true },
  input_data: { type: mongoose.Schema.Types.Mixed, required: true },
  output: { type: mongoose.Schema.Types.Mixed, required: true },
  reasoning: { type: String, required: true },
  status: { type: String, enum: ['success', 'failure', 'anomaly'], default: 'success', index: true },
  reviewed: { type: Boolean, default: false, index: true },         // Flag for manual review
  review_comments: { type: String, default: '' },        // Auditor feedback
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },  // Additional context (environment, version, etc.)
  version: { type: Number, default: 1 },                 // Version for updated logs
  retention_tier: { type: String, enum: ['hot', 'warm', 'cold'], default: 'hot' } // Storage tier for lifecycle management
}, {
  timestamps: true, // Adds createdAt and updatedAt
  ...timeSeriesOptions
});

// Compound indexes for common query patterns
logSchema.index({ agent_id: 1, timestamp: -1 });           // Agent-specific time queries
logSchema.index({ status: 1, timestamp: -1 });            // Status-based time queries
logSchema.index({ reviewed: 1, timestamp: -1 });          // Review-based time queries
logSchema.index({ user_id: 1, timestamp: -1 });           // User-specific time queries
logSchema.index({ retention_tier: 1, timestamp: -1 });    // Storage tier queries

// Text index for full-text search
logSchema.index({ 
  reasoning: 'text', 
  review_comments: 'text',
  'metadata.environment': 'text'
});

// TTL index for automatic data expiration
logSchema.index({ timestamp: 1 }, { 
  expireAfterSeconds: 7776000, // 90 days
  partialFilterExpression: { retention_tier: 'hot' }
});

// Warm storage TTL (1 year)
logSchema.index({ timestamp: 1 }, { 
  expireAfterSeconds: 31536000,
  partialFilterExpression: { retention_tier: 'warm' }
});

// Cold storage TTL (7 years)
logSchema.index({ timestamp: 1 }, { 
  expireAfterSeconds: 220752000,
  partialFilterExpression: { retention_tier: 'cold' }
});

// Pre-save middleware to set retention tier based on age
logSchema.pre('save', function(next) {
  const now = new Date();
  const ageInDays = (now - this.timestamp) / (1000 * 60 * 60 * 24);
  
  if (ageInDays <= 30) {
    this.retention_tier = 'hot';
  } else if (ageInDays <= 365) {
    this.retention_tier = 'warm';
  } else {
    this.retention_tier = 'cold';
  }
  
  next();
});

// Static method for bulk operations with better performance
logSchema.statics.bulkInsert = async function(logs) {
  return this.insertMany(logs, { 
    ordered: false, // Better performance for bulk inserts
    lean: false 
  });
};

// Static method for efficient time-range queries
logSchema.statics.findByTimeRange = function(startTime, endTime, options = {}) {
  const query = {
    timestamp: {
      $gte: startTime,
      $lte: endTime
    }
  };
  
  if (options.agent_id) query.agent_id = options.agent_id;
  if (options.status) query.status = options.status;
  if (options.reviewed !== undefined) query.reviewed = options.reviewed;
  
  return this.find(query, null, {
    lean: true, // Better performance for read-only queries
    sort: { timestamp: -1 },
    limit: options.limit || 1000,
    ...options
  });
};

// Static method for aggregation queries
logSchema.statics.getStats = function(timeRange, groupBy = 'agent_id') {
  const matchStage = {
    timestamp: {
      $gte: timeRange.start,
      $lte: timeRange.end
    }
  };
  
  return this.aggregate([
    { $match: matchStage },
    { $group: {
      _id: `$${groupBy}`,
      count: { $sum: 1 },
      successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
      failureCount: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
      anomalyCount: { $sum: { $cond: [{ $eq: ['$status', 'anomaly'] }, 1, 0] } },
      avgStepId: { $avg: '$step_id' }
    }},
    { $sort: { count: -1 } }
  ]);
};

// Instance method for data integrity
logSchema.methods.generateHash = function() {
  const crypto = require('crypto');
  const data = JSON.stringify({
    agent_id: this.agent_id,
    step_id: this.step_id,
    timestamp: this.timestamp,
    input_data: this.input_data,
    output: this.output,
    reasoning: this.reasoning,
    status: this.status,
    version: this.version
  });
  
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Instance method for retention policy check
logSchema.methods.shouldArchive = function() {
  const now = new Date();
  const ageInDays = (now - this.timestamp) / (1000 * 60 * 60 * 24);
  
  if (this.retention_tier === 'hot' && ageInDays > 30) {
    return true;
  } else if (this.retention_tier === 'warm' && ageInDays > 365) {
    return true;
  }
  
  return false;
};

module.exports = mongoose.model('Log', logSchema);
