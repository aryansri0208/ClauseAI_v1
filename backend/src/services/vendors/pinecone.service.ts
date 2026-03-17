import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface PineconeServiceConfig {
  apiKey: string;
}

const PINECONE_API = 'https://api.pinecone.io';

function authHeaders(apiKey: string): Record<string, string> {
  return { 'Api-Key': apiKey };
}

async function listIndexes(apiKey: string): Promise<any[]> {
  const res = await fetch(`${PINECONE_API}/indexes`, {
    headers: authHeaders(apiKey),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pinecone List Indexes API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.indexes ?? [];
}

export async function fetchUsage(config: PineconeServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  const indexes = await listIndexes(config.apiKey);
  const usage: NormalizedVendorUsage['usage'] = [];

  for (const idx of indexes) {
    try {
      const statsRes = await fetch(`https://${idx.host}/describe_index_stats`, {
        method: 'POST',
        headers: {
          ...authHeaders(config.apiKey),
          'Content-Type': 'application/json',
        },
        body: '{}',
      });

      if (statsRes.ok) {
        const stats = await statsRes.json();
        usage.push({
          modelOrResource: idx.name,
          usageAmount: stats.totalVectorCount ?? stats.total_vector_count ?? 0,
          unit: 'vectors',
          projectId: idx.name,
        });
      } else {
        usage.push({
          modelOrResource: idx.name,
          usageAmount: undefined,
          unit: 'vectors',
        });
      }
    } catch {
      usage.push({
        modelOrResource: idx.name,
        usageAmount: undefined,
        unit: 'vectors',
      });
    }
  }

  return usage;
}

export async function fetchProjects(config: PineconeServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  const indexes = await listIndexes(config.apiKey);
  return indexes.map((idx: any) => ({
    id: idx.name,
    name: idx.name,
  }));
}

export async function fetchCostMetrics(config: PineconeServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  const indexes = await listIndexes(config.apiKey);
  const costs: NormalizedVendorUsage['costMetrics'] = [];

  for (const idx of indexes) {
    let monthlyCost = 0;

    if (idx.spec?.pod) {
      const pods = idx.spec.pod.pods ?? 1;
      const replicas = idx.spec.pod.replicas ?? 1;
      const podType: string = idx.spec.pod.pod_type ?? 'p1.x1';
      const baseCost = podType.startsWith('p2') ? 100 : podType.startsWith('s1') ? 100 : 70;
      monthlyCost = baseCost * pods * replicas;
    } else if (idx.spec?.serverless) {
      monthlyCost = 25;
    }

    costs.push({
      projectId: idx.name,
      amount: monthlyCost,
      currency: 'USD',
      period: 'month',
    });
  }

  return costs;
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
