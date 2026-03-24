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
    const startingAt = firstDayThisMonth.toISOString();
    const endingAt = now.toISOString();

    const url = new URL(
      "https://api.anthropic.com/v1/organizations/usage_report/messages"
    );
    url.searchParams.set("starting_at", startingAt);
    url.searchParams.set("ending_at", endingAt);
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.append("group_by[]", "model");

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        vendorName,
        error:
          "Usage data requires an Admin API key (sk-ant-admin...). " +
          "Generate one at https://console.anthropic.com/settings/admin-keys. " +
          "Note: browser requests may also be blocked by CORS — the backend scan is the primary path for analytics.",
      };
    }

    if (!response.ok) {
      const errBody = await response.text();
      return {
        vendorName,
        error: `API ${response.status}: ${errBody.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      data?: Array<{
        model?: string;
        input_tokens?: number;
        output_tokens?: number;
      }>;
      has_more?: boolean;
      next_page?: string;
    };

    let tokensUsed = 0;
    const models = new Set<string>();
    for (const bucket of data.data ?? []) {
      tokensUsed += (bucket.input_tokens ?? 0) + (bucket.output_tokens ?? 0);
      if (bucket.model) models.add(bucket.model);
    }

    return {
      vendorName,
      tokensUsed,
      modelsUsed: Array.from(models),
      endpoints: ["messages"],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return {
        vendorName,
        error:
          "Could not reach Anthropic Admin API (likely blocked by CORS). " +
          "Usage data is available via the backend scan instead.",
      };
    }
    return {
      vendorName,
      error: msg || "Failed to fetch Anthropic usage",
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
