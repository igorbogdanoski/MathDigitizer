import { describe, it, expect } from 'vitest';
import { buildCoverageSnapshot, isConfirmedRef, CoverageTaskEntry } from './curriculumCoverage';
import { CURRICULUM_INDEX } from './curriculumIndex';
import { CurriculumRef } from './schema';

/**
 * Coverage is read as a statement about a school (EXPERT_LEVEL_MASTER_PLAN, 9.5).
 *
 * Before this split, an AI suggestion counted exactly as a teacher's
 * confirmation did, so "85% покриеност" could rest entirely on guesses nobody
 * had looked at. That is the shared contract's §3 failure at the scale of a
 * whole programme: the app claiming to know something it does not.
 */
const grade = CURRICULUM_INDEX.find(g => g.grade === '7')!;
const topicA = grade.topics[0];
const topicB = grade.topics[1];

const ref = (topicId: string, over: Partial<CurriculumRef> = {}): CurriculumRef => ({
  education_track: grade.education_track,
  grade: grade.grade,
  topic_id: topicId,
  topic_name: 'тема',
  outcome_codes: [],
  confidence: 0.9,
  source: 'ai',
  ...over,
});

const task = (id: string, refs?: CurriculumRef[]): CoverageTaskEntry => ({
  id,
  title: id,
  curriculum_refs: refs,
});

describe('isConfirmedRef', () => {
  it('counts only a manual mapping as confirmed', () => {
    expect(isConfirmedRef(ref('x', { source: 'manual' }))).toBe(true);
    expect(isConfirmedRef(ref('x', { source: 'ai' }))).toBe(false);
  });

  it('treats a ref with no source as unconfirmed', () => {
    // Refs predate the field. We do not know who wrote them, and the direction
    // that under-claims is the only safe one when the number reads as "covered".
    const legacy = { ...ref('x') } as Partial<CurriculumRef>;
    delete legacy.source;

    expect(isConfirmedRef(legacy as CurriculumRef)).toBe(false);
    expect(isConfirmedRef(undefined)).toBe(false);
  });
});

describe('buildCoverageSnapshot: confirmed versus suggested', () => {
  it('counts a topic as confirmed only when a teacher confirmed a task on it', () => {
    const snapshot = buildCoverageSnapshot([
      task('t1', [ref(topicA.id, { source: 'manual' })]),
      task('t2', [ref(topicB.id, { source: 'ai' })]),
    ]);

    const gc = snapshot.gradeCoverage.find(g => g.grade === '7')!;

    expect(gc.coveredTopics).toBe(2);
    expect(gc.confirmedTopics).toBe(1);
    expect(gc.confirmedPct).toBeLessThan(gc.pct);
  });

  it('splits tasks into confirmed and merely suggested', () => {
    const snapshot = buildCoverageSnapshot([
      task('t1', [ref(topicA.id, { source: 'manual' })]),
      task('t2', [ref(topicA.id, { source: 'ai' })]),
      task('t3', [ref(topicB.id, { source: 'ai' })]),
      task('t4'),
    ]);

    expect(snapshot.mappedTasks).toBe(3);
    expect(snapshot.confirmedTasks).toBe(1);
    expect(snapshot.suggestedTasks).toBe(2);
    expect(snapshot.unmappedTasks).toBe(1);
  });

  it('counts a task as confirmed when any of its refs is', () => {
    const snapshot = buildCoverageSnapshot([
      task('t1', [ref(topicA.id, { source: 'ai' }), ref(topicB.id, { source: 'manual' })]),
    ]);

    expect(snapshot.confirmedTasks).toBe(1);
    expect(snapshot.confirmedTopicCounts.get(topicB.id)).toBe(1);
    // The unconfirmed half of the same task stays unconfirmed.
    expect(snapshot.confirmedTopicCounts.get(topicA.id)).toBe(0);
  });

  it('queues a confident AI mapping for review', () => {
    // The gap this closes: only unmapped and low-confidence tasks were ever
    // shown, so a confident wrong guess counted as coverage and nobody saw it.
    const snapshot = buildCoverageSnapshot([
      task('confident-ai', [ref(topicA.id, { source: 'ai', confidence: 0.95 })]),
      task('confirmed', [ref(topicB.id, { source: 'manual' })]),
    ]);

    expect(snapshot.suggestedList.map(t => t.id)).toEqual(['confident-ai']);
    expect(snapshot.lowConfidenceList).toEqual([]);
  });

  it('does not queue the same task as both low-confidence and suggested', () => {
    const snapshot = buildCoverageSnapshot([
      task('unsure', [ref(topicA.id, { source: 'ai', confidence: 0.2 })]),
    ]);

    expect(snapshot.lowConfidenceList.map(t => t.id)).toEqual(['unsure']);
    expect(snapshot.suggestedList).toEqual([]);
  });

  it('never counts the free-text name fallback as confirmation', () => {
    // Matching `curriculum_topic` against a topic name is a string comparison
    // on text a model wrote. It may show a topic as touched; it can never show
    // it as agreed.
    const snapshot = buildCoverageSnapshot([
      { id: 'byname', title: 'byname', curriculum_topic: topicA.name },
    ]);

    expect(snapshot.topicCounts.get(topicA.id)).toBe(1);
    expect(snapshot.confirmedTopicCounts.get(topicA.id)).toBe(0);
    expect(snapshot.confirmedTasks).toBe(0);
  });

  it('reports zero confirmed coverage when nothing has been reviewed', () => {
    const snapshot = buildCoverageSnapshot([
      task('a', [ref(topicA.id)]),
      task('b', [ref(topicB.id)]),
    ]);

    const gc = snapshot.gradeCoverage.find(g => g.grade === '7')!;
    expect(gc.pct).toBeGreaterThan(0);
    expect(gc.confirmedPct).toBe(0);
  });
});
