import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { connectVendor } from '../controllers/vendor.controller';

const connectVendorSchema = z.object({
  vendor_name: z.enum(['OpenAI', 'Anthropic', 'Google Vertex AI', 'Pinecone', 'LangSmith']),
  api_key: z.string().min(1),
});

const router = Router();
router.post('/connect', authMiddleware, validate(connectVendorSchema), connectVendor);

export default router;
