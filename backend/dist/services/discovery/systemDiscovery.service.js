"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeToSystems = normalizeToSystems;
/**
 * Converts raw vendor usage into normalized AI systems.
 * Example: OpenAI API usage → "Customer Support Chatbot" system.
 */
function normalizeToSystems(vendorUsage) {
    const systems = [];
    const { vendor, projects, usage, costMetrics } = vendorUsage;
    if (projects.length === 0 && usage.length > 0) {
        usage.forEach((u, i) => {
            const cost = costMetrics[i] ?? costMetrics[0];
            systems.push({
                name: inferSystemName(vendor, u.modelOrResource ?? 'Unknown'),
                vendor,
                systemType: inferSystemType(vendor, u.modelOrResource),
                monthlyCostEstimate: cost?.amount,
                rawModelOrResource: u.modelOrResource,
            });
        });
        return systems;
    }
    projects.forEach((project, idx) => {
        const projectUsage = usage.filter((u) => u.projectId === project.id || !u.projectId);
        const cost = costMetrics.find((c) => c.projectId === project.id) ?? costMetrics[idx] ?? costMetrics[0];
        const totalUsage = projectUsage.reduce((s, u) => s + (u.usageAmount ?? 0), 0);
        systems.push({
            name: project.name || inferSystemName(vendor, project.id),
            vendor,
            systemType: inferSystemType(vendor, projectUsage[0]?.modelOrResource),
            monthlyCostEstimate: cost?.amount,
            rawProjectId: project.id,
            rawModelOrResource: projectUsage[0]?.modelOrResource,
        });
    });
    if (systems.length === 0 && usage.length > 0) {
        const cost = costMetrics[0];
        systems.push({
            name: inferSystemName(vendor, usage[0].modelOrResource ?? 'API'),
            vendor,
            systemType: 'Model API',
            monthlyCostEstimate: cost?.amount,
            rawModelOrResource: usage[0].modelOrResource,
        });
    }
    return systems;
}
function inferSystemName(vendor, resource) {
    const lower = resource.toLowerCase();
    if (lower.includes('support') || lower.includes('chat'))
        return 'Customer Support AI';
    if (lower.includes('copilot') || lower.includes('internal'))
        return 'Internal Copilot';
    if (lower.includes('summar') || lower.includes('analytics'))
        return 'Analytics Summarizer';
    if (lower.includes('doc') || lower.includes('document'))
        return 'Doc Intelligence';
    if (lower.includes('search') || lower.includes('index'))
        return 'Knowledge Base Search';
    if (lower.includes('email') || lower.includes('sales'))
        return 'Sales Email Writer';
    if (vendor === 'OpenAI' && lower.includes('gpt-4'))
        return 'Customer Support AI';
    if (vendor === 'Anthropic' && lower.includes('claude'))
        return 'Internal Copilot';
    if (vendor === 'Pinecone')
        return 'Vector DB – ' + resource;
    return resource || `${vendor} System`;
}
function inferSystemType(vendor, modelOrResource) {
    if (vendor === 'Pinecone')
        return 'Vector DB';
    const m = (modelOrResource ?? '').toLowerCase();
    if (m.includes('agent') || m.includes('copilot'))
        return 'Agent';
    if (m.includes('index') || m.includes('vector'))
        return 'Vector DB';
    return 'Model API';
}
//# sourceMappingURL=systemDiscovery.service.js.map