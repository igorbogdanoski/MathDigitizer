import { describe, it, expect } from 'vitest';
import {
  ALL_MK_CURRICULUM,
  buildCurriculumChunkText,
  searchCurriculumKeyword,
} from './curriculumData';
import { resolveGradeToken } from './curriculumGrade';

/**
 * Retrieval feeds the generators (EXPERT_LEVEL_MASTER_PLAN, 9.4).
 *
 * Whatever comes back is presented to the model as the outcomes a task MUST
 * comply with. Pulling from the wrong programme is therefore not a ranking
 * nuisance — it makes the app assert something untrue about a state curriculum,
 * with nothing on screen to show for it.
 */
describe('searchCurriculumKeyword grade filtering', () => {
  it('returns topics from one programme only when a grade is given', () => {
    const topicsIn = (token: string) =>
      new Set(ALL_MK_CURRICULUM.find(g => g.grade === token)!.topics.map(t => t.id));

    const grade7 = topicsIn('7');
    const results = searchCurriculumKeyword('броеви', '7');

    expect(results.length).toBeGreaterThan(0);
    expect(results.filter(t => !grade7.has(t.id)).map(t => t.id)).toEqual([]);
  });

  it('searches every programme when no grade is given', () => {
    // The unfiltered behaviour has to stay available: an unresolvable hint must
    // widen retrieval, not empty it.
    const filtered = searchCurriculumKeyword('броеви', '7');
    const unfiltered = searchCurriculumKeyword('броеви');

    const gradesHit = new Set(
      unfiltered.map(topic =>
        ALL_MK_CURRICULUM.find(g => g.topics.some(t => t.id === topic.id))!.grade
      )
    );

    expect(gradesHit.size).toBeGreaterThan(1);
    expect(unfiltered.length).toBeGreaterThanOrEqual(filtered.length);
  });

  it('does not let the grade act as a search term', () => {
    // The old call folded the grade into the query, so a hint of `7` scored
    // every topic that merely mentioned a 7 — in an outcome, an example, a
    // measurement — and still searched all 31 programmes.
    const asFilter = searchCurriculumKeyword('дропки', '5');
    const asQueryTerm = searchCurriculumKeyword('дропки 5');

    const gradeOf = (id: string) =>
      ALL_MK_CURRICULUM.find(g => g.topics.some(t => t.id === id))!.grade;

    expect(asFilter.every(t => gradeOf(t.id) === '5')).toBe(true);
    expect(asQueryTerm.some(t => gradeOf(t.id) !== '5')).toBe(true);
  });

  it('returns nothing for a programme that does not cover the query', () => {
    // Better empty than borrowed: the caller falls back to unfiltered context
    // rather than being handed another programme's outcomes as if they applied.
    expect(searchCurriculumKeyword('интеграли', '1')).toEqual([]);
  });
});

describe('buildCurriculumChunkText', () => {
  const withStandards = ALL_MK_CURRICULUM
    .flatMap(grade => grade.topics.map(topic => ({ grade, topic })))
    .find(({ topic }) => topic.assessment_standards?.length);

  it('carries the assessment standards when the programme has them', () => {
    // Imported in 9.2 and read by nothing until now: they shipped to every
    // browser and never reached a prompt.
    expect(withStandards).toBeDefined();
    const text = buildCurriculumChunkText(withStandards!.grade, withStandards!.topic);

    expect(text).toContain('Стандарди за оценување');
    expect(text).toContain(withStandards!.topic.assessment_standards![0]);
  });

  it('carries the prerequisite concepts when the programme has them', () => {
    const withPrereqs = ALL_MK_CURRICULUM
      .flatMap(grade => grade.topics.map(topic => ({ grade, topic })))
      .find(({ topic }) => topic.prerequisite_concept_ids?.length);

    expect(withPrereqs).toBeDefined();
    const text = buildCurriculumChunkText(withPrereqs!.grade, withPrereqs!.topic);

    expect(text).toContain('Претходно знаење');
    expect(text).toContain(withPrereqs!.topic.prerequisite_concept_ids![0]);
  });

  it('omits both sections for a topic that carries neither', () => {
    const plain = ALL_MK_CURRICULUM
      .flatMap(grade => grade.topics.map(topic => ({ grade, topic })))
      .find(({ topic }) => !topic.assessment_standards?.length && !topic.prerequisite_concept_ids?.length);

    expect(plain).toBeDefined();
    const text = buildCurriculumChunkText(plain!.grade, plain!.topic);

    expect(text).not.toContain('Стандарди за оценување');
    expect(text).not.toContain('Претходно знаење');
  });

  it('always names the level, the topic and every outcome code', () => {
    const { grade, topic } = withStandards!;
    const text = buildCurriculumChunkText(grade, topic);

    expect(text).toContain(grade.level_label);
    expect(text).toContain(topic.name);
    for (const outcome of topic.outcomes) expect(text).toContain(outcome.code);
  });
});

describe('the grade a generator asks for is the grade it retrieves from', () => {
  it('resolves every programme label to a token that filters to that programme', () => {
    // The end-to-end property: a teacher's on-screen level label, passed as the
    // grade hint, must not pull another programme's outcomes.
    const failures: string[] = [];

    for (const grade of ALL_MK_CURRICULUM) {
      const token = resolveGradeToken(grade.level_label);
      if (token === null) continue; // deliberately unresolvable, e.g. electives

      const hits = searchCurriculumKeyword(grade.topics[0].name, token);
      const foreign = hits.filter(topic => !grade.topics.some(t => t.id === topic.id));
      if (foreign.length) failures.push(`${grade.level_label} -> ${foreign[0].id}`);
    }

    expect(failures).toEqual([]);
  });
});
