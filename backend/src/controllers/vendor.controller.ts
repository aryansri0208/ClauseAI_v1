import { Response } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { encrypt } from '../utils/encryption';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import type { VendorName } from '../types/vendor.types';

export type ConnectVendorPayload = {
  company_id?: string;
  vendor_name: 'OpenAI' | 'Anthropic' | 'Google Vertex AI' | 'Pinecone' | 'LangSmith';
  api_key: string;
};

export async function connectVendor(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const { vendor_name, api_key, company_id: bodyCompanyId } = req.body as ConnectVendorPayload;

  const supabase = getSupabaseAdmin();

  let companyId: string;
  if (bodyCompanyId) {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', bodyCompanyId)
      .eq('owner_user_id', user.id)
      .single();
    if (companyError || !company) {
      logger.warn('Vendor connect: company not found or access denied', {
        companyId: bodyCompanyId,
        userId: user.id,
      });
      res.status(404).json({ error: 'Company not found or access denied.' });
      return;
    }
    companyId = company.id;
  } else {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_user_id', user.id)
      .single();
    if (companyError || !company) {
      logger.warn('Vendor connect: no company for user', { userId: user.id });
      res.status(404).json({ error: 'Company not found. Create a company first.' });
      return;
    }
    companyId = company.id;
  }

  let encryptedKey: string;
  try {
    encryptedKey = encrypt(api_key);
  } catch (err) {
    logger.error('Vendor key encryption failed', {
      vendor: vendor_name,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to store API key securely' });
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('vendor_connections')
    .upsert(
      {
        company_id: companyId,
        vendor_name: vendor_name as VendorName,
        encrypted_api_key: encryptedKey,
        connection_status: 'active',
        updated_at: now,
      },
      { onConflict: 'company_id,vendor_name', ignoreDuplicates: false }
    );

  if (error) {
    logger.error('Vendor connect DB failed', {
      vendor: vendor_name,
      companyId,
      message: error.message,
    });
    res.status(500).json({ error: 'Failed to store API key securely' });
    return;
  }

  logger.info('Vendor key stored', { vendor: vendor_name, companyId });
  res.status(200).json({
    message: 'Vendor key stored successfully',
    vendor_name,
  });
}
