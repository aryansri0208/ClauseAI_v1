# ClauseAI MVP — Cursor Prompt Sequence

**How to use:** Work through these prompts in order. Each prompt is one Cursor task. After each, review the output, test if applicable, and commit before moving to the next.

**Setup:** Make sure `MVP_DEVELOPMENT_SPEC.md` is committed to the repo root on `onboarding-v2` so Cursor can see it as context.

---

## Phase 0: Pre-work (manual, not Cursor)

### 0.1 — Run DB migrations in Supabase SQL Editor

Go to your Supabase dashboard → SQL Editor → run this:

```sql
-- Add fields for richer system data
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_role TEXT;
ALTER TABLE vendor_connections ADD COLUMN IF NOT EXISTS vendor_metadata JSONB DEFAULT '{}';
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS previous_month_cost DECIMAL(12, 2);
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS cost_trend_pct DECIMAL(5, 2);
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS primary_model TEXT;
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS usage_amount DECIMAL(18, 2);
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS usage_unit TEXT;

-- Enable Realtime on scan tables (for live scan log streaming)
ALTER PUBLICATION supabase_realtime ADD TABLE scan_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE scan_jobs;
```

### 0.2 — Verify your .env has the required vars

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
API_KEY_SECRET=... (at least 32 chars, for encrypting vendor keys)
REDIS_URL=... (or REDIS_HOST/REDIS_PORT)
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

---

## Phase 1: Vendor API Integrations (Backend)

These replace the hardcoded stubs with real API calls. Do them one at a time.

### Prompt 1.1 — OpenAI vendor service

```
Read MVP_DEVELOPMENT_SPEC.md section 1.1 for the full implementation details.

Replace the stub implementation in backend/src/services/vendors/openai.service.ts with real OpenAI API calls:

1. fetchUsage() should call GET https://api.openai.com/v1/organization/usage/completions with start_time=30 days ago, bucket_width=1d, group_by=model. Auth is Bearer token. Aggregate total input_tokens + output_tokens per model across all buckets. Handle pagination via next_page field.

2. fetchCostMetrics() should call GET https://api.openai.com/v1/organization/costs with start_time=30 days ago, bucket_width=1d, group_by=project_id. Sum amount.value per project across all buckets.

3. fetchProjects() should call GET https://api.openai.com/v1/organization/projects?limit=100. If it returns 404 (user has a regular key, not admin key), gracefully fall back to returning [{ id: 'default', name: 'Default Project' }].

4. Keep the existing getNormalizedUsage() export that combines all three.

Use native fetch, no axios. Throw descriptive errors on non-OK responses including the status code and response body. The API key passed in config.apiKey is an OpenAI Admin API key.
```

### Prompt 1.2 — Pinecone vendor service

```
Read MVP_DEVELOPMENT_SPEC.md section 1.4.

Replace the stub in backend/src/services/vendors/pinecone.service.ts with real Pinecone REST API calls:

1. fetchUsage() should:
   - GET https://api.pinecone.io/indexes with header Api-Key
   - For each index, POST https://{index.host}/describe_index_stats to get vector counts
   - Return one usage entry per index with modelOrResource=index name, usageAmount=totalVectorCount, unit='vectors'

2. fetchProjects() should list indexes and return each as a project (id=name, name=name)

3. fetchCostMetrics() should list indexes and estimate monthly cost from pod spec:
   - Pod-based: base cost × pods × replicas (p1.x1 ~$70/mo, p2.x1 ~$100/mo)
   - Serverless: flat $25 estimate
   - Return one cost entry per index

Keep the getNormalizedUsage() export. Use native fetch. Handle errors per-index so one failing index doesn't break the whole scan.
```

### Prompt 1.3 — Anthropic vendor service

