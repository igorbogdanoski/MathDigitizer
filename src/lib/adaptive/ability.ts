/**
 * Ability estimation for the adaptive test (EXPERT_LEVEL_MASTER_PLAN, 5.1).
 *
 * The test used to adapt on the last answer alone: one bad response dropped the
 * student to easy tasks, one good one pushed them to hard. This module keeps a
 * running per-topic estimate with an explicit uncertainty, so difficulty follows
 * the evidence and the session can stop once the estimate has settled instead of
 * always running a fixed number of items.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Ability (0–100) that a task of each difficulty is calibrated to discriminate. */
export const DIFFICULTY_ANCHORS: Record<Difficulty, number> = {
  easy: 30,
  medium: 55,
  hard: 80,
};

export interface AbilityEstimate {
  topic: string;
  /** Running 0–100 estimate of the student's ability on this topic. */
  ability: number;
  /** How many graded answers are folded in. */
  samples: number;
  /** Uncertainty of the estimate; shrinks as evidence accumulates. */
  standardError: number;
  /** Welford accumulator for the running variance — internal bookkeeping. */
  m2: number;
}

/** Uncertainty assigned to an estimate that has seen no evidence yet. */
export const PRIOR_STANDARD_ERROR = 25;
const MIN_STANDARD_ERROR = 2;

export function createAbilityEstimate(topic: string, prior = 50): AbilityEstimate {
  return {
    topic,
    ability: clamp(prior, 0, 100),
    samples: 0,
    standardError: PRIOR_STANDARD_ERROR,
    m2: 0,
  };
}

/**
 * The ability a single graded answer points to.
 *
 * A perfect answer on a hard task is evidence of a higher ability than the same
 * answer on an easy one, so the task's difficulty anchors the observation and
 * the score moves it around that anchor.
 */
export function observedAbility(score: number, difficulty: Difficulty = 'medium'): number {
  const anchor = DIFFICULTY_ANCHORS[difficulty] ?? DIFFICULTY_ANCHORS.medium;
  return clamp(anchor + (clamp(score, 0, 100) - 50) * 0.5, 0, 100);
}

/**
 * Folds one graded answer into the estimate.
 *
 * Early answers move the estimate a lot and later ones progressively less
 * (1/n weighting), which is the running mean — stable, and it cannot be
 * dragged around by a single unlucky item once evidence exists.
 */
export function foldObservation(
  estimate: AbilityEstimate,
  score: number,
  difficulty: Difficulty = 'medium'
): AbilityEstimate {
  const observation = observedAbility(score, difficulty);
  const samples = estimate.samples + 1;

  // Welford's online mean and variance.
  const delta = observation - estimate.ability;
  const ability = estimate.ability + delta / samples;
  const m2 = estimate.m2 + delta * (observation - ability);

  const standardError = samples < 2
    ? PRIOR_STANDARD_ERROR
    : Math.max(MIN_STANDARD_ERROR, Math.sqrt(m2 / (samples - 1)) / Math.sqrt(samples));

  return { topic: estimate.topic, ability: clamp(ability, 0, 100), samples, standardError, m2 };
}

/** Difficulty whose anchor sits closest to the current estimate. */
export function selectNextDifficulty(ability: number): Difficulty {
  const entries = Object.entries(DIFFICULTY_ANCHORS) as Array<[Difficulty, number]>;
  return entries.reduce((best, [level, anchor]) =>
    Math.abs(anchor - ability) < Math.abs(DIFFICULTY_ANCHORS[best] - ability) ? level : best
  , 'medium' as Difficulty);
}

export interface StopDecision {
  stop: boolean;
  reason: 'confident' | 'max-items' | 'continue';
}

export interface StopOptions {
  /** Never stop before this many answers, however confident the estimate looks. */
  minItems?: number;
  /** Hard cap on session length. */
  maxItems?: number;
  /** Stop once every active topic is estimated at least this precisely. */
  targetStandardError?: number;
}

/**
 * Confidence-based stopping rule: end the session once every topic under test
 * is measured precisely enough, rather than after a fixed item count.
 */
export function shouldStopSession(
  estimates: AbilityEstimate[],
  answered: number,
  { minItems = 4, maxItems = 12, targetStandardError = 6 }: StopOptions = {}
): StopDecision {
  if (answered >= maxItems) return { stop: true, reason: 'max-items' };
  if (answered < minItems) return { stop: false, reason: 'continue' };

  const measured = estimates.filter(e => e.samples > 0);
  if (measured.length === 0) return { stop: false, reason: 'continue' };

  const allPrecise = measured.every(e => e.standardError <= targetStandardError);
  return allPrecise ? { stop: true, reason: 'confident' } : { stop: false, reason: 'continue' };
}

/** Topics whose estimate is weakest — what a follow-up session should target. */
export function weakestTopics(estimates: AbilityEstimate[], count = 3): AbilityEstimate[] {
  return [...estimates]
    .filter(e => e.samples > 0)
    .sort((a, b) => a.ability - b.ability)
    .slice(0, count);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
