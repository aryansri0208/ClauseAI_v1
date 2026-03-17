# ClauseAI MVP Development Spec — Screens 01, 02, 03

**Owner:** Kalyan (CTO)
**Branch:** `onboarding-v2`
**Stack:** Next.js 16 + Tailwind v4 (frontend) · Express + TypeScript (backend) · Supabase (Postgres + Auth) · Redis (job queue)
**Design Reference:** `/design/screen-01-welcome-connect.html`, `/design/screen-02-auto-scan.html`, `/design/screen-03-discovered-systems.html`

---

## Architecture Overview

```
[Next.js Frontend]
    ├── /onboarding           → Screen 01: Welcome + Vendor Connect
    ├── /onboarding/scan      → Screen 02: Auto-Scan (live polling)
    └── /onboarding/systems   → Screen 03: Discovered Systems (table + edit)

[Express Backend]
    ├── POST /api/company              → Create company profile
    ├── POST /api/vendors/connect      → Store encrypted vendor API key
    ├── POST /api/scan/start           → Kick off async scan job
    ├── GET  /api/scan/:jobId/status   → Poll scan progress + logs
    ├── GET  /api/systems              → List discovered AI systems
    └── PATCH /api/systems/:id         → User override of inferred fields

[Supabase Postgres]
    users → companies → vendor_connections → scan_jobs → scan_logs → ai_systems → system_inferences → compliance_flags
```

---

## PART 1: VENDOR API INTEGRATIONS (Backend — Replace All Stubs)

The existing vendor services in `backend/src/services/vendors/` are all stubs returning hardcoded data. Each must be replaced with real API calls. **Important:** OpenAI's Usage/Costs API requires an **Admin API Key** (not a regular API key). The user must be told this during onboarding.

### 1.1 OpenAI (`openai.service.ts`)

**APIs to call:**
- `GET /v1/organization/usage/completions` — token usage by model, project, day
- `GET /v1/organization/costs` — dollar cost breakdown by line item and project
- `GET /v1/organization/projects` (Admin API) — list projects

**Auth:** `Authorization: Bearer <ADMIN_API_KEY>`. Note: this is an Admin Key from `platform.openai.com/settings/organization/admin-keys`, NOT a regular API key.

**Implementation:**

```typescript
// backend/src/services/vendors/openai.service.ts

const BASE = 'https://api.openai.com/v1/organization';

export async function fetchUsage(config: { apiKey: string }): Promise<NormalizedVendorUsage['usage']> {
  const startTime = Math.floor(Date.now() / 1000) - (30 * 86400); // 30 days ago

  const res = await fetch(`${BASE}/usage/completions?start_time=${startTime}&bucket_width=1d&group_by=model`, {
    headers: { 'Authorization': `Bearer ${config.apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI Usage API ${res.status}: ${body}`);
  }

  const data = await res.json();
  // data.data is array of buckets, each with results[]
  const modelMap = new Map<string, number>();

  for (const bucket of data.data ?? []) {
    for (const result of bucket.results ?? []) {
      const model = result.model ?? 'unknown';
      const tokens = (result.input_tokens ?? 0) + (result.output_tokens ?? 0);
      modelMap.set(model, (modelMap.get(model) ?? 0) + tokens);
    }
  }

  return Array.from(modelMap.entries()).map(([model, tokens]) => ({
    modelOrResource: model,
    usageAmount: tokens,
    unit: 'tokens',
  }));
}

export async function fetchCostMetrics(config: { apiKey: string }): Promise<NormalizedVendorUsage['costMetrics']> {
  const startTime = Math.floor(Date.now() / 1000) - (30 * 86400);

  const res = await fetch(`${BASE}/costs?start_time=${startTime}&bucket_width=1d&group_by=project_id`, {
    headers: { 'Authorization': `Bearer ${config.apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI Costs API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const projectCosts = new Map<string, number>();

  for (const bucket of data.data ?? []) {
    for (const result of bucket.results ?? []) {
      const projId = result.project_id ?? 'default';
      const amount = result.amount?.value ?? 0;
      projectCosts.set(projId, (projectCosts.get(projId) ?? 0) + amount);
    }
  }

  return Array.from(projectCosts.entries()).map(([projectId, amount]) => ({
    projectId,
    amount,
    currency: 'USD',
    period: 'month',
  }));
}

export async function fetchProjects(config: { apiKey: string }): Promise<NormalizedVendorUsage['projects']> {
  // Admin API endpoint for listing projects
  const res = await fetch('https://api.openai.com/v1/organization/projects?limit=100', {
    headers: { 'Authorization': `Bearer ${config.apiKey}` },
  });

  if (!res.ok) {
    // Fallback: if not admin key, return a single default project
    return [{ id: 'default', name: 'Default Project' }];
  }

  const data = await res.json();
  return (data.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
  }));
}
```

**Key gotcha:** The Costs API currently only supports `bucket_width=1d`. If the endpoint returns 404, the user likely has a standard API key instead of an Admin key — catch this and surface a clear error message.

### 1.2 Anthropic (`anthropic.service.ts`)

**APIs available:** Anthropic does NOT currently expose a public billing/usage API. The Admin API provides organization management but not usage metrics.

**Recommended approach for MVP:**
1. Use `GET /v1/models` to validate the key and discover available models
2. Use `POST /v1/messages` with a trivial prompt to confirm the key works
3. For costs — prompt the user to self-report their approximate Anthropic spend (add a field in the vendor connection form), or parse from Console export CSV if they upload one

```typescript
// backend/src/services/vendors/anthropic.service.ts

