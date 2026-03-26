import { describe, test, expect } from 'vitest';
import { inferMetadata } from '../metadataInference.service';

describe('metadataInference — inferMetadata', () => {
  test('infers Platform Eng team for customer support systems', () => {
    const result = inferMetadata({
      name: 'Customer Support AI',
      vendor: 'Anthropic',
      systemType: 'Model API',
    });

    expect(result.team_owner).toBe('Platform Eng');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.compliance_risk).toBe('medium');
  });

  test('infers ML Team for copilot systems', () => {
    const result = inferMetadata({
      name: 'Internal Copilot',
      vendor: 'OpenAI',
      systemType: 'Model API',
    });

    expect(result.team_owner).toBe('ML Team');
  });

  test('infers development environment from name', () => {
    const result = inferMetadata({
      name: 'Dev Testing Pipeline',
      vendor: 'OpenAI',
    });

    expect(result.environment).toBe('development');
  });

  test('falls back to vendor default team when no pattern matches', () => {
    const result = inferMetadata({
      name: 'Claude Sonnet System',
      vendor: 'Anthropic',
    });

    expect(result.team_owner).toBe('ML Team');
    expect(result.confidence).toBe(0.5);
  });

  test('flags high compliance risk for health/medical systems', () => {
    const result = inferMetadata({
      name: 'Patient Diagnosis Helper',
      vendor: 'OpenAI',
      rawModelOrResource: 'gpt-4o',
    });

    expect(result.compliance_risk).toBe('high');
  });
});
