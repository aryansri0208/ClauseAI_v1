import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { listSystems, updateSystem } from '../controllers/system.controller';

const updateSystemSchema = z.object({
  team_owner: z.string().optional(),
  system_type: z.string().optional(),
  environment: z.string().optional(),
});

const router = Router();
router.get('/', authMiddleware, listSystems);
router.patch('/:id', authMiddleware, validate(updateSystemSchema, 'body'), updateSystem);

export default router;
