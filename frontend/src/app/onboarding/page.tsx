"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCompany,
  connectVendor,
  ApiError,
  type ConnectVendorPayload,
  type CreateCompanyPayload,
} from "@/lib/api";

type Size = "1-10" | "11-50" | "51-200";
type Compliance = "soc2" | "hipaa" | "gdpr";

function normalizeSize(value: string): Size {
  const v = value.trim().toLowerCase();
  if (v === "1-10") return "1-10";
  if (v === "11-50") return "11-50";
  if (v === "51-200") return "51-200";
  if (/^1\s*[-–]\s*10$/.test(v)) return "1-10";
  if (/^11\s*[-–]\s*50$/.test(v)) return "11-50";
  if (/^51\s*[-–]\s*200$/.test(v)) return "51-200";
  if (v.includes("1–50") || v === "1-50") return "1-10";
  if (
    v.includes("201") ||
    v.includes("500") ||
    v.includes("501") ||
    v.includes("2000")
  )
    return "51-200";
  return "51-200";
}

function normalizeCompliance(value: string): Compliance {
  const v = value.trim().toLowerCase();
  if (v === "soc2" || v.includes("soc")) return "soc2";
  if (v === "hipaa" || v.includes("hipaa")) return "hipaa";
  if (v === "gdpr" || v.includes("gdpr")) return "gdpr";
  if (v.includes("none") || v.includes("figuring")) return "gdpr";
  return "gdpr";
}

const SIZE_OPTIONS = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
];

const COMPLIANCE_OPTIONS = [
  { value: "soc2", label: "SOC 2 Type II" },
  { value: "hipaa", label: "HIPAA" },
  { value: "gdpr", label: "GDPR" },
];

const AI_USE_CASE_OPTIONS = [
  { value: "customer_support", label: "Customer-facing AI (support, chat, search)" },
  { value: "internal_productivity", label: "Internal productivity / copilots" },
  { value: "data_analysis", label: "Data analysis + summarisation" },
  { value: "dev_tools", label: "Code generation + dev tools" },
  { value: "document_intelligence", label: "Document intelligence" },
  { value: "multiple", label: "Multiple / not sure yet" },
];

const MONTHLY_SPEND_OPTIONS = [
  { value: "under_10k", label: "Under $10k" },
  { value: "10k_50k", label: "$10k – $50k" },
  { value: "50k_200k", label: "$50k – $200k / mo" },
  { value: "200k_plus", label: "$200k+" },
];

const VENDOR_STORAGE_KEY = "clause_onboarding_vendor_keys";
const COMPANY_STORAGE_KEY = "clause_onboarding_company_id";

export function storeOnboardingKeysForAnalysis(companyId: string, keys: { openaiKey?: string; anthropicKey?: string; vertexKey?: string }) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(COMPANY_STORAGE_KEY, companyId);
  sessionStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(keys));
}

