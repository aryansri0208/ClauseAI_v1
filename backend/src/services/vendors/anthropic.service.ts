import type { NormalizedVendorUsage } from '../../types/vendor.types';

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

export async function fetchUsage(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  const res = await fetch(`${ANTHROPIC_API}/models`, {
    headers: authHeaders(config.apiKey),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return (data.data ?? []).map((m: any) => ({
    modelOrResource: m.id,
    usageAmount: undefined,
    unit: 'tokens',
  }));
}

export async function fetchProjects(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  try {
    const res = await fetch(`${ANTHROPIC_API}/organizations/workspaces`, {
      headers: authHeaders(config.apiKey),
    });

    if (res.ok) {
      const data = await res.json();
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

export async function fetchCostMetrics(_config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  return [];
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
