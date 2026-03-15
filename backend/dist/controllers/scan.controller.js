"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScan = startScan;
exports.getScanStatus = getScanStatus;
const supabase_1 = require("../config/supabase");
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const scan_job_1 = require("../jobs/scan.job");
async function startScan(req, res) {
    const user = req.user;
    const supabase = (0, supabase_1.getSupabaseAdmin)();
    const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_user_id', user.id)
        .single();
    if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
    }
    const { data: job, error: insertError } = await supabase
        .from('scan_jobs')
        .insert({
        company_id: company.id,
        status: 'pending',
    })
        .select('id, status, created_at')
        .single();
    if (insertError || !job) {
        logger_1.logger.error('Failed to create scan job', { error: insertError?.message });
        res.status(500).json({ error: 'Failed to create scan job' });
        return;
    }
    try {
        await (0, scan_job_1.addScanJob)((0, redis_1.getRedis)(), { scanJobId: job.id, companyId: company.id });
    }
    catch (err) {
        logger_1.logger.error('Failed to enqueue scan job', { jobId: job.id, error: err.message });
        await supabase.from('scan_jobs').update({ status: 'failed' }).eq('id', job.id);
        res.status(500).json({ error: 'Failed to start scan' });
        return;
    }
    logger_1.logger.info('Scan job started', { jobId: job.id, companyId: company.id });
    res.status(202).json({ job_id: job.id, status: job.status });
}
async function getScanStatus(req, res) {
    const user = req.user;
    const { jobId } = req.params;
    const supabase = (0, supabase_1.getSupabaseAdmin)();
    const { data: job, error: jobError } = await supabase
        .from('scan_jobs')
        .select('id, company_id, status, started_at, completed_at, created_at')
        .eq('id', jobId)
        .single();
    if (jobError || !job) {
        res.status(404).json({ error: 'Scan job not found' });
        return;
    }
    const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('id', job.company_id)
        .eq('owner_user_id', user.id)
        .single();
    if (!company) {
        res.status(404).json({ error: 'Scan job not found' });
        return;
    }
    const { data: logs } = await supabase
        .from('scan_logs')
        .select('id, vendor, message, timestamp')
        .eq('scan_job_id', jobId)
        .order('timestamp', { ascending: true });
    const { data: systems } = await supabase
        .from('ai_systems')
        .select('id, vendor, monthly_cost_estimate')
        .eq('scan_job_id', jobId);
    const vendorsScanned = systems
        ? [...new Set(systems.map((s) => s.vendor))]
        : [];
    const totalCost = systems?.reduce((sum, s) => sum + Number(s.monthly_cost_estimate ?? 0), 0) ?? 0;
    res.json({
        job_id: job.id,
        status: job.status,
        started_at: job.started_at,
        completed_at: job.completed_at,
        vendors_scanned: vendorsScanned.length,
        systems_discovered: systems?.length ?? 0,
        spend_estimate: Math.round(totalCost * 100) / 100,
        logs: logs ?? [],
    });
}
//# sourceMappingURL=scan.controller.js.map