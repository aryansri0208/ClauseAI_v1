import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface PineconeServiceConfig {
  apiKey: string;
}

export async function fetchUsage(_config: PineconeServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  // Stub: index list + query metrics
  return [
    { modelOrResource: 'index-1', usageAmount: 1000000, unit: 'queries' },
    { modelOrResource: 'index-2', usageAmount: 500000, unit: 'queries' },
  ];
}

export async function fetchProjects(_config: PineconeServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  return [
    { id: 'index-1', name: 'Knowledge Base' },
    { id: 'index-2', name: 'Recommendations' },
  ];
}

export async function fetchCostMetrics(config: PineconeServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  const usage = await fetchUsage(config);
  const amount = usage.length * 3500;
  return [{ amount, currency: 'USD', period: 'month' }];
}

export async function getNormalizedUsage(config: PineconeServiceConfig): Promise<NormalizedVendorUsage> {
  const [projects, usage, costMetrics] = await Promise.all([
    fetchProjects(config),
    fetchUsage(config),
    fetchCostMetrics(config),
  ]);
  return {
    vendor: 'Pinecone',
    projects,
    usage,
    costMetrics,
  };
}
