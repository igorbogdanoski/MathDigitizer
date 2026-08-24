import { describe, it, expect } from 'vitest';
import { ALL_MK_CURRICULUM } from './curriculumData';
import { CURRICULUM_INDEX, allIndexedTopics } from './curriculumIndex';

/**
 * Holds the generated index to the corpus it describes.
 *
 * The index exists so screens that only name or count curriculum entries do not
 * pull 571 KB of outcome prose into their bundle. That saving is only safe if
 * the two cannot drift: a stale index would show a teacher topics that no
 * longer exist, or hide ones that do.
 *
 * If these fail, regenerate: npx tsx scripts/build-curriculum-index.mts
 */
describe('curriculum index matches the corpus', () => {
  it('covers exactly the same programmes', () => {
    expect(CURRICULUM_INDEX.map(g => g.grade)).toEqual(ALL_MK_CURRICULUM.map(g => g.grade));
  });

  it('carries the same label, track and weekly hours per programme', () => {
    for (const [i, grade] of ALL_MK_CURRICULUM.entries()) {
      const indexed = CURRICULUM_INDEX[i];
      expect(indexed.level_label, grade.grade).toBe(grade.level_label);
      expect(indexed.education_track, grade.grade).toBe(grade.education_track);
      expect(indexed.hours_per_week, grade.grade).toBe(grade.hours_per_week);
    }
  });

  it('covers exactly the same topics, in the same order', () => {
    for (const [i, grade] of ALL_MK_CURRICULUM.entries()) {
      expect(CURRICULUM_INDEX[i].topics.map(t => t.id), grade.grade)
        .toEqual(grade.topics.map(t => t.id));
    }
  });

  it('carries the same names and hours per topic', () => {
    for (const [i, grade] of ALL_MK_CURRICULUM.entries()) {
      for (const [j, topic] of grade.topics.entries()) {
        const indexed = CURRICULUM_INDEX[i].topics[j];
        expect(indexed.name, topic.id).toBe(topic.name);
        expect(indexed.name_short, topic.id).toBe(topic.name_short);
        expect(indexed.hours, topic.id).toBe(topic.hours);
      }
    }
  });

  it('carries the same keywords per topic', () => {
    // sharedTaskFormat resolves a task's topic by keyword against this index.
    // If the keywords drifted, a saved task would resolve to the wrong topic —
    // or to none at all — while everything still looked correct on screen.
    for (const [i, grade] of ALL_MK_CURRICULUM.entries()) {
      for (const [j, topic] of grade.topics.entries()) {
        expect(CURRICULUM_INDEX[i].topics[j].keywords, topic.id).toEqual(topic.keywords);
      }
    }
  });

  it('carries every outcome code, and the right count', () => {
    for (const [i, grade] of ALL_MK_CURRICULUM.entries()) {
      for (const [j, topic] of grade.topics.entries()) {
        const indexed = CURRICULUM_INDEX[i].topics[j];
        expect(indexed.outcome_codes, topic.id).toEqual(topic.outcomes.map(o => o.code));
        expect(indexed.outcome_count, topic.id).toBe(topic.outcomes.length);
      }
    }
  });

  it('carries no outcome prose — that is the whole point', () => {
    // A regenerated index that started including texts would silently undo the
    // bundle saving it exists for.
    const serialized = JSON.stringify(CURRICULUM_INDEX);
    const anyOutcomeText = ALL_MK_CURRICULUM[0].topics[0].outcomes[0].text;

    expect(serialized).not.toContain(anyOutcomeText);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThan(
      Buffer.byteLength(JSON.stringify(ALL_MK_CURRICULUM), 'utf8') / 2
    );
  });
});

describe('allIndexedTopics', () => {
  it('flattens every topic with its programme', () => {
    const flat = allIndexedTopics();
    const total = ALL_MK_CURRICULUM.reduce((sum, g) => sum + g.topics.length, 0);

    expect(flat).toHaveLength(total);
    expect(flat[0].grade.grade).toBe(ALL_MK_CURRICULUM[0].grade);
  });
});
