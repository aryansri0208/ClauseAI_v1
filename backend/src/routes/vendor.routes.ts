import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { connectVendor, validateVendorKey } from '../controllers/vendor.controller';

const connectVendorSchema = z.object({
  vendor_name: z.enum(['OpenAI', 'Anthropic', 'Google Vertex AI', 'Pinecone', 'LangSmith'], {
    errorMap: () => ({ message: 'vendor_name must be one of: OpenAI, Anthropic, Google Vertex AI, Pinecone, LangSmith' }),
  }),
  api_key: z.string().min(1, 'api_key is required and must be non-empty'),
  company_id: z.string().uuid('company_id must be a valid UUID').optional(),
});

const validateVendorSchema = z.object({
  vendor_name: z.enum(['OpenAI', 'Anthropic', 'Google Vertex AI', 'Pinecone', 'LangSmith'], {
    errorMap: () => ({ message: 'vendor_name must be one of: OpenAI, Anthropic, Google Vertex AI, Pinecone, LangSmith' }),
  }),
  api_key: z.string().min(1, 'api_key is required and must be non-empty'),
});

const router = Router();
router.post('/validate', authMiddleware, validate(validateVendorSchema), validateVendorKey);
router.post('/connect', authMiddleware, validate(connectVendorSchema), connectVendor);

export default router;
