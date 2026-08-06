import { resolveIngestionPolicyModes, IngestionPolicyOverrides } from './config';
import { getInjectionRuleCatalog, InjectionSeverity } from './injectionScan';
import { buildIngestionPreflightReport, IngestionPreflightReport } from './preflight';

export interface IngestionDiagnosticsReport {
  ok: boolean;
  generatedAt: string;
  policyModes: {
    userInputMode: 'advisory' | 'strict';
    sourceContentMode: 'advisory' | 'strict';
  };
  scanner: {
    totalRules: number;
    bySeverity: Record<InjectionSeverity, number>;
    highSeverityRuleIds: string[];
    rules: Array<{ id: string; severity: InjectionSeverity; message: string }>;
  };
  preflight?: IngestionPreflightReport;
  advisories: string[];
}

interface BuildDiagnosticsOptions {
  includePreflight?: boolean;
  policyOverrides?: IngestionPolicyOverrides;
}

export async function buildIngestionDiagnosticsReport(
  options: BuildDiagnosticsOptions = {}
): Promise<IngestionDiagnosticsReport> {
  const includePreflight = options.includePreflight ?? true;
  const policyModes = resolveIngestionPolicyModes(options.policyOverrides);
  const rules = getInjectionRuleCatalog();

  const bySeverity: Record<InjectionSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const rule of rules) {
    bySeverity[rule.severity] += 1;
  }

  const advisories: string[] = [];
  if (policyModes.userInputMode !== 'strict') {
    advisories.push('User input policy mode is advisory; high-severity instruction payloads will not be blocked.');
  }
  if (policyModes.sourceContentMode === 'strict') {
    advisories.push('Source content policy mode is strict; extraction can block on high-severity source-text findings.');
  }

  const preflight = includePreflight ? await buildIngestionPreflightReport() : undefined;

  return {
    ok: preflight ? preflight.ok : true,
    generatedAt: new Date().toISOString(),
    policyModes,
    scanner: {
      totalRules: rules.length,
      bySeverity,
      highSeverityRuleIds: rules.filter((rule) => rule.severity === 'high').map((rule) => rule.id),
      rules,
    },
    preflight,
    advisories,
  };
}