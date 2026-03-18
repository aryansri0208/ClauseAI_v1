import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { startScan, getScanStatus } from '../controllers/scan.controller';

const router = Router();
router.post('/start', authMiddleware, startScan);
router.get('/:jobId/status', authMiddleware, getScanStatus);

export default router;
