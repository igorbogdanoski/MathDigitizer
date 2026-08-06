import { describe, expect, it } from 'vitest';
import { buildIngestionPreflightReport } from './preflight';

describe('buildIngestionPreflightReport', () => {
  it('returns a structured report with parser plans', async () => {
    const report = await buildIngestionPreflightReport();

    expect(typeof report.ok).toBe('boolean');
    expect(typeof report.generatedAt).toBe('string');
    expect(Array.isArray(report.dependencyChecks)).toBe(true);
    expect(Array.isArray(report.parserPlans)).toBe(true);
    expect(report.parserPlans.length).toBeGreaterThanOrEqual(4);
  });
});