export async function fetchUsage(config: { apiKey: string }): Promise<NormalizedVendorUsage['usage']> {
  // Validate key by listing models — this also tells us what models they have access to
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: Key validation failed`);
  }

  const data = await res.json();
  const models = (data.data ?? []).map((m: any) => m.id);

  // We can report which models are accessible but not usage amounts
  return models.map((model: string) => ({
    modelOrResource: model,
    usageAmount: undefined, // No usage API available
    unit: 'tokens',
  }));
}

export async function fetchProjects(config: { apiKey: string }): Promise<NormalizedVendorUsage['projects']> {
  // Anthropic workspaces can be listed via Admin API if they have an admin key
  // For standard keys, return a single workspace
  try {
    const res = await fetch('https://api.anthropic.com/v1/organizations/workspaces', {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.data ?? []).map((w: any) => ({ id: w.id, name: w.display_name ?? w.name }));
    }
  } catch {}

  return [{ id: 'default', name: 'Default Workspace' }];
}

export async function fetchCostMetrics(_config: { apiKey: string }): Promise<NormalizedVendorUsage['costMetrics']> {
  // No billing API — return empty. User will self-report or we'll add CSV upload later.
  return [];
}
```

### 1.3 Google Vertex AI (`google.service.ts`)

**Complexity:** Google requires a Service Account JSON key (not a simple API key string). This changes the vendor connection flow — for Google, the user uploads a service account JSON file rather than pasting an API key.

**APIs to call:**
- `aiplatform.googleapis.com` — list models, endpoints
- Cloud Billing API — usage costs
- Cloud Monitoring API — request counts, latency

**For MVP, simplify:** Accept a Google AI Studio API key (for Gemini models) instead of full Vertex AI:

```typescript
// backend/src/services/vendors/google.service.ts

export async function fetchUsage(config: { apiKey: string }): Promise<NormalizedVendorUsage['usage']> {
  // Use the Generative AI API to list available models
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`
  );

  if (!res.ok) {
    throw new Error(`Google AI API ${res.status}: Key validation failed`);
  }

  const data = await res.json();
  const models = (data.models ?? [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => ({
      modelOrResource: m.name?.replace('models/', '') ?? m.displayName,
      usageAmount: undefined, // No usage API for AI Studio keys
      unit: 'tokens',
    }));

  return models;
}

export async function fetchProjects(_config: { apiKey: string }): Promise<NormalizedVendorUsage['projects']> {
  return [{ id: 'default', name: 'Google AI Studio' }];
}

