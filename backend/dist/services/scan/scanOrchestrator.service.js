"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runScan = runScan;
const supabase_1 = require("../../config/supabase");
const encryption_1 = require("../../utils/encryption");
const logger_1 = require("../../config/logger");
const vendor_types_1 = require("../../types/vendor.types");
const openai_service_1 = require("../vendors/openai.service");
const anthropic_service_1 = require("../vendors/anthropic.service");
const google_service_1 = require("../vendors/google.service");
const pinecone_service_1 = require("../vendors/pinecone.service");
const langsmith_service_1 = require("../vendors/langsmith.service");
const systemDiscovery_service_1 = require("../discovery/systemDiscovery.service");
const metadataInference_service_1 = require("../inference/metadataInference.service");
const VENDOR_SERVICES = {
    'OpenAI': openai_service_1.getNormalizedUsage,
    'Anthropic': anthropic_service_1.getNormalizedUsage,
    'Google Vertex AI': google_service_1.getNormalizedUsage,
    'Pinecone': pinecone_service_1.getNormalizedUsage,
    'LangSmith': langsmith_service_1.getNormalizedUsage,
};
async function runScan(scanJobId, companyId) {
    const supabase = (0, supabase_1.getSupabaseAdmin)();
    await supabase.from('scan_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', scanJobId);
    const log = async (vendor, message) => {
        await supabase.from('scan_logs').insert({ scan_job_id: scanJobId, vendor, message });
        logger_1.logger.info('Scan log', { scanJobId, vendor, message });
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
    const allSystems = [];
    for (const conn of connections) {
        if (!(0, vendor_types_1.isVendorName)(conn.vendor_name))
            continue;
        const getUsage = VENDOR_SERVICES[conn.vendor_name];
        if (!getUsage)
            continue;
        try {
            await log(conn.vendor_name, `Connected to ${conn.vendor_name} API · reading usage data`);
            const apiKey = (0, encryption_1.decrypt)(conn.encrypted_api_key);
            const usage = await getUsage({ apiKey });
            await log(conn.vendor_name, `Fetched ${usage.projects?.length ?? 0} projects, ${usage.usage?.length ?? 0} usage entries`);
            const systems = (0, systemDiscovery_service_1.normalizeToSystems)(usage);
            for (const sys of systems) {
                const inferred = (0, metadataInference_service_1.inferMetadata)(sys);
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
        }
        catch (err) {
            const msg = err.message;
            await log(conn.vendor_name, `Error: ${msg}`);
            logger_1.logger.error('Vendor scan failed', { vendor: conn.vendor_name, scanJobId, error: msg });
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
            const inferred = (0, metadataInference_service_1.inferMetadata)({
                name: s.name,
                vendor: s.vendor,
                systemType: s.system_type,
                monthlyCostEstimate: s.monthly_cost_estimate ?? undefined,
            });
            await supabase.from('system_inferences').upsert([
                { system_id: inserted.id, field_name: 'team_owner', inferred_value: inferred.team_owner, confidence_score: inferred.confidence },
                { system_id: inserted.id, field_name: 'system_type', inferred_value: inferred.system_type, confidence_score: inferred.confidence },
                { system_id: inserted.id, field_name: 'environment', inferred_value: inferred.environment, confidence_score: inferred.confidence },
            ], { onConflict: 'system_id,field_name' });
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
    logger_1.logger.info('Scan completed', { scanJobId, companyId, systemsCount: allSystems.length });
}
//# sourceMappingURL=scanOrchestrator.service.js.map