"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUsage = fetchUsage;
exports.fetchProjects = fetchProjects;
exports.fetchCostMetrics = fetchCostMetrics;
exports.getNormalizedUsage = getNormalizedUsage;
async function fetchUsage(_config) {
    // Stub: index list + query metrics
    return [
        { modelOrResource: 'index-1', usageAmount: 1000000, unit: 'queries' },
        { modelOrResource: 'index-2', usageAmount: 500000, unit: 'queries' },
    ];
}
async function fetchProjects(_config) {
    return [
        { id: 'index-1', name: 'Knowledge Base' },
        { id: 'index-2', name: 'Recommendations' },
    ];
}
async function fetchCostMetrics(config) {
    const usage = await fetchUsage(config);
    const amount = usage.length * 3500;
    return [{ amount, currency: 'USD', period: 'month' }];
}
async function getNormalizedUsage(config) {
    const [projects, usage, costMetrics] = await Promise.all([
        fetchProjects(config),
        fetchUsage(config),
        fetchCostMetrics(config),
    ]);
    return {
        vendor: 'Pinecone',
        projects,
        usage,
        costMetrics,
    };
}
//# sourceMappingURL=pinecone.service.js.map