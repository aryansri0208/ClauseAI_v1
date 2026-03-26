import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  ANTHROPIC_ADMIN_USAGE_RESPONSE,
  ANTHROPIC_COST_RESPONSE,
  ANTHROPIC_WORKSPACES_RESPONSE,
  ANTHROPIC_MODELS_RESPONSE,
} from '../../../__fixtures__/anthropic.fixtures';

vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  fetchUsage,
  fetchProjects,
  fetchCostMetrics,
  getNormalizedUsage,
} from '../anthropic.service';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const ADMIN_KEY = 'sk-ant-admin-test-key-12345';
const REGULAR_KEY = 'sk-ant-api-test-key-12345';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Anthropic Service', () => {
  describe('fetchUsage — Admin API path', () => {
    test('aggregates tokens per model across multiple buckets', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse(ANTHROPIC_ADMIN_USAGE_RESPONSE),
      );

      const result = await fetchUsage({ apiKey: ADMIN_KEY });

      expect(result).toHaveLength(3);

      const sonnet = result.find((r) => r.modelOrResource === 'claude-sonnet-4-20250514');
      // Day 1: 2850000 + 150000 + 50000 + 0 + 420000 = 3470000
      // Day 2: 3100000 + 200000 + 30000 + 0 + 480000 = 3810000
      expect(sonnet?.usageAmount).toBe(7280000);

      const haiku = result.find((r) => r.modelOrResource === 'claude-haiku-4-5-20251001');
      // Day 1: 8200000 + 800000 + 0 + 0 + 1100000 = 10100000
      // Day 2: 7500000 + 600000 + 0 + 0 + 950000 = 9050000
      expect(haiku?.usageAmount).toBe(19150000);

      const opus = result.find((r) => r.modelOrResource === 'claude-opus-4-20250514');
      // Only day 1: 120000 + 0 + 0 + 0 + 35000 = 155000
      expect(opus?.usageAmount).toBe(155000);

      for (const entry of result) {
        expect(entry.unit).toBe('tokens');
      }
    });

    test('handles pagination (has_more = true)', async () => {
      const page1 = {
        data: [ANTHROPIC_ADMIN_USAGE_RESPONSE.data[0]],
        has_more: true,
        next_page: 'page2',
      };
      const page2 = {
        data: [ANTHROPIC_ADMIN_USAGE_RESPONSE.data[1]],
        has_more: false,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(mockResponse(page1));
      fetchSpy.mockResolvedValueOnce(mockResponse(page2));

      const result = await fetchUsage({ apiKey: ADMIN_KEY });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(3);

      const sonnet = result.find((r) => r.modelOrResource === 'claude-sonnet-4-20250514');
      expect(sonnet?.usageAmount).toBe(7280000);
    });

    test('falls back to models API when admin API returns 403', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(mockResponse({}, 403));
      fetchSpy.mockResolvedValueOnce(mockResponse(ANTHROPIC_MODELS_RESPONSE));

      const result = await fetchUsage({ apiKey: REGULAR_KEY });

      expect(result).toHaveLength(4);
      for (const entry of result) {
        expect(entry.usageAmount).toBeUndefined();
        expect(entry.unit).toBe('tokens');
      }
      expect(result.map((r) => r.modelOrResource)).toContain('claude-sonnet-4-20250514');
      expect(result.map((r) => r.modelOrResource)).toContain('claude-3-5-sonnet-20241022');
    });
  });

  describe('fetchCostMetrics', () => {
    test('aggregates costs per workspace across buckets', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse(ANTHROPIC_COST_RESPONSE),
      );

      const result = await fetchCostMetrics({ apiKey: ADMIN_KEY });

      expect(result).toHaveLength(2);

      const support = result.find((r) => r.projectId === 'wrkspc_support_team');
      expect(support?.amount).toBeCloseTo(80.70, 2);
      expect(support?.currency).toBe('USD');
      expect(support?.period).toBe('month');

      const ml = result.find((r) => r.projectId === 'wrkspc_ml_research');
      expect(ml?.amount).toBeCloseTo(40.85, 2);
    });

    test('returns empty array for non-admin keys', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await fetchCostMetrics({ apiKey: REGULAR_KEY });

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('fetchProjects', () => {
    test('returns workspaces for admin key', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse(ANTHROPIC_WORKSPACES_RESPONSE),
      );

      const result = await fetchProjects({ apiKey: ADMIN_KEY });

      expect(result).toEqual([
        { id: 'wrkspc_support_team', name: 'Customer Support AI' },
        { id: 'wrkspc_ml_research', name: 'ML Research' },
      ]);
    });

    test('returns default workspace on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchProjects({ apiKey: ADMIN_KEY });

      expect(result).toEqual([{ id: 'default', name: 'Default Workspace' }]);
    });
  });

  describe('getNormalizedUsage — full integration', () => {
    test('returns complete NormalizedVendorUsage for admin key', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      // fetchProjects → workspaces
      fetchSpy.mockResolvedValueOnce(mockResponse(ANTHROPIC_WORKSPACES_RESPONSE));
      // fetchUsage → admin usage
      fetchSpy.mockResolvedValueOnce(mockResponse(ANTHROPIC_ADMIN_USAGE_RESPONSE));
      // fetchCostMetrics → cost report
      fetchSpy.mockResolvedValueOnce(mockResponse(ANTHROPIC_COST_RESPONSE));

      const result = await getNormalizedUsage({ apiKey: ADMIN_KEY });

      expect(result.vendor).toBe('Anthropic');
      expect(result.projects).toHaveLength(2);
      expect(result.usage).toHaveLength(3);
      expect(result.costMetrics).toHaveLength(2);

      const totalCost = result.costMetrics.reduce((s, c) => s + c.amount, 0);
      expect(totalCost).toBeCloseTo(121.55, 2);
    });
  });
});
