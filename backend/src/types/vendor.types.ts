export const VENDOR_NAMES = [
  'OpenAI',
  'Anthropic',
  'Google Vertex AI',
  'Pinecone',
  'LangSmith',
] as const;

export type VendorName = (typeof VENDOR_NAMES)[number];

export function isVendorName(name: string): name is VendorName {
  return VENDOR_NAMES.includes(name as VendorName);
}

export interface VendorConnectionRow {
  id: string;
  company_id: string;
  vendor_name: string;
  encrypted_api_key: string;
  connection_status: 'active' | 'failed' | 'revoked';
  created_at: string;
}

export interface NormalizedVendorUsage {
  vendor: VendorName;
  projects: Array<{ id: string; name: string }>;
  usage: Array<{
    projectId?: string;
    modelOrResource?: string;
    usageAmount?: number;
    unit?: string;
  }>;
  costMetrics: Array<{
    projectId?: string;
    amount: number;
    currency: string;
    period?: string;
  }>;
}
