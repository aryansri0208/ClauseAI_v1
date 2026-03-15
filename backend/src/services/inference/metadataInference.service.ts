import type { NormalizedAISystem } from '../../types/system.types';
import type { SystemType, Environment } from '../../types/system.types';

export interface InferredMetadata {
  team_owner: string;
  system_type: SystemType;
  environment: Environment;
  compliance_risk: 'low' | 'medium' | 'high';
  confidence: number;
}

/**
 * Simple heuristic inference for team ownership, system type, and compliance risk.
 */
export function inferMetadata(system: NormalizedAISystem): InferredMetadata {
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

  let system_type: SystemType = system.systemType ?? 'Model API';
  if (!system_type && (name.includes('agent') || name.includes('copilot'))) system_type = 'Agent';
  if (!system_type && (name.includes('vector') || name.includes('pinecone'))) system_type = 'Vector DB';

  let environment: Environment = 'production';
  if (name.includes('staging') || name.includes('staging')) environment = 'staging';
  else if (name.includes('dev') || name.includes('test')) environment = 'development';

  let compliance_risk: 'low' | 'medium' | 'high' = 'low';
  if (name.includes('support') || name.includes('customer') || name.includes('pii')) compliance_risk = 'medium';
  if (name.includes('health') || name.includes('hipaa')) compliance_risk = 'high';

  const confidence = 0.7;

  return {
    team_owner,
    system_type,
    environment,
    compliance_risk,
    confidence,
  };
}
