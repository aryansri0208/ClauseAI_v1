"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUsage = fetchUsage;
exports.fetchProjects = fetchProjects;
exports.fetchCostMetrics = fetchCostMetrics;
exports.getNormalizedUsage = getNormalizedUsage;
async function fetchUsage(_config) {
    // Stub: Vertex AI / Gemini usage
    return [
        { modelOrResource: 'gemini-1.5-pro', usageAmount: 1500000, unit: 'tokens' },
        { modelOrResource: 'gemini-1.5-flash', usageAmount: 3000000, unit: 'tokens' },
    ];
}
async function fetchProjects(_config) {
    return [
        { id: 'proj-1', name: 'Analytics' },
        { id: 'proj-2', name: 'Doc Intelligence' },
    ];
}
async function fetchCostMetrics(config) {
    const usage = await fetchUsage(config);
    const amount = usage.length * 9000;
    return [{ amount, currency: 'USD', period: 'month' }];
}
async function getNormalizedUsage(config) {
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
//# sourceMappingURL=google.service.js.map