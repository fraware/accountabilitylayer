const Log = require('../models/logModel');
const logService = require('../services/logService');

exports.createLog = async (req, res) => {
  try {
    const logData = req.body;
    // Use advanced anomaly detection.
    if (logService.detectAnomaly(logData)) {
      logData.status = 'anomaly';
    }
    const logEntry = new Log(logData);
    await logEntry.save();
    
    // Trigger notification if anomaly is detected.
    if (logEntry.status === 'anomaly') {
      logService.notifyAnomaly(logEntry);
    }
    
    res.status(201).json({ message: 'Log created', data: logEntry });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getLogsByAgent = async (req, res) => {
  try {
    const logs = await Log.find({ agent_id: req.params.agent_id }).sort({ step_id: 1 });
    res.status(200).json({ data: logs });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

exports.getLogStep = async (req, res) => {
  try {
    const log = await Log.findOne({
      agent_id: req.params.agent_id,
      step_id: req.params.step_id
    });
    if (!log) return res.status(404).json({ message: 'Log step not found' });
    res.status(200).json({ data: log });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

// Update log review status (secured endpoint; only auditors/admins can update).
exports.updateLogReview = async (req, res) => {
  try {
    const { reviewed, review_comments } = req.body;
    const { agent_id, step_id } = req.params;
    let log = await Log.findOne({ agent_id, step_id });
    if (!log) return res.status(404).json({ message: 'Log not found' });

    // Allow update only if log is anomaly or pending review.
    if (log.status !== 'anomaly' && log.reviewed === true) {
      return res.status(400).json({ message: 'Only anomaly or pending review logs can be updated.' });
    }

    log.reviewed = reviewed;
    log.review_comments = review_comments || log.review_comments;
    log.version = log.version + 1; // Increment version.
    await log.save();
    res.status(200).json({ message: 'Log updated successfully', data: log });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.searchLogs = async (req, res) => {
  try {
    const { agent_id, status, from_date, to_date, trace_id } = req.query;
    let query = {};
    if (agent_id) query.agent_id = agent_id;
    if (status) query.status = status;
    if (trace_id) query.trace_id = trace_id;
    if (from_date || to_date) {
      query.timestamp = {};
      if (from_date) query.timestamp.$gte = new Date(from_date);
      if (to_date) query.timestamp.$lte = new Date(to_date);
    }
    const logs = await Log.find(query).sort({ timestamp: -1 });
    res.status(200).json({ data: logs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.summaryLogs = async (req, res) => {
  try {
    const { agent_id } = req.params;
    const totalLogs = await Log.countDocuments({ agent_id });
    const anomalies = await Log.countDocuments({ agent_id, status: 'anomaly' });
    const reviewedCount = await Log.countDocuments({ agent_id, reviewed: true });
    const pendingReview = await Log.countDocuments({ agent_id, reviewed: false });
    
    res.status(200).json({
      data: {
        totalLogs,
        anomalies,
        reviewedCount,
        pendingReview
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
