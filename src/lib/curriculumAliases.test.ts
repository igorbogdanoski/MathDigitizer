import { describe, it, expect } from 'vitest';
import {
  CURRICULUM_CODE_ALIASES,
  AMBIGUOUS_LEGACY_CODES,
  CURRICULUM_PROVENANCE,
  UNVERIFIED_ORIGIN_CODES,
  resolveOutcomeCode,
} from './curriculumAliases';
import { currentOutcomeCodes, isCurrentOutcomeCode } from './curriculumCodes';

/**
 * The alias map exists so that a tag saved before the 9.1 corpus repair still
 * finds its outcome. That only holds if every alias points somewhere real and
 * no alias contradicts a code that is live today — a map that quietly rewrote a
 * valid code would move a teacher's evidence to the wrong outcome, which is
 * worse than the dangling ref it was meant to fix.
 *
 * If these fail, regenerate: npx tsx scripts/build-curriculum-aliases.mts
 */
describe('legacy outcome-code aliases', () => {
  it('point at codes that exist today', () => {
    const live = currentOutcomeCodes();
    const dangling = Object.entries(CURRICULUM_CODE_ALIASES)
      .filter(([, to]) => !live.has(to))
      .map(([from, to]) => `${from} -> ${to}`);

    expect(dangling).toEqual([]);
  });

  it('never shadow a code that is still valid', () => {
    const live = currentOutcomeCodes();
    const shadowed = Object.keys(CURRICULUM_CODE_ALIASES).filter(from => live.has(from));

    expect(shadowed).toEqual([]);
  });

  it('never alias a code that was ambiguous', () => {
    // These stood for several unrelated outcomes at once. Aliasing one would be
    // exactly the guess the shared contract §3 forbids.
    const both = AMBIGUOUS_LEGACY_CODES.filter(code => code in CURRICULUM_CODE_ALIASES);
    expect(both).toEqual([]);
  });

  it('never map a code to itself', () => {
    const identity = Object.entries(CURRICULUM_CODE_ALIASES)
      .filter(([from, to]) => from === to)
      .map(([from]) => from);

    expect(identity).toEqual([]);
  });

  it('covers the codes the repair actually renumbered', () => {
    // A regenerated but empty map would make every test above pass while
    // recovering nothing.
    expect(Object.keys(CURRICULUM_CODE_ALIASES).length).toBeGreaterThan(100);
    expect(AMBIGUOUS_LEGACY_CODES.length).toBeGreaterThan(0);
  });
});

describe('code provenance', () => {
  it('accounts for every outcome in the corpus', () => {
    // The contract (§9) states a number per origin. A bucket that silently
    // stopped matching would leave outcomes uncounted while the table still
    // read as if every code had a known source.
    const total = Object.values(CURRICULUM_PROVENANCE).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(currentOutcomeCodes().size);
  });

  it('names each outcome whose origin could not be verified', () => {
    // "22 unverified" is only an honest statement if the 22 can be pointed at.
    expect(UNVERIFIED_ORIGIN_CODES).toHaveLength(CURRICULUM_PROVENANCE.unverified);

    const live = currentOutcomeCodes();
    const stale = UNVERIFIED_ORIGIN_CODES.filter(o => !live.has(o.code)).map(o => o.code);
    expect(stale).toEqual([]);

    const blank = UNVERIFIED_ORIGIN_CODES.filter(o => !o.text.trim()).map(o => o.code);
    expect(blank).toEqual([]);
  });

  it('reports most of the corpus as traceable to the first import', () => {
    // Guards against a regeneration that quietly reclassified everything as
    // unverified — which would pass the sum check above on its own.
    const traced =
      CURRICULUM_PROVENANCE.identical +
      CURRICULUM_PROVENANCE.repaired +
      CURRICULUM_PROVENANCE.renumbered;

    expect(traced / currentOutcomeCodes().size).toBeGreaterThan(0.85);
  });
});

describe('resolveOutcomeCode', () => {
  const live = [...currentOutcomeCodes()];

  it('passes a live code through untouched', () => {
    const result = resolveOutcomeCode(live[0], isCurrentOutcomeCode);
    expect(result).toEqual({ code: live[0], status: 'current' });
  });

  it('follows an alias to the current code', () => {
    const [from, to] = Object.entries(CURRICULUM_CODE_ALIASES)[0];
    expect(resolveOutcomeCode(from, isCurrentOutcomeCode)).toEqual({ code: to, status: 'renamed' });
  });

  it('reports an ambiguous legacy code without resolving it', () => {
    const code = AMBIGUOUS_LEGACY_CODES[0];
    expect(resolveOutcomeCode(code, isCurrentOutcomeCode)).toEqual({ code, status: 'ambiguous' });
  });

  it('reports an unrecognised code as unknown, unchanged', () => {
    expect(resolveOutcomeCode('МА.99.9.9', isCurrentOutcomeCode))
      .toEqual({ code: 'МА.99.9.9', status: 'unknown' });
  });

  it('treats blank input as unknown rather than throwing', () => {
    expect(resolveOutcomeCode('   ', isCurrentOutcomeCode).status).toBe('unknown');
  });

  it('trims surrounding whitespace before deciding', () => {
    expect(resolveOutcomeCode(`  ${live[0]}  `, isCurrentOutcomeCode))
      .toEqual({ code: live[0], status: 'current' });
  });
});
