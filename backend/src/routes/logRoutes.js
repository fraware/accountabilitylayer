const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

// Create a new log entry
router.post('/logs', logController.createLog);

// Get all logs for an agent
router.get('/logs/:agent_id', logController.getLogsByAgent);

// Get a specific log step
router.get('/logs/:agent_id/:step_id', logController.getLogStep);

// Update log review status and comments
router.put('/logs/:agent_id/:step_id', logController.updateLogReview);

// Search logs with filters (agent_id, status, date range, trace_id)
router.get('/logs/search', logController.searchLogs);

// Get summary of logs for a given agent
router.get('/logs/summary/:agent_id', logController.summaryLogs);

module.exports = router;