export async function fetchCostMetrics(_config: { apiKey: string }): Promise<NormalizedVendorUsage['costMetrics']> {
  // Google AI Studio doesn't expose billing via API key
  return [];
}
```

### 1.4 Pinecone (`pinecone.service.ts`)

**APIs to call (REST, no SDK needed):**
- `GET https://api.pinecone.io/indexes` — list all indexes (name, metric, dimension, pod type, status)
- `POST https://{index-host}/describe_index_stats` — vector count, namespace breakdown, fullness

```typescript
// backend/src/services/vendors/pinecone.service.ts

export async function fetchUsage(config: { apiKey: string }): Promise<NormalizedVendorUsage['usage']> {
  // Step 1: List all indexes
  const listRes = await fetch('https://api.pinecone.io/indexes', {
    headers: { 'Api-Key': config.apiKey },
  });

  if (!listRes.ok) {
    throw new Error(`Pinecone API ${listRes.status}: Key validation failed`);
  }

  const listData = await listRes.json();
  const indexes = listData.indexes ?? [];

  const usage: NormalizedVendorUsage['usage'] = [];

  // Step 2: For each index, get stats
  for (const idx of indexes) {
    try {
      const statsRes = await fetch(`https://${idx.host}/describe_index_stats`, {
        method: 'POST',
        headers: {
          'Api-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });

      if (statsRes.ok) {
        const stats = await statsRes.json();
        usage.push({
          modelOrResource: idx.name,
          usageAmount: stats.totalVectorCount ?? stats.total_vector_count ?? 0,
          unit: 'vectors',
          projectId: idx.name,
        });
      }
    } catch {
      usage.push({
        modelOrResource: idx.name,
        usageAmount: undefined,
        unit: 'vectors',
      });
    }
  }

  return usage;
}

export async function fetchProjects(config: { apiKey: string }): Promise<NormalizedVendorUsage['projects']> {
  const listRes = await fetch('https://api.pinecone.io/indexes', {
    headers: { 'Api-Key': config.apiKey },
  });

  if (!listRes.ok) return [];

  const data = await listRes.json();
  return (data.indexes ?? []).map((idx: any) => ({
    id: idx.name,
    name: idx.name,
  }));
}

export async function fetchCostMetrics(config: { apiKey: string }): Promise<NormalizedVendorUsage['costMetrics']> {
  // Pinecone doesn't expose billing API
  // Estimate cost based on pod spec from list_indexes
  const listRes = await fetch('https://api.pinecone.io/indexes', {
    headers: { 'Api-Key': config.apiKey },
  });

  if (!listRes.ok) return [];

  const data = await listRes.json();
  const costs: NormalizedVendorUsage['costMetrics'] = [];

  for (const idx of data.indexes ?? []) {
    // Rough cost estimation based on pod type
    let monthlyCost = 0;
    if (idx.spec?.pod) {
      const pods = idx.spec.pod.pods ?? 1;
      const replicas = idx.spec.pod.replicas ?? 1;
      const podType = idx.spec.pod.pod_type ?? 'p1.x1';
      // Approximate pricing: p1.x1 ~$70/mo, p2.x1 ~$100/mo, s1.x1 ~$100/mo
      const baseCost = podType.startsWith('p2') ? 100 : podType.startsWith('s1') ? 100 : 70;
      monthlyCost = baseCost * pods * replicas;
    } else if (idx.spec?.serverless) {
      // Serverless: ~$0.05 per GB stored + read/write units
      monthlyCost = 25; // Rough estimate for active serverless index
    }

    costs.push({
      projectId: idx.name,
      amount: monthlyCost,
      currency: 'USD',
      period: 'month',
    });
  }

  return costs;
}
```

### 1.5 LangSmith (`langsmith.service.ts`)

**APIs to call:**
- `GET https://api.smith.langchain.com/api/v1/sessions` — list tracing projects/sessions
- `GET https://api.smith.langchain.com/api/v1/runs/stats` — run counts, latency, token usage

