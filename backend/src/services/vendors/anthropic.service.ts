import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface AnthropicServiceConfig {
  apiKey: string;
}

export async function fetchUsage(_config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  // Stub: call Anthropic usage API
  return [
    { modelOrResource: 'claude-3-5-sonnet', usageAmount: 2000000, unit: 'tokens' },
    { modelOrResource: 'claude-3-opus', usageAmount: 500000, unit: 'tokens' },
  ];
}

export async function fetchProjects(_config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  return [
    { id: 'ws-1', name: 'Platform' },
    { id: 'ws-2', name: 'ML Team' },
  ];
}

export async function fetchCostMetrics(config: AnthropicServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  const usage = await fetchUsage(config);
  const amount = usage.length * 10000;
  return [{ amount, currency: 'USD', period: 'month' }];
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
