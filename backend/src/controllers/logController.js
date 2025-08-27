const Log = require('../models/logModel');
const logService = require('../services/logService');
const eventBus = require('../services/eventBus');

exports.createLog = async (req, res) => {
  try {
    const logData = req.body;
    
    // Validate required fields
    if (!logData.agent_id || !logData.step_id || !logData.input_data || !logData.output || !logData.reasoning) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Use advanced anomaly detection
    if (logService.detectAnomaly(logData)) {
      logData.status = 'anomaly';
    }
    
    // Publish to event bus instead of direct database write
    const eventResult = await eventBus.publish('logs.create', logData, {
      metadata: {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    // Return immediate response with event ID
    res.status(202).json({ 
      message: 'Log creation queued', 
      eventId: eventResult.id,
      sequence: eventResult.sequence,
      timestamp: eventResult.timestamp
    });
    
  } catch (error) {
    console.error('Failed to queue log creation:', error);
    res.status(500).json({ error: 'Failed to queue log creation' });
  }
};

exports.createBulkLogs = async (req, res) => {
  try {
    const { logs } = req.body;
    
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ error: 'Invalid logs array' });
    }
    
    // Validate each log entry
    for (const logData of logs) {
      if (!logData.agent_id || !logData.step_id || !logData.input_data || !logData.output || !logData.reasoning) {
        return res.status(400).json({ error: 'Missing required fields in one or more logs' });
      }
      
      // Apply anomaly detection
      if (logService.detectAnomaly(logData)) {
        logData.status = 'anomaly';
      }
    }
    
    // Publish bulk event to event bus
    const eventResult = await eventBus.publish('logs.bulk', { logs }, {
      metadata: {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        count: logs.length
      }
    });
    
    res.status(202).json({ 
      message: 'Bulk logs queued', 
      eventId: eventResult.id,
      sequence: eventResult.sequence,
      count: logs.length,
      timestamp: eventResult.timestamp
    });
    
  } catch (error) {
    console.error('Failed to queue bulk logs:', error);
    res.status(500).json({ error: 'Failed to queue bulk logs' });
  }
};

exports.getLogsByAgent = async (req, res) => {
  try {
    const { page = 1, limit = 100, sort = 'timestamp', order = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    
    // Use optimized time-series query
    const logs = await Log.findByTimeRange(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      new Date(),
      {
        agent_id: req.params.agent_id,
        limit: parseInt(limit),
        skip: parseInt(skip),
        sort: { [sort]: order === 'desc' ? -1 : 1 }
      }
    );
    
    // Get total count for pagination
    const total = await Log.countDocuments({ agent_id: req.params.agent_id });
    
    res.status(200).json({ 
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch logs by agent:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

exports.getLogStep = async (req, res) => {
  try {
    const log = await Log.findOne({
      agent_id: req.params.agent_id,
      step_id: req.params.step_id
    }).lean(); // Use lean for better performance
    
    if (!log) {
      return res.status(404).json({ message: 'Log step not found' });
    }
    
    res.status(200).json({ data: log });
  } catch (error) {
    console.error('Failed to fetch log step:', error);
    res.status(500).json({ error: 'Failed to fetch log step' });
  }
};

// Update log review status (secured endpoint; only auditors/admins can update)
exports.updateLogReview = async (req, res) => {
  try {
    const { reviewed, review_comments } = req.body;
    const { agent_id, step_id } = req.params;
    
    // Find the log first
    const log = await Log.findOne({ agent_id, step_id });
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }
    
    // Allow update only if log is anomaly or pending review
    if (log.status !== 'anomaly' && log.reviewed === true) {
      return res.status(400).json({ 
        message: 'Only anomaly or pending review logs can be updated.' 
      });
    }
    
    // Publish update event to event bus
    const eventResult = await eventBus.publish('logs.update', {
      logId: log._id,
      updates: {
        reviewed,
        review_comments: review_comments || log.review_comments
      }
    }, {
      metadata: {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        originalStatus: log.status
      }
    });
    
    res.status(202).json({ 
      message: 'Log review update queued', 
      eventId: eventResult.id,
      sequence: eventResult.sequence,
      timestamp: eventResult.timestamp
    });
    
  } catch (error) {
    console.error('Failed to queue log review update:', error);
    res.status(500).json({ error: 'Failed to queue log review update' });
  }
};

exports.searchLogs = async (req, res) => {
  try {
    const { 
      agent_id, 
      status, 
      from_date, 
      to_date, 
      trace_id, 
      reviewed,
      page = 1, 
      limit = 100,
      sort = 'timestamp',
      order = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query using optimized fields
    let query = {};
    if (agent_id) query.agent_id = agent_id;
    if (status) query.status = status;
    if (trace_id) query.trace_id = trace_id;
    if (reviewed !== undefined) query.reviewed = reviewed === 'true';
    
    // Use time-range query for better performance
    if (from_date || to_date) {
      query.timestamp = {};
      if (from_date) query.timestamp.$gte = new Date(from_date);
      if (to_date) query.timestamp.$lte = new Date(to_date);
    } else {
      // Default to last 30 days if no date range specified
      query.timestamp = {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      };
    }
    
    // Execute query with pagination and lean for performance
    const logs = await Log.find(query)
      .lean()
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Log.countDocuments(query);
    
    res.status(200).json({ 
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Failed to search logs:', error);
    res.status(500).json({ error: 'Failed to search logs' });
  }
};

exports.summaryLogs = async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { from_date, to_date } = req.query;
    
    // Build time range for summary
    const timeRange = {
      start: from_date ? new Date(from_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: to_date ? new Date(to_date) : new Date()
    };
    
    // Use aggregation for better performance
    const summary = await Log.getStats(timeRange, 'agent_id');
    
    // Filter by specific agent if provided
    const agentSummary = agent_id 
      ? summary.find(s => s._id === agent_id)
      : summary;
    
    if (agent_id && !agentSummary) {
      return res.status(404).json({ message: 'Agent not found' });
    }
    
    res.status(200).json({
      data: agentSummary || summary,
      timeRange
    });
    
  } catch (error) {
    console.error('Failed to get logs summary:', error);
    res.status(500).json({ error: 'Failed to get logs summary' });
  }
};

// Health check endpoint
exports.health = async (req, res) => {
  try {
    const eventBusHealth = await eventBus.health();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      eventBus: eventBusHealth,
      mongodb: 'connected' // Assuming connection is maintained
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
