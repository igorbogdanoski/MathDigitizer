import { describe, it, expect } from 'vitest';
import { MathTask, CurriculumRef } from '../schema';
import {
  UNCLASSIFIED_LABEL,
  coveredOutcomeCodes,
  groupTasksByCurriculum,
  primaryRef,
} from './grouping';

const ref = (over: Partial<CurriculumRef> = {}): CurriculumRef => ({
  education_track: 'primary',
  grade: '7',
  topic_id: 'mk-7-linearni-ravenki',
  topic_name: 'Линеарни равенки',
  outcome_codes: ['МА.7.5.2'],
  source: 'ai',
  ...over,
});

const task = (over: Partial<MathTask> = {}): MathTask => ({
  title: 'Задача',
  original_text: 'Реши $x+1=2$',
  solution_steps: [],
  type: 'task',
  difficulty: 'easy',
  ...over,
} as MathTask);

describe('primaryRef', () => {
  it('returns null when a task has no refs', () => {
    expect(primaryRef(task())).toBeNull();
    expect(primaryRef(task({ curriculum_refs: [] }))).toBeNull();
  });

  it('picks the most confident ref', () => {
    const chosen = primaryRef(task({
      curriculum_refs: [
        ref({ topic_id: 'low', confidence: 0.2 }),
        ref({ topic_id: 'high', confidence: 0.9 }),
      ],
    }));
    expect(chosen?.topic_id).toBe('high');
  });

  it('falls back to the first ref when none carry confidence', () => {
    expect(primaryRef(task({ curriculum_refs: [ref({ topic_id: 'first' }), ref({ topic_id: 'second' })] }))?.topic_id)
      .toBe('first');
  });
});

describe('groupTasksByCurriculum', () => {
  it('groups by topic_id, not by the free-text topic', () => {
    // Same curriculum topic, three different spellings of the text field
    const groups = groupTasksByCurriculum([
      task({ curriculum_topic: 'Линеарни равенки', curriculum_refs: [ref()] }),
      task({ curriculum_topic: 'линеарни равенки', curriculum_refs: [ref()] }),
      task({ curriculum_topic: 'Равенки (линеарни)', curriculum_refs: [ref()] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].tasks).toHaveLength(3);
    expect(groups[0].label).toBe('Линеарни равенки');
    expect(groups[0].classified).toBe(true);
  });

  it('separates genuinely different curriculum topics', () => {
    const groups = groupTasksByCurriculum([
      task({ curriculum_refs: [ref()] }),
      task({ curriculum_refs: [ref({ topic_id: 'mk-7-proporcii', topic_name: 'Пропорции' })] }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('keeps unclassified tasks, grouped by their text topic', () => {
    const groups = groupTasksByCurriculum([
      task({ curriculum_topic: 'Геометрија' }),
      task({ curriculum_topic: 'геометрија' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].classified).toBe(false);
    expect(groups[0].tasks).toHaveLength(2);
  });

  it('labels tasks with neither refs nor topic', () => {
    const groups = groupTasksByCurriculum([task()]);
    expect(groups[0].label).toBe(UNCLASSIFIED_LABEL);
  });

  it('puts classified groups before unclassified ones', () => {
    const groups = groupTasksByCurriculum([
      task({ curriculum_topic: 'Ааа непознато' }),
      task({ curriculum_refs: [ref({ topic_name: 'Ѕвезди' })] }),
    ]);
    expect(groups[0].classified).toBe(true);
  });

  it('collects and dedupes the outcome codes of a group', () => {
    const groups = groupTasksByCurriculum([
      task({ curriculum_refs: [ref({ outcome_codes: ['МА.7.5.2', 'МА.7.5.1'] })] }),
      task({ curriculum_refs: [ref({ outcome_codes: ['МА.7.5.2'] })] }),
    ]);
    expect(groups[0].outcomeCodes).toEqual(['МА.7.5.1', 'МА.7.5.2']);
  });

  it('returns nothing for no tasks', () => {
    expect(groupTasksByCurriculum([])).toEqual([]);
  });
});

describe('coveredOutcomeCodes', () => {
  it('returns every distinct code, sorted', () => {
    expect(coveredOutcomeCodes([
      task({ curriculum_refs: [ref({ outcome_codes: ['МА.7.5.2'] })] }),
      task({ curriculum_refs: [ref({ outcome_codes: ['МА.7.5.1', 'МА.7.5.2'] })] }),
      task(),
    ])).toEqual(['МА.7.5.1', 'МА.7.5.2']);
  });

  it('is empty when nothing is classified', () => {
    expect(coveredOutcomeCodes([task(), task()])).toEqual([]);
  });
});
