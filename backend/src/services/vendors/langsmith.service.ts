import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface LangSmithServiceConfig {
  apiKey: string;
}

export async function fetchUsage(_config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  // Stub: trace / run metrics
  return [
    { modelOrResource: 'default', usageAmount: 50000, unit: 'runs' },
  ];
}

export async function fetchProjects(_config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  return [
    { id: 'default', name: 'Default Project' },
  ];
}

export async function fetchCostMetrics(config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  const usage = await fetchUsage(config);
  const amount = usage.length * 2000;
  return [{ amount, currency: 'USD', period: 'month' }];
}

export async function getNormalizedUsage(config: LangSmithServiceConfig): Promise<NormalizedVendorUsage> {
  const [projects, usage, costMetrics] = await Promise.all([
    fetchProjects(config),
    fetchUsage(config),
    fetchCostMetrics(config),
  ]);
  return {
    vendor: 'LangSmith',
    projects,
    usage,
    costMetrics,
  };
}
