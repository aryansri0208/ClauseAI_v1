import { getSupabaseAdmin } from '../../config/supabase';
import { decrypt } from '../../utils/encryption';
import { logger } from '../../config/logger';
import { isVendorName, type VendorName, type NormalizedVendorUsage } from '../../types/vendor.types';
import { getNormalizedUsage as getOpenAI } from '../vendors/openai.service';
import { getNormalizedUsage as getAnthropic } from '../vendors/anthropic.service';
import { getNormalizedUsage as getGoogle } from '../vendors/google.service';
import { getNormalizedUsage as getPinecone } from '../vendors/pinecone.service';
import { getNormalizedUsage as getLangSmith } from '../vendors/langsmith.service';
import { normalizeToSystems } from '../discovery/systemDiscovery.service';
import { inferMetadata } from '../inference/metadataInference.service';

const VENDOR_SERVICES: Record<
  VendorName,
  (config: { apiKey: string }) => Promise<NormalizedVendorUsage>
> = {
  'OpenAI': getOpenAI,
  'Anthropic': getAnthropic,
  'Google Vertex AI': getGoogle,
  'Pinecone': getPinecone,
  'LangSmith': getLangSmith,
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
    const display = models.length <= 4 ? models.join(', ') : models.slice(0, 3).join(', ') + ` +${models.length - 3} more`;
    parts.push(`Found ${display}`);
  }

  if (usage.projects.length > 0) {
    parts.push(`${usage.projects.length} project${usage.projects.length === 1 ? '' : 's'}`);
  }

  const totalCost = usage.costMetrics.reduce((s, c) => s + c.amount, 0);
  if (totalCost > 0) {
    parts.push(`Total cost: ${formatCost(totalCost)}/mo`);
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
    const getUsage = VENDOR_SERVICES[conn.vendor_name];
    if (!getUsage) continue;

    try {
      await log(conn.vendor_name, `Connected to ${conn.vendor_name} API · reading usage data`);
      const apiKey = decrypt(conn.encrypted_api_key);
      const vendorUsage = await getUsage({ apiKey });

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
      }
    } catch (err) {
      const msg = (err as Error).message;
      await log(conn.vendor_name, `Error: ${msg}`);
      logger.error('Vendor scan failed', { vendor: conn.vendor_name, scanJobId, error: msg });
    }
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

  await log(null, `Scan complete · ${allSystems.length} system${allSystems.length === 1 ? '' : 's'} discovered`);
  await supabase.from('scan_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', scanJobId);
  logger.info('Scan completed', { scanJobId, companyId, systemsCount: allSystems.length });
}
