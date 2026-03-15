import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createCompany } from '../controllers/company.controller';

const createCompanySchema = z.object({
  name: z.string().min(1).max(500),
  size: z.string().optional(),
  ai_use_case: z.string().optional(),
  monthly_ai_spend_estimate: z.string().optional(),
  compliance_requirement: z.string().optional(),
});

const router = Router();
router.post('/', authMiddleware, validate(createCompanySchema), createCompany);

export default router;
