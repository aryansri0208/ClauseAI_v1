"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { getCompany } from "@/lib/api";
import { getOnboardingKeysForAnalysis } from "@/app/onboarding/page";
import type { VendorIntelligence } from "@/lib/vendorConnectors";
import { fetchAllVendorAnalytics } from "@/lib/vendorConnectors";

function OrganizeContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company");
  const [company, setCompany] = useState<{
    id: string;
    name: string;
    size?: string | null;
    ai_use_case?: string | null;
    monthly_ai_spend_estimate?: string | null;
    compliance_requirement?: string | null;
  } | null>(null);
  const [analytics, setAnalytics] = useState<VendorIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const companyData = await getCompany(companyId);
        if (!cancelled) setCompany(companyData);
      } catch {
        if (!cancelled) setCompany({ id: companyId, name: "Company" });
      }
      try {
        const { keys } = getOnboardingKeysForAnalysis();
        const list = await fetchAllVendorAnalytics(keys);
        if (!cancelled) setAnalytics(list);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!companyId) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4 bg-clause-bg p-8">
        <p className="text-clause-text2">Missing company id.</p>
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
          <Step done label="Scan" step={2} />
          <StepDiv />
          <Step active label="Confirm" step={3} />
          <StepDiv />
          <Step label="Baseline" step={4} />
          <StepDiv />
          <Step label="Insights" step={5} />
        </div>
      </header>

      <div className="flex-1 p-8 lg:p-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-2xl font-bold tracking-tight text-clause-text">
            Organise
          </h1>
          <p className="mt-1 text-sm text-clause-text2">
            Company and vendor data, classified by constraints and compliance.
          </p>

          {loading && (
            <div className="mt-8 flex justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-clause-border border-t-clause-accent" />
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && company && (
            <div className="mt-8 grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              <div className="rounded-lg border border-clause-border bg-clause-surface p-6 shadow-sm">
                <h2 className="font-display font-semibold text-clause-text">
                  Company
                </h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="text-clause-text3">Name</dt>
                    <dd className="font-medium text-clause-text">
                      {company.name}
                    </dd>
                  </div>
                  {company.size && (
                    <div>
                      <dt className="text-clause-text3">Size</dt>
                      <dd className="text-clause-text2">{company.size}</dd>
                    </div>
                  )}
                  {company.ai_use_case && (
                    <div>
                      <dt className="text-clause-text3">AI use case</dt>
                      <dd className="text-clause-text2">
                        {company.ai_use_case}
                      </dd>
                    </div>
                  )}
                  {company.monthly_ai_spend_estimate && (
                    <div>
                      <dt className="text-clause-text3">Est. monthly spend</dt>
                      <dd className="text-clause-text2">
                        {company.monthly_ai_spend_estimate}
                      </dd>
                    </div>
                  )}
                  {company.compliance_requirement && (
                    <div>
                      <dt className="text-clause-text3">Compliance</dt>
                      <dd className="text-clause-text2">
                        {company.compliance_requirement}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-lg border border-clause-border bg-clause-surface p-6 shadow-sm">
                <h2 className="font-display font-semibold text-clause-text">
                  Vendors ({analytics.length})
                </h2>
                <ul className="mt-4 space-y-2 text-sm text-clause-text2">
                  {analytics.length === 0 && (
                    <li className="text-clause-text3">
                      No vendor analytics available.
                    </li>
                  )}
                  {analytics.map((v) => (
                    <li key={v.vendorName}>
                      {v.vendorName}
                      {v.error && (
                        <span className="ml-2 text-red-600">({v.error})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-clause-border bg-clause-surface p-6 shadow-sm lg:col-span-2">
                <h2 className="font-display font-semibold text-clause-text">
                  Classification by constraints / compliance
                </h2>
                <p className="mt-2 text-sm text-clause-text3">
                  Classification and mapping by compliance requirement will
                  appear here.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-4">
            <Link
              href={`/analysis?company=${encodeURIComponent(companyId)}`}
              className="rounded-lg border border-clause-border bg-clause-surface px-4 py-2 text-sm font-medium text-clause-text2 hover:bg-clause-surface2"
            >
              Back to Analysis
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-clause-accent px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--clause-accent-hover)]"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OrganizePage() {
  return (
    <Suspense
      fallback={
        <div className="relative z-10 flex min-h-screen items-center justify-center bg-clause-bg">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-clause-border border-t-clause-accent" />
        </div>
      }
    >
      <OrganizeContent />
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
        active
          ? "text-clause-text"
          : done
            ? "text-clause-text2"
            : "text-clause-text3"
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
