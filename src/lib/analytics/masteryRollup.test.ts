import { describe, it, expect } from 'vitest';
import { CurriculumRef } from '../schema';
import {
  GradedEvidence,
  MIN_EVIDENCE,
  WEAKNESS_THRESHOLD,
  buildMasteryRollup,
  classificationCoverage,
  findWeaknesses,
  rollupForStudent,
} from './masteryRollup';

const ref = (over: Partial<CurriculumRef> = {}): CurriculumRef => ({
  education_track: 'primary',
  grade: '8',
  topic_id: 'mk-8-geometrija',
  topic_name: 'Геометрија',
  outcome_codes: ['МА.8.1.1'],
  source: 'ai',
  ...over,
});

const evidence = (score: number, over: Partial<GradedEvidence> = {}): GradedEvidence => ({
  studentId: 's1',
  score,
  curriculum_refs: [ref()],
  ...over,
});

describe('buildMasteryRollup', () => {
  it('averages a code across attempts and records the worst single score', () => {
    const rollup = buildMasteryRollup([evidence(80), evidence(40), evidence(60)]);

    expect(rollup.codes).toHaveLength(1);
    expect(rollup.codes[0]).toMatchObject({ code: 'МА.8.1.1', attempts: 3, averageScore: 60, worstScore: 40 });
  });

  it('groups codes into curriculum domains', () => {
    const rollup = buildMasteryRollup([
      evidence(30, { curriculum_refs: [ref({ topic_name: 'Геометрија', outcome_codes: ['МА.8.1.1'] })] }),
      evidence(90, { curriculum_refs: [ref({ topic_name: 'Линеарни равенки', outcome_codes: ['МА.8.3.1'] })] }),
    ]);

    expect(rollup.domains.map(d => d.domain)).toEqual(['geometry', 'algebra']);
    expect(rollup.domains[0].averageScore).toBe(30);
  });

  it('orders domains weakest first', () => {
    const rollup = buildMasteryRollup([
      evidence(95, { curriculum_refs: [ref({ topic_name: 'Геометрија', outcome_codes: ['g'] })] }),
      evidence(20, { curriculum_refs: [ref({ topic_name: 'Работа со податоци', outcome_codes: ['d'] })] }),
    ]);
    expect(rollup.domains[0].domain).toBe('data');
  });

  it('weights a domain average by attempts, so one lucky answer cannot lift it', () => {
    const rollup = buildMasteryRollup([
      // Three weak attempts on one code, one strong attempt on another
      evidence(20, { curriculum_refs: [ref({ outcome_codes: ['МА.8.1.1'] })] }),
      evidence(20, { curriculum_refs: [ref({ outcome_codes: ['МА.8.1.1'] })] }),
      evidence(20, { curriculum_refs: [ref({ outcome_codes: ['МА.8.1.1'] })] }),
      evidence(100, { curriculum_refs: [ref({ outcome_codes: ['МА.8.1.2'] })] }),
    ]);

    // Unweighted this would be (20 + 100) / 2 = 60; weighted it is 40
    expect(rollup.domains[0].averageScore).toBe(40);
  });

  it('counts work with no curriculum reference as unclassified rather than guessing', () => {
    const rollup = buildMasteryRollup([
      evidence(80),
      evidence(40, { curriculum_refs: [] }),
      evidence(40, { curriculum_refs: undefined, curriculum_topic: 'Геометрија' }),
    ]);

    expect(rollup.unclassifiedCount).toBe(2);
    expect(rollup.totalEvidence).toBe(3);
    expect(rollup.codes).toHaveLength(1);
  });

  it('handles a submission carrying several codes', () => {
    const rollup = buildMasteryRollup([
      evidence(50, { curriculum_refs: [ref({ outcome_codes: ['МА.8.1.1', 'МА.8.1.2'] })] }),
    ]);
    expect(rollup.codes.map(c => c.code)).toEqual(['МА.8.1.1', 'МА.8.1.2']);
  });

  it('leaves an unclassifiable topic out of the domain view but keeps the code', () => {
    const rollup = buildMasteryRollup([
      evidence(50, { curriculum_refs: [ref({ topic_name: 'Повторување', outcome_codes: ['МА.8.9.1'] })] }),
    ]);

    expect(rollup.codes).toHaveLength(1);
    expect(rollup.codes[0].domain).toBeNull();
    expect(rollup.domains).toHaveLength(0);
  });

  it('ignores entries with an unusable score', () => {
    const rollup = buildMasteryRollup([
      evidence(NaN as unknown as number),
      { score: 'x' as unknown as number },
      evidence(50),
    ]);
    expect(rollup.totalEvidence).toBe(1);
  });

  it('clamps scores into 0–100', () => {
    const rollup = buildMasteryRollup([evidence(150), evidence(-20)]);
    expect(rollup.codes[0].averageScore).toBe(50);
  });

  it('returns an empty rollup for no evidence', () => {
    expect(buildMasteryRollup([])).toEqual({ domains: [], codes: [], unclassifiedCount: 0, totalEvidence: 0 });
  });
});

