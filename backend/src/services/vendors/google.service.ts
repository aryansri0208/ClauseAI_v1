import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface GoogleServiceConfig {
  apiKey: string;
}

const GENERATIVE_AI_API = 'https://generativelanguage.googleapis.com/v1beta';

export async function fetchUsage(config: GoogleServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  const res = await fetch(`${GENERATIVE_AI_API}/models?key=${config.apiKey}`);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google AI API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return (data.models ?? [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => ({
      modelOrResource: m.name?.replace('models/', '') ?? m.displayName,
      usageAmount: undefined,
      unit: 'tokens',
    }));
}

export async function fetchProjects(_config: GoogleServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  return [{ id: 'default', name: 'Google AI Studio' }];
}

export async function fetchCostMetrics(_config: GoogleServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  return [];
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
