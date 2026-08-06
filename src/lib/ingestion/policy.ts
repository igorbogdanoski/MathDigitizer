import { InjectionScanResult } from './injectionScan';

export type IngestionPolicyMode = 'advisory' | 'strict';

export interface IngestionPolicyDecision {
  blocked: boolean;
  reason?: string;
}

export function evaluateInjectionPolicy(
  scan: InjectionScanResult,
  mode: IngestionPolicyMode,
  sourceLabel: string
): IngestionPolicyDecision {
  if (mode === 'advisory' || !scan.highestSeverity) {
    return { blocked: false };
  }

  if (scan.highestSeverity === 'high') {
    return {
      blocked: true,
      reason: `Потенцијално небезбеден влез во ${sourceLabel}. Отстранете инструкциски фрази како "ignore previous instructions" и обидете се повторно.`,
    };
  }

  return { blocked: false };
}