```
Read MVP_DEVELOPMENT_SPEC.md section 1.2.

Replace the stub in backend/src/services/vendors/anthropic.service.ts with real API calls:

1. fetchUsage() should call GET https://api.anthropic.com/v1/models with headers x-api-key and anthropic-version: 2023-06-01. Return each model as a usage entry with modelOrResource=model id, usageAmount=undefined (Anthropic has no usage API), unit='tokens'.

2. fetchProjects() should try GET https://api.anthropic.com/v1/organizations/workspaces with the same headers. If it works (admin key), return workspaces. If it fails, return [{ id: 'default', name: 'Default Workspace' }].

3. fetchCostMetrics() should return an empty array — Anthropic doesn't expose billing API.

Keep getNormalizedUsage(). Use native fetch. The key validation (confirming the key works) happens implicitly in fetchUsage() via the /v1/models call.
```

### Prompt 1.4 — Google AI vendor service

```
Read MVP_DEVELOPMENT_SPEC.md section 1.3.

Replace the stub in backend/src/services/vendors/google.service.ts with real API calls:

For MVP, we accept a Google AI Studio API key (not full Vertex AI service account).

1. fetchUsage() should call GET https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}. Filter to models that support generateContent. Return each as a usage entry with modelOrResource = model name (strip 'models/' prefix), usageAmount=undefined, unit='tokens'.

2. fetchProjects() returns [{ id: 'default', name: 'Google AI Studio' }]

3. fetchCostMetrics() returns [] (AI Studio doesn't expose billing via API key)

Keep getNormalizedUsage(). Use native fetch.
```

### Prompt 1.5 — LangSmith vendor service

```
Read MVP_DEVELOPMENT_SPEC.md section 1.5.

Replace the stub in backend/src/services/vendors/langsmith.service.ts with real API calls:

1. fetchUsage() should call GET https://api.smith.langchain.com/api/v1/sessions?limit=50 with header x-api-key. Return each session as a usage entry with modelOrResource=session name, usageAmount=run_count, unit='runs'.

2. fetchProjects() should use the same sessions endpoint, returning each as a project.

3. fetchCostMetrics() returns [] (LangSmith doesn't expose billing).

Keep getNormalizedUsage(). Use native fetch.
```

---

## Phase 2: Backend Additions

### Prompt 2.1 — Vendor key validation endpoint

```
Read MVP_DEVELOPMENT_SPEC.md section 2.1.

Add a new endpoint POST /api/vendors/validate to the backend that tests whether a vendor API key is valid before storing it.

1. Add the route in backend/src/routes/vendor.routes.ts
2. Add the controller function validateVendorKey in backend/src/controllers/vendor.controller.ts
3. It should accept { vendor_name, api_key } in the request body
4. For each vendor, make a lightweight API call to test the key:
   - OpenAI: GET /v1/models
   - Anthropic: GET /v1/models with x-api-key header and anthropic-version: 2023-06-01
   - Google Vertex AI: GET https://generativelanguage.googleapis.com/v1beta/models?key={key}
   - Pinecone: GET https://api.pinecone.io/indexes with Api-Key header
   - LangSmith: GET https://api.smith.langchain.com/api/v1/sessions?limit=1 with x-api-key header
5. Return { valid: boolean, vendor_name: string, error?: string }
6. This endpoint should still require auth (use the existing auth middleware).
```

### Prompt 2.2 — Improve system discovery heuristics

```
Read MVP_DEVELOPMENT_SPEC.md section 2.3.

Update backend/src/services/discovery/systemDiscovery.service.ts:

1. Improve inferSystemType() to recognize real model names:
   - gpt-4o, gpt-4, gpt-3.5-turbo, o1, o3 → 'Model API'
   - claude-3-*, claude-sonnet-*, claude-opus-*, claude-haiku-* → 'Model API'
   - gemini-1.5-*, gemini-2.* → 'Model API'
   - text-embedding-*, embed-* → 'Pipeline'
   - Any Pinecone vendor → 'Vector DB'
   - Any LangSmith vendor → 'Pipeline'

2. Improve inferSystemName() to prefer the actual project/workspace name from the vendor API rather than heuristic guessing. Only fall back to heuristics when the project name is generic like 'Default Project' or 'default'.

3. When creating NormalizedAISystem entries, populate the rawModelOrResource field so it's available for downstream inference.
```

