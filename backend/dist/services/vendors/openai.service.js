"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUsage = fetchUsage;
exports.fetchProjects = fetchProjects;
exports.fetchCostMetrics = fetchCostMetrics;
exports.getNormalizedUsage = getNormalizedUsage;
async function fetchUsage(_config) {
    // Stub: call OpenAI Usage API (e.g. /v1/usage or dashboard API)
    return [
        { modelOrResource: 'gpt-4o', usageAmount: 1000000, unit: 'tokens' },
        { modelOrResource: 'gpt-4o-mini', usageAmount: 5000000, unit: 'tokens' },
    ];
}
async function fetchProjects(_config) {
    // Stub: list orgs/projects
    return [
        { id: 'org-1', name: 'Production' },
        { id: 'org-2', name: 'Staging' },
    ];
}
async function fetchCostMetrics(config) {
    const usage = await fetchUsage(config);
    // Stub: map usage to cost (e.g. from billing API or pricing table)
    const amount = usage.length * 15000; // placeholder
    return [{ amount, currency: 'USD', period: 'month' }];
}
async function getNormalizedUsage(config) {
    const [projects, usage, costMetrics] = await Promise.all([
        fetchProjects(config),
        fetchUsage(config),
        fetchCostMetrics(config),
    ]);
    return {
        vendor: 'OpenAI',
        projects,
        usage,
        costMetrics,
    };
}
//# sourceMappingURL=openai.service.js.map