export function getOnboardingKeysForAnalysis(): { companyId: string | null; keys: { openaiKey?: string; anthropicKey?: string; vertexKey?: string } } {
  if (typeof sessionStorage === "undefined") return { companyId: null, keys: {} };
  const companyId = sessionStorage.getItem(COMPANY_STORAGE_KEY);
  const raw = sessionStorage.getItem(VENDOR_STORAGE_KEY);
  let keys: { openaiKey?: string; anthropicKey?: string; vertexKey?: string } = {};
  try {
    if (raw) keys = JSON.parse(raw);
  } catch {
    // ignore
  }
  return { companyId, keys };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState<string>("51-200");
  const [monthlySpend, setMonthlySpend] = useState("50k_200k");
  const [aiUseCase, setAiUseCase] = useState("multiple");
  const [compliance, setCompliance] = useState<string>("soc2");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [vertexKey, setVertexKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Company name is required.");
      return;
    }

    setLoading(true);
    try {
      const payload: CreateCompanyPayload = {
        name: trimmedName,
        size: normalizeSize(size),
        ai_use_case: aiUseCase || "multiple",
        monthly_ai_spend_estimate: monthlySpend || "50k_200k",
        compliance_requirement: normalizeCompliance(compliance),
      };
      const { id: companyId } = await createCompany(payload);

      const connections: ConnectVendorPayload[] = [];
      if (openaiKey.trim())
        connections.push({
          company_id: companyId,
          vendor_name: "OpenAI",
          api_key: openaiKey.trim(),
        });
      if (anthropicKey.trim())
        connections.push({
          company_id: companyId,
          vendor_name: "Anthropic",
          api_key: anthropicKey.trim(),
        });
      if (vertexKey.trim())
        connections.push({
          company_id: companyId,
          vendor_name: "Google Vertex AI",
          api_key: vertexKey.trim(),
        });

      if (connections.length > 0) {
        const results = await Promise.allSettled(
          connections.map((c) => connectVendor(c))
        );
        const errors: string[] = [];
        results.forEach((result, i) => {
          if (result.status === "rejected") {
            const msg =
              result.reason instanceof ApiError
                ? result.reason.message
                : result.reason instanceof Error
                  ? result.reason.message
                  : "Connection failed";
            errors.push(`${connections[i].vendor_name}: ${msg}`);
          }
        });
        if (errors.length > 0) {
          setError(errors.join(" "));
          setLoading(false);
          return;
        }
      }

      storeOnboardingKeysForAnalysis(companyId, {
        openaiKey: openaiKey.trim() || undefined,
        anthropicKey: anthropicKey.trim() || undefined,
        vertexKey: vertexKey.trim() || undefined,
      });
      router.push(`/analysis?company=${encodeURIComponent(companyId)}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 flex min-h-screen flex-col">
      <header className="flex h-[52px] items-center border-b border-clause-border bg-clause-surface px-7">
        <Link href="/" className="flex items-center gap-2 font-display text-base font-extrabold tracking-tight text-clause-accent">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-clause-accent text-[10px] font-bold text-white">
            C/
          </div>
          Clause<span className="text-clause-accent">AI</span>
        </Link>
        <div className="ml-7 flex items-center">
          <Step active label="Connect" step={1} />
          <StepDiv />
          <Step label="Scan" step={2} />
          <StepDiv />
          <Step label="Confirm" step={3} />
          <StepDiv />
          <Step label="Baseline" step={4} />
          <StepDiv />
          <Step label="Insights" step={5} />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-8 border-clause-border px-10 py-12 lg:border-r lg:px-14 lg:py-[52px] animate-clause-fade-up">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[2px] text-clause-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-clause-accent animate-clause-pulse" />
              Getting started
            </div>
            <h1 className="mt-3 font-display text-[36px] font-extrabold leading-tight tracking-tight">
              Welcome to
              <br />
              Clause<span className="text-clause-accent">AI</span>
            </h1>
            <p className="mt-3.5 max-w-[400px] text-sm font-light leading-relaxed text-clause-text2">
              Tell us a little about your organisation. ClauseAI will use this to
              personalise your baseline and surface the most relevant insights
              from day one.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Company name"
                required
                value={name}
                onChange={setName}
                placeholder="Acme Corp"
              />
              <Field label="Company size">
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="field-select"
                >
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Primary AI use case">
              <select
                value={aiUseCase}
                onChange={(e) => setAiUseCase(e.target.value)}
                className="field-select"
              >
                {AI_USE_CASE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Est. monthly AI spend">
                <select
                  value={monthlySpend}
                  onChange={(e) => setMonthlySpend(e.target.value)}
                  className="field-select"
                >
                  {MONTHLY_SPEND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Primary compliance requirement">
                <select
                  value={compliance}
                  onChange={(e) => setCompliance(e.target.value)}
                  className="field-select"
                >
                  {COMPLIANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {error && (
              <div
                className="mt-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg bg-clause-accent px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--clause-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Connecting..." : "Continue to connect vendors →"}
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

        <div className="flex flex-col justify-center gap-7 px-8 py-12 lg:px-12 lg:py-[52px] opacity-0 animate-clause-fade-up-delay-1">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">
              Connect your AI vendors
            </h2>
            <p className="mt-1.5 text-sm font-light leading-relaxed text-clause-text2">
              ClauseAI will connect to your vendor analytics APIs to auto-discover
              systems, spend, and usage. We only read telemetry — we never modify
              your AI systems. Connect as many as you use.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <VendorCard
              vendorKey="anthropic"
              name="Anthropic"
              desc="Claude models · usage + cost API"
              logoBg="bg-[rgba(0,229,255,0.1)]"
              logoColor="text-clause-accent"
              logoText="An"
              value={anthropicKey}
              onChange={setAnthropicKey}
              className="animate-clause-fade-up-card-1 opacity-0"
            />
            <VendorCard
              vendorKey="openai"
              name="OpenAI"
              desc="GPT models · usage dashboard API"
              logoBg="bg-[rgba(123,97,255,0.1)]"
              logoColor="text-clause-accent2"
              logoText="OA"
              value={openaiKey}
              onChange={setOpenaiKey}
              className="animate-clause-fade-up-card-2 opacity-0"
            />
            <VendorCard
              vendorKey="google"
              name="Google AI / Vertex"
              desc="Gemini models · Cloud billing API"
              logoBg="bg-[rgba(255,179,71,0.1)]"
              logoColor="text-clause-warning"
              logoText="G"
              value={vertexKey}
              onChange={setVertexKey}
              className="animate-clause-fade-up-card-3 opacity-0"
            />
          </div>

          <p className="font-mono text-xs text-clause-text3">
            <span>Missing a vendor?</span>{" "}
            <button type="button" className="text-clause-text2 underline decoration-clause-text3">
              Add via API key manually
            </button>
            {" · "}
            <button type="button" className="text-clause-text2 underline decoration-clause-text3">
              Skip for now
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

function Step({
  active,
  label,
  step,
}: {
  active?: boolean;
  label: string;
  step: number;
}) {
  return (
    <div
      className={`flex items-center gap-[7px] px-3 py-0 font-mono text-[11px] ${
        active ? "text-clause-text" : "text-clause-text3"
      }`}
    >
      <span
        className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border text-[9px] ${
          active
            ? "border-clause-accent bg-clause-accent text-white"
            : "border-current"
        }`}
      >
        {step}
      </span>
      {label}
    </div>
  );
}

