import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface OpenAIServiceConfig {
  apiKey: string;
}

const BASE = 'https://api.openai.com/v1/organization';

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function fetchUsage(config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  const startTime = Math.floor(Date.now() / 1000) - 30 * 86400;
  const modelMap = new Map<string, number>();
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({
      start_time: String(startTime),
      bucket_width: '1d',
      group_by: 'model',
    });
    if (cursor) params.set('page', cursor);

    const res = await fetch(`${BASE}/usage/completions?${params}`, {
      headers: authHeaders(config.apiKey),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI Usage API ${res.status}: ${body}`);
    }

    const data: any = await res.json();

    for (const bucket of data.data ?? []) {
      for (const result of bucket.results ?? []) {
        const model = result.model ?? 'unknown';
        const tokens = (result.input_tokens ?? 0) + (result.output_tokens ?? 0);
        modelMap.set(model, (modelMap.get(model) ?? 0) + tokens);
      }
    }

    cursor = data.next_page ?? null;
  } while (cursor);

  return Array.from(modelMap.entries()).map(([model, tokens]) => ({
    modelOrResource: model,
    usageAmount: tokens,
    unit: 'tokens',
  }));
}

export async function fetchCostMetrics(config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  const startTime = Math.floor(Date.now() / 1000) - 30 * 86400;
  const projectCosts = new Map<string, number>();
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({
      start_time: String(startTime),
      bucket_width: '1d',
      group_by: 'project_id',
    });
    if (cursor) params.set('page', cursor);

    const res = await fetch(`${BASE}/costs?${params}`, {
      headers: authHeaders(config.apiKey),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI Costs API ${res.status}: ${body}`);
    }

    const data: any = await res.json();

    for (const bucket of data.data ?? []) {
      for (const result of bucket.results ?? []) {
        const projId = result.project_id ?? 'default';
        const amount = result.amount?.value ?? 0;
        projectCosts.set(projId, (projectCosts.get(projId) ?? 0) + amount);
      }
    }

    cursor = data.next_page ?? null;
  } while (cursor);

  return Array.from(projectCosts.entries()).map(([projectId, amount]) => ({
    projectId,
    amount,
    currency: 'USD',
    period: 'month',
  }));
}

export async function fetchProjects(config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  const res = await fetch(`${BASE}/projects?limit=100`, {
    headers: authHeaders(config.apiKey),
  });

  if (res.status === 404) {
    return [{ id: 'default', name: 'Default Project' }];
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI Projects API ${res.status}: ${body}`);
  }

  const data: any = await res.json();
  return (data.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
  }));
}

export async function getNormalizedUsage(config: OpenAIServiceConfig): Promise<NormalizedVendorUsage> {
  const [projects, usage, costMetrics] = await Promise.all([
    fetchProjects(config),
    fetchUsage(config),
    fetchCostMetrics(config),
  ]);
  return {
    vendor: 'OpenAI',
    projects,
    usage,
    costMetrics,
  };
}
