// backend/scripts/run-pipeline-dry.ts
// Run: npx tsx scripts/run-pipeline-dry.ts
//
// End-to-end pipeline validation using mock fixture data.
// Zero external dependencies — no env.ts, no supabase, no redis.

import type { NormalizedVendorUsage } from '../src/types/vendor.types';
import type { NormalizedAISystem } from '../src/types/system.types';

import {
  ANTHROPIC_ADMIN_USAGE_RESPONSE,
  ANTHROPIC_COST_RESPONSE,
  ANTHROPIC_WORKSPACES_RESPONSE,
} from '../src/__fixtures__/anthropic.fixtures';
import {
  OPENAI_USAGE_RESPONSE,
  OPENAI_COSTS_RESPONSE,
  OPENAI_PROJECTS_RESPONSE,
} from '../src/__fixtures__/openai.fixtures';
import {
  GOOGLE_MODELS_RESPONSE,
  GOOGLE_BIGQUERY_BILLING_ROWS,
} from '../src/__fixtures__/google.fixtures';

import { normalizeToSystems } from '../src/services/discovery/systemDiscovery.service';
import { inferMetadata } from '../src/services/inference/metadataInference.service';
import {
  estimateMonthlyCost,
  getModelTier,
  getCompetitiveRanking,
} from '../src/services/pricing/modelPricing.service';

// ────────────────────────────────────────────────────────────
// Fixture → NormalizedVendorUsage converters
// (replicate the exact aggregation logic from each vendor service)
// ────────────────────────────────────────────────────────────

function buildAnthropicUsage(): NormalizedVendorUsage {
  // Matches anthropic.service.ts: fetchUsageFromAdminAPI aggregation
  const modelMap = new Map<string, number>();
  for (const bucket of ANTHROPIC_ADMIN_USAGE_RESPONSE.data) {
    for (const result of bucket.results) {
      const model: string = result.model;
      const tokens =
        (result.uncached_input_tokens ?? 0) +
        (result.cache_read_input_tokens ?? 0) +
        ((result.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
         (result.cache_creation?.ephemeral_1h_input_tokens ?? 0)) +
        (result.output_tokens ?? 0);
      modelMap.set(model, (modelMap.get(model) ?? 0) + tokens);
    }
  }

  const usage: NormalizedVendorUsage['usage'] = Array.from(modelMap.entries()).map(
    ([model, tokens]) => ({
      modelOrResource: model,
      usageAmount: tokens,
      unit: 'tokens',
    }),
  );

  // Matches anthropic.service.ts: fetchCostMetrics aggregation
  const workspaceCosts = new Map<string, number>();
  for (const bucket of ANTHROPIC_COST_RESPONSE.data) {
    for (const result of bucket.results) {
      const wsId: string = result.workspace_id ?? 'default';
      const amount = parseFloat(result.amount ?? '0');
      workspaceCosts.set(wsId, (workspaceCosts.get(wsId) ?? 0) + amount);
    }
  }

  const costMetrics: NormalizedVendorUsage['costMetrics'] = Array.from(
    workspaceCosts.entries(),
  ).map(([projectId, amount]) => ({
    projectId,
    amount,
    currency: 'USD',
    period: 'month',
  }));

  // Matches anthropic.service.ts: fetchProjects
  const projects: NormalizedVendorUsage['projects'] = ANTHROPIC_WORKSPACES_RESPONSE.data.map(
    (w) => ({
      id: w.id,
      name: w.display_name,
    }),
  );

  return { vendor: 'Anthropic', projects, usage, costMetrics };
}

function buildOpenAIUsage(): NormalizedVendorUsage {
  // Matches openai.service.ts: fetchUsage aggregation
  const modelMap = new Map<string, number>();
  for (const bucket of OPENAI_USAGE_RESPONSE.data) {
    for (const result of bucket.results) {
      const model: string = result.model;
      const tokens = (result.input_tokens ?? 0) + (result.output_tokens ?? 0);
      modelMap.set(model, (modelMap.get(model) ?? 0) + tokens);
    }
  }

  const usage: NormalizedVendorUsage['usage'] = Array.from(modelMap.entries()).map(
    ([model, tokens]) => ({
      modelOrResource: model,
      usageAmount: tokens,
      unit: 'tokens',
    }),
  );

  // Matches openai.service.ts: fetchCostMetrics aggregation
  const projectCosts = new Map<string, number>();
  for (const bucket of OPENAI_COSTS_RESPONSE.data) {
    for (const result of bucket.results) {
      const projId: string = result.project_id ?? 'default';
      const amount = result.amount?.value ?? 0;
      projectCosts.set(projId, (projectCosts.get(projId) ?? 0) + amount);
    }
  }

  const costMetrics: NormalizedVendorUsage['costMetrics'] = Array.from(
    projectCosts.entries(),
  ).map(([projectId, amount]) => ({
    projectId,
    amount,
    currency: 'USD',
    period: 'month',
  }));

  // Matches openai.service.ts: fetchProjects
  const projects: NormalizedVendorUsage['projects'] = OPENAI_PROJECTS_RESPONSE.data.map(
    (p) => ({
      id: p.id,
      name: p.name,
    }),
  );

  return { vendor: 'OpenAI', projects, usage, costMetrics };
}

function buildGoogleUsage(): NormalizedVendorUsage {
  // google.service.ts currently only lists models from the free API (no billing).
  // Here we simulate a richer scenario: models from the API + BigQuery billing data.

  // Models from the free API — matches google.service.ts: fetchUsage
  const modelUsageFromAPI: NormalizedVendorUsage['usage'] = GOOGLE_MODELS_RESPONSE.models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({
      modelOrResource: m.name.replace('models/', ''),
      usageAmount: undefined,
      unit: 'tokens',
    }));

  // Enrich with BigQuery billing: group rows by model name extracted from sku_description,
  // sum usage (tokens) and cost per model, per project.
  const modelCostMap = new Map<string, { tokens: number; cost: number; projectId: string }>();
  for (const row of GOOGLE_BIGQUERY_BILLING_ROWS) {
    // Extract model name: "Gemini 2.5 Pro Online Prediction Text Input" → "gemini-2.5-pro"
    const skuLower = row.sku_description.toLowerCase();
    const modelMatch = skuLower.match(/^(gemini[\s\d.]+(?:pro|flash|ultra))/);
    if (!modelMatch) continue;
    const modelName = modelMatch[1].trim().replace(/\s+/g, '-');
    const key = `${modelName}::${row.project_id}`;

    const existing = modelCostMap.get(key) ?? { tokens: 0, cost: 0, projectId: row.project_id };
    existing.tokens += row.usage_amount;
    existing.cost += row.cost;
    modelCostMap.set(key, existing);
  }

  // Build usage entries from BigQuery data (overrides the API-only entries where available)
  const bqModels = new Set<string>();
  const bqUsage: NormalizedVendorUsage['usage'] = [];
  const bqCosts: NormalizedVendorUsage['costMetrics'] = [];

  for (const [key, data] of modelCostMap.entries()) {
    const modelName = key.split('::')[0];
    bqModels.add(modelName);
    bqUsage.push({
      modelOrResource: modelName,
      usageAmount: data.tokens,
      unit: 'tokens',
      projectId: data.projectId,
    });
    bqCosts.push({
      projectId: data.projectId,
      amount: data.cost,
      currency: 'USD',
      period: 'month',
    });
  }

  // Merge: use BQ data where we have it, fall back to API listing for others
  const usage = [
    ...bqUsage,
    ...modelUsageFromAPI.filter((u) => !bqModels.has(u.modelOrResource!)),
  ];

  // Projects from BigQuery
  const projectIds = [...new Set(GOOGLE_BIGQUERY_BILLING_ROWS.map((r) => r.project_id))];
  const projects =
    projectIds.length > 0
      ? projectIds.map((id) => ({ id, name: id }))
      : [{ id: 'default', name: 'Google AI Studio' }];

  return { vendor: 'Google Vertex AI', projects, usage, costMetrics: bqCosts };
}

