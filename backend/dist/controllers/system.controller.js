"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSystems = listSystems;
exports.updateSystem = updateSystem;
const supabase_1 = require("../config/supabase");
async function listSystems(req, res) {
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
    const { data: systems, error } = await supabase
        .from('ai_systems')
        .select('id, name, vendor, system_type, team_owner, environment, monthly_cost_estimate, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
    if (error) {
        res.status(500).json({ error: 'Failed to fetch systems' });
        return;
    }
    const { data: inferences } = await supabase
        .from('system_inferences')
        .select('system_id, field_name, inferred_value, user_override, confidence_score')
        .in('system_id', (systems ?? []).map((s) => s.id));
    const { data: flags } = await supabase
        .from('compliance_flags')
        .select('system_id, flag_type, status')
        .in('system_id', (systems ?? []).map((s) => s.id));
    const inferenceBySystem = (inferences ?? []).reduce((acc, i) => {
        if (!acc[i.system_id])
            acc[i.system_id] = [];
        acc[i.system_id].push(i);
        return acc;
    }, {});
    const flagsBySystem = (flags ?? []).reduce((acc, f) => {
        if (!acc[f.system_id])
            acc[f.system_id] = [];
        acc[f.system_id].push(f);
        return acc;
    }, {});
    const enriched = (systems ?? []).map((s) => ({
        ...s,
        monthly_cost_estimate: s.monthly_cost_estimate != null ? Number(s.monthly_cost_estimate) : null,
        inferences: inferenceBySystem[s.id] ?? [],
        compliance_flags: flagsBySystem[s.id] ?? [],
    }));
    res.json({ systems: enriched });
}
async function updateSystem(req, res) {
    const user = req.user;
    const { id } = req.params;
    const body = req.body;
    const allowed = ['team_owner', 'system_type', 'environment'];
    const updates = {};
    for (const key of allowed) {
        if (body[key] !== undefined)
            updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid fields to update' });
        return;
    }
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
    const { data: system, error: fetchErr } = await supabase
        .from('ai_systems')
        .select('id')
        .eq('id', id)
        .eq('company_id', company.id)
        .single();
    if (fetchErr || !system) {
        res.status(404).json({ error: 'System not found' });
        return;
    }
    const { error: updateErr } = await supabase
        .from('ai_systems')
        .update(updates)
        .eq('id', id);
    if (updateErr) {
        res.status(500).json({ error: 'Failed to update system' });
        return;
    }
    for (const [field_name, user_override] of Object.entries(updates)) {
        await supabase.from('system_inferences').upsert({
            system_id: id,
            field_name,
            user_override: user_override ?? null,
        }, { onConflict: 'system_id,field_name' });
    }
    const { data: updated } = await supabase
        .from('ai_systems')
        .select('id, name, vendor, system_type, team_owner, environment, monthly_cost_estimate, created_at')
        .eq('id', id)
        .single();
    res.json(updated);
}
//# sourceMappingURL=system.controller.js.map