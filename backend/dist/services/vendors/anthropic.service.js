"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUsage = fetchUsage;
exports.fetchProjects = fetchProjects;
exports.fetchCostMetrics = fetchCostMetrics;
exports.getNormalizedUsage = getNormalizedUsage;
async function fetchUsage(_config) {
    // Stub: call Anthropic usage API
    return [
        { modelOrResource: 'claude-3-5-sonnet', usageAmount: 2000000, unit: 'tokens' },
        { modelOrResource: 'claude-3-opus', usageAmount: 500000, unit: 'tokens' },
    ];
}
async function fetchProjects(_config) {
    return [
        { id: 'ws-1', name: 'Platform' },
        { id: 'ws-2', name: 'ML Team' },
    ];
}
async function fetchCostMetrics(config) {
    const usage = await fetchUsage(config);
    const amount = usage.length * 10000;
    return [{ amount, currency: 'USD', period: 'month' }];
}
async function getNormalizedUsage(config) {
    const [projects, usage, costMetrics] = await Promise.all([
        fetchProjects(config),
        fetchUsage(config),
        fetchCostMetrics(config),
    ]);
    return {
        vendor: 'Anthropic',
        projects,
        usage,
        costMetrics,
    };
}
//# sourceMappingURL=anthropic.service.js.map