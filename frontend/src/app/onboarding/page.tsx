"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCompany,
  connectVendor,
  validateVendorKey,
  ApiError,
  type CreateCompanyPayload,
  type VendorName,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Options                                                            */
/* ------------------------------------------------------------------ */

const SIZE_OPTIONS = [
  "1–50",
  "51–200",
  "201–500",
  "501–2,000 employees",
  "2,000+",
];

const AI_USE_CASE_OPTIONS = [
  "Customer-facing AI (support, chat, search)",
  "Internal productivity / copilots",
  "Data analysis + summarisation",
  "Code generation + dev tools",
  "Document intelligence",
  "Multiple / not sure yet",
];

const ROLE_OPTIONS = [
  "CTO / Head of Engineering",
  "Head of AI / ML",
  "VP Engineering",
  "Platform Engineer",
  "ML / AI Engineer",
];

const SPEND_OPTIONS = [
  "Under $10k",
  "$10k – $50k",
  "$50k – $200k / mo",
  "$200k+",
];

const COMPLIANCE_OPTIONS = [
  "SOC 2 Type II",
  "HIPAA",
  "GDPR",
  "SOC 2 + HIPAA",
  "None yet / figuring out",
];

/* ------------------------------------------------------------------ */
/*  Vendor config                                                      */
/* ------------------------------------------------------------------ */

type VendorStatus = "idle" | "expanded" | "validating" | "connected" | "error";

interface VendorDef {
  key: string;
  apiName: VendorName;
  displayName: string;
  desc: string;
  logoText: string;
  logoBg: string;
  logoColor: string;
  borderColor: string;
  animClass: string;
  hint?: string;
}

const VENDORS: VendorDef[] = [
  {
    key: "anthropic",
    apiName: "Anthropic",
    displayName: "Anthropic",
    desc: "Claude models · usage + cost API",
    logoText: "An",
    logoBg: "rgba(0,229,255,0.1)",
    logoColor: "var(--clause-accent)",
    borderColor: "var(--clause-accent)",
    animClass: "opacity-0 animate-clause-fade-up-card-1",
  },
  {
    key: "openai",
    apiName: "OpenAI",
    displayName: "OpenAI",
    desc: "GPT models · usage dashboard API",
    logoText: "OA",
    logoBg: "rgba(123,97,255,0.1)",
    logoColor: "var(--clause-accent2)",
    borderColor: "var(--clause-accent2)",
    animClass: "opacity-0 animate-clause-fade-up-card-2",
    hint: "Requires Admin API key from platform.openai.com/settings/organization/admin-keys",
  },
  {
    key: "google",
    apiName: "Google Vertex AI",
    displayName: "Google AI / Vertex",
    desc: "Gemini models · Cloud billing API",
    logoText: "G",
    logoBg: "rgba(255,179,71,0.1)",
    logoColor: "var(--clause-warning)",
    borderColor: "var(--clause-warning)",
    animClass: "opacity-0 animate-clause-fade-up-card-3",
  },
  {
    key: "pinecone",
    apiName: "Pinecone",
    displayName: "Pinecone",
    desc: "Vector DB · usage + query metrics",
    logoText: "Pi",
    logoBg: "rgba(0,255,148,0.1)",
    logoColor: "var(--clause-accent4)",
    borderColor: "var(--clause-accent4)",
    animClass: "opacity-0 animate-clause-fade-up-card-4",
  },
  {
    key: "langsmith",
    apiName: "LangSmith",
    displayName: "LangSmith",
    desc: "Trace + eval pipeline metrics",
    logoText: "Ls",
    logoBg: "rgba(255,107,107,0.1)",
    logoColor: "var(--clause-accent3)",
    borderColor: "var(--clause-accent3)",
    animClass: "opacity-0 animate-clause-fade-up-card-5",
  },
];

/* ------------------------------------------------------------------ */
/*  Normalizers (keep backend compat)                                  */
/* ------------------------------------------------------------------ */

type Size = "1-10" | "11-50" | "51-200";
type Compliance = "soc2" | "hipaa" | "gdpr";

function normalizeSize(v: string): Size {
  if (v.includes("2,000") || v.includes("501") || v.includes("201")) return "51-200";
  if (v.includes("51")) return "11-50";
  return "1-10";
}