### Prompt 2.3 — Improve metadata inference

```
Update backend/src/services/inference/metadataInference.service.ts:

1. Make confidence scores dynamic instead of hardcoded 0.7:
   - If system name clearly matches a pattern (e.g. 'Customer Support' → team: 'Platform Eng'), confidence = 0.85
   - If matching on vendor-level defaults, confidence = 0.5
   - If no pattern matches, team = 'Unknown', confidence = 0.3

2. Add compliance_risk inference based on vendor capabilities:
   - Systems handling customer data (support, chat, customer-facing) → 'medium'
   - Systems with health/medical keywords → 'high'
   - Pinecone indexes (may store PII embeddings) → 'medium'
   - Everything else → 'low'

3. Keep the existing function signature and InferredMetadata return type.
```

### Prompt 2.4 — Update scan orchestrator for new fields

```
Update backend/src/services/scan/scanOrchestrator.service.ts:

When inserting into ai_systems, also populate the new columns:
- primary_model: from the rawModelOrResource of the normalized system
- usage_amount: from the usage entry's usageAmount
- usage_unit: from the usage entry's unit

Also update the scan_logs messages to be more descriptive:
- Include model names found: "Found gpt-4o, gpt-4o-mini · 2 projects"
- Include cost data: "Total cost: $32,100/mo"
- Include vector counts for Pinecone: "Found index 'prod-embeddings' · 3.2M vectors"

Keep the same overall flow: iterate vendors → fetch usage → normalize to systems → infer metadata → insert to DB.
```

---

## Phase 3: Frontend — Screen 01 (Welcome + Vendor Connect)

### Prompt 3.1 — Create shared design tokens and layout

```
Read the design mockup at design/screen-01-welcome-connect.html for the visual reference.

Create frontend/src/app/onboarding/layout.tsx with:

1. A shared OnboardingLayout component that wraps all onboarding pages
2. Top bar with ClauseAI logo (logo-mark "C/" in dark box + "ClauseAI" text)
3. Step tracker showing 5 steps: Connect, Scan, Confirm, Baseline, Insights
4. Accept a currentStep prop (1-5) to highlight the active step and mark previous as done

Create frontend/src/styles/onboarding-tokens.ts (or use CSS variables in globals.css) with the design tokens from the mockup:
- --bg: #FBF8F5
- --surface: #FFFFFF
- --border: #DCDCDC
- --accent: #28354A (primary dark blue)
- --accent2: #EF876E (coral/orange)
- --accent3: #E06B5D
- --accent4: #4CAF50 (green/success)
- --warning: #FFB347
- --text: #333333, --text2: #555555, --text3: #777777

Use Tailwind v4 classes wherever possible, supplemented by CSS variables for the custom palette.
```

### Prompt 3.2 — Rebuild Welcome screen with mockup design

```
Read design/screen-01-welcome-connect.html for the exact visual layout.

Rewrite frontend/src/app/onboarding/page.tsx to match the mockup design:

LEFT PANEL (company form):
- "Getting started" eyebrow with animated dot
- "Welcome to ClauseAI" title
- Subtitle text
- Form fields in the exact layout from the mockup:
  - Row: Company name (text) + Company size (select: 1-50, 51-200, 201-500, 501-2000, 2000+)
  - Full width: Primary AI use case (select with options from mockup)
  - Row: Your role (select) + Est. monthly AI spend (select)
  - Full width: Primary compliance requirement (select: SOC 2 Type II, HIPAA, GDPR, etc.)
- "Continue to connect vendors →" button
- "Already using ClauseAI? Sign in instead" link

RIGHT PANEL (vendor connect):
- "Connect your AI vendors" title + subtitle
- Vendor cards in a vertical list, each with:
  - Colored left border accent (different per vendor)
  - Logo placeholder (2-letter abbreviation in colored circle)
  - Vendor name + description
  - "Connect" button that expands to show API key input
  - After successful validation: "Connected ✓" green button

Use the existing frontend/src/lib/api.ts functions (createCompany, connectVendor).
Add a new function to call POST /api/vendors/validate.

The form submission should:
1. Create company via POST /api/company
2. For each vendor with a key entered, validate then store via POST /api/vendors/connect
3. Navigate to /onboarding/scan?company={companyId}
```

