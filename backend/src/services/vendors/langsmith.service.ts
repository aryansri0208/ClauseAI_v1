import type { NormalizedVendorUsage } from '../../types/vendor.types';

export interface LangSmithServiceConfig {
  apiKey: string;
}

const LANGSMITH_API = 'https://api.smith.langchain.com/api/v1';

function authHeaders(apiKey: string): Record<string, string> {
  return { 'x-api-key': apiKey };
}

async function listSessions(apiKey: string): Promise<any[]> {
  const res = await fetch(`${LANGSMITH_API}/sessions?limit=50`, {
    headers: authHeaders(apiKey),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LangSmith API ${res.status}: ${body}`);
  }

  const sessions = await res.json();
  return sessions ?? [];
}

export async function fetchUsage(config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  const sessions = await listSessions(config.apiKey);

  return sessions.map((s: any) => ({
    modelOrResource: s.name ?? s.id,
    usageAmount: s.run_count ?? s.total_runs ?? undefined,
    unit: 'runs',
    projectId: s.id,
  }));
}

export async function fetchProjects(config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  const sessions = await listSessions(config.apiKey);

  return sessions.map((s: any) => ({
    id: s.id,
    name: s.name ?? 'Unnamed Project',
  }));
}

export async function fetchCostMetrics(_config: LangSmithServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  return [];
}

export async function getNormalizedUsage(config: LangSmithServiceConfig): Promise<NormalizedVendorUsage> {
  const sessions = await listSessions(config.apiKey);

  const projects = sessions.map((s: any) => ({
    id: s.id,
    name: s.name ?? 'Unnamed Project',
  }));

  const usage = sessions.map((s: any) => ({
    modelOrResource: s.name ?? s.id,
    usageAmount: s.run_count ?? s.total_runs ?? undefined,
    unit: 'runs',
    projectId: s.id,
  }));

  return {
    vendor: 'LangSmith',
    projects,
    usage,
    costMetrics: [],
  };
}
