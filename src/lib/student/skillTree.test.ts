import { describe, it, expect } from 'vitest';
import {
  MasteryRecord,
  SkillNodeSpec,
  MASTERY_INTERVAL_DAYS,
  MASTERY_QUALITY,
  matchMastery,
  nodeMasteryLevel,
  isNodeCompleted,
  isNodeUnlocked,
  nodeStatus,
  practiceLinkFor,
} from './skillTree';

const nodes: SkillNodeSpec[] = [
  { id: 'basics', requiredXP: 0, dependsOn: [], topicKeywords: ['аритметика', 'основи'] },
  { id: 'algebra', requiredXP: 500, dependsOn: ['basics'], topicKeywords: ['алгебра', 'равенк'] },
  { id: 'calculus', requiredXP: 2000, dependsOn: ['algebra'], topicKeywords: ['извод'] },
];

const node = (id: string) => nodes.find(n => n.id === id)!;

const mastered = (topic: string): MasteryRecord => ({ topic, interval: MASTERY_INTERVAL_DAYS, last_quality: 5 });
const struggling = (topic: string): MasteryRecord => ({ topic, interval: 1, last_quality: 2 });

describe('matchMastery', () => {
  it('matches a topic that contains one of the keywords', () => {
    const records = [mastered('Линеарни равенки'), mastered('Стереометрија')];
    expect(matchMastery(node('algebra'), records).map(r => r.topic)).toEqual(['Линеарни равенки']);
  });

  it('is case-insensitive', () => {
    expect(matchMastery(node('calculus'), [mastered('ИЗВОДИ НА ФУНКЦИИ')])).toHaveLength(1);
  });

  it('returns nothing for an unrelated topic', () => {
    expect(matchMastery(node('calculus'), [mastered('Комбинаторика')])).toEqual([]);
  });

  it('ignores records with an empty topic', () => {
    expect(matchMastery(node('algebra'), [{ topic: '' }])).toEqual([]);
  });
});

describe('nodeMasteryLevel', () => {
  it('is zero without evidence', () => {
    expect(nodeMasteryLevel(node('algebra'), [])).toBe(0);
  });

  it('counts a long recall interval as mastery', () => {
    expect(nodeMasteryLevel(node('algebra'), [{ topic: 'Равенки', interval: MASTERY_INTERVAL_DAYS }])).toBe(1);
  });

  it('counts a high last quality as mastery', () => {
    expect(nodeMasteryLevel(node('algebra'), [{ topic: 'Равенки', last_quality: MASTERY_QUALITY }])).toBe(1);
  });

  it('is the share of matched topics that reach the bar', () => {
    const records = [mastered('Линеарни равенки'), struggling('Квадратни равенки')];
    expect(nodeMasteryLevel(node('algebra'), records)).toBe(0.5);
  });

  it('does not count a struggling topic', () => {
    expect(nodeMasteryLevel(node('algebra'), [struggling('Равенки')])).toBe(0);
  });
});

describe('isNodeUnlocked', () => {
  it('unlocks a root node on XP alone', () => {
    expect(isNodeUnlocked(node('basics'), nodes, [], 0)).toBe(true);
  });

  it('keeps a node locked below its XP bar', () => {
    expect(isNodeUnlocked(node('algebra'), nodes, [mastered('Аритметика')], 100)).toBe(false);
  });

  it('keeps a node locked when the prerequisite is not mastered (regression: XP alone unlocked everything)', () => {
    expect(isNodeUnlocked(node('algebra'), nodes, [struggling('Аритметика')], 5000)).toBe(false);
    expect(isNodeUnlocked(node('calculus'), nodes, [], 99999)).toBe(false);
  });

  it('unlocks once the prerequisite is genuinely mastered', () => {
    expect(isNodeUnlocked(node('algebra'), nodes, [mastered('Основи на аритметика')], 500)).toBe(true);
  });

  it('requires the whole chain, not just the immediate parent', () => {
    const records = [mastered('Аритметика')];
    expect(isNodeUnlocked(node('calculus'), nodes, records, 2000)).toBe(false);

    const full = [mastered('Аритметика'), mastered('Линеарни равенки')];
    expect(isNodeUnlocked(node('calculus'), nodes, full, 2000)).toBe(true);
  });

  it('never unlocks through an unknown prerequisite', () => {
    const orphan: SkillNodeSpec = { id: 'orphan', requiredXP: 0, dependsOn: ['missing'], topicKeywords: ['x'] };
    expect(isNodeUnlocked(orphan, nodes, [], 99999)).toBe(false);
  });
});

describe('nodeStatus', () => {
  it('reports locked, unlocked and completed', () => {
    expect(nodeStatus(node('algebra'), nodes, [], 0)).toBe('locked');
    expect(nodeStatus(node('algebra'), nodes, [mastered('Аритметика')], 500)).toBe('unlocked');
    expect(nodeStatus(node('algebra'), nodes, [mastered('Аритметика'), mastered('Равенки')], 500)).toBe('completed');
  });
});

describe('practiceLinkFor', () => {
  it('links to an adaptive session on a topic the student has actually seen', () => {
    expect(practiceLinkFor(node('algebra'), [mastered('Линеарни равенки')]))
      .toBe('/adaptive-test?topic=' + encodeURIComponent('Линеарни равенки'));
  });

  it('falls back to the node keyword when there is no history', () => {
    expect(practiceLinkFor(node('calculus'))).toBe('/adaptive-test?topic=' + encodeURIComponent('извод'));
  });
});