```typescript
// backend/src/services/vendors/langsmith.service.ts

export async function fetchUsage(config: { apiKey: string }): Promise<NormalizedVendorUsage['usage']> {
  const res = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=50', {
    headers: { 'x-api-key': config.apiKey },
  });

  if (!res.ok) {
    throw new Error(`LangSmith API ${res.status}: Key validation failed`);
  }

  const sessions = await res.json();

  return (sessions ?? []).map((s: any) => ({
    modelOrResource: s.name ?? s.id,
    usageAmount: s.run_count ?? s.total_runs ?? undefined,
    unit: 'runs',
    projectId: s.id,
  }));
}

export async function fetchProjects(config: { apiKey: string }): Promise<NormalizedVendorUsage['projects']> {
  const res = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=50', {
    headers: { 'x-api-key': config.apiKey },
  });

  if (!res.ok) return [];

  const sessions = await res.json();
  return (sessions ?? []).map((s: any) => ({
    id: s.id,
    name: s.name ?? 'Unnamed Project',
  }));
}

export async function fetchCostMetrics(_config: { apiKey: string }): Promise<NormalizedVendorUsage['costMetrics']> {
  // LangSmith doesn't expose billing directly
  return [];
}
```

---

## PART 2: BACKEND IMPROVEMENTS

### 2.1 Add Vendor Key Validation Endpoint

Before storing a key, validate it works. Add a new route:

```typescript
// backend/src/routes/vendor.routes.ts — add:
router.post('/validate', auth, validateVendorKey);

// backend/src/controllers/vendor.controller.ts — add:
export async function validateVendorKey(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { vendor_name, api_key } = req.body;

  const validators: Record<string, (key: string) => Promise<boolean>> = {
    'OpenAI': async (key) => {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      return r.ok;
    },
    'Anthropic': async (key) => {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      });
      return r.ok;
    },
    'Google Vertex AI': async (key) => {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      return r.ok;
    },
    'Pinecone': async (key) => {
      const r = await fetch('https://api.pinecone.io/indexes', {
        headers: { 'Api-Key': key },
      });
      return r.ok;
    },
    'LangSmith': async (key) => {
      const r = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=1', {
        headers: { 'x-api-key': key },
      });
      return r.ok;
    },
  };

  const validator = validators[vendor_name];
  if (!validator) {
    res.status(400).json({ valid: false, error: 'Unknown vendor' });
    return;
  }

  try {
    const valid = await validator(api_key);
    res.json({ valid, vendor_name });
  } catch (err) {
    res.json({ valid: false, vendor_name, error: (err as Error).message });
  }
}
```

### 2.2 Real-Time Scan Progress via Supabase Realtime

Instead of polling `/api/scan/:jobId/status`, use Supabase Realtime for live updates on the frontend:

```typescript
// Frontend: subscribe to scan_logs for live updates
const channel = supabase
  .channel(`scan-${jobId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'scan_logs',
    filter: `scan_job_id=eq.${jobId}`,
  }, (payload) => {
    addLogEntry(payload.new);
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'scan_jobs',
    filter: `id=eq.${jobId}`,
  }, (payload) => {
    updateScanStatus(payload.new.status);
  })
  .subscribe();
```

**Required:** Enable Supabase Realtime on `scan_logs` and `scan_jobs` tables in the Supabase dashboard.

### 2.3 Enhanced System Discovery

Update `systemDiscovery.service.ts` to handle real API data better:

```typescript
// Key improvements:
// 1. Use actual project names from vendor APIs, not heuristic guessing
// 2. Calculate MoM cost change from historical data
// 3. Infer system type from actual model names (gpt-4o → LLM API, text-embedding → Embedding, etc.)

