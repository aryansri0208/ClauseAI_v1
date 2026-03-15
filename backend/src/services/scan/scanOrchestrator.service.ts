import { getSupabaseAdmin } from '../../config/supabase';
import { decrypt } from '../../utils/encryption';
import { logger } from '../../config/logger';
import { isVendorName, type VendorName } from '../../types/vendor.types';
import { getNormalizedUsage as getOpenAI } from '../vendors/openai.service';
import { getNormalizedUsage as getAnthropic } from '../vendors/anthropic.service';
import { getNormalizedUsage as getGoogle } from '../vendors/google.service';
import { getNormalizedUsage as getPinecone } from '../vendors/pinecone.service';
import { getNormalizedUsage as getLangSmith } from '../vendors/langsmith.service';
import { normalizeToSystems } from '../discovery/systemDiscovery.service';
import { inferMetadata } from '../inference/metadataInference.service';

const VENDOR_SERVICES: Record<
  VendorName,
  (config: { apiKey: string }) => Promise<import('../../types/vendor.types').NormalizedVendorUsage>
> = {
  'OpenAI': getOpenAI,
  'Anthropic': getAnthropic,
  'Google Vertex AI': getGoogle,
  'Pinecone': getPinecone,
  'LangSmith': getLangSmith,
};

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

  const allSystems: Array<{ name: string; vendor: string; system_type: string | null; team_owner: string | null; environment: string | null; monthly_cost_estimate: number | null }> = [];

  for (const conn of connections) {
    if (!isVendorName(conn.vendor_name)) continue;
    const getUsage = VENDOR_SERVICES[conn.vendor_name];
    if (!getUsage) continue;

    try {
      await log(conn.vendor_name, `Connected to ${conn.vendor_name} API · reading usage data`);
      const apiKey = decrypt(conn.encrypted_api_key);
      const usage = await getUsage({ apiKey });
      await log(conn.vendor_name, `Fetched ${usage.projects?.length ?? 0} projects, ${usage.usage?.length ?? 0} usage entries`);

      const systems = normalizeToSystems(usage);
      for (const sys of systems) {
        const inferred = inferMetadata(sys);
        await log(conn.vendor_name, `Inferred team: ${inferred.team_owner} · system: ${sys.name}`);

        allSystems.push({
          name: sys.name,
          vendor: sys.vendor,
          system_type: inferred.system_type,
          team_owner: inferred.team_owner,
          environment: inferred.environment,
          monthly_cost_estimate: sys.monthlyCostEstimate ?? null,
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
      })
      .select('id')
      .single();

    if (inserted) {
      const inferred = inferMetadata({
        name: s.name,
        vendor: s.vendor,
        systemType: s.system_type as any,
        monthlyCostEstimate: s.monthly_cost_estimate ?? undefined,
      });
      await supabase.from('system_inferences').upsert(
        [
          { system_id: inserted.id, field_name: 'team_owner', inferred_value: inferred.team_owner, confidence_score: inferred.confidence },
          { system_id: inserted.id, field_name: 'system_type', inferred_value: inferred.system_type, confidence_score: inferred.confidence },
          { system_id: inserted.id, field_name: 'environment', inferred_value: inferred.environment, confidence_score: inferred.confidence },
        ],
        { onConflict: 'system_id,field_name' }
      );
      if (inferred.compliance_risk !== 'low') {
        await supabase.from('compliance_flags').insert({
          system_id: inserted.id,
          flag_type: `${inferred.compliance_risk} risk`,
          status: 'open',
        });
      }
    }
  }

  await log(null, `Scan complete · ${allSystems.length} systems discovered`);
  await supabase.from('scan_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', scanJobId);
  logger.info('Scan completed', { scanJobId, companyId, systemsCount: allSystems.length });
}
