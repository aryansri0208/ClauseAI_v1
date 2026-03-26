import { describe, test, expect } from 'vitest';
import type { NormalizedVendorUsage } from '../../../types/vendor.types';
import { normalizeToSystems } from '../systemDiscovery.service';

describe('systemDiscovery — normalizeToSystems', () => {
  test('creates one system per model when single project', () => {
    const input: NormalizedVendorUsage = {
      vendor: 'Anthropic',
      projects: [{ id: 'default', name: 'Default Workspace' }],
      usage: [
        { modelOrResource: 'claude-sonnet-4-20250514', usageAmount: 5000000, unit: 'tokens' },
        { modelOrResource: 'claude-haiku-4-5-20251001', usageAmount: 15000000, unit: 'tokens' },
      ],
      costMetrics: [{ projectId: 'default', amount: 45, currency: 'USD', period: 'month' }],
    };

    const systems = normalizeToSystems(input);

    expect(systems).toHaveLength(2);
    expect(systems[0].name).toContain('Sonnet');
    expect(systems[1].name).toContain('Haiku');
    expect(systems[0].systemType).toBe('Model API');
    expect(systems[1].systemType).toBe('Model API');
  });

  test('creates systems per project when multiple projects', () => {
    const input: NormalizedVendorUsage = {
      vendor: 'OpenAI',
      projects: [
        { id: 'proj_chatbot', name: 'Customer Chatbot' },
        { id: 'proj_tools', name: 'Internal Copilot Tools' },
      ],
      usage: [
        { modelOrResource: 'gpt-4o', usageAmount: 9000000, unit: 'tokens', projectId: 'proj_chatbot' },
        { modelOrResource: 'gpt-4o-mini', usageAmount: 20000000, unit: 'tokens', projectId: 'proj_tools' },
      ],
      costMetrics: [
        { projectId: 'proj_chatbot', amount: 67, currency: 'USD', period: 'month' },
        { projectId: 'proj_tools', amount: 23, currency: 'USD', period: 'month' },
      ],
    };

    const systems = normalizeToSystems(input);

    expect(systems).toHaveLength(2);
    expect(systems[0].name).toBe('Customer Chatbot');
    expect(systems[1].name).toBe('Internal Copilot Tools');
    expect(systems[0].monthlyCostEstimate).toBe(67);
    expect(systems[1].monthlyCostEstimate).toBe(23);
  });

  test('classifies embedding models as Pipeline', () => {
    const input: NormalizedVendorUsage = {
      vendor: 'OpenAI',
      projects: [{ id: 'default', name: 'Default Project' }],
      usage: [
        { modelOrResource: 'text-embedding-3-small', usageAmount: 25000000, unit: 'tokens' },
      ],
      costMetrics: [],
    };

    const systems = normalizeToSystems(input);

    expect(systems).toHaveLength(1);
    expect(systems[0].systemType).toBe('Pipeline');
  });

  test('classifies Pinecone as Vector DB', () => {
    const input: NormalizedVendorUsage = {
      vendor: 'Pinecone',
      projects: [{ id: 'default', name: 'Default' }],
      usage: [
        { modelOrResource: 'product-vectors', usageAmount: 500000, unit: 'vectors' },
      ],
      costMetrics: [],
    };

    const systems = normalizeToSystems(input);

    expect(systems).toHaveLength(1);
    expect(systems[0].systemType).toBe('Vector DB');
    expect(systems[0].name).toContain('Vector DB');
    expect(systems[0].name).toContain('product-vectors');
  });
});
