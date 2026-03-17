"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCompany } from "@/lib/api";
import {
  fetchAllVendorAnalytics,
  type VendorIntelligence,
} from "@/lib/vendorConnectors";
import { getOnboardingKeysForAnalysis } from "@/app/onboarding/page";

function AnalysisContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company");
  const [company, setCompany] = useState<{ id: string; name: string } | null>(
    null
  );
  const [analytics, setAnalytics] = useState<VendorIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setError("Missing company id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      try {
        const companyData = await getCompany(companyId);
        setCompany({ id: companyData.id, name: companyData.name });
      } catch {
        setCompany({ id: companyId, name: "Company" });
      }

      const { keys } = getOnboardingKeysForAnalysis();
      const list = await fetchAllVendorAnalytics(keys);
      setAnalytics(list);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load company or analytics"
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!companyId) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4 bg-clause-bg p-8">
        <p className="text-clause-text2">Missing company id. Start from onboarding.</p>
        <Link
          href="/onboarding"
          className="rounded-lg bg-clause-accent px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--clause-accent-hover)]"
        >
          Go to Onboarding
        </Link>
      </div>
    );
  }

  return (
    <main className="relative z-10 flex min-h-screen flex-col bg-clause-bg">
      <header className="flex h-[52px] items-center border-b border-clause-border bg-clause-surface px-7">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-base font-extrabold tracking-tight text-clause-accent"
        >
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-clause-accent text-[10px] font-bold text-white">
            C/
          </div>
          Clause<span className="text-clause-accent">AI</span>
        </Link>
        <div className="ml-7 flex items-center">
          <Step done label="Connect" step={1} />
          <StepDiv />
          <Step active label="Scan" step={2} />
          <StepDiv />
          <Step label="Confirm" step={3} />
          <StepDiv />
          <Step label="Baseline" step={4} />
          <StepDiv />
          <Step label="Insights" step={5} />
        </div>
      </header>

      <div className="flex-1 p-8 lg:p-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-2xl font-bold tracking-tight text-clause-text">
            Analysis
          </h1>
          <p className="mt-1 text-sm text-clause-text2">
            {company ? `Company: ${company.name}` : `Company ID: ${companyId}`}
          </p>

          {loading && (
            <div className="mt-8 flex flex-col items-center justify-center gap-4 py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-clause-border border-t-clause-accent" />
              <p className="text-sm text-clause-text3">Loading analytics…</p>
            </div>
          )}

          {error && !loading && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mt-8">
                <h2 className="mb-4 font-display text-lg font-semibold text-clause-text">
                  Vendor analytics
                </h2>
                <div className="overflow-hidden rounded-lg border border-clause-border bg-clause-surface">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-clause-border bg-clause-surface2">
                        <th className="px-4 py-3 font-medium text-clause-text">
                          Vendor
                        </th>
                        <th className="px-4 py-3 font-medium text-clause-text">
                          Cost (last month)
                        </th>
                        <th className="px-4 py-3 font-medium text-clause-text">
                          Tokens used
                        </th>
                        <th className="px-4 py-3 font-medium text-clause-text">
                          Models
                        </th>
                        <th className="px-4 py-3 font-medium text-clause-text">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-clause-text3"
                          >
                            No vendor keys were provided during onboarding, or
                            analytics could not be fetched.
                          </td>
                        </tr>
                      )}
                      {analytics.map((row) => (
                        <tr
                          key={row.vendorName}
                          className="border-b border-clause-border2 last:border-0"
                        >
                          <td className="px-4 py-3 font-medium text-clause-text">
                            {row.vendorName}
                          </td>
                          <td className="px-4 py-3 text-clause-text2">
                            {row.costLastMonth != null
                              ? `$${row.costLastMonth.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-clause-text2">
                            {row.tokensUsed != null
                              ? row.tokensUsed.toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-clause-text2">
                            {row.modelsUsed?.length
                              ? row.modelsUsed.join(", ")
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {row.error ? (
                              <span className="text-red-600">{row.error}</span>
                            ) : (
                              <span className="text-clause-accent4">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 rounded-lg border border-clause-border bg-clause-surface p-6">
                <h3 className="font-display font-semibold text-clause-text">
                  Classification (placeholder)
                </h3>
                <p className="mt-2 text-sm text-clause-text3">
                  System and team mapping will appear here.
                </p>
              </div>

              <div className="mt-6 flex gap-4">
                <Link
                  href={`/organize?company=${encodeURIComponent(companyId)}`}
                  className="rounded-lg bg-clause-accent px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--clause-accent-hover)]"
                >
                  Continue to Organize
                </Link>
                <Link
                  href="/onboarding"
                  className="rounded-lg border border-clause-border bg-clause-surface px-4 py-2 text-sm font-medium text-clause-text2 hover:bg-clause-surface2"
                >
                  Back to Onboarding
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="relative z-10 flex min-h-screen items-center justify-center bg-clause-bg">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-clause-border border-t-clause-accent" />
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}

function Step({
  active,
  done,
  label,
  step,
}: {
  active?: boolean;
  done?: boolean;
  label: string;
  step: number;
}) {
  return (
    <div
      className={`flex items-center gap-[7px] px-3 py-0 font-mono text-[11px] ${
        active ? "text-clause-text" : done ? "text-clause-text2" : "text-clause-text3"
      }`}
    >
      <span
        className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border text-[9px] ${
          active
            ? "border-clause-accent bg-clause-accent text-white"
            : done
              ? "border-clause-accent4 bg-clause-accent4 text-white"
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