function inferSystemType(vendor: string, modelOrResource?: string): SystemType {
  const m = (modelOrResource ?? '').toLowerCase();

  if (vendor === 'Pinecone') return 'Vector DB';
  if (vendor === 'LangSmith') return 'Pipeline';

  // LLM model patterns
  if (m.includes('gpt-4') || m.includes('gpt-3.5') || m.includes('o1') || m.includes('o3'))
    return 'Model API';
  if (m.includes('claude') || m.includes('sonnet') || m.includes('opus') || m.includes('haiku'))
    return 'Model API';
  if (m.includes('gemini') || m.includes('palm'))
    return 'Model API';

  // Embedding models
  if (m.includes('embed') || m.includes('ada'))
    return 'Pipeline'; // Embeddings are typically part of a pipeline

  // Agent patterns
  if (m.includes('agent') || m.includes('assistant') || m.includes('copilot'))
    return 'Agent';

  return 'Model API';
}
```

---

## PART 3: FRONTEND — SCREEN 01 (Welcome + Vendor Connect)

**File:** `frontend/src/app/onboarding/page.tsx`

### 3.1 Design Requirements (from mockup)

- Two-panel layout: Left = company info form, Right = vendor cards
- Step tracker in top bar (1. Connect → 2. Scan → 3. Confirm → 4. Baseline → 5. Insights)
- Vendor cards show colored left border accent, logo placeholder, name, description, Connect/Connected button
- API key input appears inline when "Connect" is clicked (not a modal)
- Real-time key validation with loading spinner + success/error state
- "Continue to scan" button becomes active when at least 1 vendor is connected

### 3.2 Component Structure

```
/onboarding/page.tsx
├── OnboardingLayout (top bar + step tracker)
├── CompanyInfoForm (left panel)
│   ├── CompanyNameInput
│   ├── CompanySizeSelect
│   ├── AIUseCaseSelect
│   ├── RoleSelect
│   ├── MonthlySpendSelect
│   └── ComplianceSelect
└── VendorConnectPanel (right panel)
    ├── VendorCard × 5 (OpenAI, Anthropic, Google, Pinecone, LangSmith)
    │   ├── collapsed: logo + name + description + Connect button
    │   └── expanded: API key input + Validate button + status
    └── ContinueButton
