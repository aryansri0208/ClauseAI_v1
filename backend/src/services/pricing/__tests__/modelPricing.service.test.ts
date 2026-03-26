import { describe, test, expect } from 'vitest';
import {
  estimateMonthlyCost,
  getModelTier,
  getCompetitiveRanking,
} from '../modelPricing.service';

describe('modelPricing', () => {
  test('estimateMonthlyCost returns correct estimate for known model', () => {
    // claude-sonnet-4 with 5M tokens
    // 70% input = 3.5M × $3/M = $10.50
    // 30% output = 1.5M × $15/M = $22.50
    // Total = $33.00
    const cost = estimateMonthlyCost('claude-sonnet-4-20250514', 5000000);
    expect(cost).toBeCloseTo(33, 0);
  });

  test('estimateMonthlyCost handles date suffix stripping', () => {
    const cost = estimateMonthlyCost('gpt-4o-2024-08-06', 1000000);
    expect(cost).not.toBeNull();

    // gpt-4o: 0.7 × 1M × $2.50/M + 0.3 × 1M × $10/M = $1.75 + $3.00 = $4.75
    expect(cost).toBeCloseTo(4.75, 2);
  });

  test('estimateMonthlyCost returns null for unknown model', () => {
    const cost = estimateMonthlyCost('some-unknown-model-v99', 1000000);
    expect(cost).toBeNull();
  });

  test('getModelTier returns correct tier', () => {
    expect(getModelTier('claude-opus-4')).toBe('flagship');
    expect(getModelTier('gpt-4o-mini')).toBe('fast');
    expect(getModelTier('o3')).toBe('reasoning');
    expect(getModelTier('text-embedding-3-small')).toBe('embedding');
  });

  test('getModelTier resolves versioned model IDs', () => {
    expect(getModelTier('claude-sonnet-4-20250514')).toBe('mid');
    expect(getModelTier('claude-3-5-sonnet-20241022')).toBe('mid');
    expect(getModelTier('o3-mini-2025-01-31')).toBe('reasoning');
  });

  test('getCompetitiveRanking returns sorted by blended cost ascending', () => {
    const ranking = getCompetitiveRanking();
    expect(ranking.length).toBeGreaterThan(10);

    for (let i = 1; i < ranking.length; i++) {
      const prev = 0.7 * ranking[i - 1].inputCost + 0.3 * ranking[i - 1].outputCost;
      const curr = 0.7 * ranking[i].inputCost + 0.3 * ranking[i].outputCost;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});
