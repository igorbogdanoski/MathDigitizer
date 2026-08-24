import { describe, it, expect } from 'vitest';
import { ALL_MK_CURRICULUM, CurriculumGrade, CurriculumTopic } from './curriculumData';

/**
 * Integrity gate for the curriculum corpus
 * (EXPERT_LEVEL_MASTER_PLAN, 9.1).
 *
 * Each of these encodes a defect that was actually present and is now fixed:
 * corrupted characters, outcome codes shared by unrelated outcomes, national
 * standards filed as subject outcomes, and slugified topic ids. The tests exist
 * so the corpus cannot silently regress into any of them again.
 */

const allTopics = (): Array<{ grade: CurriculumGrade; topic: CurriculumTopic }> =>
  ALL_MK_CURRICULUM.flatMap(grade => grade.topics.map(topic => ({ grade, topic })));

const allOutcomes = () =>
  allTopics().flatMap(({ grade, topic }) =>
    topic.outcomes.map(outcome => ({ grade, topic, outcome }))
  );

describe('curriculum text integrity', () => {
  it('contains no replacement characters', () => {
    // 114 Cyrillic letters had been lost to a bad decode; they reached the UI,
    // the RAG context and printed worksheets.
    const damaged: string[] = [];

    for (const { topic, outcome } of allOutcomes()) {
      if (outcome.text.includes('�')) damaged.push(`${outcome.code}: ${outcome.text}`);
      if (topic.name.includes('�')) damaged.push(`topic ${topic.id}`);
    }
    for (const { topic } of allTopics()) {
      for (const task of topic.example_tasks) {
        if (task.includes('�')) damaged.push(`${topic.id} example`);
      }
      for (const keyword of topic.keywords) {
        if (keyword.includes('�')) damaged.push(`${topic.id} keyword`);
      }
    }

    expect(damaged).toEqual([]);
  });

  it('has no empty outcome text', () => {
    const empty = allOutcomes().filter(({ outcome }) => !outcome.text.trim());
    expect(empty.map(e => e.outcome.code)).toEqual([]);
  });
});

describe('outcome codes', () => {
  it('are unique across the whole corpus', () => {
    // Ten unrelated outcomes once shared `АЛ.1год-миг.1.1`, which made the
    // per-code mastery rollup merge things that have nothing to do with each other.
    const seen = new Map<string, string[]>();

    for (const { topic, outcome } of allOutcomes()) {
      const owners = seen.get(outcome.code) ?? [];
      owners.push(topic.id);
      seen.set(outcome.code, owners);
    }

    const duplicated = [...seen.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([code, owners]) => `${code} in ${owners.join(', ')}`);

    expect(duplicated).toEqual([]);
  });

  it('carry the grade they belong to', () => {
    const mismatched = allOutcomes()
      .filter(({ grade, outcome }) => {
        const segments = outcome.code.split('.');
        return segments.length >= 3 && segments[1] !== grade.grade;
      })
      .map(({ grade, outcome }) => `${outcome.code} is filed under grade ${grade.grade}`);

    expect(mismatched).toEqual([]);
  });

  it('never hold a national standard', () => {
    // Contract §7: `III-A.*` are cross-subject standards, not subject outcomes.
    const misfiled = allOutcomes()
      .filter(({ outcome }) => /^[IVX]+-[A-Z]/.test(outcome.code))
      .map(({ outcome }) => outcome.code);

    expect(misfiled).toEqual([]);
  });

  it('spell the subject prefix in Cyrillic', () => {
    // 51 outcomes across the five geometry topics of IV година мат-инф were
    // transcribed with a Latin `GE.` instead of Cyrillic `ГЕ.`. The two render
    // identically, so nothing looked wrong — but a task tagged from those
    // topics carried a code that could never equal the Cyrillic form, which
    // silently excluded it from the mastery rollup and from every cross-app
    // comparison the shared contract exists to make possible.
    const latin = allOutcomes()
      .filter(({ outcome }) => /[A-Za-z]/.test(outcome.code.split('.')[0]))
      .map(({ outcome }) => outcome.code);

    expect(latin).toEqual([]);
  });

  it('are shaped like PREFIX.GRADE.TOPIC[.SUBTOPIC].OUTCOME', () => {
    // Grade 8 numbers an extra subtopic level; both depths are legitimate.
    const malformed = allOutcomes()
      .filter(({ outcome }) => !/^[А-ШA-Z]{2}\.[^.]+\.\d+\.\d+(\.\d+)?$/.test(outcome.code))
      .map(({ outcome }) => outcome.code);

    expect(malformed).toEqual([]);
  });
});

describe('national standards', () => {
  it('are filed in their own field when present', () => {
    const standards = allTopics().flatMap(({ topic }) => topic.national_standards ?? []);
    expect(standards.length).toBeGreaterThan(0);

    const wrongShape = standards.filter(s => !/^[IVX]+-[A-Z]\.\d+$/.test(s.code));
    expect(wrongShape.map(s => s.code)).toEqual([]);
  });
});

describe('topic ids', () => {
  it('are unique', () => {
    const ids = allTopics().map(({ topic }) => topic.id);
    const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect([...new Set(duplicated)]).toEqual([]);
  });

  it('are not slugified into runs of dashes', () => {
    // A Cyrillic grade token was slugified away, leaving `mk-1--------algebra`.
    const broken = allTopics()
      .map(({ topic }) => topic.id)
      .filter(id => /--/.test(id));

    expect(broken).toEqual([]);
  });
});

describe('grade tokens reach the model', () => {
  it('every programme is listed in the extraction prompt', async () => {
    // The model is told which grade tokens are valid. A programme missing from
    // that list can never be assigned, however complete the corpus is — and a
    // token in the list that no programme uses produces refs that resolve to
    // nothing.
    const { CURRICULUM_PROMPT_GRADE_TOKENS } = await import('./ai/extraction');

    const inCorpus = new Set(ALL_MK_CURRICULUM.map(g => g.grade));
    const inPrompt = new Set<string>(CURRICULUM_PROMPT_GRADE_TOKENS);

    const missingFromPrompt = [...inCorpus].filter(g => !inPrompt.has(g));
    const missingFromCorpus = [...inPrompt].filter(g => !inCorpus.has(g));

    expect(missingFromPrompt).toEqual([]);
    expect(missingFromCorpus).toEqual([]);
  });
});

describe('grade coverage', () => {
  it('has a unique key per programme', () => {
    const keys = ALL_MK_CURRICULUM.map(g => g.grade);
    const duplicated = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(duplicated)]).toEqual([]);
  });

  it('gives every grade topics, hours and outcomes', () => {
    for (const grade of ALL_MK_CURRICULUM) {
      expect(grade.topics.length, `${grade.grade} has no topics`).toBeGreaterThan(0);
      expect(grade.hours_per_week, `${grade.grade} has no weekly hours`).toBeGreaterThan(0);

      for (const topic of grade.topics) {
        expect(topic.outcomes.length, `${topic.id} has no outcomes`).toBeGreaterThan(0);
      }
    }
  });
});
