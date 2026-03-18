import type { NormalizedVendorUsage } from '../../types/vendor.types';
import type { NormalizedAISystem } from '../../types/system.types';
import type { SystemType } from '../../types/system.types';

const GENERIC_PROJECT_NAMES = new Set([
  'default',
  'default project',
  'default workspace',
  'google ai studio',
  'unnamed project',
  'personal',
  'my project',
  'test',
  'main',
]);

function isGenericName(name: string): boolean {
  return GENERIC_PROJECT_NAMES.has(name.toLowerCase().trim());
}

function isOpaqueId(value: string): boolean {
  return /^(proj_|org-|sk-|key-)/i.test(value) ||
    /^[a-f0-9-]{32,}$/i.test(value) ||
    /^[A-Za-z0-9_-]{20,}$/.test(value);
}

function inferSystemType(vendor: string, modelOrResource?: string): SystemType {
  const m = (modelOrResource ?? '').toLowerCase();

  if (vendor === 'Pinecone') return 'Vector DB';
  if (vendor === 'LangSmith') return 'Pipeline';

  // LLM model patterns
  if (/\bgpt-4/.test(m) || /\bgpt-3\.5/.test(m) || /\bo[13]\b/.test(m) || /\bgpt-4o\b/.test(m))
    return 'Model API';
  if (/\bclaude/.test(m) || /\bsonnet\b/.test(m) || /\bopus\b/.test(m) || /\bhaiku\b/.test(m))
    return 'Model API';
  if (/\bgemini/.test(m) || /\bpalm\b/.test(m))
    return 'Model API';

  // Embedding models → Pipeline
  if (/\btext-embedding/.test(m) || /\bembed-/.test(m) || /\bada\b/.test(m))
    return 'Pipeline';

  // Agent patterns
  if (/\bagent\b/.test(m) || /\bassistant\b/.test(m) || /\bcopilot\b/.test(m))
    return 'Agent';

  return 'Model API';
}

function inferSystemName(vendor: string, resource: string, projectName?: string): string {
  if (projectName && !isGenericName(projectName) && !isOpaqueId(projectName)) {
    return projectName;
  }

  const lower = resource.toLowerCase();

  if (lower.includes('support') || lower.includes('chat')) return 'Customer Support AI';
  if (lower.includes('copilot') || lower.includes('internal')) return 'Internal Copilot';
  if (lower.includes('summar') || lower.includes('analytics')) return 'Analytics Summarizer';
  if (lower.includes('doc') || lower.includes('document')) return 'Doc Intelligence';
  if (lower.includes('search') || lower.includes('index')) return 'Knowledge Base Search';
  if (lower.includes('email') || lower.includes('sales')) return 'Sales Email Writer';
  if (lower.includes('embed')) return 'Embedding Pipeline';
  if (lower.includes('eval') || lower.includes('trace')) return 'LLM Eval Pipeline';

  if (vendor === 'Pinecone') return 'Vector DB – ' + resource;
  if (vendor === 'LangSmith') return 'LangSmith Trace Pipeline';

  if (/^(gpt-4|gpt-3|o[134]-|chatgpt)/i.test(lower)) {
    const shortModel = resource.split('-').slice(0, 2).join('-');
    return `OpenAI ${shortModel} System`;
  }
  if (/^claude/i.test(lower)) {
    const variant = lower.includes('haiku') ? 'Haiku' : lower.includes('opus') ? 'Opus' : 'Sonnet';
    return `Claude ${variant} System`;
  }
  if (/^gemini/i.test(lower)) {
    const variant = lower.includes('pro') ? 'Pro' : lower.includes('ultra') ? 'Ultra' : 'Flash';
    return `Gemini ${variant} System`;
  }

  if (!resource || isOpaqueId(resource)) {
    return `${vendor} System`;
  }

  return resource;
}

/**
 * Converts raw vendor usage into normalized AI systems.
 */
export function normalizeToSystems(vendorUsage: NormalizedVendorUsage): NormalizedAISystem[] {
  const systems: NormalizedAISystem[] = [];
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
    const primaryModel = projectUsage[0]?.modelOrResource;

    systems.push({
      name: inferSystemName(vendor, primaryModel ?? project.id, project.name),
      vendor,
      systemType: inferSystemType(vendor, primaryModel),
      monthlyCostEstimate: cost?.amount,
      rawProjectId: project.id,
      rawModelOrResource: primaryModel,
    });
  });

  if (systems.length === 0 && usage.length > 0) {
    const cost = costMetrics[0];
    systems.push({
      name: inferSystemName(vendor, usage[0].modelOrResource ?? 'API'),
      vendor,
      systemType: inferSystemType(vendor, usage[0].modelOrResource),
      monthlyCostEstimate: cost?.amount,
      rawModelOrResource: usage[0].modelOrResource,
    });
  }

  return systems;
}
