// src/app/onboarding/WelcomeOnboarding.tsx
// or wherever your Screen 1 component lives

'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCompany,
  connectVendor,
  type VendorName,
  type CreateCompanyPayload,
  ApiError,
} from '@/lib/api';

type VendorKey = VendorName;

const VENDORS: { key: VendorKey; label: string; placeholder: string }[] = [
  {
    key: 'openai',
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
  },
  {
    key: 'anthropic',
    label: 'Anthropic API Key',
    placeholder: 'anthropic-key...',
  },
  {
    key: 'google_vertex',
    label: 'Google Vertex AI Key',
    placeholder: 'vertex-ai-key...',
  },
];

interface WelcomeOnboardingFormState extends CreateCompanyPayload {
  vendors: Record<VendorKey, string>;
}

const initialFormState: WelcomeOnboardingFormState = {
  name: '',
  size: '',
  ai_use_case: '',
  monthly_ai_spend_estimate: '',
  compliance_requirement: '',
  vendors: {
    openai: '',
    anthropic: '',
    google_vertex: '',
  },
};

export const WelcomeOnboarding: React.FC = () => {
  const router = useRouter();

  const [form, setForm] = useState<WelcomeOnboardingFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCompanyFieldChange = useCallback(
    (field: keyof CreateCompanyPayload) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { value } = event.target;
        setForm(prev => ({
          ...prev,
          [field]: value,
        }));
      },
    []
  );

  const handleVendorKeyChange = useCallback(
    (vendor: VendorKey) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setForm(prev => ({
          ...prev,
          vendors: {
            ...prev.vendors,
            [vendor]: value,
          },
        }));
      },
    []
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage(null);
      setIsSubmitting(true);

      try {
        const companyPayload: CreateCompanyPayload = {
          name: form.name.trim(),
          size: form.size.trim(),
          ai_use_case: form.ai_use_case.trim(),
          monthly_ai_spend_estimate: form.monthly_ai_spend_estimate.trim(),
          compliance_requirement: form.compliance_requirement.trim(),
        };

        const { id: companyId } = await createCompany(companyPayload);

        const vendorConnectionRequests = Object.entries(form.vendors)
          .filter(([, apiKey]) => apiKey.trim().length > 0)
          .map(([vendorName, apiKey]) =>
            connectVendor({
              company_id: companyId,
              vendor_name: vendorName as VendorName,
              api_key: apiKey.trim(),
            })
          );

        // Only connect vendors that have keys; connects in parallel.
        if (vendorConnectionRequests.length > 0) {
          await Promise.all(vendorConnectionRequests);
        }

        router.push(`/scan?company=${encodeURIComponent(companyId)}`);
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message || 'Unable to complete onboarding. Please try again.');
        } else if (error instanceof Error) {
          setErrorMessage(error.message || 'Unexpected error. Please try again.');
        } else {
          setErrorMessage('Unexpected error. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, router]
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 rounded-xl bg-white p-8 shadow-lg">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome to ClauseAI</h1>
        <p className="text-sm text-gray-500">
          Tell us about your company and connect your AI vendors to get started.
        </p>
      </header>

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {/* Company details */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-gray-700">Company details</h2>

          <div className="space-y-1">
            <label htmlFor="company-name" className="text-sm font-medium text-gray-700">
              Company name
            </label>
            <input
              id="company-name"
              type="text"
              required
              value={form.name}
              onChange={handleCompanyFieldChange('name')}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Acme Corp"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="company-size" className="text-sm font-medium text-gray-700">
                Company size
              </label>
              <input
                id="company-size"
                type="text"
                value={form.size}
                onChange={handleCompanyFieldChange('size')}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 51–200"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="company-spend"
                className="text-sm font-medium text-gray-700"
              >
                Monthly AI spend (estimate)
              </label>
              <input
                id="company-spend"
                type="text"
                value={form.monthly_ai_spend_estimate}
                onChange={handleCompanyFieldChange('monthly_ai_spend_estimate')}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="$5,000"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="ai-use-case" className="text-sm font-medium text-gray-700">
              Primary AI use case
            </label>
            <textarea
              id="ai-use-case"
              rows={3}
              value={form.ai_use_case}
              onChange={handleCompanyFieldChange('ai_use_case')}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Describe how your company uses AI today."
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="compliance-req"
              className="text-sm font-medium text-gray-700"
            >
              Compliance requirements
            </label>
            <input
              id="compliance-req"
              type="text"
              value={form.compliance_requirement}
              onChange={handleCompanyFieldChange('compliance_requirement')}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. SOC 2, HIPAA, GDPR"
            />
          </div>
        </section>

        {/* Vendor connections */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-gray-700">Connect your vendors</h2>
          <p className="text-xs text-gray-500">
            Optional: Only vendors with API keys provided will be connected.
          </p>

          <div className="space-y-3">
            {VENDORS.map(vendor => (
              <div key={vendor.key} className="space-y-1">
                <label
                  htmlFor={`vendor-${vendor.key}`}
                  className="text-sm font-medium text-gray-700"
                >
                  {vendor.label}
                </label>
                <input
                  id={`vendor-${vendor.key}`}
                  type="password"
                  value={form.vendors[vendor.key]}
                  onChange={handleVendorKeyChange(vendor.key)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder={vendor.placeholder}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Error + actions */}
        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Setting things up…' : 'Continue'}
          </button>

          <span className="text-xs text-gray-400">
            You can update these settings later.
          </span>
        </div>
      </form>
    </div>
  );
};