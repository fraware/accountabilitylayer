"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLog = createLog;
exports.createBulkLogs = createBulkLogs;
exports.getLogsByAgent = getLogsByAgent;
exports.getLogStep = getLogStep;
exports.updateLogReview = updateLogReview;
exports.searchLogs = searchLogs;
exports.summaryLogs = summaryLogs;
exports.health = health;
const zod_1 = require("zod");
const Log = require('../models/logModel');
const logService = require('../services/logService');
const eventBus = require('../services/eventBus');
const createLogBodySchema = zod_1.z.object({
    agent_id: zod_1.z.string().min(1),
    step_id: zod_1.z.coerce.number(),
    input_data: zod_1.z.unknown(),
    output: zod_1.z.unknown(),
    reasoning: zod_1.z.string().min(1),
    trace_id: zod_1.z.string().optional(),
    status: zod_1.z.enum(['success', 'failure', 'anomaly']).optional(),
});
async function createLog(req, res) {
    try {
        const parsed = createLogBodySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Missing or invalid required fields', details: parsed.error.flatten() });
            return;
        }
        const logData = { ...parsed.data };
        if (logService.detectAnomaly(logData)) {
            logData.status = 'anomaly';
        }
        const eventResult = await eventBus.publish('logs.create', logData, {
            metadata: {
                userId: req.user?.id,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                requestId: String(req.headers['x-request-id'] || ''),
            },
        });
        res.status(202).json({
            message: 'Log creation queued',
            eventId: eventResult.id,
            sequence: eventResult.sequence,
            timestamp: eventResult.timestamp,
        });
    }
    catch (error) {
        console.error('Failed to queue log creation:', error);
        res.status(500).json({ error: 'Failed to queue log creation' });
    }
}
async function createBulkLogs(req, res) {
    try {
        const { logs } = req.body;
        if (!Array.isArray(logs) || logs.length === 0) {
            res.status(400).json({ error: 'Invalid logs array' });
            return;
        }
        const validatedLogs = [];
        for (const item of logs) {
            const p = createLogBodySchema.safeParse(item);
            if (!p.success) {
                res.status(400).json({ error: 'Missing required fields in one or more logs' });
                return;
            }
            const entry = { ...p.data };
            if (logService.detectAnomaly(entry)) {
                entry.status = 'anomaly';
            }
            validatedLogs.push(entry);
        }
        const eventResult = await eventBus.publish('logs.bulk', { logs: validatedLogs }, {
            metadata: {
                userId: req.user?.id,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                count: validatedLogs.length,
                requestId: String(req.headers['x-request-id'] || ''),
            },
        });
        res.status(202).json({
            message: 'Bulk logs queued',
            eventId: eventResult.id,
            sequence: eventResult.sequence,
            count: validatedLogs.length,
            timestamp: eventResult.timestamp,
        });
    }
    catch (error) {
        console.error('Failed to queue bulk logs:', error);
        res.status(500).json({ error: 'Failed to queue bulk logs' });
    }
}
async function getLogsByAgent(req, res) {
    try {
        const { page = 1, limit = 100, sort = 'timestamp', order = 'desc' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const logs = await Log.findByTimeRange(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date(), {
            agent_id: req.params.agent_id,
            limit: parseInt(String(limit), 10),
            skip: parseInt(String(skip), 10),
            sort: { [String(sort)]: order === 'desc' ? -1 : 1 },
        });
        const total = await Log.countDocuments({ agent_id: req.params.agent_id });
        res.status(200).json({
            data: logs,
            pagination: {
                page: parseInt(String(page), 10),
                limit: parseInt(String(limit), 10),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Failed to fetch logs by agent:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
}
async function getLogStep(req, res) {
    try {
        const log = await Log.findOne({
            agent_id: req.params.agent_id,
            step_id: req.params.step_id,
        }).lean();
        if (!log) {
            res.status(404).json({ message: 'Log step not found' });
            return;
        }
        res.status(200).json({ data: log });
    }
    catch (error) {
        console.error('Failed to fetch log step:', error);
        res.status(500).json({ error: 'Failed to fetch log step' });
    }
}
async function updateLogReview(req, res) {
    try {
        const { reviewed, review_comments } = req.body;
        const { agent_id, step_id } = req.params;
        const log = await Log.findOne({ agent_id, step_id });
        if (!log) {
            res.status(404).json({ message: 'Log not found' });
            return;
        }
        if (log.status !== 'anomaly' && log.reviewed === true) {
            res.status(400).json({
                message: 'Only anomaly or pending review logs can be updated.',
            });
            return;
        }
        const eventResult = await eventBus.publish('logs.update', {
            logId: log._id,
            updates: {
                reviewed,
                review_comments: review_comments || log.review_comments,
            },
        }, {
            metadata: {
                userId: req.user?.id,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                originalStatus: log.status,
                requestId: String(req.headers['x-request-id'] || ''),
            },
        });
        res.status(202).json({
            message: 'Log review update queued',
            eventId: eventResult.id,
            sequence: eventResult.sequence,
            timestamp: eventResult.timestamp,
        });
    }
    catch (error) {
        console.error('Failed to queue log review update:', error);
        res.status(500).json({ error: 'Failed to queue log review update' });
    }
}
async function searchLogs(req, res) {
    try {
        const { agent_id, status, from_date, to_date, trace_id, reviewed, keyword, page = 1, limit = 100, sort = 'timestamp', order = 'desc', } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const query = {};
        if (agent_id)
            query.agent_id = agent_id;
        if (status)
            query.status = status;
        if (trace_id)
            query.trace_id = trace_id;
        if (reviewed !== undefined && reviewed !== '') {
            query.reviewed = reviewed === 'true';
        }
        const keywordTrimmed = keyword !== undefined && String(keyword).trim() !== ''
            ? String(keyword).trim()
            : '';
        if (keywordTrimmed) {
            query.$text = { $search: keywordTrimmed };
        }
        if (from_date || to_date) {
            query.timestamp = {};
            if (from_date)
                query.timestamp.$gte = new Date(String(from_date));
            if (to_date)
                query.timestamp.$lte = new Date(String(to_date));
        }
        else {
            query.timestamp = {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            };
        }
        const logs = await Log.find(query)
            .lean()
            .sort({ [String(sort)]: order === 'desc' ? -1 : 1 })
            .skip(parseInt(String(skip), 10))
            .limit(parseInt(String(limit), 10));
        const total = await Log.countDocuments(query);
        res.status(200).json({
            data: logs,
            pagination: {
                page: parseInt(String(page), 10),
                limit: parseInt(String(limit), 10),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Failed to search logs:', error);
        res.status(500).json({ error: 'Failed to search logs' });
    }
}
async function summaryLogs(req, res) {
    try {
        const { agent_id } = req.params;
        const { from_date, to_date } = req.query;
        const timeRange = {
            start: from_date ? new Date(String(from_date)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: to_date ? new Date(String(to_date)) : new Date(),
        };
        const summary = await Log.getStats(timeRange, 'agent_id');
        const agentSummary = agent_id ? summary.find((s) => s._id === agent_id) : summary;
        if (agent_id && !agentSummary) {
            res.status(404).json({ message: 'Agent not found' });
            return;
        }
        res.status(200).json({
            data: agentSummary || summary,
            timeRange,
        });
    }
    catch (error) {
        console.error('Failed to get logs summary:', error);
        res.status(500).json({ error: 'Failed to get logs summary' });
    }
}
async function health(_req, res) {
    try {
        const eventBusHealth = await eventBus.health();
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            eventBus: eventBusHealth,
            mongodb: 'connected',
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(503).json({
            status: 'unhealthy',
            error: message,
            timestamp: new Date().toISOString(),
        });
    }
}