describe('findWeaknesses', () => {
  const weakGeometry = Array.from({ length: 4 }, () =>
    evidence(35, { curriculum_refs: [ref({ topic_name: 'Геометрија', grade: '8', outcome_codes: ['МА.8.1.1'] })] })
  );

  it('names the weak domain and the prerequisite to revisit', () => {
    const [weakness] = findWeaknesses(buildMasteryRollup(weakGeometry));

    expect(weakness.domain).toBe('geometry');
    expect(weakness.averageScore).toBeLessThan(WEAKNESS_THRESHOLD);
    // The VIII weakness rests on the VII geometry
    expect(weakness.prerequisite?.grade).toBe('VII');
    expect(weakness.prerequisite?.concepts).toContain('триаголници');
  });

  it('ignores a domain with too little evidence to act on', () => {
    const thin = [evidence(20, { curriculum_refs: [ref({ topic_name: 'Геометрија', outcome_codes: ['x'] })] })];
    expect(findWeaknesses(buildMasteryRollup(thin))).toHaveLength(0);
    expect(MIN_EVIDENCE).toBeGreaterThan(1);
  });

  it('says nothing when the student is doing fine', () => {
    const strong = Array.from({ length: 5 }, () => evidence(90));
    expect(findWeaknesses(buildMasteryRollup(strong))).toHaveLength(0);
  });

  it('caps how many weaknesses it reports', () => {
    const many = ['Геометрија', 'Линеарни равенки', 'Работа со податоци', 'Мерење'].flatMap(topic =>
      Array.from({ length: 3 }, () =>
        evidence(30, { curriculum_refs: [ref({ topic_name: topic, outcome_codes: [topic] })] })
      )
    );
    expect(findWeaknesses(buildMasteryRollup(many))).toHaveLength(3);
    expect(findWeaknesses(buildMasteryRollup(many), { limit: 2 })).toHaveLength(2);
  });

  it('has no prerequisite to offer outside the VI–IX progression', () => {
    const secondary = Array.from({ length: 4 }, () =>
      evidence(30, { curriculum_refs: [ref({ topic_name: 'Геометрија', grade: '2год', outcome_codes: ['МА.2год.1.1'] })] })
    );
    expect(findWeaknesses(buildMasteryRollup(secondary))[0].prerequisite).toBeNull();
  });

  it('honours a custom threshold', () => {
    const middling = Array.from({ length: 4 }, () => evidence(70));
    expect(findWeaknesses(buildMasteryRollup(middling))).toHaveLength(0);
    expect(findWeaknesses(buildMasteryRollup(middling), { threshold: 80 })).toHaveLength(1);
  });
});

describe('rollupForStudent', () => {
  it('narrows the evidence to one student', () => {
    const rollup = rollupForStudent([
      evidence(20, { studentId: 'ana' }),
      evidence(100, { studentId: 'bojan' }),
    ], 'ana');

    expect(rollup.totalEvidence).toBe(1);
    expect(rollup.codes[0].averageScore).toBe(20);
  });
});

describe('classificationCoverage', () => {
  it('reports the share of graded work that carries a curriculum reference', () => {
    const rollup = buildMasteryRollup([evidence(50), evidence(50), evidence(50, { curriculum_refs: [] })]);
    expect(classificationCoverage(rollup)).toBeCloseTo(66.7, 1);
  });

  it('is zero with no evidence at all', () => {
    expect(classificationCoverage(buildMasteryRollup([]))).toBe(0);
  });

  it('is 100 when everything is classified', () => {
    expect(classificationCoverage(buildMasteryRollup([evidence(50)]))).toBe(100);
  });
});