// ────────────────────────────────────────────────────────────
// Pipeline runner
// ────────────────────────────────────────────────────────────

interface PipelineResult {
  name: string;
  vendor: string;
  model: string;
  type: string;
  team: string;
  environment: string;
  monthlyCost: string;
  costSource: string;
  complianceRisk: string;
  tier: string;
  confidence: string;
}

function runVendorPipeline(vendorUsage: NormalizedVendorUsage): PipelineResult[] {
  const systems: NormalizedAISystem[] = normalizeToSystems(vendorUsage);
  const results: PipelineResult[] = [];

  for (const system of systems) {
    const metadata = inferMetadata(system);
    const model = system.rawModelOrResource ?? '—';
    const tier = model !== '—' ? getModelTier(model) ?? '—' : '—';

    let monthlyCost = system.monthlyCostEstimate;
    let costSource = 'none';

    if (monthlyCost !== undefined) {
      // Determine if cost came from costMetrics (Admin API) or estimateMonthlyCost (pricing fallback).
      // If vendorUsage had costMetrics entries, and this system got a cost, it's from Admin API;
      // otherwise it's from the pricing estimate (set by systemDiscovery).
      const hasCostMetric = vendorUsage.costMetrics.some(
        (c) =>
          c.amount === monthlyCost &&
          (c.projectId === system.rawProjectId || !system.rawProjectId),
      );
      costSource = hasCostMetric ? 'Admin API' : 'Pricing Estimate';
    } else if (model !== '—') {
      // Try pricing estimate as a last resort (e.g. Google models from free API with no token count)
      const tokens = vendorUsage.usage.find(
        (u) => u.modelOrResource === model,
      )?.usageAmount;
      if (tokens) {
        monthlyCost = estimateMonthlyCost(model, tokens) ?? undefined;
        costSource = monthlyCost !== undefined ? 'Pricing Estimate' : 'none';
      }
    }

    results.push({
      name: system.name,
      vendor: system.vendor,
      model,
      type: metadata.system_type,
      team: metadata.team_owner,
      environment: metadata.environment,
      monthlyCost: monthlyCost !== undefined ? `$${monthlyCost.toFixed(2)}` : '—',
      costSource,
      complianceRisk: metadata.compliance_risk,
      tier,
      confidence: `${(metadata.confidence * 100).toFixed(0)}%`,
    });
  }

  return results;
}