```

### 3.3 Key Implementation Details

**Form state shape:**
```typescript
interface OnboardingForm {
  company: {
    name: string;
    size: string;
    ai_use_case: string;
    role: string;
    monthly_ai_spend_estimate: string;
    compliance_requirement: string;
  };
  vendors: Record<VendorName, {
    apiKey: string;
    status: 'idle' | 'validating' | 'connected' | 'error';
    errorMessage?: string;
  }>;
}
```

**Vendor connect flow:**
1. User clicks "Connect" → card expands to show API key input
2. User pastes key → auto-validates via `POST /api/vendors/validate`
3. On success → `POST /api/vendors/connect` to store encrypted key
4. Card shows "Connected ✓" with green styling
5. On error → show inline error ("Invalid API key" or "Requires Admin key for OpenAI")

**OpenAI-specific UX:** Show a helper note: "OpenAI requires an Admin API key for usage data. Generate one at platform.openai.com/settings/organization/admin-keys"

---

## PART 4: FRONTEND — SCREEN 02 (Auto-Scan)

**File:** `frontend/src/app/onboarding/scan/page.tsx`

### 4.1 Design Requirements

- Left panel: scan progress by vendor (Done ✓ / Scanning… / Pending)
- Live counters: Systems found, Est. spend/mo, Teams mapped
- Right panel: live log feed (timestamp + colored dot + message)
- Inference preview box showing what ClauseAI has inferred so far
- "Continue → Confirm systems" button activates when scan completes

### 4.2 Data Flow

```
1. Page loads → POST /api/scan/start → receives { job_id }
2. Subscribe to Supabase Realtime on scan_logs (filter: scan_job_id = job_id)
3. Subscribe to scan_jobs updates (filter: id = job_id)
4. As scan_logs INSERT events arrive → append to live log feed
5. Periodically update counters by computing from log entries
6. When scan_jobs.status === 'completed' → enable continue button
```

**Fallback (if Realtime isn't set up):** Poll `GET /api/scan/:jobId/status` every 2 seconds.

### 4.3 Component Structure

```
/onboarding/scan/page.tsx
├── OnboardingLayout (step 2 active)
├── ScanProgressPanel (left)
│   ├── ScanHeader ("Discovering your AI infrastructure…")
│   ├── VendorScanRow × N (one per connected vendor)
│   │   ├── progress bar animation
│   │   └── status text (systems found, cost, teams)
│   └── CounterCards (systems / spend / teams)
└── LiveLogPanel (right)
    ├── LogFeed (scrollable, auto-scroll to bottom)
    │   └── LogRow × N (time + dot + message)
    ├── InferencePreview (summary table of what's been detected)
    └── ContinueButton
```

### 4.4 Vendor Status State Machine

```
idle → scanning → done | error
```

The backend logs like `Connected to OpenAI API · reading usage data` should be parsed on the frontend to update vendor-specific status:
- Log contains "Connected to {vendor}" → set vendor to `scanning`
- Log contains "Fetched" or "Found" for vendor → update vendor stats
- Log contains "Error" for vendor → set vendor to `error`
- Log "Scan complete" → set all remaining to `done`

---

## PART 5: FRONTEND — SCREEN 03 (Discovered Systems)

**File:** `frontend/src/app/onboarding/systems/page.tsx`

### 5.1 Design Requirements

- Left sidebar: summary stats + vendor breakdown + actions
- Main area: table of discovered AI systems
- Each system row shows: name, vendor badge, team (inferred/editable), cost, compliance badges
- Inferred fields have a distinctive badge style (blue tint) with edit icon on hover
- Clicking an inferred field opens inline edit (dropdown or text input)
- User overrides change the badge to "override" style (amber tint)
- Bottom: "Add a system ClauseAI didn't find" button

### 5.2 Data Flow

```
1. Page loads → GET /api/systems → receives { systems: [...] }
2. Each system includes: inferences[], compliance_flags[]
3. User clicks inferred field → inline edit
4. On save → PATCH /api/systems/:id with { field: newValue }
5. Backend stores override in system_inferences.user_override
6. UI updates badge style from "inferred" to "override"
```

### 5.3 Component Structure

```
/onboarding/systems/page.tsx
├── OnboardingLayout (step 3 active)
├── SidePanel (left)
│   ├── ScanSummary (total systems, total spend, vendors, teams)
│   ├── VendorBreakdown (vendor → count + cost)
│   └── ActionButtons (Confirm & Generate Baseline, Re-scan, Add manually)
└── SystemsTable (right/main)
    ├── FilterBar (All / Production / Staging / By vendor)
    ├── TableHeader (System, Vendor, Team, Cost, Compliance)
    ├── SystemRow × N
    │   ├── SystemNameCell (name + type badge)
    │   ├── VendorBadge (colored dot + name)
    │   ├── InferredField (editable, shows confidence)
    │   ├── CostCell (amount + MoM trend)
    │   └── ComplianceBadges (pass/warn/fail)
    ├── AddSystemRow
    └── InferenceLegend (blue = inferred, amber = user override)
```

### 5.4 InferredField Component

```typescript
interface InferredFieldProps {
  value: string;
  confidence: number;
  isOverridden: boolean;
  onSave: (newValue: string) => Promise<void>;
  options?: string[]; // If provided, shows dropdown; else text input
}
```

---

## PART 6: DATABASE CHANGES

### 6.1 Schema Additions (run in Supabase SQL Editor)

```sql
-- Add user_role to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_role TEXT;

-- Add vendor_metadata to store extra info from vendor APIs
ALTER TABLE vendor_connections ADD COLUMN IF NOT EXISTS vendor_metadata JSONB DEFAULT '{}';

-- Add MoM cost tracking to ai_systems
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS previous_month_cost DECIMAL(12, 2);
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS cost_trend_pct DECIMAL(5, 2);

-- Add model info
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS primary_model TEXT;
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS usage_amount DECIMAL(18, 2);
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS usage_unit TEXT;

-- Enable Realtime on scan tables
ALTER PUBLICATION supabase_realtime ADD TABLE scan_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE scan_jobs;
```

### 6.2 RLS Policies (for Supabase Auth)

```sql
-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_systems ENABLE ROW LEVEL SECURITY;

-- Companies: users can only see their own
CREATE POLICY "Users see own companies" ON companies
  FOR ALL USING (owner_user_id = auth.uid());

-- Vendor connections: through company ownership
CREATE POLICY "Users see own vendor connections" ON vendor_connections
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_user_id = auth.uid())
  );

