// src/lib/api.ts
// Use NEXT_PUBLIC_API_BASE_URL for backend (e.g. http://localhost:4000 when Next runs on 3000).

const API_BASE_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : "http://localhost:3000";

export interface CreateCompanyPayload {
  name: string;
  size: "1-10" | "11-50" | "51-200";
  ai_use_case: string;
  monthly_ai_spend_estimate: string;
  compliance_requirement: "soc2" | "hipaa" | "gdpr";
}

export interface CreateCompanyResponse {
  id: string;
  name?: string;
  size?: string | null;
  ai_use_case?: string | null;
  monthly_ai_spend_estimate?: string | null;
  compliance_requirement?: string | null;
  created_at?: string;
}

export interface Company {
  id: string;
  name: string;
  size?: string | null;
  ai_use_case?: string | null;
  monthly_ai_spend_estimate?: string | null;
  compliance_requirement?: string | null;
  created_at?: string;
}

/** Backend expects one vendor per request: vendor_name + api_key; company_id optional (for onboarding). */
export type VendorName =
  | 'OpenAI'
  | 'Anthropic'
  | 'Google Vertex AI'
  | 'Pinecone'
  | 'LangSmith';

export interface ConnectVendorPayload {
  company_id?: string;
  vendor_name: VendorName;
  api_key: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    // ignore JSON parse error; data stays undefined
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    if (data && typeof data === 'object') {
      const d = data as { message?: string; error?: string };
      if (typeof d.message === 'string' && d.message) message = d.message;
      else if (typeof d.error === 'string' && d.error) message = d.error;
    }
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export async function createCompany(
  payload: CreateCompanyPayload,
  options?: RequestInit
): Promise<CreateCompanyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    body: JSON.stringify(payload),
    ...options,
  });

  return handleJsonResponse<CreateCompanyResponse>(response);
}

/** Connect a single vendor (backend expects one vendor per POST; company_id optional). */
export async function connectVendor(
  payload: ConnectVendorPayload,
  options?: RequestInit
): Promise<void> {
  const body: { vendor_name: VendorName; api_key: string; company_id?: string } = {
    vendor_name: payload.vendor_name,
    api_key: payload.api_key,
  };
  if (payload.company_id) body.company_id = payload.company_id;

  const response = await fetch(`${API_BASE_URL}/api/vendors/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...options,
  });

  await handleJsonResponse<unknown>(response);
}

/** Connect multiple vendors in parallel; only call with non-empty trimmed keys */
export async function connectVendors(
  connections: ConnectVendorPayload[],
  options?: RequestInit
): Promise<void> {
  if (connections.length === 0) return;
  await Promise.all(connections.map((c) => connectVendor(c, options)));
}

/** Fetch company by id (backend may expose GET /api/company/:id) */
export async function getCompany(
  companyId: string,
  options?: RequestInit
): Promise<Company> {
  const response = await fetch(`${API_BASE_URL}/api/company/${companyId}`, {
    method: "GET",
    headers: options?.headers as HeadersInit,
    ...options,
  });
  return handleJsonResponse<Company>(response);
}