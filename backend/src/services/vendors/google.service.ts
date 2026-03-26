import type { NormalizedVendorUsage } from '../../types/vendor.types';
import { logger } from '../../config/logger';

export interface GoogleServiceConfig {
  apiKey: string;
  bigquery?: {
    projectId: string;
    datasetId: string;
    billingTableId: string;
    credentials?: object;
  };
}

const GENERATIVE_AI_API = 'https://generativelanguage.googleapis.com/v1beta';

// ────────────────────────────────────────────────────────────
// SKU description parser
// ────────────────────────────────────────────────────────────

interface SkuParsed {
  model: string;
  direction: 'input' | 'output' | 'unknown';
}

export function extractModelFromSku(skuDescription: string): SkuParsed | null {
  const lower = skuDescription.toLowerCase();
  const match = lower.match(/^(gemini[\s\d.]+(?:pro|flash|ultra))/);
  if (!match) return null;

  const model = match[1].trim().replace(/\s+/g, '-');
  let direction: SkuParsed['direction'] = 'unknown';
  if (lower.includes('input')) direction = 'input';
  else if (lower.includes('output')) direction = 'output';

  return { model, direction };
}

// ────────────────────────────────────────────────────────────
// BigQuery path
// ────────────────────────────────────────────────────────────

function hasBigQueryConfig(
  config: GoogleServiceConfig,
): config is GoogleServiceConfig & { bigquery: Required<Pick<NonNullable<GoogleServiceConfig['bigquery']>, 'projectId' | 'datasetId' | 'billingTableId'>> & { credentials?: object } } {
  const bq = config.bigquery;
  return !!(bq?.projectId && bq?.datasetId && bq?.billingTableId);
}

async function fetchUsageFromBigQuery(
  config: GoogleServiceConfig,
): Promise<NormalizedVendorUsage['usage']> {
  const bq = config.bigquery!;
  const { BigQuery } = require('@google-cloud/bigquery');
  const client = new BigQuery({
    projectId: bq.projectId,
    ...(bq.credentials ? { credentials: bq.credentials } : {}),
  });

  const table = `\`${bq.projectId}.${bq.datasetId}.${bq.billingTableId}\``;
  const query = `
    SELECT
      sku.description AS sku_description,
      project.id AS project_id,
      SUM(usage.amount) AS total_usage,
      usage.unit AS usage_unit,
      SUM(cost) AS total_cost,
      currency
    FROM ${table}
    WHERE service.description = 'Vertex AI'
      AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      AND sku.description LIKE '%Gemini%'
    GROUP BY sku.description, project.id, usage.unit, currency
    ORDER BY total_cost DESC
  `;

  const [rows] = await client.query({ query });

  // Aggregate: model → total tokens (input + output combined)
  const modelMap = new Map<string, number>();
  for (const row of rows) {
    const parsed = extractModelFromSku(row.sku_description ?? '');
    if (!parsed) continue;
    modelMap.set(parsed.model, (modelMap.get(parsed.model) ?? 0) + (Number(row.total_usage) || 0));
  }

  return Array.from(modelMap.entries()).map(([model, tokens]) => ({
    modelOrResource: model,
    usageAmount: tokens,
    unit: 'tokens',
  }));
}

async function fetchCostMetricsFromBigQuery(
  config: GoogleServiceConfig,
): Promise<NormalizedVendorUsage['costMetrics']> {
  const bq = config.bigquery!;
  const { BigQuery } = require('@google-cloud/bigquery');
  const client = new BigQuery({
    projectId: bq.projectId,
    ...(bq.credentials ? { credentials: bq.credentials } : {}),
  });

  const table = `\`${bq.projectId}.${bq.datasetId}.${bq.billingTableId}\``;
  const query = `
    SELECT
      project.id AS project_id,
      SUM(cost) AS total_cost,
      currency
    FROM ${table}
    WHERE service.description = 'Vertex AI'
      AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    GROUP BY project.id, currency
    ORDER BY total_cost DESC
  `;

  const [rows] = await client.query({ query });

  return rows.map((row: any) => ({
    projectId: row.project_id ?? 'default',
    amount: Number(row.total_cost) || 0,
    currency: 'USD',
    period: 'month',
  }));
}

