/**
 * Fetch vendor analytics (cost, tokens, models, endpoints) using provider API keys.
 * Used on the Analysis screen; keys may come from sessionStorage after onboarding
 * or from a future backend proxy.
 */

export type VendorIntelligence = {
  vendorName: string;
  costLastMonth?: number;
  tokensUsed?: number;
  modelsUsed?: string[];
  endpoints?: string[];
  error?: string;
};

const now = new Date();
const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const startTime = Math.floor(firstDayThisMonth.getTime() / 1000);
const endTime = Math.floor(now.getTime() / 1000);

async function fetchOpenAIAnalytics(apiKey: string): Promise<VendorIntelligence> {
  const vendorName = "OpenAI";
  try {
    const response = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&bucket_width=1d`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      const errBody = await response.text();
      return {
        vendorName,
        error: `API ${response.status}: ${errBody.slice(0, 200)}`,
      };
    }
    const data = (await response.json()) as {
      data?: Array<{
        input_tokens?: number;
        output_tokens?: number;
        num_model_requests?: number;
        model?: string;
      }>;
    };
    const items = data.data ?? [];
    let tokensUsed = 0;
    const models = new Set<string>();
    for (const item of items) {
      tokensUsed += (item.input_tokens ?? 0) + (item.output_tokens ?? 0);
      if (item.model) models.add(item.model);
    }
    return {
      vendorName,
      tokensUsed,
      modelsUsed: Array.from(models),
      endpoints: ["completions"],
    };
  } catch (e) {
    return {
      vendorName,
      error: e instanceof Error ? e.message : "Failed to fetch OpenAI usage",
    };
  }
}

async function fetchAnthropicAnalytics(
  apiKey: string
): Promise<VendorIntelligence> {
  const vendorName = "Anthropic";
  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/usage?period=month",
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      const errBody = await response.text();
      return {
        vendorName,
        error: `API ${response.status}: ${errBody.slice(0, 200)}`,
      };
    }
    const data = (await response.json()) as {
      usage?: { input_tokens?: number; output_tokens?: number };
      models?: string[];
    };
    const usage = data.usage ?? {};
    const tokensUsed =
      (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
    return {
      vendorName,
      tokensUsed,
      modelsUsed: data.models ?? [],
      endpoints: ["usage"],
    };
  } catch (e) {
    return {
      vendorName,
      error:
        e instanceof Error ? e.message : "Failed to fetch Anthropic usage",
    };
  }
}

async function fetchVertexAnalytics(apiKey: string): Promise<VendorIntelligence> {
  const vendorName = "Google Vertex AI";
  try {
    return {
      vendorName,
      costLastMonth: undefined,
      tokensUsed: undefined,
      modelsUsed: [],
      endpoints: [],
      error:
        "Vertex AI analytics require a GCP project and server-side auth; use Cloud Billing API for cost data.",
    };
  } catch (e) {
    return {
      vendorName,
      error:
        e instanceof Error ? e.message : "Failed to fetch Vertex usage",
    };
  }
}

export type VendorAnalyticsKeys = {
  openaiKey?: string;
  anthropicKey?: string;
  vertexKey?: string;
};

/**
 * Fetch analytics for all vendors with non-empty keys.
 * Returns an array of VendorIntelligence (one per vendor with a key).
 */
export async function fetchAllVendorAnalytics(
  keys: VendorAnalyticsKeys
): Promise<VendorIntelligence[]> {
  const results: Promise<VendorIntelligence>[] = [];
  if (keys.openaiKey?.trim()) {
    results.push(fetchOpenAIAnalytics(keys.openaiKey.trim()));
  }
  if (keys.anthropicKey?.trim()) {
    results.push(fetchAnthropicAnalytics(keys.anthropicKey.trim()));
  }
  if (keys.vertexKey?.trim()) {
    results.push(fetchVertexAnalytics(keys.vertexKey.trim()));
  }
  return Promise.all(results);
}
