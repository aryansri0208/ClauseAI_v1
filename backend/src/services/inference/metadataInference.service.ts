import type { NormalizedAISystem } from '../../types/system.types';
import type { SystemType, Environment } from '../../types/system.types';

export interface InferredMetadata {
  team_owner: string;
  system_type: SystemType;
  environment: Environment;
  compliance_risk: 'low' | 'medium' | 'high';
  confidence: number;
}

interface InferenceContext {
  usageAmount?: number;
  monthlyCostEstimate?: number;
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

const GENERIC_NAME_PATTERN = /^[a-z\s]+ system$/i;
const MODEL_DERIVED_NAME_PATTERN =
  /^(gpt|gemini|claude|llama|mistral|command|embed|text-|dall-e|whisper|tts)/i;

/**
 * Heuristic inference for team ownership, system type, compliance risk, and
 * multi-signal confidence scoring.
 */
export function inferMetadata(
  system: NormalizedAISystem,
  context?: InferenceContext,
): InferredMetadata {
  const name = (system.name ?? '').toLowerCase();
  const vendor = (system.vendor ?? '').toLowerCase();
  const resource = (system.rawModelOrResource ?? '').toLowerCase();

  const { team: team_owner, confidence: teamConfidence } = inferTeam(name, vendor);

  const system_type: SystemType = system.systemType ?? 'Model API';

  let environment: Environment = 'production';
  if (name.includes('staging') || resource.includes('staging')) environment = 'staging';
  else if (name.includes('dev') || name.includes('test') || resource.includes('dev')) environment = 'development';

  const compliance_risk = inferComplianceRisk(name, vendor, resource);

  const confidence = computeOverallConfidence(system, teamConfidence, context);

  return {
    team_owner,
    system_type,
    environment,
    compliance_risk,
    confidence,
  };
}

function computeOverallConfidence(
  system: NormalizedAISystem,
  teamConfidence: number,
  context?: InferenceContext,
): number {
  const costValue = context?.monthlyCostEstimate ?? system.monthlyCostEstimate;
  const hasCostData = costValue != null && costValue > 0 ? 1.0 : 0.3;

  const usageValue = context?.usageAmount;
  const hasUsageData = usageValue != null && usageValue > 0 ? 1.0 : 0.2;

  const hasDescriptiveName = scoreNameQuality(system.name ?? '', system.vendor ?? '');

  const raw =
    teamConfidence * 0.4 +
    hasCostData * 0.25 +
    hasDescriptiveName * 0.2 +
    hasUsageData * 0.15;

  return Math.min(0.95, Math.max(0.1, parseFloat(raw.toFixed(4))));
}

function scoreNameQuality(name: string, vendor: string): number {
  const trimmed = name.trim();
  if (!trimmed) return 0.2;

  const vendorPrefix = vendor.split(' ')[0];
  if (
    GENERIC_NAME_PATTERN.test(trimmed) ||
    trimmed.toLowerCase() === `${vendorPrefix.toLowerCase()} system`
  ) {
    return 0.2;
  }

  if (MODEL_DERIVED_NAME_PATTERN.test(trimmed)) return 0.5;

  return 1.0;
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