async function fetchProjectsFromBigQuery(
  config: GoogleServiceConfig,
): Promise<NormalizedVendorUsage['projects']> {
  const bq = config.bigquery!;
  const { BigQuery } = require('@google-cloud/bigquery');
  const client = new BigQuery({
    projectId: bq.projectId,
    ...(bq.credentials ? { credentials: bq.credentials } : {}),
  });

  const table = `\`${bq.projectId}.${bq.datasetId}.${bq.billingTableId}\``;
  const query = `
    SELECT DISTINCT project.id AS project_id
    FROM ${table}
    WHERE service.description = 'Vertex AI'
      AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  `;

  const [rows] = await client.query({ query });

  if (!rows.length) return [{ id: 'default', name: 'Google AI Studio' }];

  return rows.map((row: any) => ({
    id: row.project_id ?? 'default',
    name: row.project_id ?? 'Google AI Studio',
  }));
}

// ────────────────────────────────────────────────────────────
// Models API fallback (original implementation)
// ────────────────────────────────────────────────────────────

function deduplicateGeminiModels(
  models: Array<{ modelOrResource: string; usageAmount: undefined; unit: string }>,
): typeof models {
  const groups = new Map<string, typeof models[0]>();
  for (const m of models) {
    const base = m.modelOrResource.replace(/-(preview|\d{3})$/, '');
    const existing = groups.get(base);
    if (!existing || m.modelOrResource.length < existing.modelOrResource.length) {
      groups.set(base, m);
    }
  }
  return Array.from(groups.values());
}

async function fetchModelsAsFallback(
  config: GoogleServiceConfig,
): Promise<NormalizedVendorUsage['usage']> {
  const res = await fetch(`${GENERATIVE_AI_API}/models?key=${config.apiKey}`);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google AI API ${res.status}: ${body}`);
  }

  const data: any = await res.json();
  const allModels = (data.models ?? [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => ({
      modelOrResource: (m.name?.replace('models/', '') ?? m.displayName) as string,
      usageAmount: undefined as undefined,
      unit: 'tokens',
    }))
    .filter((m: { modelOrResource: string }) => m.modelOrResource.startsWith('gemini-'));

  return deduplicateGeminiModels(allModels);
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export async function fetchUsage(config: GoogleServiceConfig): Promise<NormalizedVendorUsage['usage']> {
  if (hasBigQueryConfig(config)) {
    try {
      const usage = await fetchUsageFromBigQuery(config);
      logger.info('Google: fetched usage from BigQuery (%d models)', usage.length);
      return usage;
    } catch (err) {
      logger.warn('Google: BigQuery usage fetch failed, falling back to models API: %s', (err as Error).message);
    }
  }

  logger.info('Google: using models API listing fallback');
  return fetchModelsAsFallback(config);
}

export async function fetchProjects(config: GoogleServiceConfig): Promise<NormalizedVendorUsage['projects']> {
  if (hasBigQueryConfig(config)) {
    try {
      return await fetchProjectsFromBigQuery(config);
    } catch (err) {
      logger.warn('Google: BigQuery projects fetch failed: %s', (err as Error).message);
    }
  }

  return [{ id: 'default', name: 'Google AI Studio' }];
}

export async function fetchCostMetrics(config: GoogleServiceConfig): Promise<NormalizedVendorUsage['costMetrics']> {
  if (hasBigQueryConfig(config)) {
    try {
      return await fetchCostMetricsFromBigQuery(config);
    } catch (err) {
      logger.warn('Google: BigQuery cost fetch failed: %s', (err as Error).message);
    }
  }

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
