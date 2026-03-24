import type { NormalizedVendorUsage } from '../../types/vendor.types';
import { logger } from '../../config/logger';

export interface AnthropicServiceConfig {
  apiKey: string;
}

const ANTHROPIC_API = 'https://api.anthropic.com/v1';

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
}

function isAdminKey(apiKey: string): boolean {
  return apiKey.startsWith('sk-ant-admin');
}

async function fetchUsageFromAdminAPI(
  config: AnthropicServiceConfig,
): Promise<NormalizedVendorUsage['usage'] | null> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);

  const modelMap = new Map<string, number>();
  let nextPage: string | null = null;

  do {
    const url = new URL(`${ANTHROPIC_API}/organizations/usage_report/messages`);
    url.searchParams.set('starting_at', thirtyDaysAgo.toISOString());
    url.searchParams.set('ending_at', now.toISOString());
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.append('group_by[]', 'model');
    if (nextPage) url.searchParams.set('page', nextPage);

    const res = await fetch(url.toString(), {
      headers: authHeaders(config.apiKey),
    });

    if (res.status === 401 || res.status === 403) {
      logger.warn('Anthropic usage Admin API returned %d — key lacks admin permissions, falling back to model listing', res.status);
      return null;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic Usage Admin API ${res.status}: ${body}`);
    }

    const data: any = await res.json();

    for (const bucket of data.data ?? []) {
      for (const result of bucket.results ?? []) {
        const model: string = result.model ?? 'unknown';
        const tokens =
          (result.uncached_input_tokens ?? 0) +
          (result.cache_read_input_tokens ?? 0) +
          ((result.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
           (result.cache_creation?.ephemeral_1h_input_tokens ?? 0)) +
          (result.output_tokens ?? 0);
        modelMap.set(model, (modelMap.get(model) ?? 0) + tokens);
      }
    }

    nextPage = data.has_more ? (data.next_page ?? null) : null;
  } while (nextPage);

  return Array.from(modelMap.entries()).map(([model, tokens]) => ({
    modelOrResource: model,
    usageAmount: tokens,
    unit: 'tokens',
  }));
}

async function fetchModelsAsFallback(
  config: AnthropicServiceConfig,
): Promise<NormalizedVendorUsage['usage']> {
  const res = await fetch(`${ANTHROPIC_API}/models`, {
    headers: authHeaders(config.apiKey),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic Models API ${res.status}: ${body}`);
  }

  const data: any = await res.json();
  return (data.data ?? []).map((m: any) => ({
    modelOrResource: m.id,
    usageAmount: undefined,
    unit: 'tokens',
  }));
}

export async function fetchUsage(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  try {
    const adminUsage = await fetchUsageFromAdminAPI(config);

    if (adminUsage && adminUsage.length > 0) {
      return adminUsage;
    }

    if (adminUsage && adminUsage.length === 0) {
      logger.warn('Anthropic Admin API returned empty usage data for the last 30 days, falling back to model listing');
    }
  } catch (err) {
    logger.warn('Anthropic Admin API usage fetch failed: %s', err instanceof Error ? err.message : err);
  }

  if (isAdminKey(config.apiKey)) {
    logger.warn('Admin key cannot access /v1/models — returning empty usage');
    return [];
  }

  return fetchModelsAsFallback(config);
}

export async function fetchProjects(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  try {
    const res = await fetch(`${ANTHROPIC_API}/organizations/workspaces`, {
      headers: authHeaders(config.apiKey),
    });

    if (res.ok) {
      const data: any = await res.json();
      return (data.data ?? []).map((w: any) => ({
        id: w.id,
        name: w.display_name ?? w.name,
      }));
    }
  } catch {
    // Non-admin key or network issue — fall through to default
  }

  return [{ id: 'default', name: 'Default Workspace' }];
}

export async function fetchCostMetrics(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  if (!isAdminKey(config.apiKey)) {
    return [];
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);

  const workspaceCosts = new Map<string, number>();
  let nextPage: string | null = null;

  do {
    const url = new URL(`${ANTHROPIC_API}/organizations/cost_report`);
    url.searchParams.set('starting_at', thirtyDaysAgo.toISOString());
    url.searchParams.set('ending_at', now.toISOString());
    url.searchParams.set('bucket_width', '1d');
    if (nextPage) url.searchParams.set('page', nextPage);

    const res = await fetch(url.toString(), {
      headers: authHeaders(config.apiKey),
    });

    if (res.status === 401 || res.status === 403) {
      logger.warn('Anthropic cost Admin API returned %d — key lacks admin permissions', res.status);
      return [];
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic Cost Admin API ${res.status}: ${body}`);
    }

    const data: any = await res.json();

    for (const bucket of data.data ?? []) {
      for (const result of bucket.results ?? []) {
        const workspaceId: string = result.workspace_id ?? 'default';
        const amount = parseFloat(result.amount ?? '0');
        workspaceCosts.set(workspaceId, (workspaceCosts.get(workspaceId) ?? 0) + amount);
      }
    }

    nextPage = data.has_more ? (data.next_page ?? null) : null;
  } while (nextPage);

  return Array.from(workspaceCosts.entries()).map(([projectId, amount]) => ({
    projectId,
    amount,
    currency: 'USD',
    period: 'month',
  }));
}

export async function getNormalizedUsage(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage> {
  const [projects, usage, costMetrics] = await Promise.all([
    fetchProjects(config),
    fetchUsage(config),
    fetchCostMetrics(config),
  ]);
  return {
    vendor: 'Anthropic',
    projects,
    usage,
    costMetrics,
  };
}
