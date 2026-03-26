import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  OPENAI_USAGE_RESPONSE,
  OPENAI_COSTS_RESPONSE,
  OPENAI_PROJECTS_RESPONSE,
} from '../../../__fixtures__/openai.fixtures';

import {
  fetchUsage,
  fetchCostMetrics,
  fetchProjects,
  getNormalizedUsage,
} from '../openai.service';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const CONFIG = { apiKey: 'sk-test-openai-key' };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OpenAI Service', () => {
  describe('fetchUsage', () => {
    test('aggregates tokens per model across buckets', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse(OPENAI_USAGE_RESPONSE),
      );

      const result = await fetchUsage(CONFIG);

      const gpt4o = result.find((r) => r.modelOrResource === 'gpt-4o-2024-08-06');
      // Day 1: 4200000 + 680000 = 4880000, Day 2: 3800000 + 590000 = 4390000
      expect(gpt4o?.usageAmount).toBe(9270000);

      const gpt4oMini = result.find((r) => r.modelOrResource === 'gpt-4o-mini-2024-07-18');
      // Day 1: 12500000 + 1800000 = 14300000, Day 2: 11200000 + 1650000 = 12850000
      expect(gpt4oMini?.usageAmount).toBe(27150000);

      const embedding = result.find((r) => r.modelOrResource === 'text-embedding-3-small');
      expect(embedding?.usageAmount).toBe(25000000);

      const o3mini = result.find((r) => r.modelOrResource === 'o3-mini-2025-01-31');
      expect(o3mini?.usageAmount).toBe(1170000);

      for (const entry of result) {
        expect(entry.unit).toBe('tokens');
      }
    });

    test('handles pagination', async () => {
      const page1 = {
        data: [OPENAI_USAGE_RESPONSE.data[0]],
        next_page: 'cursor_abc',
      };
      const page2 = {
        data: [OPENAI_USAGE_RESPONSE.data[1]],
        next_page: null,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(mockResponse(page1));
      fetchSpy.mockResolvedValueOnce(mockResponse(page2));

      const result = await fetchUsage(CONFIG);

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      const gpt4o = result.find((r) => r.modelOrResource === 'gpt-4o-2024-08-06');
      expect(gpt4o?.usageAmount).toBe(9270000);
    });
  });

  describe('fetchCostMetrics', () => {
    test('aggregates costs per project', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse(OPENAI_COSTS_RESPONSE),
      );

      const result = await fetchCostMetrics(CONFIG);

      const chatbot = result.find((r) => r.projectId === 'proj_customer_chatbot');
      expect(chatbot?.amount).toBeCloseTo(67.30, 2);

      const tools = result.find((r) => r.projectId === 'proj_internal_tools');
      expect(tools?.amount).toBeCloseTo(23.20, 2);

      const embedding = result.find((r) => r.projectId === 'proj_embedding_pipeline');
      expect(embedding?.amount).toBeCloseTo(2.10, 2);

      for (const entry of result) {
        expect(entry.currency).toBe('USD');
        expect(entry.period).toBe('month');
      }
    });
  });

  describe('fetchProjects', () => {
    test('returns project list', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockResponse(OPENAI_PROJECTS_RESPONSE),
      );

      const result = await fetchProjects(CONFIG);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 'proj_customer_chatbot', name: 'Customer Chatbot' });
      expect(result[1]).toEqual({ id: 'proj_internal_tools', name: 'Internal Copilot Tools' });
      expect(result[2]).toEqual({ id: 'proj_embedding_pipeline', name: 'Embedding Pipeline' });
    });

    test('returns default on 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse({}, 404));

      const result = await fetchProjects(CONFIG);

      expect(result).toEqual([{ id: 'default', name: 'Default Project' }]);
    });
  });

  describe('getNormalizedUsage — full integration', () => {
    test('returns complete NormalizedVendorUsage', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      // fetchProjects
      fetchSpy.mockResolvedValueOnce(mockResponse(OPENAI_PROJECTS_RESPONSE));
      // fetchUsage
      fetchSpy.mockResolvedValueOnce(mockResponse(OPENAI_USAGE_RESPONSE));
      // fetchCostMetrics
      fetchSpy.mockResolvedValueOnce(mockResponse(OPENAI_COSTS_RESPONSE));

      const result = await getNormalizedUsage(CONFIG);

      expect(result.vendor).toBe('OpenAI');
      expect(result.projects).toHaveLength(3);
      expect(result.usage.length).toBeGreaterThanOrEqual(1);
      expect(result.costMetrics.length).toBeGreaterThanOrEqual(1);
    });
  });
});
