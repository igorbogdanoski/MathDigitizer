import { describe, it, expect } from 'vitest';
import {
  CardSchedule,
  LEARNING_STEPS_MINUTES,
  RELEARNING_STEPS_MINUTES,
  createSchedule,
  scheduleReview,
  dueCards,
  gradeFromOutcome,
} from './fsrsLite';

const NOW = new Date('2026-08-23T12:00:00.000Z');
const opts = { now: NOW, fuzz: false as const };

/** Minutes between `now` and the scheduled review. */
const minutesUntil = (schedule: CardSchedule) =>
  (Date.parse(schedule.nextReview) - NOW.getTime()) / 60_000;

const graduate = (): CardSchedule => {
  let card = createSchedule();
  card = scheduleReview(card, 'good', opts); // step 0 -> step 1
  card = scheduleReview(card, 'good', opts); // graduates
  return card;
};

describe('learning steps', () => {
  it('shows a brand-new card again within a minute, not tomorrow', () => {
    const card = scheduleReview(createSchedule(), 'good', opts);
    expect(card.phase).toBe('learning');
    expect(minutesUntil(card)).toBeCloseTo(LEARNING_STEPS_MINUTES[1], 5);
  });

  it('walks through every learning step before graduating', () => {
    let card = createSchedule();
    card = scheduleReview(card, 'good', opts);
    expect(card.phase).toBe('learning');

    card = scheduleReview(card, 'good', opts);
    expect(card.phase).toBe('review');
    expect(card.interval).toBe(1);
  });

  it('lets an easy answer skip the remaining steps', () => {
    const card = scheduleReview(createSchedule(), 'easy', opts);
    expect(card.phase).toBe('review');
    expect(card.interval).toBe(4);
  });

  it('sends a failed new card back to the first step', () => {
    let card = scheduleReview(createSchedule(), 'good', opts);
    card = scheduleReview(card, 'again', opts);
    expect(card.phase).toBe('learning');
    expect(card.step).toBe(0);
    expect(minutesUntil(card)).toBeCloseTo(LEARNING_STEPS_MINUTES[0], 5);
  });

  it('does not count a failed new card as a lapse', () => {
    let card = scheduleReview(createSchedule(), 'good', opts);
    card = scheduleReview(card, 'again', opts);
    expect(card.lapses).toBe(0);
  });
});

describe('review phase', () => {
  it('grows the interval by the ease factor on good', () => {
    const graduated = graduate();
    const next = scheduleReview(graduated, 'good', opts);
    expect(next.interval).toBeGreaterThan(graduated.interval);
    expect(next.phase).toBe('review');
  });

  it('grows least on hard and most on easy', () => {
    const graduated = graduate();
    const hard = scheduleReview(graduated, 'hard', opts).interval;
    const good = scheduleReview(graduated, 'good', opts).interval;
    const easy = scheduleReview(graduated, 'easy', opts).interval;
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });

  it('moves the ease factor with the grade and never below 1.3', () => {
    let card = graduate();
    const before = card.easeFactor;
    expect(scheduleReview(card, 'easy', opts).easeFactor).toBeGreaterThan(before);
    expect(scheduleReview(card, 'hard', opts).easeFactor).toBeLessThan(before);

    for (let i = 0; i < 30; i++) card = scheduleReview(card, 'hard', opts);
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('lapses and relearning', () => {
  it('counts a lapse only when a graduated card is forgotten', () => {
    const graduated = graduate();
    const lapsed = scheduleReview(graduated, 'again', opts);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.phase).toBe('relearning');
    expect(minutesUntil(lapsed)).toBeCloseTo(RELEARNING_STEPS_MINUTES[0], 5);
  });

  it('returns a relearned card gently instead of resetting it to zero', () => {
    let card = graduate();
    for (let i = 0; i < 4; i++) card = scheduleReview(card, 'good', opts);
    const matureInterval = card.interval;

    const lapsed = scheduleReview(card, 'again', opts);
    const relearned = scheduleReview(lapsed, 'good', opts);

    expect(relearned.phase).toBe('review');
    expect(relearned.interval).toBeLessThan(matureInterval);
    expect(relearned.interval).toBeGreaterThanOrEqual(1);
  });

  it('accumulates repeated lapses', () => {
    let card = graduate();
    card = scheduleReview(card, 'again', opts);
    card = scheduleReview(card, 'good', opts);
    card = scheduleReview(card, 'again', opts);
    expect(card.lapses).toBe(2);
  });
});

describe('interval fuzz', () => {
  it('jitters day-scale intervals so cards do not clump forever', () => {
    let card = graduate();
    for (let i = 0; i < 3; i++) card = scheduleReview(card, 'good', opts);

    const low = scheduleReview(card, 'good', { now: NOW, random: () => 0 }).interval;
    const high = scheduleReview(card, 'good', { now: NOW, random: () => 1 }).interval;
    expect(low).toBeLessThan(high);
  });

  it('never fuzzes a sub-day learning step', () => {
    const a = scheduleReview(createSchedule(), 'good', { now: NOW, random: () => 0 });
    const b = scheduleReview(createSchedule(), 'good', { now: NOW, random: () => 1 });
    expect(a.nextReview).toBe(b.nextReview);
  });

  it('keeps fuzzed intervals at one day or more', () => {
    let card = graduate();
    card = scheduleReview(card, 'good', { now: NOW, random: () => 0 });
    expect(card.interval).toBeGreaterThanOrEqual(1);
  });
});

describe('dueCards', () => {
  it('returns never-reviewed cards and overdue ones, soonest first', () => {
    const cards = [
      { id: 'later', next_review: '2026-08-24T12:00:00.000Z' },
      { id: 'overdue', next_review: '2026-08-22T12:00:00.000Z' },
      { id: 'new' },
      { id: 'just-due', next_review: '2026-08-23T11:00:00.000Z' },
    ];
    expect(dueCards(cards, NOW).map(c => c.id)).toEqual(['new', 'overdue', 'just-due']);
  });

  it('treats an unparseable due date as due rather than hiding the card', () => {
    expect(dueCards([{ id: 'broken', next_review: 'утре' }], NOW).map(c => c.id)).toEqual(['broken']);
  });
});

describe('gradeFromOutcome', () => {
  it('maps a wrong answer to again', () => {
    expect(gradeFromOutcome(false)).toBe('again');
    expect(gradeFromOutcome(false, 500)).toBe('again');
  });

  it('rewards a fast correct answer and penalises a slow one', () => {
    expect(gradeFromOutcome(true, 2000)).toBe('easy');
    expect(gradeFromOutcome(true, 8000)).toBe('good');
    expect(gradeFromOutcome(true, 30000)).toBe('hard');
  });

  it('defaults to good when no timing was captured', () => {
    expect(gradeFromOutcome(true)).toBe('good');
  });
});
