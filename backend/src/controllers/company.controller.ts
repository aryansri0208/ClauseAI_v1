import { Response } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

export async function createCompany(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const { name, size, ai_use_case, monthly_ai_spend_estimate, compliance_requirement } = req.body;

  const supabase = getSupabaseAdmin();

  const { data: existingUser } = await supabase.from('users').select('id').eq('id', user.id).single();
  if (!existingUser) {
    await supabase.from('users').upsert(
      { id: user.id, email: user.email, created_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert({
      owner_user_id: user.id,
      name,
      size: size ?? null,
      ai_use_case: ai_use_case ?? null,
      monthly_ai_spend_estimate: monthly_ai_spend_estimate ?? null,
      compliance_requirement: compliance_requirement ?? null,
    })
    .select('id, name, size, ai_use_case, monthly_ai_spend_estimate, compliance_requirement, created_at')
    .single();

  if (error) {
    logger.error('Create company failed', { error: error.message, userId: user.id });
    res.status(500).json({ error: 'Failed to create company' });
    return;
  }

  logger.info('Company created', { companyId: company.id, userId: user.id });
  res.status(201).json(company);
}
