import { describe, it, expect } from 'vitest';
import {
  USAGE_BASES,
  UsageRightsError,
  assertUsageRights,
  isUsageBasis,
  requiresNote,
  validateUsageDeclaration,
} from './usageRights';

const sound = {
  basis: 'own_work' as const,
  declaredBy: 'uid-123',
  declaredAt: '2026-08-25T10:00:00.000Z',
};

describe('validateUsageDeclaration', () => {
  it('accepts a sound declaration', () => {
    expect(validateUsageDeclaration(sound)).toEqual([]);
  });

  it('rejects a missing declaration outright', () => {
    // Distillation sends someone's book to a model and keeps a derived copy.
    // No declaration means no basis for having done it.
    expect(validateUsageDeclaration(undefined).length).toBeGreaterThan(0);
    expect(validateUsageDeclaration(null).length).toBeGreaterThan(0);
    expect(validateUsageDeclaration({}).length).toBeGreaterThan(0);
  });

  it('names which part is missing rather than failing as a whole', () => {
    const problems = validateUsageDeclaration({ basis: 'own_work' });
    expect(problems.map(p => p.field).sort()).toEqual(['declaredAt', 'declaredBy']);
  });

  it('requires the licence to be named when the basis is a licence', () => {
    // "Open licence" without naming one is a hope, not a declaration: CC BY and
    // CC BY-NC-ND permit very different things.
    const problems = validateUsageDeclaration({ ...sound, basis: 'open_licence' });
    expect(problems.map(p => p.field)).toEqual(['note']);

    expect(validateUsageDeclaration({ ...sound, basis: 'open_licence', note: 'CC BY 4.0' })).toEqual([]);
  });

  it('does not demand a note where there is nothing to point at', () => {
    for (const basis of ['own_work', 'public_domain'] as const) {
      expect(requiresNote(basis)).toBe(false);
      expect(validateUsageDeclaration({ ...sound, basis })).toEqual([]);
    }
  });

  it('treats whitespace as absent', () => {
    expect(validateUsageDeclaration({ ...sound, declaredBy: '   ' }).map(p => p.field))
      .toEqual(['declaredBy']);
    expect(validateUsageDeclaration({ ...sound, basis: 'permission', note: '  ' }).map(p => p.field))
      .toEqual(['note']);
  });

  it('rejects a timestamp that is not a date', () => {
    expect(validateUsageDeclaration({ ...sound, declaredAt: 'вчера' }).map(p => p.field))
      .toEqual(['declaredAt']);
  });

  it('rejects a basis outside the known set', () => {
    expect(validateUsageDeclaration({ ...sound, basis: 'because I said so' as never }).map(p => p.field))
      .toEqual(['basis']);
  });
});

describe('isUsageBasis', () => {
  it('accepts every basis the UI can offer', () => {
    for (const basis of USAGE_BASES) expect(isUsageBasis(basis)).toBe(true);
  });

  it('rejects anything else', () => {
    for (const value of ['', 'other', null, undefined, 7, {}]) {
      expect(isUsageBasis(value)).toBe(false);
    }
  });
});

describe('assertUsageRights', () => {
  it('returns the declaration when it stands', () => {
    expect(assertUsageRights(sound)).toEqual(sound);
  });

  it('throws a type a caller cannot mistake for a network failure', () => {
    // A dialog can be bypassed by calling the function underneath it. This is
    // the gate that cannot be, and it must not be retried away as a blip.
    expect(() => assertUsageRights(undefined)).toThrow(UsageRightsError);

    try {
      assertUsageRights({ basis: 'open_licence', declaredBy: 'u', declaredAt: sound.declaredAt });
    } catch (error) {
      expect(error).toBeInstanceOf(UsageRightsError);
      expect((error as UsageRightsError).problems.map(p => p.field)).toEqual(['note']);
    }
  });
});
