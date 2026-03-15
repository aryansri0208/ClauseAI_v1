import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface GoogleServiceConfig {
  apiKey: string;
}

export async function fetchUsage(_config: GoogleServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  // Stub: Vertex AI / Gemini usage
  return [
    { modelOrResource: 'gemini-1.5-pro', usageAmount: 1500000, unit: 'tokens' },
    { modelOrResource: 'gemini-1.5-flash', usageAmount: 3000000, unit: 'tokens' },
  ];
}

export async function fetchProjects(_config: GoogleServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  return [
    { id: 'proj-1', name: 'Analytics' },
    { id: 'proj-2', name: 'Doc Intelligence' },
  ];
}

export async function fetchCostMetrics(config: GoogleServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  const usage = await fetchUsage(config);
  const amount = usage.length * 9000;
  return [{ amount, currency: 'USD', period: 'month' }];
}

export async function getNormalizedUsage(config: GoogleServiceConfig): Promise<NormalizedVendorUsage> {
  const [projects, usage, costMetrics] = await Promise.all([
    fetchProjects(config),
    fetchUsage(config),
    fetchCostMetrics(config),
  ]);
  return {
    vendor: 'Google Vertex AI',
    projects,
    usage,
    costMetrics,
  };
}
