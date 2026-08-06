import { describe, expect, it } from 'vitest';
import { buildIngestionDiagnosticsReport } from './diagnostics';

describe('buildIngestionDiagnosticsReport', () => {
  it('returns scanner totals and severity breakdown', async () => {
    const report = await buildIngestionDiagnosticsReport({ includePreflight: false });

    expect(typeof report.ok).toBe('boolean');
    expect(typeof report.generatedAt).toBe('string');
    expect(report.scanner.totalRules).toBeGreaterThan(0);

    const counted =
      report.scanner.bySeverity.low + report.scanner.bySeverity.medium + report.scanner.bySeverity.high;
    expect(counted).toBe(report.scanner.totalRules);
    expect(report.preflight).toBeUndefined();
  });

  it('adds advisory when user input mode is not strict', async () => {
    const report = await buildIngestionDiagnosticsReport({
      includePreflight: false,
      policyOverrides: { userInputMode: 'advisory', sourceContentMode: 'advisory' },
    });

    expect(report.advisories.some((message) => message.includes('User input policy mode is advisory'))).toBe(true);
  });

  it('can include preflight diagnostics', async () => {
    const report = await buildIngestionDiagnosticsReport({ includePreflight: true });

    expect(report.preflight).toBeDefined();
    expect(Array.isArray(report.preflight?.dependencyChecks)).toBe(true);
    expect(Array.isArray(report.preflight?.parserPlans)).toBe(true);
  });
});