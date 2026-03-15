import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface OpenAIServiceConfig {
  apiKey: string;
}

export async function fetchUsage(_config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  // Stub: call OpenAI Usage API (e.g. /v1/usage or dashboard API)
  return [
    { modelOrResource: 'gpt-4o', usageAmount: 1000000, unit: 'tokens' },
    { modelOrResource: 'gpt-4o-mini', usageAmount: 5000000, unit: 'tokens' },
  ];
}

export async function fetchProjects(_config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  // Stub: list orgs/projects
  return [
    { id: 'org-1', name: 'Production' },
    { id: 'org-2', name: 'Staging' },
  ];
}

export async function fetchCostMetrics(config: OpenAIServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  const usage = await fetchUsage(config);
  // Stub: map usage to cost (e.g. from billing API or pricing table)
  const amount = usage.length * 15000; // placeholder
  return [{ amount, currency: 'USD', period: 'month' }];
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
