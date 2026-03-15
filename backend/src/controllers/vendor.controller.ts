import { Response } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { encrypt } from '../utils/encryption';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { isVendorName } from '../types/vendor.types';
import { logger } from '../config/logger';

export async function connectVendor(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const { vendor_name, api_key } = req.body;

  if (!isVendorName(vendor_name)) {
    res.status(400).json({
      error: 'Invalid vendor',
      supported: ['OpenAI', 'Anthropic', 'Google Vertex AI', 'Pinecone', 'LangSmith'],
    });
    return;
  }

  const supabase = getSupabaseAdmin();

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();

  if (!company) {
    res.status(404).json({ error: 'Company not found. Create a company first.' });
    return;
  }

  let encryptedKey: string;
  try {
    encryptedKey = encrypt(api_key);
  } catch (err) {
    logger.error('Encryption failed', { vendor: vendor_name });
    res.status(500).json({ error: 'Failed to store API key securely' });
    return;
  }

  const { data: connection, error } = await supabase
    .from('vendor_connections')
    .upsert(
      {
        company_id: company.id,
        vendor_name,
        encrypted_api_key: encryptedKey,
        connection_status: 'active',
      },
      { onConflict: 'company_id,vendor_name', ignoreDuplicates: false }
    )
    .select('id, vendor_name, connection_status, created_at')
    .single();

  if (error) {
    logger.error('Vendor connect failed', { error: error.message, vendor: vendor_name });
    res.status(500).json({ error: 'Failed to save vendor connection' });
    return;
  }

  logger.info('Vendor connected', { vendor: vendor_name, companyId: company.id });
  res.status(201).json(connection);
}