function StepDiv() {
  return <div className="h-px w-5 bg-clause-border2" />;
}

function Field({
  label,
  children,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  children?: React.ReactNode;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[9px] uppercase tracking-wider text-clause-text3">
        {label}
        {required && " *"}
      </label>
      {children ?? (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="field-input"
        />
      )}
    </div>
  );
}

function VendorCard({
  vendorKey,
  name,
  desc,
  logoBg,
  logoColor,
  logoText,
  value,
  onChange,
  className,
}: {
  vendorKey: string;
  name: string;
  desc: string;
  logoBg: string;
  logoColor: string;
  logoText: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 overflow-hidden rounded-lg border border-clause-border bg-clause-surface px-4 py-3.5 transition-colors hover:border-clause-border2 hover:bg-clause-surface2 ${className ?? ""}`}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor:
          vendorKey === "openai"
            ? "var(--clause-accent2)"
            : vendorKey === "anthropic"
              ? "var(--clause-accent)"
              : "var(--clause-warning)",
      }}
    >
      <div
        className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-md font-mono text-[13px] font-bold ${logoBg} ${logoColor}`}
      >
        {logoText}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{name}</div>
        <div className="font-mono text-[11px] text-clause-text3 mt-0.5">
          {desc}
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="API key (optional)"
          autoComplete="off"
          className="field-input mt-2 w-full"
        />
      </div>
    </div>
  );
}
