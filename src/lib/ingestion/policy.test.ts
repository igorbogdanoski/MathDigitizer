import { describe, expect, it } from 'vitest';
import { evaluateInjectionPolicy } from './policy';

describe('evaluateInjectionPolicy', () => {
  it('blocks high severity in strict mode', () => {
    const decision = evaluateInjectionPolicy(
      {
        highestSeverity: 'high',
        findings: [{ id: 'x', severity: 'high', message: 'm', match: 'ignore previous instructions' }],
      },
      'strict',
      'custom instructions'
    );

    expect(decision.blocked).toBe(true);
    expect(decision.reason).toContain('custom instructions');
  });

  it('does not block in advisory mode', () => {
    const decision = evaluateInjectionPolicy(
      {
        highestSeverity: 'high',
        findings: [{ id: 'x', severity: 'high', message: 'm', match: 'ignore previous instructions' }],
      },
      'advisory',
      'transcript'
    );

    expect(decision.blocked).toBe(false);
  });

  it('does not block when no severity is present', () => {
    const decision = evaluateInjectionPolicy({ highestSeverity: null, findings: [] }, 'strict', 'input');
    expect(decision.blocked).toBe(false);
  });
});
