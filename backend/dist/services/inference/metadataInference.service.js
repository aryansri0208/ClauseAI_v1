"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferMetadata = inferMetadata;
/**
 * Simple heuristic inference for team ownership, system type, and compliance risk.
 */
function inferMetadata(system) {
    const name = (system.name ?? '').toLowerCase();
    const vendor = (system.vendor ?? '').toLowerCase();
    let team_owner = 'Unknown';
    if (name.includes('support') || name.includes('customer') || name.includes('chat'))
        team_owner = 'Platform Eng';
    else if (name.includes('copilot') || name.includes('internal') || name.includes('ml'))
        team_owner = 'ML Team';
    else if (name.includes('analytics') || name.includes('summar') || name.includes('data'))
        team_owner = 'Data Team';
    else if (name.includes('sales') || name.includes('email') || name.includes('growth'))
        team_owner = 'Growth Team';
    else if (name.includes('doc') || name.includes('knowledge'))
        team_owner = 'Platform Eng';
    let system_type = system.systemType ?? 'Model API';
    if (!system_type && (name.includes('agent') || name.includes('copilot')))
        system_type = 'Agent';
    if (!system_type && (name.includes('vector') || name.includes('pinecone')))
        system_type = 'Vector DB';
    let environment = 'production';
    if (name.includes('staging') || name.includes('staging'))
        environment = 'staging';
    else if (name.includes('dev') || name.includes('test'))
        environment = 'development';
    let compliance_risk = 'low';
    if (name.includes('support') || name.includes('customer') || name.includes('pii'))
        compliance_risk = 'medium';
    if (name.includes('health') || name.includes('hipaa'))
        compliance_risk = 'high';
    const confidence = 0.7;
    return {
        team_owner,
        system_type,
        environment,
        compliance_risk,
        confidence,
    };
}
//# sourceMappingURL=metadataInference.service.js.map