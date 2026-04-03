import { Router } from 'express';
import * as logController from '../controllers/logController';

const router = Router();

// Static paths must be registered before /logs/:agent_id
router.get('/logs/search', logController.searchLogs);
router.get('/logs/summary/:agent_id', logController.summaryLogs);

router.post('/logs', logController.createLog);
router.post('/logs/bulk', logController.createBulkLogs);

router.get('/logs/:agent_id', logController.getLogsByAgent);
router.get('/logs/:agent_id/:step_id', logController.getLogStep);
router.put('/logs/:agent_id/:step_id', logController.updateLogReview);

router.get('/health', logController.health);

export default router;