### Prompt 3.3 — Add vendor key validation UX

```
In the vendor cards on the onboarding page, implement inline key validation:

1. When user clicks "Connect" on a vendor card, expand it to show:
   - A password input for the API key
   - A "Validate & Connect" button
   - For OpenAI specifically, show a helper note: "Requires an Admin API key. Get one at platform.openai.com/settings/organization/admin-keys"

2. On clicking "Validate & Connect":
   - Show a loading spinner on the button
   - Call POST /api/vendors/validate with { vendor_name, api_key }
   - If valid: call POST /api/vendors/connect to store it, then collapse the input and show "Connected ✓"
   - If invalid: show inline error message below the input (e.g. "Invalid API key" or the error from the backend)

3. Track validation state per vendor: 'idle' | 'validating' | 'connected' | 'error'

4. The main "Continue to connect vendors →" button should be enabled only when at least 1 vendor is connected.

Add the validate function to frontend/src/lib/api.ts:
export async function validateVendorKey(vendor_name: VendorName, api_key: string): Promise<{ valid: boolean; error?: string }>
```

---

## Phase 4: Frontend — Screen 02 (Auto-Scan)

### Prompt 4.1 — Create scan page with polling

```
Read design/screen-02-auto-scan.html for the visual layout.

Create frontend/src/app/onboarding/scan/page.tsx:

1. On mount, read companyId from URL search params
2. POST to /api/scan/start to kick off the scan, receive { job_id }
3. Poll GET /api/scan/{job_id}/status every 2 seconds

LEFT PANEL:
- "Auto-scan running" eyebrow with spinning icon
- "Discovering your AI infrastructure…" title
- Vendor scan rows: one per connected vendor showing:
  - Logo + name
  - Status text (scanning progress or results summary)
  - Badge: "Done ✓" / "Scanning…" / "Pending"
  - Animated progress bar at bottom of each row
- Counter cards grid (3 columns):
  - Systems found (count)
  - Est. spend / mo (dollar amount)
  - Teams mapped (count)

RIGHT PANEL:
- "Live scan log" title
- Scrollable log feed that auto-scrolls to bottom as new entries arrive
- Each log row: timestamp + colored dot + message text
  - Green dot for success events
  - Cyan dot for scanning events
  - Orange dot for warnings/flags
- "Inferences so far" section: key-value table showing detected info
- "Continue → Confirm systems" button (disabled until scan completes)

Parse the scan status response to:
- Determine per-vendor status from logs (look for "Connected to {vendor}" and "Error" messages)
- Calculate counter values from systems_discovered, spend_estimate, vendors_scanned
- Populate the inference preview from the logs data

When status === 'completed', enable the Continue button and navigate to /onboarding/systems?company={companyId}
```

### Prompt 4.2 — Add Supabase Realtime (optional upgrade)

```
Upgrade the scan page to use Supabase Realtime instead of polling, with polling as fallback.

1. Install @supabase/supabase-js in the frontend if not already present
2. Create frontend/src/lib/supabase.ts that initializes the Supabase client with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
3. In the scan page, after getting the job_id:
   - Subscribe to postgres_changes INSERT on scan_logs where scan_job_id = job_id
   - Subscribe to postgres_changes UPDATE on scan_jobs where id = job_id
   - On each new scan_log, append to the log feed
   - On scan_jobs update, check if status changed to 'completed'
4. Keep the polling as a fallback: if the Realtime subscription fails or isn't available, fall back to polling every 2 seconds
5. Clean up subscriptions on unmount
```

