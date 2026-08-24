import { describe, it, expect } from 'vitest';
import {
  AbilityEstimate,
  DIFFICULTY_ANCHORS,
  PRIOR_STANDARD_ERROR,
  createAbilityEstimate,
  foldObservation,
  observedAbility,
  selectNextDifficulty,
  shouldStopSession,
  weakestTopics,
} from './ability';

const fold = (scores: Array<[number, 'easy' | 'medium' | 'hard']>, topic = 'Равенки') =>
  scores.reduce(
    (estimate, [score, difficulty]) => foldObservation(estimate, score, difficulty),
    createAbilityEstimate(topic)
  );

describe('observedAbility', () => {
  it('anchors on the task difficulty', () => {
    expect(observedAbility(50, 'easy')).toBe(DIFFICULTY_ANCHORS.easy);
    expect(observedAbility(50, 'hard')).toBe(DIFFICULTY_ANCHORS.hard);
  });

  it('rates the same score higher on a harder task', () => {
    expect(observedAbility(100, 'hard')).toBeGreaterThan(observedAbility(100, 'easy'));
  });

  it('clamps to the 0-100 range', () => {
    expect(observedAbility(-50, 'easy')).toBeGreaterThanOrEqual(0);
    expect(observedAbility(500, 'hard')).toBeLessThanOrEqual(100);
  });

  it('defaults to medium for an unknown difficulty', () => {
    expect(observedAbility(50, 'impossible' as any)).toBe(DIFFICULTY_ANCHORS.medium);
  });
});

describe('foldObservation', () => {
  it('starts uncertain and grows confident with evidence', () => {
    const fresh = createAbilityEstimate('Равенки');
    expect(fresh.standardError).toBe(PRIOR_STANDARD_ERROR);

    const settled = fold([
      [80, 'medium'], [82, 'medium'], [78, 'medium'], [81, 'medium'], [79, 'medium'],
    ]);
    expect(settled.samples).toBe(5);
    expect(settled.standardError).toBeLessThan(PRIOR_STANDARD_ERROR);
  });

  it('is not dragged around by one unlucky answer', () => {
    const consistent = fold([[90, 'medium'], [90, 'medium'], [90, 'medium'], [90, 'medium']]);
    const afterSlip = foldObservation(consistent, 0, 'medium');

    // The estimate moves, but nowhere near the single bad observation
    expect(afterSlip.ability).toBeLessThan(consistent.ability);
    expect(afterSlip.ability).toBeGreaterThan(observedAbility(0, 'medium') + 20);
  });

  it('stays more uncertain when answers are erratic', () => {
    const steady = fold([[70, 'medium'], [72, 'medium'], [68, 'medium'], [71, 'medium']]);
    const erratic = fold([[10, 'medium'], [95, 'medium'], [20, 'medium'], [98, 'medium']]);
    expect(erratic.standardError).toBeGreaterThan(steady.standardError);
  });

  it('keeps the estimate inside 0-100', () => {
    const estimate = fold([[100, 'hard'], [100, 'hard'], [100, 'hard']]);
    expect(estimate.ability).toBeLessThanOrEqual(100);
    expect(fold([[0, 'easy'], [0, 'easy']]).ability).toBeGreaterThanOrEqual(0);
  });

  it('is the running mean of the observations', () => {
    const estimate = fold([[100, 'medium'], [0, 'medium']]);
    const expected = (observedAbility(100, 'medium') + observedAbility(0, 'medium')) / 2;
    expect(estimate.ability).toBeCloseTo(expected, 6);
  });
});

describe('selectNextDifficulty', () => {
  it('matches the difficulty to the estimated ability', () => {
    expect(selectNextDifficulty(20)).toBe('easy');
    expect(selectNextDifficulty(55)).toBe('medium');
    expect(selectNextDifficulty(95)).toBe('hard');
  });
});

describe('shouldStopSession', () => {
  const precise: AbilityEstimate = { topic: 'A', ability: 70, samples: 6, standardError: 3, m2: 0 };
  const vague: AbilityEstimate = { topic: 'B', ability: 50, samples: 3, standardError: 15, m2: 0 };

  it('never stops before the minimum item count', () => {
    expect(shouldStopSession([precise], 2)).toEqual({ stop: false, reason: 'continue' });
  });

  it('stops once every topic is measured precisely enough', () => {
    expect(shouldStopSession([precise], 5)).toEqual({ stop: true, reason: 'confident' });
  });

  it('keeps going while any topic is still vague', () => {
    expect(shouldStopSession([precise, vague], 5)).toEqual({ stop: false, reason: 'continue' });
  });

  it('always stops at the hard cap', () => {
    expect(shouldStopSession([vague], 12)).toEqual({ stop: true, reason: 'max-items' });
  });

  it('keeps going when no topic has any evidence yet', () => {
    expect(shouldStopSession([createAbilityEstimate('A')], 5)).toEqual({ stop: false, reason: 'continue' });
  });

  it('honours custom thresholds', () => {
    expect(shouldStopSession([precise], 5, { targetStandardError: 1 })).toEqual({ stop: false, reason: 'continue' });
    expect(shouldStopSession([vague], 5, { maxItems: 5 })).toEqual({ stop: true, reason: 'max-items' });
  });
});

describe('weakestTopics', () => {
  it('returns the lowest-ability measured topics first', () => {
    const estimates: AbilityEstimate[] = [
      { topic: 'Строг', ability: 80, samples: 3, standardError: 4, m2: 0 },
      { topic: 'Слаб', ability: 30, samples: 3, standardError: 4, m2: 0 },
      { topic: 'Среден', ability: 55, samples: 3, standardError: 4, m2: 0 },
    ];
    expect(weakestTopics(estimates, 2).map(e => e.topic)).toEqual(['Слаб', 'Среден']);
  });

  it('ignores topics with no evidence', () => {
    expect(weakestTopics([createAbilityEstimate('Празен')])).toEqual([]);
  });
});