function normalizeCompliance(v: string): Compliance {
  const l = v.toLowerCase();
  if (l.includes("soc")) return "soc2";
  if (l.includes("hipaa")) return "hipaa";
  return "gdpr";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const router = useRouter();

  // Company form
  const [companyName, setCompanyName] = useState("");
  const [size, setSize] = useState(SIZE_OPTIONS[3]);
  const [useCase, setUseCase] = useState(AI_USE_CASE_OPTIONS[0]);
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [spend, setSpend] = useState(SPEND_OPTIONS[2]);
  const [compliance, setCompliance] = useState(COMPLIANCE_OPTIONS[0]);

  // Vendor state
  const [vendorStates, setVendorStates] = useState<
    Record<string, { status: VendorStatus; apiKey: string; error?: string }>
  >(() =>
    Object.fromEntries(
      VENDORS.map((v) => [v.key, { status: "idle" as VendorStatus, apiKey: "" }]),
    ),
  );

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const connectedCount = Object.values(vendorStates).filter(
    (s) => s.status === "connected",
  ).length;

  function updateVendor(
    key: string,
    patch: Partial<{ status: VendorStatus; apiKey: string; error?: string }>,
  ) {
    setVendorStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function handleValidateAndConnect(vendor: VendorDef) {
    const state = vendorStates[vendor.key];
    const trimmedKey = state.apiKey.trim();
    if (!trimmedKey) {
      updateVendor(vendor.key, { error: "API key is required", status: "error" });
      return;
    }

    updateVendor(vendor.key, { status: "validating", error: undefined });

    try {
      const validation = await validateVendorKey(vendor.apiName, trimmedKey);
      if (!validation.valid) {
        updateVendor(vendor.key, {
          status: "error",
          error: validation.error || "Invalid API key",
        });
        return;
      }

      updateVendor(vendor.key, { status: "connected", error: undefined });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Validation failed";
      updateVendor(vendor.key, { status: "error", error: msg });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const trimmedName = companyName.trim();
    if (!trimmedName) {
      setSubmitError("Company name is required.");
      return;
    }
    if (connectedCount === 0) {
      setSubmitError("Connect at least one vendor to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateCompanyPayload = {
        name: trimmedName,
        size: normalizeSize(size),
        ai_use_case: useCase,
        monthly_ai_spend_estimate: spend,
        compliance_requirement: normalizeCompliance(compliance),
      };
      const { id: companyId } = await createCompany(payload);

      const vendorsToConnect = VENDORS.filter(
        (v) => vendorStates[v.key].status === "connected",
      );
      await Promise.all(
        vendorsToConnect.map((v) =>
          connectVendor({
            vendor_name: v.apiName,
            api_key: vendorStates[v.key].apiKey.trim(),
            company_id: companyId,
          }),
        ),
      );

      router.push(`/onboarding/scan?company=${encodeURIComponent(companyId)}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const STEPS = ["Connect", "Scan", "Confirm", "Baseline", "Insights"];

  return (
    <main className="relative z-[1] flex min-h-screen flex-col">
      {/* ===== TOP BAR ===== */}
      <header className="flex h-[52px] shrink-0 items-center border-b border-clause-border bg-clause-surface px-7">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-extrabold tracking-tight text-clause-accent"
        >
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-clause-accent text-[10px] font-bold text-white">
            C/
          </span>
          Clause<span className="text-clause-accent">AI</span>
        </Link>
        <nav className="ml-7 flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              {i > 0 && <div className="mx-1 h-px w-5 bg-clause-border2" />}
              <div
                className={`flex items-center gap-[7px] px-3 font-mono text-[11px] ${
                  i === 0 ? "text-clause-text" : "text-clause-text3"
                }`}
              >
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[9px] ${
                    i === 0
                      ? "border-clause-accent bg-clause-accent text-white"
                      : "border-current"
                  }`}
                >
                  {i + 1}
                </span>
                {label}
              </div>
            </div>
          ))}
        </nav>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        {/* ===== LEFT PANEL ===== */}
        <div className="flex flex-col justify-center gap-8 border-clause-border py-[52px] px-[56px] lg:border-r animate-clause-fade-up">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[2px] text-clause-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-clause-accent animate-clause-pulse" />
              Getting started
            </div>
            <h1 className="mt-3 font-display text-[36px] font-extrabold leading-[1.1] tracking-[-1.2px]">
              Welcome to
              <br />
              Clause<span className="text-clause-accent">AI</span>
            </h1>
            <p className="mt-3.5 max-w-[400px] text-[14px] font-light leading-[1.7] text-clause-text2">
              Tell us a little about your organisation. ClauseAI will use this to
              personalise your baseline and surface the most relevant insights
              from day one.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Row 1: Company name + size */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company name">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  className="field-input w-full"
                />
              </Field>
              <Field label="Company size">
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="field-select w-full"
                >
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* AI use case — full width */}
            <Field label="Primary AI use case">
              <select
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                className="field-select w-full"
              >
                {AI_USE_CASE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>

            {/* Row 2: Role + Spend */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your role">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="field-select w-full"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Est. monthly AI spend">
                <select
                  value={spend}
                  onChange={(e) => setSpend(e.target.value)}
                  className="field-select w-full"
                >
                  {SPEND_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Compliance — full width */}
            <Field label="Primary compliance requirement">
              <select
                value={compliance}
                onChange={(e) => setCompliance(e.target.value)}
                className="field-select w-full"
              >
                {COMPLIANCE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>

            {submitError && (
              <div
                className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                role="alert"
              >
                {submitError}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="submit"
                disabled={submitting || connectedCount === 0}
                className="flex items-center justify-center gap-2 rounded-lg bg-clause-accent px-4 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--clause-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? "Setting up..."
                  : `Continue to scan →`}
              </button>
              <p className="text-center font-mono text-xs text-clause-text3">
                Already using ClauseAI?{" "}
                <Link href="/" className="text-clause-accent hover:underline">
                  Sign in instead
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="flex flex-col justify-center gap-7 py-[52px] px-[48px] opacity-0 animate-clause-fade-up-delay-1">
          <div>
            <h2 className="font-display text-[18px] font-bold tracking-[-0.4px]">
              Connect your AI vendors
            </h2>
            <p className="mt-1.5 text-[13px] font-light leading-[1.6] text-clause-text2">
              ClauseAI will connect to your vendor analytics APIs to auto-discover
              systems, spend, and usage. We only read telemetry — we never modify
              your AI systems. Connect as many as you use.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {VENDORS.map((vendor) => (
              <VendorCard
                key={vendor.key}
                vendor={vendor}
                state={vendorStates[vendor.key]}
                onUpdate={(patch) => updateVendor(vendor.key, patch)}
                onValidate={() => handleValidateAndConnect(vendor)}
                className={vendor.animClass}
              />
            ))}
          </div>

          <p className="flex items-center gap-2 font-mono text-xs text-clause-text3">
            <span>Missing a vendor?</span>
            <button
              type="button"
              className="text-clause-text2 underline decoration-clause-text3"
            >
              Add via API key manually
            </button>
            <span>·</span>
            <button
              type="button"
              className="text-clause-text2 underline decoration-clause-text3"
            >
              Skip for now
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Field                                                              */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[9px] uppercase tracking-[1px] text-clause-text3">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  VendorCard                                                         */
/* ------------------------------------------------------------------ */

function VendorCard({
  vendor,
  state,
  onUpdate,
  onValidate,
  className,
}: {
  vendor: VendorDef;
  state: { status: VendorStatus; apiKey: string; error?: string };
  onUpdate: (patch: Partial<{ status: VendorStatus; apiKey: string; error?: string }>) => void;
  onValidate: () => void;
  className?: string;
}) {
  const isConnected = state.status === "connected";
  const isExpanded = state.status === "expanded" || state.status === "validating" || state.status === "error";

  return (
    <div
      className={`relative overflow-hidden rounded-[9px] border bg-clause-surface transition-all ${
        isConnected
          ? "border-[var(--clause-connected-border)] bg-[var(--clause-connected-bg)]"
          : "border-clause-border hover:border-clause-border2 hover:bg-clause-surface2"
      } ${className ?? ""}`}
      style={{ borderLeftWidth: "3px", borderLeftColor: vendor.borderColor }}
    >
      {/* Top row: logo + info + action */}
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <div
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[7px] font-mono text-[13px] font-bold"
          style={{ background: vendor.logoBg, color: vendor.logoColor }}
        >
          {vendor.logoText}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{vendor.displayName}</div>
          <div className="mt-0.5 font-mono text-[11px] text-clause-text3">
            {vendor.desc}
          </div>
        </div>
        {isConnected ? (
          <span className="flex-shrink-0 rounded border border-[var(--clause-connected-border)] bg-[rgba(0,255,148,0.06)] px-2.5 py-1 font-mono text-[10px] text-clause-accent4">
            Connected ✓
          </span>
        ) : (
          <button
            type="button"
            onClick={() =>
              onUpdate({
                status: isExpanded ? "idle" : "expanded",
                error: undefined,
              })
            }
            className="flex-shrink-0 cursor-pointer rounded border border-clause-border2 bg-transparent px-2.5 py-1 font-mono text-[10px] text-clause-text3 transition-colors hover:border-clause-accent hover:text-clause-accent"
          >
            {isExpanded ? "Cancel" : "Connect"}
          </button>
        )}
      </div>

      {/* Expanded: key input + validate */}
      {isExpanded && (
        <div className="border-t border-clause-border px-4 pb-3.5 pt-3">
          {vendor.hint && (
            <p className="mb-2 rounded bg-[var(--clause-surface2)] px-2.5 py-1.5 font-mono text-[10px] leading-[1.5] text-clause-text3">
              {vendor.hint}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="password"
              value={state.apiKey}
              onChange={(e) => onUpdate({ apiKey: e.target.value, error: undefined })}
              placeholder="Paste API key"
              autoComplete="off"
              className="field-input min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={state.status === "validating" || !state.apiKey.trim()}
              onClick={onValidate}
              className="flex-shrink-0 rounded-[7px] bg-clause-accent px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--clause-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state.status === "validating" ? "Validating..." : "Validate & Connect"}
            </button>
          </div>
          {state.error && (
            <p className="mt-2 font-mono text-[11px] text-red-600">
              {state.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
