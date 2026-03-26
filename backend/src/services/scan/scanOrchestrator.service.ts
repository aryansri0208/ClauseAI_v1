import { getSupabaseAdmin } from '../../config/supabase';
import { decrypt } from '../../utils/encryption';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { isVendorName, type VendorName, type NormalizedVendorUsage } from '../../types/vendor.types';
import { getNormalizedUsage as getOpenAI } from '../vendors/openai.service';
import { getNormalizedUsage as getAnthropic } from '../vendors/anthropic.service';
import { getNormalizedUsage as getGoogle, type GoogleServiceConfig } from '../vendors/google.service';
import { getNormalizedUsage as getPinecone } from '../vendors/pinecone.service';
import { getNormalizedUsage as getLangSmith } from '../vendors/langsmith.service';
import { normalizeToSystems } from '../discovery/systemDiscovery.service';
import { inferMetadata } from '../inference/metadataInference.service';

type VendorConfigBuilder = (apiKey: string) => any;

const VENDOR_SERVICES: Record<
  VendorName,
  { buildConfig: VendorConfigBuilder; fetch: (config: any) => Promise<NormalizedVendorUsage> }
> = {
  'OpenAI': {
    buildConfig: (apiKey) => ({ apiKey }),
    fetch: getOpenAI,
  },
  'Anthropic': {
    buildConfig: (apiKey) => ({ apiKey }),
    fetch: getAnthropic,
  },
  'Google Vertex AI': {
    buildConfig: (apiKey) => {
      const config: GoogleServiceConfig = { apiKey };
      if (env.GCP_BQ_PROJECT_ID && env.GCP_BQ_DATASET_ID && env.GCP_BQ_BILLING_TABLE) {
        config.bigquery = {
          projectId: env.GCP_BQ_PROJECT_ID,
          datasetId: env.GCP_BQ_DATASET_ID,
          billingTableId: env.GCP_BQ_BILLING_TABLE,
        };
      }
      return config;
    },
    fetch: getGoogle,
  },
  'Pinecone': {
    buildConfig: (apiKey) => ({ apiKey }),
    fetch: getPinecone,
  },
  'LangSmith': {
    buildConfig: (apiKey) => ({ apiKey }),
    fetch: getLangSmith,
  },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildUsageSummary(vendor: string, usage: NormalizedVendorUsage): string {
  const parts: string[] = [];

  const models = usage.usage
    .filter((u) => u.modelOrResource)
    .map((u) => u.modelOrResource!);

  if (vendor === 'Pinecone') {
    for (const u of usage.usage) {
      const count = u.usageAmount != null ? formatNumber(u.usageAmount) : '?';
      parts.push(`Found index '${u.modelOrResource}' · ${count} vectors`);
    }
  } else if (models.length > 0) {
    const display =
      models.length <= 4
        ? models.join(', ')
        : models.slice(0, 3).join(', ') + ` +${models.length - 3} more`;
    parts.push(`Found ${display}`);
  }

  if (usage.projects.length > 0) {
    parts.push(
      `${usage.projects.length} project${usage.projects.length === 1 ? '' : 's'}`,
    );
  }

  const totalCost = usage.costMetrics.reduce((s, c) => s + c.amount, 0);
  if (totalCost > 0) {
    parts.push(`Total cost: ${formatCost(totalCost)}/mo`);
  }

  const totalUsage = usage.usage.reduce((s, u) => s + (u.usageAmount ?? 0), 0);
  if (totalUsage === 0 && totalCost === 0) {
    parts.push('No usage detected on this key yet');
  }

  return parts.join(' · ') || 'No usage data found';
}

interface CollectedSystem {
  name: string;
  vendor: string;
  system_type: string | null;
  team_owner: string | null;
  environment: string | null;
  monthly_cost_estimate: number | null;
  primary_model: string | null;
  usage_amount: number | null;
  usage_unit: string | null;
  confidence: number;
  compliance_risk: string;
  rawModelOrResource?: string;
}

export async function runScan(scanJobId: string, companyId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase.from('scan_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', scanJobId);

  const log = async (vendor: string | null, message: string) => {
    await supabase.from('scan_logs').insert({ scan_job_id: scanJobId, vendor, message });
    logger.info('Scan log', { scanJobId, vendor, message });
  };

  const { data: connections } = await supabase
    .from('vendor_connections')
    .select('id, vendor_name, encrypted_api_key')
    .eq('company_id', companyId)
    .eq('connection_status', 'active');

  if (!connections?.length) {
    await log(null, 'No active vendor connections');
    await supabase.from('scan_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', scanJobId);
    return;
  }

  const allSystems: CollectedSystem[] = [];

  for (const conn of connections) {
    if (!isVendorName(conn.vendor_name)) continue;
    const service = VENDOR_SERVICES[conn.vendor_name];
    if (!service) continue;

    try {
      await log(conn.vendor_name, `Connected to ${conn.vendor_name} API · reading usage data`);
      const apiKey = decrypt(conn.encrypted_api_key);
      const vendorUsage = await service.fetch(service.buildConfig(apiKey));

      await log(conn.vendor_name, buildUsageSummary(conn.vendor_name, vendorUsage));

      const systems = normalizeToSystems(vendorUsage);
      for (const sys of systems) {
        const inferred = inferMetadata(sys);

        const matchingUsage = vendorUsage.usage.find(
          (u) => u.projectId === sys.rawProjectId || u.modelOrResource === sys.rawModelOrResource,
        ) ?? vendorUsage.usage[0];

        allSystems.push({
          name: sys.name,
          vendor: sys.vendor,
          system_type: inferred.system_type,
          team_owner: inferred.team_owner,
          environment: inferred.environment,
          monthly_cost_estimate: sys.monthlyCostEstimate ?? null,
          primary_model: sys.rawModelOrResource ?? null,
          usage_amount: matchingUsage?.usageAmount ?? null,
          usage_unit: matchingUsage?.unit ?? null,
          confidence: inferred.confidence,
          compliance_risk: inferred.compliance_risk,
          rawModelOrResource: sys.rawModelOrResource,
        });

        await log(
          conn.vendor_name,
          `Classified "${sys.name}" → ${inferred.system_type} · ${inferred.environment}`,
        );

        if (inferred.confidence >= 0.8) {
          await log(
            conn.vendor_name,
            `Inferred team: ${inferred.team_owner} · key prefix match · confidence ${Math.round(inferred.confidence * 100)}%`,
          );
        } else if (inferred.team_owner !== 'Unknown') {
          await log(
            conn.vendor_name,
            `Inferred team: ${inferred.team_owner} · vendor default · confidence ${Math.round(inferred.confidence * 100)}%`,
          );
        } else {
          await log(
            conn.vendor_name,
            `Team owner: unresolved · needs manual classification`,
          );
        }

        if (inferred.compliance_risk !== 'low') {
          await log(
            conn.vendor_name,
            `Flagged ${sys.name} · ${inferred.compliance_risk} compliance risk`,
          );
        } else {
          await log(
            conn.vendor_name,
            `Compliance: ${inferred.compliance_risk} risk · no flags`,
          );
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      await log(conn.vendor_name, `Error: ${msg}`);
      logger.error('Vendor scan failed', { vendor: conn.vendor_name, scanJobId, error: msg });
    }
  }

  const scannedVendors = [...new Set(allSystems.map((s) => s.vendor))];
  for (const vendorName of scannedVendors) {
    const vendorSystems = allSystems.filter((s) => s.vendor === vendorName);
    const vendorCost = vendorSystems.reduce(
      (sum, s) => sum + (s.monthly_cost_estimate ?? 0),
      0,
    );
    const vendorTeams = [
      ...new Set(
        vendorSystems
          .map((s) => s.team_owner)
          .filter((t) => t && t !== 'Unknown'),
      ),
    ];
    const costStr = vendorCost > 0 ? ` · ${formatCost(vendorCost)}/mo` : '';
    const teamStr =
      vendorTeams.length > 0
        ? ` · ${vendorTeams.length} team${vendorTeams.length === 1 ? '' : 's'} mapped`
        : '';
    await log(
      vendorName,
      `${vendorSystems.length} system${vendorSystems.length === 1 ? '' : 's'} found${costStr}${teamStr}`,
    );
  }

  for (const s of allSystems) {
    const { data: inserted } = await supabase
      .from('ai_systems')
      .insert({
        company_id: companyId,
        scan_job_id: scanJobId,
        name: s.name,
        vendor: s.vendor,
        system_type: s.system_type,
        team_owner: s.team_owner,
        environment: s.environment,
        monthly_cost_estimate: s.monthly_cost_estimate,
        primary_model: s.primary_model,
        usage_amount: s.usage_amount,
        usage_unit: s.usage_unit,
      })
      .select('id')
      .single();

    if (inserted) {
      await supabase.from('system_inferences').upsert(
        [
          { system_id: inserted.id, field_name: 'team_owner', inferred_value: s.team_owner, confidence_score: s.confidence },
          { system_id: inserted.id, field_name: 'system_type', inferred_value: s.system_type, confidence_score: s.confidence },
          { system_id: inserted.id, field_name: 'environment', inferred_value: s.environment, confidence_score: s.confidence },
        ],
        { onConflict: 'system_id,field_name' }
      );
      if (s.compliance_risk !== 'low') {
        await supabase.from('compliance_flags').insert({
          system_id: inserted.id,
          flag_type: `${s.compliance_risk} risk`,
          status: 'open',
        });
      }
    }
  }

  const totalCost = allSystems.reduce(
    (s, sys) => s + (sys.monthly_cost_estimate ?? 0),
    0,
  );
  const totalTeams = [
    ...new Set(
      allSystems.map((s) => s.team_owner).filter((t) => t && t !== 'Unknown'),
    ),
  ].length;
  const complianceFlags = allSystems.filter(
    (s) => s.compliance_risk !== 'low',
  ).length;
  const costSummary = totalCost > 0 ? ` · ${formatCost(totalCost)}/mo` : '';
  const teamSummary =
    totalTeams > 0
      ? ` · ${totalTeams} team${totalTeams === 1 ? '' : 's'}`
      : '';
  const flagSummary =
    complianceFlags > 0
      ? ` · ${complianceFlags} compliance flag${complianceFlags === 1 ? '' : 's'}`
      : '';
  await log(
    null,
    `Scan complete · ${allSystems.length} system${allSystems.length === 1 ? '' : 's'} discovered${costSummary}${teamSummary}${flagSummary}`,
  );

  await supabase.from('scan_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', scanJobId);
  logger.info('Scan completed', { scanJobId, companyId, systemsCount: allSystems.length });
}
