"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  startScan,
  getScanStatus,
  ApiError,
  type ScanLogEntry,
  type ScanStatusResponse,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Vendor visual config (matches onboarding page)                     */
/* ------------------------------------------------------------------ */

interface VendorVisual {
  apiName: string;
  displayName: string;
  logoText: string;
  logoBg: string;
  logoColor: string;
}

const VENDOR_VISUALS: VendorVisual[] = [
  {
    apiName: "Anthropic",
    displayName: "Anthropic",
    logoText: "An",
    logoBg: "rgba(0,229,255,0.1)",
    logoColor: "var(--clause-accent)",
  },
  {
    apiName: "OpenAI",
    displayName: "OpenAI",
    logoText: "OA",
    logoBg: "rgba(123,97,255,0.1)",
    logoColor: "var(--clause-accent2)",
  },
  {
    apiName: "Google Vertex AI",
    displayName: "Google AI / Vertex",
    logoText: "G",
    logoBg: "rgba(255,179,71,0.1)",
    logoColor: "var(--clause-warning)",
  },
  {
    apiName: "Pinecone",
    displayName: "Pinecone",
    logoText: "Pi",
    logoBg: "rgba(0,255,148,0.1)",
    logoColor: "var(--clause-accent4)",
  },
  {
    apiName: "LangSmith",
    displayName: "LangSmith",
    logoText: "Ls",
    logoBg: "rgba(255,107,107,0.1)",
    logoColor: "var(--clause-accent3)",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type VendorScanStatus = "pending" | "scanning" | "done" | "error";

function deriveVendorStatus(
  vendorName: string,
  logs: ScanLogEntry[],
): { status: VendorScanStatus; statusText: string } {
  const vendorLogs = logs.filter(
    (l) => l.vendor?.toLowerCase() === vendorName.toLowerCase(),
  );

  if (vendorLogs.length === 0) {
    return { status: "pending", statusText: "Queued · waiting" };
  }

  const messages = vendorLogs.map((l) => l.message);
  const hasError = messages.some((m) => /error/i.test(m));
  if (hasError) {
    const errorMsg = messages.find((m) => /error/i.test(m)) ?? "Error during scan";
    return { status: "error", statusText: errorMsg };
  }

  const isDone = messages.some((m) => /fetched|found|complete|systems? found/i.test(m));
  if (isDone) {
    const summaryMsg = messages.find((m) => /\d+\s+systems?\s+found/i.test(m));
    const doneMsg = summaryMsg ?? messages.filter((m) => /fetched|found|complete/i.test(m)).pop()!;
    return { status: "done", statusText: doneMsg };
  }

  const lastMsg = messages[messages.length - 1];
  return { status: "scanning", statusText: lastMsg };
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts.slice(11, 19);
  }
}

function logDotColor(message: string): string {
  if (/error/i.test(message)) return "var(--clause-accent3)";
  if (/flag|warn/i.test(message)) return "var(--clause-warning)";
  if (/scanning|reading/i.test(message)) return "var(--clause-accent)";
  return "var(--clause-accent4)";
}

interface InferenceSummary {
  systemsFound: number;
  primaryVendors: string[];
  topCostDriver: string | null;
  teamsMapped: string[];
  complianceNotes: string[];
  vendorStatuses: Array<{ vendor: string; status: "done" | "scanning" | "pending" }>;
}

function extractInferences(logs: ScanLogEntry[], vendorVisuals: VendorVisual[]): InferenceSummary {
  const summary: InferenceSummary = {
    systemsFound: 0,
    primaryVendors: [],
    topCostDriver: null,
    teamsMapped: [],
    complianceNotes: [],
    vendorStatuses: [],
  };

  const vendorSystemCounts = new Map<string, number>();
  const teams = new Set<string>();
  const complianceSet = new Set<string>();
  const costSystems: Array<{ name: string; cost: number }> = [];
  const vendorsWithLogs = new Set<string>();
  const vendorsDone = new Set<string>();

  for (const log of logs) {
    const msg = log.message;
    const vendor = log.vendor;

    if (vendor) {
      vendorsWithLogs.add(vendor);
    }

    const systemMatch = msg.match(/^(\d+)\s+systems?\s+found/i);
    if (systemMatch && vendor) {
      vendorSystemCounts.set(vendor, parseInt(systemMatch[1], 10));
      vendorsDone.add(vendor);
    }

    const teamMatch = msg.match(/^Inferred team:\s+([^·]+)/i);
    if (teamMatch) {
      const team = teamMatch[1].trim();
      if (team !== 'undefined' && team !== 'Unknown') {
        teams.add(team);
      }
    }

    const flagMatch = msg.match(/^Flagged\s+(.+?)\s+·\s+(medium|high)\s+compliance risk/i);
    if (flagMatch) {
      complianceSet.add(`${flagMatch[2]} risk · ${flagMatch[1]}`);
    }

    const costMatch = msg.match(/\$([0-9,.]+[kKmM]?)\/mo/);
    if (costMatch && vendor) {
      let costVal = costMatch[1].replace(/,/g, '');
      let multiplier = 1;
      if (costVal.toLowerCase().endsWith('k')) {
        multiplier = 1000;
        costVal = costVal.slice(0, -1);
      } else if (costVal.toLowerCase().endsWith('m')) {
        multiplier = 1000000;
        costVal = costVal.slice(0, -1);
      }
      const cost = parseFloat(costVal) * multiplier;
      if (!isNaN(cost) && cost > 0) {
        costSystems.push({ name: vendor, cost });
      }
    }
  }

  summary.systemsFound = Array.from(vendorSystemCounts.values()).reduce((s, n) => s + n, 0);
  summary.primaryVendors = Array.from(vendorsDone);
  summary.teamsMapped = Array.from(teams);
  summary.complianceNotes = Array.from(complianceSet);

  if (costSystems.length > 0) {
    costSystems.sort((a, b) => b.cost - a.cost);
    summary.topCostDriver = costSystems[0].name;
  }

  summary.vendorStatuses = vendorVisuals.map((v) => {
    if (vendorsDone.has(v.apiName)) return { vendor: v.displayName, status: "done" as const };
    if (vendorsWithLogs.has(v.apiName)) return { vendor: v.displayName, status: "scanning" as const };
    return { vendor: v.displayName, status: "pending" as const };
  });

  return summary;
}

/* ------------------------------------------------------------------ */
/*  Inner component (needs useSearchParams inside Suspense)            */
/* ------------------------------------------------------------------ */

function ScanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company") ?? "";

  const [jobId, setJobId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const logFeedRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!companyId) {
      setError("Missing company ID in URL.");
      return;
    }

    let cancelled = false;

    async function kick() {
      try {
        const { job_id } = await startScan(companyId);
        if (cancelled) return;
        setJobId(job_id);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to start scan.",
        );
      }
    }

    kick();
    return () => { cancelled = true; };
  }, [companyId]);

  useEffect(() => {
    if (!jobId) return;

    async function poll() {
      try {
        const data = await getScanStatus(jobId!);
        setScanStatus(data);
        if (data.status === "completed" || data.status === "failed") {
          setCompleted(data.status === "completed");
          stopPolling();
        }
      } catch {
        // silently retry on transient failures
      }
    }

    poll();
    pollingRef.current = setInterval(poll, 2000);

    return stopPolling;
  }, [jobId, stopPolling]);

  useEffect(() => {
    if (logFeedRef.current) {
      logFeedRef.current.scrollTop = logFeedRef.current.scrollHeight;
    }
  }, [scanStatus?.logs.length]);

  const isRunning = !completed && !error;
  const logs = scanStatus?.logs ?? [];

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
          {STEPS.map((label, i) => {
            const isDone = i < 1;
            const isActive = i === 1;
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
      </header>

      {/* ===== PAGE BODY (two columns) ===== */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
        {/* ===== LEFT PANEL ===== */}
        <div className="flex flex-col justify-center gap-9 border-clause-border py-[52px] px-[56px] lg:border-r">
          {/* Scan header */}
          <div className="opacity-0 animate-clause-fade-up">
            <div className="mb-3.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[2px] text-clause-accent">
              {isRunning && (
                <span className="inline-block animate-clause-spin text-xs">⟳</span>
              )}
              {isRunning ? "Auto-scan running" : completed ? "Scan complete" : "Scan error"}
            </div>
            <h1 className="font-display text-[32px] font-extrabold leading-[1.15] tracking-[-1px]">
              {isRunning ? (
                <>
                  Discovering your
                  <br />
                  AI infrastructure…
                </>
              ) : completed ? (
                <>
                  Infrastructure
                  <br />
                  discovered
                </>
              ) : (
                "Something went wrong"
              )}
            </h1>
            <p className="mt-2.5 max-w-[420px] text-[14px] font-light leading-[1.6] text-clause-text2">
              {isRunning
                ? "ClauseAI is reading your vendor analytics APIs to map every AI system, model, team, and cost centre — without you lifting a finger. This takes about 60 seconds."
                : error
                  ? error
                  : "Your vendor APIs have been scanned. Review the discovered systems on the next screen."}
            </p>
          </div>

          {/* Vendor scan rows */}
          <div className="flex flex-col gap-2.5 opacity-0 animate-clause-fade-up-delay-1">
            {VENDOR_VISUALS.map((vendor) => {
              const { status, statusText } = deriveVendorStatus(
                vendor.apiName,
                logs,
              );
              return (
                <VendorScanRow
                  key={vendor.apiName}
                  vendor={vendor}
                  status={status}
                  statusText={statusText}
                />
              );
            })}
          </div>

          {/* Counter cards */}
          <div className="grid grid-cols-3 gap-3 opacity-0 animate-clause-fade-up-delay-2">
            <CounterCard
              value={scanStatus?.systems_discovered ?? 0}
              label="Systems found"
              color="var(--clause-accent)"
              animate={isRunning}
            />
            <CounterCard
              value={scanStatus?.spend_estimate ?? "$0"}
              label="Est. spend / mo"
              color="var(--clause-warning)"
              animate={isRunning}
            />
            <CounterCard
              value={scanStatus?.teams_mapped ?? 0}
              label="Teams mapped"
              color="var(--clause-accent4)"
              animate={isRunning}
            />
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="flex flex-col gap-5 py-8 px-7 overflow-y-auto">
          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3 opacity-0 animate-clause-fade-up-delay-1">
            Live scan log
          </div>

          {/* Log feed */}
          <div
            ref={logFeedRef}
            className="flex min-h-0 max-h-[45vh] flex-1 flex-col overflow-y-auto rounded-[10px] border border-clause-border bg-clause-surface opacity-0 animate-clause-fade-up-delay-2"
          >
            {logs.length === 0 && (
              <div className="px-3.5 py-3 font-mono text-[11px] text-clause-text3">
                Waiting for scan to start…
              </div>
            )}
            {logs.map((log, i) => {
              const isNew = i === logs.length - 1 && isRunning;
              return (
                <div
                  key={`${log.timestamp}-${i}`}
                  className={`flex items-start gap-2.5 border-b border-clause-border px-3.5 py-2 font-mono text-[11px] last:border-b-0 ${
                    isNew ? "bg-[rgba(0,229,255,0.03)]" : ""
                  }`}
                >
                  <span className="w-[52px] shrink-0 text-clause-text3">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span
                    className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: logDotColor(log.message) }}
                  />
                  <span className="flex-1 leading-[1.4] text-clause-text2">
                    {log.message}
                    {isNew && isRunning && (
                      <span className="animate-clause-cursor-blink">_</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Inferences summary */}
          <div className="opacity-0 animate-clause-fade-up-delay-2">
            <InferencePanel
              logs={logs}
              vendorVisuals={VENDOR_VISUALS}
              isRunning={isRunning}
            />
          </div>

          {/* Continue button */}
          <div className="opacity-0 animate-clause-fade-up-delay-3">
            <button
              disabled={!completed}
              onClick={() =>
                router.push(
                  `/onboarding/systems?company=${encodeURIComponent(companyId)}`,
                )
              }
              className="w-full rounded-lg bg-clause-accent px-4 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--clause-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue → Confirm systems
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Page (wrapped in Suspense for useSearchParams)                     */
/* ------------------------------------------------------------------ */

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-clause-text3">
          Loading…
        </div>
      }
    >
      <ScanPageInner />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  VendorScanRow                                                      */
/* ------------------------------------------------------------------ */

function VendorScanRow({
  vendor,
  status,
  statusText,
}: {
  vendor: VendorVisual;
  status: VendorScanStatus;
  statusText: string;
}) {
  const badgeClass = {
    done: "border-[rgba(0,255,148,0.2)] bg-[rgba(0,255,148,0.08)] text-clause-accent4",
    scanning:
      "border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.08)] text-clause-accent",
    pending: "border-clause-border bg-clause-surface2 text-clause-text3",
    error: "border-[rgba(224,107,93,0.2)] bg-[rgba(224,107,93,0.08)] text-clause-accent3",
  }[status];

  const statusTextClass = {
    done: "text-clause-accent4",
    scanning: "text-clause-accent",
    pending: "text-clause-text3",
    error: "text-clause-accent3",
  }[status];

  const badgeLabel = {
    done: "Done ✓",
    scanning: "Scanning…",
    pending: "Pending",
    error: "Error",
  }[status];

  return (
    <div className="relative flex items-center gap-3.5 overflow-hidden rounded-[9px] border border-clause-border bg-clause-surface px-4 py-3.5">
      {/* Progress bar at bottom */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 rounded-bl ${
          status === "scanning"
            ? "animate-clause-scan-progress bg-clause-accent"
            : status === "done"
              ? "w-full bg-clause-accent4"
              : status === "error"
                ? "w-full bg-clause-accent3"
                : "w-0"
        }`}
      />

      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold"
        style={{ background: vendor.logoBg, color: vendor.logoColor }}
      >
        {vendor.logoText}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{vendor.displayName}</div>
        <div className={`mt-0.5 font-mono text-[10px] ${statusTextClass}`}>
          {statusText}
          {status === "scanning" && (
            <span className="animate-clause-cursor-blink">_</span>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] ${badgeClass}`}
      >
        {badgeLabel}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CounterCard                                                        */
/* ------------------------------------------------------------------ */

function CounterCard({
  value,
  label,
  color,
  animate,
}: {
  value: number | string;
  label: string;
  color: string;
  animate: boolean;
}) {
  return (
    <div className="rounded-lg border border-clause-border bg-clause-surface px-3.5 py-3.5">
      <div
        className={`font-display text-[28px] font-extrabold tracking-[-1px] ${
          animate ? "animate-clause-count-blink" : ""
        }`}
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[1px] text-clause-text3">
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  InferencePanel                                                     */
/* ------------------------------------------------------------------ */

function InferencePanel({
  logs,
  vendorVisuals,
  isRunning,
}: {
  logs: ScanLogEntry[];
  vendorVisuals: VendorVisual[];
  isRunning: boolean;
}) {
  const inferences = extractInferences(logs, vendorVisuals);

  if (logs.length === 0) return null;

  const rows: Array<{ label: string; value: string; highlight?: boolean }> = [];

  if (inferences.systemsFound > 0 || !isRunning) {
    rows.push({
      label: "Systems found",
      value: inferences.systemsFound > 0 ? String(inferences.systemsFound) : "0",
    });
  }

  if (inferences.primaryVendors.length > 0) {
    rows.push({
      label: "Primary vendors",
      value: inferences.primaryVendors.join(", "),
    });
  }

  if (inferences.topCostDriver) {
    rows.push({
      label: "Top cost driver",
      value: inferences.topCostDriver,
    });
  }

  if (inferences.teamsMapped.length > 0) {
    rows.push({
      label: "Teams mapped",
      value: inferences.teamsMapped.join(", "),
    });
  }

  if (inferences.complianceNotes.length > 0) {
    rows.push({
      label: "Compliance",
      value: inferences.complianceNotes.join("; "),
      highlight: true,
    });
  }

  const pendingOrScanning = inferences.vendorStatuses.filter(
    (v) => v.status !== "done",
  );
  for (const vs of pendingOrScanning) {
    rows.push({
      label: vs.vendor,
      value: vs.status === "scanning" ? "scanning..." : "pending...",
    });
  }

  return (
    <div className="rounded-[10px] border border-clause-border bg-clause-surface">
      <div className="border-b border-clause-border px-3.5 py-2.5">
        <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-clause-text3">
          Inferences so far
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[1px] text-clause-text3 opacity-60">
          Auto-detected · review after scan completes
        </div>
      </div>

      <div className="divide-y divide-clause-border">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 px-3.5 py-2.5"
          >
            <span className="shrink-0 font-mono text-[11px] text-clause-text2">
              {row.label}
            </span>
            <span
              className={`text-right font-mono text-[11px] ${
                row.highlight
                  ? "rounded border border-[rgba(255,107,107,0.2)] bg-[rgba(255,107,107,0.06)] px-2 py-0.5 text-clause-accent3"
                  : row.value === "scanning..." || row.value === "pending..."
                    ? "text-clause-text3"
                    : "rounded border border-[rgba(0,229,255,0.15)] bg-[rgba(0,229,255,0.04)] px-2 py-0.5 text-clause-accent"
              }`}
            >
              {row.value}
              {(row.value === "scanning..." || row.value === "pending...") && isRunning && (
                <span className="animate-clause-cursor-blink">_</span>
              )}
            </span>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="px-3.5 py-3 font-mono text-[11px] text-clause-text3">
            Analyzing vendor data…
          </div>
        )}
      </div>
    </div>
  );
}