function printTable(title: string, rows: PipelineResult[]) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(80)}`);

  if (rows.length === 0) {
    console.log('  (no systems discovered)');
    return;
  }

  const headers = [
    'System Name',
    'Vendor',
    'Model',
    'Type',
    'Team',
    'Env',
    'Monthly Cost',
    'Cost Source',
    'Risk',
    'Tier',
    'Conf',
  ];

  const keys: (keyof PipelineResult)[] = [
    'name',
    'vendor',
    'model',
    'type',
    'team',
    'environment',
    'monthlyCost',
    'costSource',
    'complianceRisk',
    'tier',
    'confidence',
  ];

  const widths = headers.map((h, i) => {
    const key = keys[i];
    return Math.max(h.length, ...rows.map((r) => String(r[key]).length));
  });

  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('│');

  console.log(`  ${headerLine}`);
  console.log(`  ${sep}`);

  for (const row of rows) {
    const line = keys.map((k, i) => ` ${String(row[k]).padEnd(widths[i])} `).join('│');
    console.log(`  ${line}`);
  }
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        ClauseAI Pipeline Dry Run — Fixture Data             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const allResults: PipelineResult[] = [];

  // ── Anthropic ──
  const anthropicUsage = buildAnthropicUsage();
  const anthropicResults = runVendorPipeline(anthropicUsage);
  printTable('Anthropic', anthropicResults);
  allResults.push(...anthropicResults);

  // ── OpenAI ──
  const openaiUsage = buildOpenAIUsage();
  const openaiResults = runVendorPipeline(openaiUsage);
  printTable('OpenAI', openaiResults);
  allResults.push(...openaiResults);

  // ── Google ──
  const googleUsage = buildGoogleUsage();
  const googleResults = runVendorPipeline(googleUsage);
  printTable('Google Vertex AI', googleResults);
  allResults.push(...googleResults);

  // ── Competitive Cost Ranking ──
  console.log(`\n${'═'.repeat(80)}`);
  console.log('  Competitive Cost Ranking (all models, blended cost ascending)');
  console.log(`${'═'.repeat(80)}`);

  const ranking = getCompetitiveRanking();
  const rankHeaders = ['#', 'Vendor', 'Model', 'Tier', 'Input $/1M', 'Output $/1M', 'Blended $/1M'];
  const rankRows = ranking.map((r, i) => {
    const blended = r.inputCost * 0.7 + r.outputCost * 0.3;
    return [
      String(i + 1),
      r.vendor,
      r.model,
      r.tier,
      `$${r.inputCost.toFixed(3)}`,
      `$${r.outputCost.toFixed(3)}`,
      `$${blended.toFixed(3)}`,
    ];
  });

  const rankWidths = rankHeaders.map((h, i) =>
    Math.max(h.length, ...rankRows.map((r) => r[i].length)),
  );

  const rankHeaderLine = rankHeaders.map((h, i) => ` ${h.padEnd(rankWidths[i])} `).join('│');
  const rankSep = rankWidths.map((w) => '─'.repeat(w + 2)).join('┼');

  console.log(`  ${rankHeaderLine}`);
  console.log(`  ${rankSep}`);
  for (const row of rankRows) {
    console.log(`  ${row.map((v, i) => ` ${v.padEnd(rankWidths[i])} `).join('│')}`);
  }

  // ── Classification Summary ──
  console.log(`\n${'═'.repeat(80)}`);
  console.log('  Classification Summary');
  console.log(`${'═'.repeat(80)}`);

  const totalSystems = allResults.length;

  const totalCost = allResults.reduce((sum, r) => {
    const val = parseFloat(r.monthlyCost.replace('$', ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const teams = [...new Set(allResults.map((r) => r.team))].sort();

  const complianceFlags = allResults.filter((r) => r.complianceRisk !== 'low');

  console.log(`  Total systems discovered:  ${totalSystems}`);
  console.log(`  Total estimated monthly:   $${totalCost.toFixed(2)}`);
  console.log(`  Teams identified:          ${teams.join(', ')}`);
  console.log(`  Compliance flags:          ${complianceFlags.length} system(s) with medium/high risk`);
  if (complianceFlags.length > 0) {
    for (const f of complianceFlags) {
      console.log(`    - ${f.name} (${f.vendor}): ${f.complianceRisk} risk`);
    }
  }

  console.log('');
}

main();
