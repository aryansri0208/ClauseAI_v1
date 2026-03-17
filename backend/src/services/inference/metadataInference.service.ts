import type { NormalizedAISystem } from '../../types/system.types';
import type { SystemType, Environment } from '../../types/system.types';

export interface InferredMetadata {
  team_owner: string;
  system_type: SystemType;
  environment: Environment;
  compliance_risk: 'low' | 'medium' | 'high';
  confidence: number;
}

const TEAM_PATTERNS: Array<{ test: RegExp; team: string }> = [
  { test: /support|customer|chat|helpdesk|ticket/, team: 'Platform Eng' },
  { test: /copilot|internal|ml|model|train/, team: 'ML Team' },
  { test: /analytics|summar|data|report|metric/, team: 'Data Team' },
  { test: /sales|email|growth|marketing|outreach/, team: 'Growth Team' },
  { test: /doc|knowledge|wiki|search/, team: 'Platform Eng' },
];

const VENDOR_DEFAULT_TEAMS: Record<string, string> = {
  openai: 'Platform Eng',
  anthropic: 'ML Team',
  'google vertex ai': 'Platform Eng',
  pinecone: 'Data Team',
  langsmith: 'ML Team',
};

/**
 * Simple heuristic inference for team ownership, system type, and compliance risk.
 */
export function inferMetadata(system: NormalizedAISystem): InferredMetadata {
  const name = (system.name ?? '').toLowerCase();
  const vendor = (system.vendor ?? '').toLowerCase();
  const resource = (system.rawModelOrResource ?? '').toLowerCase();

  const { team_owner, confidence: teamConfidence } = inferTeam(name, vendor);

  const system_type: SystemType = system.systemType ?? 'Model API';

  let environment: Environment = 'production';
  if (name.includes('staging') || resource.includes('staging')) environment = 'staging';
  else if (name.includes('dev') || name.includes('test') || resource.includes('dev')) environment = 'development';

  const compliance_risk = inferComplianceRisk(name, vendor, resource);

  return {
    team_owner,
    system_type,
    environment,
    compliance_risk,
    confidence: teamConfidence,
  };
}

function inferTeam(name: string, vendor: string): { team: string; confidence: number } {
  for (const { test, team } of TEAM_PATTERNS) {
    if (test.test(name)) {
      return { team, confidence: 0.85 };
    }
  }

  const vendorDefault = VENDOR_DEFAULT_TEAMS[vendor];
  if (vendorDefault) {
    return { team: vendorDefault, confidence: 0.5 };
  }

  return { team: 'Unknown', confidence: 0.3 };
}

function inferComplianceRisk(name: string, vendor: string, resource: string): 'low' | 'medium' | 'high' {
  const combined = `${name} ${resource}`;

  if (/health|medical|hipaa|patient|diagnos/.test(combined)) return 'high';

  if (/support|chat|customer|pii|user.?data|personal/.test(combined)) return 'medium';

  if (vendor === 'pinecone') return 'medium';

  return 'low';
}
