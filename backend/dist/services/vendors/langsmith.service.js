"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUsage = fetchUsage;
exports.fetchProjects = fetchProjects;
exports.fetchCostMetrics = fetchCostMetrics;
exports.getNormalizedUsage = getNormalizedUsage;
async function fetchUsage(_config) {
    // Stub: trace / run metrics
    return [
        { modelOrResource: 'default', usageAmount: 50000, unit: 'runs' },
    ];
}
async function fetchProjects(_config) {
    return [
        { id: 'default', name: 'Default Project' },
    ];
}
async function fetchCostMetrics(config) {
    const usage = await fetchUsage(config);
    const amount = usage.length * 2000;
    return [{ amount, currency: 'USD', period: 'month' }];
}
async function getNormalizedUsage(config) {
    const [projects, usage, costMetrics] = await Promise.all([
        fetchProjects(config),
        fetchUsage(config),
        fetchCostMetrics(config),
    ]);
    return {
        vendor: 'LangSmith',
        projects,
        usage,
        costMetrics,
    };
}
//# sourceMappingURL=langsmith.service.js.map