export interface ModelPricing {
  inputPer1MTokens: number;
  outputPer1MTokens: number;
  vendor: string;
  tier: string;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Anthropic ──────────────────────────────────────────────
  'claude-opus-4':     { inputPer1MTokens: 15,   outputPer1MTokens: 75,   vendor: 'Anthropic', tier: 'flagship' },
  'claude-sonnet-4':   { inputPer1MTokens: 3,    outputPer1MTokens: 15,   vendor: 'Anthropic', tier: 'mid' },
  'claude-haiku-4':    { inputPer1MTokens: 0.80, outputPer1MTokens: 4,    vendor: 'Anthropic', tier: 'fast' },
  'claude-3.5-sonnet': { inputPer1MTokens: 3,    outputPer1MTokens: 15,   vendor: 'Anthropic', tier: 'mid' },
  'claude-3-opus':     { inputPer1MTokens: 15,   outputPer1MTokens: 75,   vendor: 'Anthropic', tier: 'flagship' },
  'claude-3-haiku':    { inputPer1MTokens: 0.25, outputPer1MTokens: 1.25, vendor: 'Anthropic', tier: 'fast' },

  // ── OpenAI ─────────────────────────────────────────────────
  'gpt-4o':                  { inputPer1MTokens: 2.50, outputPer1MTokens: 10,   vendor: 'OpenAI', tier: 'flagship' },
  'gpt-4o-mini':             { inputPer1MTokens: 0.15, outputPer1MTokens: 0.60, vendor: 'OpenAI', tier: 'fast' },
  'gpt-4.1':                 { inputPer1MTokens: 2.00, outputPer1MTokens: 8.00, vendor: 'OpenAI', tier: 'mid' },
  'gpt-4.1-mini':            { inputPer1MTokens: 0.40, outputPer1MTokens: 1.60, vendor: 'OpenAI', tier: 'fast' },
  'gpt-4.1-nano':            { inputPer1MTokens: 0.10, outputPer1MTokens: 0.40, vendor: 'OpenAI', tier: 'nano' },
  'o3':                      { inputPer1MTokens: 2.00, outputPer1MTokens: 8.00, vendor: 'OpenAI', tier: 'reasoning' },
  'o3-mini':                 { inputPer1MTokens: 1.10, outputPer1MTokens: 4.40, vendor: 'OpenAI', tier: 'reasoning' },
  'o4-mini':                 { inputPer1MTokens: 1.10, outputPer1MTokens: 4.40, vendor: 'OpenAI', tier: 'reasoning' },
  'text-embedding-3-small':  { inputPer1MTokens: 0.02, outputPer1MTokens: 0,    vendor: 'OpenAI', tier: 'embedding' },
  'text-embedding-3-large':  { inputPer1MTokens: 0.13, outputPer1MTokens: 0,    vendor: 'OpenAI', tier: 'embedding' },

  // ── Google (Gemini) ────────────────────────────────────────
  'gemini-2.5-pro':   { inputPer1MTokens: 1.25,  outputPer1MTokens: 10,   vendor: 'Google', tier: 'flagship' },
  'gemini-2.5-flash': { inputPer1MTokens: 0.15,  outputPer1MTokens: 0.60, vendor: 'Google', tier: 'fast' },
  'gemini-2.0-flash': { inputPer1MTokens: 0.10,  outputPer1MTokens: 0.40, vendor: 'Google', tier: 'fast' },
  'gemini-1.5-pro':   { inputPer1MTokens: 1.25,  outputPer1MTokens: 5.00, vendor: 'Google', tier: 'mid' },
  'gemini-1.5-flash': { inputPer1MTokens: 0.075, outputPer1MTokens: 0.30, vendor: 'Google', tier: 'fast' },
};

const PRICING_KEYS = Object.keys(MODEL_PRICING);

/**
 * Resolve a potentially-versioned model ID (e.g. "claude-3-5-sonnet-20241022")
 * to a canonical key in MODEL_PRICING.
 */
function resolveModelKey(modelId: string): string | null {
  const id = modelId.toLowerCase().trim();

  // (a) Exact match
  if (MODEL_PRICING[id]) return id;

  // Normalize "claude-3-5-sonnet" → "claude-3.5-sonnet" (API IDs use hyphens, pricing uses dots)
  const dotNormalized = id.replace(/^(claude-\d+)-(\d+)/, '$1.$2');
  if (MODEL_PRICING[dotNormalized]) return dotNormalized;

  // (b) Strip date suffixes like -20241022 or -20250514
  const withoutDate = id.replace(/-\d{6,}$/, '');
  if (MODEL_PRICING[withoutDate]) return withoutDate;

  const dotWithoutDate = withoutDate.replace(/^(claude-\d+)-(\d+)/, '$1.$2');
  if (MODEL_PRICING[dotWithoutDate]) return dotWithoutDate;

  // (c) Longest-prefix match — find the pricing key that is the longest prefix of the input
  let bestMatch: string | null = null;
  let bestLen = 0;
  for (const key of PRICING_KEYS) {
    if (id.startsWith(key) && key.length > bestLen) {
      bestMatch = key;
      bestLen = key.length;
    }
    if (dotNormalized.startsWith(key) && key.length > bestLen) {
      bestMatch = key;
      bestLen = key.length;
    }
  }

  return bestMatch;
}

const INPUT_RATIO = 0.7;
const OUTPUT_RATIO = 0.3;

/**
 * Estimate monthly cost in USD given a model ID and total token count.
 * Assumes 70% input / 30% output split. Returns null for unknown models.
 */
export function estimateMonthlyCost(modelId: string, totalTokens: number): number | null {
  const key = resolveModelKey(modelId);
  if (!key) return null;

  const pricing = MODEL_PRICING[key];
  const inputTokens = totalTokens * INPUT_RATIO;
  const outputTokens = totalTokens * OUTPUT_RATIO;

  const cost =
    (inputTokens / 1_000_000) * pricing.inputPer1MTokens +
    (outputTokens / 1_000_000) * pricing.outputPer1MTokens;

  return Math.round(cost * 100) / 100;
}

/**
 * Returns the tier classification for a model, or null if unknown.
 */
export function getModelTier(modelId: string): string | null {
  const key = resolveModelKey(modelId);
  if (!key) return null;
  return MODEL_PRICING[key].tier;
}

/**
 * Returns all models sorted by blended cost (0.7 * input + 0.3 * output) ascending.
 */
export function getCompetitiveRanking(): Array<{
  vendor: string;
  model: string;
  tier: string;
  inputCost: number;
  outputCost: number;
}> {
  return PRICING_KEYS
    .map((model) => {
      const p = MODEL_PRICING[model];
      return {
        vendor: p.vendor,
        model,
        tier: p.tier,
        inputCost: p.inputPer1MTokens,
        outputCost: p.outputPer1MTokens,
      };
    })
    .sort((a, b) => {
      const blendedA = a.inputCost * INPUT_RATIO + a.outputCost * OUTPUT_RATIO;
      const blendedB = b.inputCost * INPUT_RATIO + b.outputCost * OUTPUT_RATIO;
      return blendedA - blendedB;
    });
}
