/**
 * FSRS-lite scheduler for flashcards (EXPERT_LEVEL_MASTER_PLAN, 5.4).
 *
 * Plain SM-2 sends a brand-new card straight to "tomorrow" and, on a lapse,
 * back to a full day — so a card the student just failed is not seen again in
 * the session that failed it. FSRS-lite adds what modern schedulers do:
 *
 *  - learning steps (1 min, 10 min) before a card graduates to day intervals,
 *  - relearning after a lapse instead of a hard reset, with `lapses` tracked,
 *  - interval fuzz, so cards reviewed together do not clump forever on one day.
 *
 * SM-2's ease-factor arithmetic is kept (see srsAlgorithm.ts) so existing cards
 * keep their history; this layer decides *when*, not how easy.
 */

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type CardPhase = 'learning' | 'review' | 'relearning';

export interface CardSchedule {
  phase: CardPhase;
  /** Index into the learning/relearning steps; ignored in the review phase. */
  step: number;
  /** Days until the next review; fractional while in learning steps. */
  interval: number;
  easeFactor: number;
  /** How many times this card has been forgotten after graduating. */
  lapses: number;
  /** ISO timestamp of the next due date. */
  nextReview: string;
}

/** Minutes before a new card graduates to day-scale intervals. */
export const LEARNING_STEPS_MINUTES = [1, 10];
/** Minutes a lapsed card spends in relearning before returning to review. */
export const RELEARNING_STEPS_MINUTES = [10];

const MINUTES_PER_DAY = 1440;
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
/** ±5% jitter, so a big import does not come due all on the same day forever. */
const FUZZ_RATIO = 0.05;

export function createSchedule(): CardSchedule {
  return {
    phase: 'learning',
    step: 0,
    interval: 0,
    easeFactor: DEFAULT_EASE,
    lapses: 0,
    nextReview: new Date().toISOString(),
  };
}

/** Ease adjustment per grade, matching SM-2's response curve. */
function adjustEase(easeFactor: number, grade: ReviewGrade): number {
  const delta = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }[grade];
  return Math.max(MIN_EASE, round2(easeFactor + delta));
}

export interface ScheduleOptions {
  /** Injectable clock and jitter, so the scheduler is fully testable. */
  now?: Date;
  random?: () => number;
  /** Set false to get exact intervals (used by the tests and by previews). */
  fuzz?: boolean;
}

/**
 * Advances a card's schedule for one review.
 *
 * `again` at any point sends the card back into (re)learning so it comes round
 * again within the same session, which is the whole point of learning steps.
 */
export function scheduleReview(
  current: CardSchedule,
  grade: ReviewGrade,
  options: ScheduleOptions = {}
): CardSchedule {
  const now = options.now ?? new Date();
  const easeFactor = adjustEase(current.easeFactor, grade);

  if (grade === 'again') {
    const relearning = current.phase === 'review' || current.phase === 'relearning';
    const minutes = relearning ? RELEARNING_STEPS_MINUTES[0] : LEARNING_STEPS_MINUTES[0];
    return finalize({
      phase: relearning ? 'relearning' : 'learning',
      step: 0,
      interval: minutes / MINUTES_PER_DAY,
      easeFactor,
      // Only a graduated card can lapse; failing a card still being learned is not a lapse.
      lapses: current.phase === 'review' ? current.lapses + 1 : current.lapses,
      nextReview: '',
    }, now, options, false);
  }

  if (current.phase === 'learning' || current.phase === 'relearning') {
    const steps = current.phase === 'learning' ? LEARNING_STEPS_MINUTES : RELEARNING_STEPS_MINUTES;

    // `easy` skips the remaining steps and graduates immediately.
    const nextStep = grade === 'easy' ? steps.length : current.step + 1;

    if (nextStep < steps.length) {
      return finalize({
        phase: current.phase,
        step: nextStep,
        interval: steps[nextStep] / MINUTES_PER_DAY,
        easeFactor,
        lapses: current.lapses,
        nextReview: '',
      }, now, options, false);
    }

    // Graduating: a lapsed card comes back gently, a new one starts at 1 day.
    const graduatedInterval = current.phase === 'relearning'
      ? Math.max(1, round2(current.interval * 0.5))
      : (grade === 'easy' ? 4 : 1);

    return finalize({
      phase: 'review',
      step: 0,
      interval: graduatedInterval,
      easeFactor,
      lapses: current.lapses,
      nextReview: '',
    }, now, options, true);
  }

  // Review phase: grow the interval by the ease factor, modulated by the grade.
  const multiplier = { hard: 1.2, good: easeFactor, easy: easeFactor * 1.3 }[grade];
  const interval = Math.max(1, round2(Math.max(1, current.interval) * multiplier));

  return finalize({
    phase: 'review',
    step: 0,
    interval,
    easeFactor,
    lapses: current.lapses,
    nextReview: '',
  }, now, options, true);
}

/**
 * Applies fuzz (day-scale intervals only) and stamps the due date.
 * Sub-day learning steps are never fuzzed — a "1 minute" step must mean it.
 */
function finalize(
  schedule: Omit<CardSchedule, 'nextReview'> & { nextReview: string },
  now: Date,
  options: ScheduleOptions,
  allowFuzz: boolean
): CardSchedule {
  let interval = schedule.interval;

  if (allowFuzz && options.fuzz !== false && interval >= 2) {
    const random = options.random ?? Math.random;
    const jitter = (random() * 2 - 1) * FUZZ_RATIO;
    interval = Math.max(1, round2(interval * (1 + jitter)));
  }

  const nextReview = new Date(now.getTime() + interval * MINUTES_PER_DAY * 60_000).toISOString();
  return { ...schedule, interval, nextReview };
}

/** Cards whose due date has arrived, soonest first. */
export function dueCards<T extends { next_review?: string }>(cards: readonly T[], now: Date = new Date()): T[] {
  const nowMs = now.getTime();
  return cards
    .filter(card => {
      if (!card.next_review) return true; // never reviewed
      const due = Date.parse(card.next_review);
      return Number.isNaN(due) || due <= nowMs;
    })
    .sort((a, b) => (Date.parse(a.next_review ?? '') || 0) - (Date.parse(b.next_review ?? '') || 0));
}

/**
 * Maps a quiz or match-game outcome onto a review grade, so those modes feed
 * the same scheduler instead of being throwaway practice.
 */
export function gradeFromOutcome(correct: boolean, elapsedMs?: number): ReviewGrade {
  if (!correct) return 'again';
  if (elapsedMs === undefined) return 'good';
  if (elapsedMs <= 4000) return 'easy';
  if (elapsedMs <= 12000) return 'good';
  return 'hard';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