---

## Phase 5: Frontend — Screen 03 (Discovered Systems)

### Prompt 5.1 — Create systems page with table

```
Read design/screen-03-discovered-systems.html for the visual layout.

Create frontend/src/app/onboarding/systems/page.tsx:

1. On mount, GET /api/systems to fetch all discovered AI systems

LEFT SIDEBAR (300px):
- "Confirm your AI systems" title + subtitle
- Scan summary cards:
  - Systems discovered (count)
  - Total spend (sum of monthly_cost_estimate)
  - Vendors (unique vendor count)
  - Teams (unique team_owner count)
- Vendor breakdown list: each vendor with system count + total cost
- Action buttons at bottom:
  - "Confirm & generate baseline" (primary, navigates to next screen)
  - "Re-scan vendors" (ghost button)

RIGHT MAIN AREA:
- Header with "Discovered AI systems" title + filter buttons (All, Production, Staging, by vendor)
- Table with columns: System, Vendor, Team, Cost/mo, Compliance
- Each row shows:
  - System: name + type badge (e.g. "Model API · Production")
  - Vendor: colored dot + vendor name in a badge
  - Team: inferred value in a blue-tinted badge with edit icon on hover
  - Cost: dollar amount + MoM trend (↑ 24% or "Stable" or ↓ 8%)
  - Compliance: badges (green "SOC 2 ✓", orange "⚠ SOC 2 partial", red "✕ No injection guard")
- Bottom: "+ Add a system ClauseAI didn't find" button
- Legend: blue = AI-inferred, amber = user override, dashed = low confidence
```

### Prompt 5.2 — Add inline editing for inferred fields

```
In the systems table on /onboarding/systems, make the inferred Team field editable:

1. Create an InferredField component that:
   - Shows the value in a styled badge (blue tint for inferred, amber for overridden)
   - On hover, shows a small edit icon (pencil)
   - On click, transforms into a dropdown select with options: 'Platform Eng', 'ML Team', 'Data Team', 'Growth Team', 'Security', 'Product', 'Other'
   - On selection, calls PATCH /api/systems/:id with { team_owner: newValue }
   - On success, updates the badge to amber "override" style
   - On blur/escape, cancels the edit

2. Also make the compliance badges interactive:
   - Inferred compliance badges (the ones with edit icons) should be clickable
   - On click, show a dropdown with options: 'SOC 2 ✓', 'SOC 2 partial', 'HIPAA required', 'GDPR review needed', 'No issues'
   - On selection, update via the backend

3. Add the PATCH function to frontend/src/lib/api.ts:
   export async function updateSystem(id: string, updates: Record<string, string>): Promise<void>
```

### Prompt 5.3 — Add filtering and manual system addition

```
On the /onboarding/systems page, add:

1. Filter bar functionality:
   - "All" shows all systems
   - "Production" / "Staging" filters by environment field
   - Individual vendor buttons filter by vendor name
   - Filters should be toggleable and combinable
   - Show the count next to each filter: "All (8)" "Production (6)"

2. "Add a system ClauseAI didn't find" button at the bottom of the table:
   - On click, append a new empty row to the table in edit mode
   - Fields: System name (text input), Vendor (select), Team (select), Est. cost (number input)
   - "Save" and "Cancel" buttons on the row
   - On save, POST to /api/systems (you'll need to add this endpoint) to create a manual system entry
   - The new system should have a visual indicator that it was manually added (not auto-discovered)

3. Add the create system function to frontend/src/lib/api.ts:
   export async function createManualSystem(payload: { name: string; vendor: string; team_owner: string; monthly_cost_estimate: number }): Promise<void>

4. Add a corresponding POST /api/systems endpoint in the backend that creates an ai_system with scan_job_id = null (indicating manual entry).
```

