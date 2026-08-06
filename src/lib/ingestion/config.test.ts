import { describe, expect, it } from 'vitest';
import { resolveIngestionPolicyModes, resolveIngestionSnapshotPersistenceEnabled } from './config';

describe('resolveIngestionPolicyModes', () => {
  it('uses explicit overrides when provided', () => {
    const result = resolveIngestionPolicyModes({ userInputMode: 'advisory', sourceContentMode: 'strict' });
    expect(result.userInputMode).toBe('advisory');
    expect(result.sourceContentMode).toBe('strict');
  });

  it('defaults to strict user input and advisory source content', () => {
    const result = resolveIngestionPolicyModes({});
    expect(result.userInputMode).toBe('strict');
    expect(result.sourceContentMode).toBe('advisory');
  });

  it('uses explicit snapshot persistence override', () => {
    expect(resolveIngestionSnapshotPersistenceEnabled(true)).toBe(true);
    expect(resolveIngestionSnapshotPersistenceEnabled(false)).toBe(false);
  });
});
