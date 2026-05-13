import { describe, expect, it } from 'vitest';
import {
  buildPedagogyQaPrompt,
  evaluatePedagogyPrompt,
  runPedagogyQaHarness,
  PEDAGOGY_GOLDEN_PROMPTS,
  PEDAGOGY_QA_DIMENSION_THRESHOLDS,
  buildPedagogyQaSummary,
} from './pedagogyQa';

describe('pedagogyQa', () => {
  it('builds pedagogically rich prompts from golden prompts', () => {
    const prompt = buildPedagogyQaPrompt(PEDAGOGY_GOLDEN_PROMPTS[0]);

    expect(prompt).toContain('ПЕДАГОШКИ ПРОТОКОЛ');
    expect(prompt).toContain('Concrete -> Representational -> Abstract');
    expect(prompt).toContain('Socratic');
    expect(prompt).toContain('ВЛЕЗ ОД КОРИСНИК');
    expect(prompt).toContain('ТВРДИ ПРАВИЛА');
  });

  it('evaluates prompt quality with rubric output', () => {
    const result = evaluatePedagogyPrompt(buildPedagogyQaPrompt(PEDAGOGY_GOLDEN_PROMPTS[1]));

    expect(result.maxScore).toBe(50);
    expect(result.totalScore).toBeGreaterThanOrEqual(30);
    expect(result.status).not.toBe('fail');
    expect(result.breakdown.protocol.maxScore).toBe(10);
    expect(result.breakdown.outputContract.maxScore).toBe(10);
  });

  it('runs the golden prompt harness and marks expected tokens', () => {
    const results = runPedagogyQaHarness();

    expect(results).toHaveLength(PEDAGOGY_GOLDEN_PROMPTS.length);
    expect(results.length).toBeGreaterThanOrEqual(6);
    expect(results.every((entry) => entry.hasAllExpectedTokens)).toBe(true);
  });

  it('enforces per-dimension thresholds for pass/warn classification', () => {
    const result = evaluatePedagogyPrompt(buildPedagogyQaPrompt(PEDAGOGY_GOLDEN_PROMPTS[0]));

    const dimensions = Object.keys(PEDAGOGY_QA_DIMENSION_THRESHOLDS) as Array<keyof typeof PEDAGOGY_QA_DIMENSION_THRESHOLDS>;
    for (const dimension of dimensions) {
      expect(result.breakdown[dimension].score).toBeGreaterThanOrEqual(PEDAGOGY_QA_DIMENSION_THRESHOLDS[dimension]);
    }
    expect(['pass', 'warn']).toContain(result.status);
  });

  it('builds summary output with report-ready fields', () => {
    const summary = buildPedagogyQaSummary();

    expect(summary.total).toBe(PEDAGOGY_GOLDEN_PROMPTS.length);
    expect(summary.averageScore).toBeGreaterThan(0);
    expect(summary.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(summary.results).toHaveLength(PEDAGOGY_GOLDEN_PROMPTS.length);
  });
});