---

## Phase 6: Integration & Polish

### Prompt 6.1 — Wire up navigation flow

```
Ensure the full onboarding flow works end-to-end:

1. /onboarding (Screen 01) → on "Continue" → navigates to /onboarding/scan?company={id}
2. /onboarding/scan (Screen 02) → on "Continue" → navigates to /onboarding/systems?company={id}
3. /onboarding/systems (Screen 03) → on "Confirm & generate baseline" → navigates to /onboarding/baseline (Screen 04, can be a placeholder for now)

Make sure:
- The step tracker in the layout highlights the correct step on each page
- The company ID is passed via URL search params between pages
- If someone navigates to /onboarding/scan without a company param, redirect to /onboarding
- If someone navigates to /onboarding/systems before a scan has completed, show a loading state or redirect to /onboarding/scan
```

### Prompt 6.2 — Error handling and edge cases

```
Add robust error handling across all three onboarding screens:

1. Screen 01:
   - Show validation errors if required fields are empty on submit
   - Handle network errors when creating company or connecting vendors
   - If a vendor key validation times out after 10 seconds, show "Connection timed out, please try again"

2. Screen 02:
   - If POST /api/scan/start fails, show an error state with "Retry scan" button
   - If a vendor scan fails (error in logs), show that vendor as "Error" with red styling, but continue with other vendors
   - If the scan takes more than 2 minutes, show a "This is taking longer than expected" message
   - Handle page refresh: if there's an existing running scan, resume watching it instead of starting a new one

3. Screen 03:
   - Handle empty state: if scan found 0 systems, show a helpful message ("No AI systems detected. Check your API keys or add systems manually.")
   - Handle PATCH failures gracefully (revert the edit, show error toast)
   - Loading skeleton while systems are being fetched

4. Global:
   - Add a toast/notification system for success/error messages
   - Handle 401 (unauthorized) by redirecting to login
```

### Prompt 6.3 — Loading states and animations

```
Add polish to match the mockup's animations and loading states:

1. Screen 01:
   - fadeUp animation on page load (staggered: left panel, then right panel, then vendor cards)
   - Subtle pulse animation on the "Getting started" eyebrow dot
   - Smooth expand/collapse transition on vendor cards when connecting

2. Screen 02:
   - Scanning progress bar animation on each vendor row (CSS keyframe that sweeps left to right)
   - Counter values should animate/count up when they change
   - Log feed should have a subtle fade-in on new entries
   - Spinning icon next to "Auto-scan running"

3. Screen 03:
   - Table rows should fade in on load (staggered)
   - Smooth transition when filter changes (rows fade out/in)
   - Hover state on inferred fields (slight background color change + edit icon appears)

Use CSS keyframes and Tailwind transition utilities. Keep animations subtle and fast (150-300ms).
```

---

## Testing After Each Phase

After Phase 1: Test each vendor service individually with a real API key:
```bash
# Add a quick test script
cd backend
npx ts-node -e "
  import { getNormalizedUsage } from './src/services/vendors/openai.service';
  getNormalizedUsage({ apiKey: process.env.OPENAI_ADMIN_KEY! }).then(console.log).catch(console.error);
"
```

After Phase 2: Start the backend, hit /api/vendors/validate with curl

After Phase 3: Start both frontend + backend, go through Screen 01 manually

After Phase 4: Trigger a scan, watch logs stream in

After Phase 5: Verify systems table loads, edits persist

After Phase 6: Full flow walkthrough, end to end

---

## Notes for Cursor

- Always tell Cursor which specific file(s) to create or edit
- If Cursor generates something that imports a package not in package.json, install it before moving on
- If a prompt produces errors, paste the error back into Cursor with "Fix this error: ..."
- Commit after each successful prompt so you can revert if something breaks
- The design mockups in /design/ are HTML files — tell Cursor to read them for visual reference