-- Similar for scan_jobs, ai_systems, etc.
```

---

## PART 7: CURSOR PROMPTING GUIDE

When working with Cursor on this codebase, use these prompts for each task:

### For vendor service implementation:
```
Replace the stub in backend/src/services/vendors/openai.service.ts with real API calls.
Use the OpenAI Organization Usage API (GET /v1/organization/usage/completions)
and Costs API (GET /v1/organization/costs). Auth is via Admin API Key passed
as Bearer token. Group by model for usage, group by project_id for costs.
Use native fetch (no axios). Handle pagination via next_page. See spec in
MVP_DEVELOPMENT_SPEC.md section 1.1.
```

### For frontend screen implementation:
```
Create the onboarding scan screen at frontend/src/app/onboarding/scan/page.tsx.
Match the visual design from design/screen-02-auto-scan.html exactly, using
Tailwind v4 classes. The page should:
1. On mount, POST to /api/scan/start to begin scanning
2. Poll GET /api/scan/:jobId/status every 2s (or use Supabase Realtime)
3. Show vendor scan progress (done/scanning/pending per vendor)
4. Show live log feed with auto-scroll
5. Show counter cards for systems/spend/teams
6. Enable "Continue" button when scan completes
Use the design tokens from the mockup: --bg: #FBF8F5, --accent: #28354A,
--accent2: #EF876E, --accent4: #4CAF50, etc.
See MVP_DEVELOPMENT_SPEC.md section 4 for full component structure.
```

### For system discovery improvements:
```
Update backend/src/services/discovery/systemDiscovery.service.ts to handle
real vendor API data. The current heuristic name inference is too naive.
Improvements needed:
1. Use actual project/workspace names from vendor APIs as system names
2. Infer system type from model names (gpt-4o → Model API, text-embedding → Pipeline)
3. Calculate cost per system from costMetrics matched by projectId
4. Store primary_model and usage_amount on the ai_systems record
See MVP_DEVELOPMENT_SPEC.md section 2.3.
```

---

## PART 8: TESTING CHECKLIST

### Backend
- [ ] OpenAI service: test with real Admin API key → returns models, costs, projects
- [ ] OpenAI service: test with regular API key → returns models, fails gracefully on costs
- [ ] Anthropic service: test with real key → returns available models
- [ ] Pinecone service: test with real key → returns indexes and vector counts
- [ ] Google service: test with AI Studio key → returns available models
- [ ] Scan orchestrator: full scan with 2+ vendors → systems written to DB
- [ ] Vendor validation endpoint: valid key → true, invalid key → false

### Frontend
- [ ] Welcome screen: form validation, vendor key validation flow
- [ ] Welcome screen: at least 1 vendor connected → Continue enabled
- [ ] Scan screen: scan starts automatically, logs stream in
- [ ] Scan screen: counters update as vendors complete
- [ ] Scan screen: scan completion enables Continue
- [ ] Systems screen: table loads with all discovered systems
- [ ] Systems screen: inferred fields are editable, overrides persist
- [ ] Systems screen: filter by vendor/environment works

### Integration
- [ ] Full flow: Welcome → Scan → Systems without errors
- [ ] Error states: invalid key, network failure, scan timeout
- [ ] Auth: Supabase Auth user → company → vendor connections → scan → systems

---

## PRIORITY ORDER

1. **Vendor services** (backend) — Replace stubs with real API calls. Start with OpenAI (richest data), then Pinecone (simple REST), then Anthropic/Google/LangSmith.
2. **Scan orchestrator fixes** — Update to handle real data shapes, error handling per vendor.
3. **Screen 01** — Polish the existing WelcomeOnboarding.tsx to match the mockup design, add inline key validation.
4. **Screen 02** — Build from scratch with polling/realtime.
5. **Screen 03** — Build from scratch with editable inferred fields.
6. **Database migrations** — Run schema additions before testing screens 02-03.