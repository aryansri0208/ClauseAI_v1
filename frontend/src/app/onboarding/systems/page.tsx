"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  listSystems,
  updateSystem,
  type AISystem,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS = ["Connect", "Scan", "Confirm", "Baseline", "Insights"];

const VENDOR_COLORS: Record<string, string> = {
  OpenAI: "var(--clause-accent4)",
  Anthropic: "var(--clause-accent)",
  "Google Vertex AI": "var(--clause-warning)",
  Pinecone: "var(--clause-accent4)",
  LangSmith: "var(--clause-accent3)",
};

const VENDOR_SHORT: Record<string, string> = {
  OpenAI: "OpenAI",
  Anthropic: "Anthropic",
  "Google Vertex AI": "Google AI",
  Pinecone: "Pinecone",
  LangSmith: "LangSmith",
};

const TEAM_OPTIONS = ["Platform Eng", "ML Team", "Data Team", "Growth Team", "Unknown"];
const SYSTEM_TYPE_OPTIONS = ["Model API", "Agent", "Vector DB", "Embedding", "Other"];
const ENVIRONMENT_OPTIONS = ["production", "staging", "development", "unknown"];

type FilterTab = "all" | "model_api" | "agents" | "vector_db" | "issues";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCost(amount: number | null): string {
  if (amount == null || amount === 0) return "$0";
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${Math.round(amount).toLocaleString()}`;
}

function formatCostFull(amount: number): string {
  if (amount === 0) return "$0";
  return `$${Math.round(amount).toLocaleString()}`;
}

function isFieldOverridden(system: AISystem, fieldName: string): boolean {
  return system.inferences.some(
    (inf) => inf.field_name === fieldName && inf.user_override != null,
  );
}

function hasComplianceFlags(system: AISystem): boolean {
  return system.compliance_flags.length > 0;
}

function deduplicateSystems(systems: AISystem[]): AISystem[] {
  const seen = new Map<string, AISystem>();
  const sorted = [...systems].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  for (const sys of sorted) {
    const key = `${sys.vendor}::${sys.name}`.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, sys);
    }
  }
  return Array.from(seen.values());
}

/* ------------------------------------------------------------------ */
/*  Inner component                                                    */
/* ------------------------------------------------------------------ */

function SystemsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company") ?? "";

  const [systems, setSystems] = useState<AISystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSystem, setNewSystem] = useState({
    name: "",
    vendor: "OpenAI",
    system_type: "Model API",
    team_owner: "Unknown",
    environment: "production",
  });

  const fetchSystems = useCallback(async () => {
    if (!companyId) {
      setError("Missing company ID in URL.");
      setLoading(false);
      return;
    }
    try {
      const data = await listSystems(companyId);
      setSystems(deduplicateSystems(data.systems));
    } catch {
      setError("Failed to load systems.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  const handleAddSystem = () => {
    if (!newSystem.name.trim()) return;
    const tempSystem: AISystem = {
      id: `temp-${Date.now()}`,
      name: newSystem.name.trim(),
      vendor: newSystem.vendor,
      system_type: newSystem.system_type,
      team_owner: newSystem.team_owner,
      environment: newSystem.environment,
      monthly_cost_estimate: 0,
      primary_model: null,
      usage_amount: null,
      usage_unit: null,
      created_at: new Date().toISOString(),
      inferences: [],
      compliance_flags: [],
    };
    setSystems((prev) => [...prev, tempSystem]);
    setShowAddForm(false);
    setNewSystem({
      name: "",
      vendor: "OpenAI",
      system_type: "Model API",
      team_owner: "Unknown",
      environment: "production",
    });
  };

  const handleFieldUpdate = async (
    systemId: string,
    field: "team_owner" | "system_type" | "environment",
    value: string,
  ) => {
    setSystems((prev) =>
      prev.map((s) => (s.id === systemId ? { ...s, [field]: value } : s)),
    );
    setEditedFields((prev) => new Set(prev).add(`${systemId}:${field}`));
    try {
      await updateSystem(systemId, companyId, { [field]: value });
    } catch {
      fetchSystems();
    }
  };

  const filtered = systems.filter((s) => {
    switch (activeFilter) {
      case "model_api":
        return s.system_type === "Model API";
      case "agents":
        return s.system_type === "Agent";
      case "vector_db":
        return s.system_type === "Vector DB";
      case "issues":
        return hasComplianceFlags(s);
      default:
        return true;
    }
  });

  const uniqueVendors = [...new Set(systems.map((s) => s.vendor))];
  const totalCost = systems.reduce(
    (sum, s) => sum + (s.monthly_cost_estimate ?? 0),
    0,
  );
  const complianceGaps = systems.filter(hasComplianceFlags).length;
  const teamsIdentified = [
    ...new Set(
      systems
        .map((s) => s.team_owner)
        .filter((t) => t && t !== "Unknown"),
    ),
  ].length;
  const totalEdited = editedFields.size;

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "model_api", label: "Model APIs" },
    { key: "agents", label: "Agents" },
    { key: "vector_db", label: "Vector DBs" },
    { key: "issues", label: `⚠ Issues${complianceGaps > 0 ? ` (${complianceGaps})` : ""}` },
  ];

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
          {STEPS.map((label, i) => {
            const isDone = i < 2;
            const isActive = i === 2;
            return (
              <div key={label} className="flex items-center">
                {i > 0 && <div className="mx-1 h-px w-5 bg-clause-border2" />}
                <div
                  className={`flex items-center gap-[7px] px-3 font-mono text-[11px] ${
                    isDone
                      ? "text-clause-accent4"
                      : isActive
                        ? "text-clause-text"
                        : "text-clause-text3"
                  }`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[9px] ${
                      isDone
                        ? "border-clause-accent4 bg-clause-accent4 text-white"
                        : isActive
                          ? "border-clause-accent bg-clause-accent text-white"
                          : "border-current"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </span>
                  {label}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 font-mono text-[10px] text-clause-accent4">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-clause-accent4" />
          Scan complete · {systems.length} systems found
        </div>
      </header>

      {/* ===== PAGE BODY ===== */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* ===== LEFT SIDEBAR ===== */}
        <div className="flex flex-col gap-7 border-r border-clause-border px-6 py-8 opacity-0 animate-clause-fade-up">
          <div>
            <h1 className="font-display text-[20px] font-extrabold leading-tight tracking-[-0.5px]">
              Review discovered systems
            </h1>
            <p className="mt-2 text-[12px] font-light leading-[1.5] text-clause-text2">
              ClauseAI scanned your connected vendors and inferred team
              ownership, spend, and compliance exposure. Review and correct
              anything that looks wrong before we generate your baseline.
            </p>
          </div>

          {/* Summary stats */}
          <div className="flex flex-col gap-0 rounded-[9px] border border-clause-border bg-clause-surface">
            <SidebarRow label="Systems found" value={String(systems.length)} />
            <SidebarRow
              label="Vendors connected"
              value={String(uniqueVendors.length)}
            />
            <SidebarRow
              label="Est. monthly spend"
              value={formatCostFull(totalCost)}
            />
            <SidebarRow
              label="Compliance gaps"
              value={String(complianceGaps)}
              highlight={complianceGaps > 0}
            />
            <SidebarRow
              label="Teams identified"
              value={String(teamsIdentified)}
              isLast
            />
          </div>

          {/* Vendors scanned */}
          {uniqueVendors.length > 0 && (
            <div>
              <div className="mb-2 font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3">
                Vendors scanned
              </div>
              <div className="flex flex-col gap-1.5">
                {uniqueVendors.map((vendor) => {
                  const vendorSystems = systems.filter(
                    (s) => s.vendor === vendor,
                  );
                  const vendorCost = vendorSystems.reduce(
                    (sum, s) => sum + (s.monthly_cost_estimate ?? 0),
                    0,
                  );
                  return (
                    <div
                      key={vendor}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: VENDOR_COLORS[vendor] ?? "var(--clause-text3)",
                        }}
                      />
                      <span className="flex-1 font-medium">
                        {VENDOR_SHORT[vendor] ?? vendor}
                      </span>
                      <span className="font-mono text-[10px] text-clause-text3">
                        {vendorSystems.length}
                      </span>
                      <span className="font-mono text-[10px] text-clause-text3">
                        {formatCost(vendorCost)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-col gap-2.5">
            <button
              onClick={() =>
                router.push(
                  `/onboarding/baseline?company=${encodeURIComponent(companyId)}`,
                )
              }
              className="w-full rounded-lg bg-clause-accent px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--clause-accent-hover)]"
            >
              Confirm + generate baseline →
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full rounded-lg border border-clause-border bg-clause-surface px-4 py-2.5 text-[12px] font-medium text-clause-text2 transition-colors hover:bg-clause-surface2"
            >
              + Add system manually
            </button>
            <p className="text-center text-[10px] text-clause-text3">
              All inferred fields can be edited at any time after onboarding
            </p>
          </div>
        </div>

        {/* ===== MAIN AREA ===== */}
        <div className="flex flex-col px-7 py-8 opacity-0 animate-clause-fade-up-delay-1">
          {loading ? (
            <div className="flex flex-1 items-center justify-center font-mono text-[12px] text-clause-text3">
              Loading systems…
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center font-mono text-[12px] text-clause-accent3">
              {error}
            </div>
          ) : (
            <>
              {/* Top bar: count + filters */}
              <div className="mb-4 flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-clause-text3">
                  {filtered.length} systems discovered · click any{" "}
                  <span className="text-[var(--clause-accent)]">
                    purple field
                  </span>{" "}
                  to edit
                </div>
                <div className="flex gap-1">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveFilter(tab.key)}
                      className={`rounded-md px-3 py-1.5 font-mono text-[10px] transition-colors ${
                        activeFilter === tab.key
                          ? "bg-clause-accent text-white"
                          : "text-clause-text3 hover:bg-clause-surface2"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded border border-[rgba(40,53,74,0.15)] bg-[rgba(40,53,74,0.05)] px-2 py-0.5 font-mono text-[9px] text-clause-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-clause-accent" />
                    AI inferred — click to edit
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded border border-[rgba(239,135,110,0.2)] bg-[rgba(239,135,110,0.06)] px-2 py-0.5 font-mono text-[9px] text-clause-accent2">
                    <span className="h-1.5 w-1.5 rounded-full bg-clause-accent2" />
                    Edited by you
                  </span>
                </div>
                <div className="font-mono text-[9px] text-clause-text3">
                  {totalEdited > 0 && (
                    <span>
                      {totalEdited} field{totalEdited === 1 ? "" : "s"} edited
                      {complianceGaps > 0 && " · "}
                    </span>
                  )}
                  {complianceGaps > 0 && (
                    <span className="text-clause-accent3">
                      {complianceGaps} compliance gap
                      {complianceGaps === 1 ? "" : "s"} need attention
                    </span>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="rounded-[10px] border border-clause-border bg-clause-surface">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_110px_140px_100px_140px] gap-2 border-b border-clause-border px-4 py-2.5">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3">
                    System
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3">
                    Vendor
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3">
                    Team owner
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3">
                    Monthly cost
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3">
                    Compliance
                  </span>
                </div>

                {/* Rows */}
                {filtered.map((system, idx) => {
                  const teamOverridden =
                    editedFields.has(`${system.id}:team_owner`) ||
                    isFieldOverridden(system, "team_owner");

                  return (
                    <div
                      key={system.id}
                      className={`grid grid-cols-[1fr_110px_140px_100px_140px] items-center gap-2 px-4 py-3 ${
                        idx < filtered.length - 1
                          ? "border-b border-clause-border"
                          : ""
                      }`}
                      style={{
                        opacity: 0,
                        animation: `clause-fade-up 0.35s ${0.05 + idx * 0.03}s ease forwards`,
                      }}
                    >
                      {/* System name */}
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">
                          {system.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-clause-text3">
                          {system.system_type ?? "Unknown"} ·{" "}
                          {system.environment ?? "unknown"}
                        </div>
                      </div>

                      {/* Vendor */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background:
                              VENDOR_COLORS[system.vendor] ??
                              "var(--clause-text3)",
                          }}
                        />
                        <span className="truncate font-mono text-[11px]">
                          {VENDOR_SHORT[system.vendor] ?? system.vendor}
                        </span>
                      </div>

                      {/* Team owner (editable) */}
                      <div>
                        <select
                          value={system.team_owner ?? "Unknown"}
                          onChange={(e) =>
                            handleFieldUpdate(
                              system.id,
                              "team_owner",
                              e.target.value,
                            )
                          }
                          className={`cursor-pointer appearance-none rounded-full border-0 px-3 py-1 font-mono text-[11px] font-medium outline-none ${
                            teamOverridden
                              ? "bg-[rgba(239,135,110,0.12)] text-clause-accent2"
                              : "bg-[rgba(40,53,74,0.08)] text-clause-accent"
                          }`}
                        >
                          {TEAM_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Monthly cost */}
                      <div className="font-mono text-[11px]">
                        {formatCost(system.monthly_cost_estimate)}
                      </div>

                      {/* Compliance */}
                      <div className="flex flex-wrap gap-1">
                        {system.compliance_flags.length > 0 ? (
                          system.compliance_flags.map((flag, fi) => (
                            <span
                              key={fi}
                              className="rounded border border-[rgba(224,107,93,0.2)] bg-[rgba(224,107,93,0.06)] px-1.5 py-0.5 font-mono text-[9px] text-clause-accent3"
                            >
                              {flag.flag_type}
                            </span>
                          ))
                        ) : (
                          <span className="rounded border border-[rgba(76,175,80,0.2)] bg-[rgba(76,175,80,0.06)] px-1.5 py-0.5 font-mono text-[9px] text-clause-accent4">
                            SOC 2 ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-center font-mono text-[11px] text-clause-text3">
                    No systems match this filter.
                  </div>
                )}

                {/* Inline add form */}
                {showAddForm && (
                  <div className="border-t border-clause-border px-4 py-3">
                    <div className="grid grid-cols-[1fr_110px_140px_100px_140px] items-end gap-2">
                      <div>
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-[1px] text-clause-text3">
                          Name
                        </label>
                        <input
                          type="text"
                          value={newSystem.name}
                          onChange={(e) =>
                            setNewSystem((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g. Customer Support Bot"
                          className="field-input w-full text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-[1px] text-clause-text3">
                          Vendor
                        </label>
                        <select
                          value={newSystem.vendor}
                          onChange={(e) =>
                            setNewSystem((prev) => ({
                              ...prev,
                              vendor: e.target.value,
                            }))
                          }
                          className="field-select w-full text-[12px]"
                        >
                          <option>OpenAI</option>
                          <option>Anthropic</option>
                          <option>Google Vertex AI</option>
                          <option>Pinecone</option>
                          <option>LangSmith</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-[1px] text-clause-text3">
                          Team
                        </label>
                        <select
                          value={newSystem.team_owner}
                          onChange={(e) =>
                            setNewSystem((prev) => ({
                              ...prev,
                              team_owner: e.target.value,
                            }))
                          }
                          className="field-select w-full text-[12px]"
                        >
                          {TEAM_OPTIONS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-[1px] text-clause-text3">
                          Type
                        </label>
                        <select
                          value={newSystem.system_type}
                          onChange={(e) =>
                            setNewSystem((prev) => ({
                              ...prev,
                              system_type: e.target.value,
                            }))
                          }
                          className="field-select w-full text-[12px]"
                        >
                          {SYSTEM_TYPE_OPTIONS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleAddSystem}
                          className="rounded-md bg-clause-accent px-3 py-[9px] text-[11px] font-semibold text-white transition-colors hover:bg-[var(--clause-accent-hover)]"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowAddForm(false)}
                          className="rounded-md px-2 py-[9px] text-[11px] text-clause-text3 transition-colors hover:text-clause-text"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add system row */}
                {!showAddForm && (
                  <div className="border-t border-clause-border px-4 py-3">
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="font-mono text-[11px] text-clause-text3 transition-colors hover:text-clause-accent"
                    >
                      + Add a system ClauseAI didn't find
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Page (Suspense wrapper)                                            */
/* ------------------------------------------------------------------ */

export default function SystemsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-clause-text3">
          Loading…
        </div>
      }
    >
      <SystemsPageInner />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  SidebarRow                                                         */
/* ------------------------------------------------------------------ */

function SidebarRow({
  label,
  value,
  highlight,
  isLast,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3.5 py-2.5 ${
        isLast ? "" : "border-b border-clause-border"
      }`}
    >
      <span className="font-mono text-[10px] text-clause-text3">{label}</span>
      <span
        className={`font-mono text-[11px] font-medium ${
          highlight ? "text-clause-accent3" : "text-clause-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
