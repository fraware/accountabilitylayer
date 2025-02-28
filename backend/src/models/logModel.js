const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  agent_id: { type: String, required: true },
  step_id: { type: Number, required: true },
  trace_id: { type: String },               // Unique identifier for distributed tracing
  user_id: { type: String },                // User or system that initiated the action
  timestamp: { type: Date, default: Date.now, index: true },
  input_data: { type: mongoose.Schema.Types.Mixed, required: true },
  output: { type: mongoose.Schema.Types.Mixed, required: true },
  reasoning: { type: String, required: true },
  status: { type: String, enum: ['success', 'failure', 'anomaly'], default: 'success' },
  reviewed: { type: Boolean, default: false },         // Flag for manual review
  review_comments: { type: String, default: '' },        // Auditor feedback
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },  // Additional context (environment, version, etc.)
  version: { type: Number, default: 1 }                  // Version for updated logs
});

// Create indexes for faster queries
logSchema.index({ agent_id: 1 });
logSchema.index({ step_id: 1 });
logSchema.index({ timestamp: 1 });
logSchema.index({ trace_id: 1 });

module.exports = mongoose.model('Log', logSchema);
