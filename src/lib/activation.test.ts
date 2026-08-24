import { describe, it, expect } from 'vitest';
import {
  ACTIVATION_ORDER,
  ActivationMilestone,
  MilestoneStore,
  hasReached,
  markReached,
  milestoneStep,
  nextMilestone,
  reachedMilestones,
} from './activation';

/** An in-memory stand-in for `localStorage`. */
const memoryStore = (): MilestoneStore & { size(): number } => {
  const map = new Map<string, string>();
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    size: () => map.size,
  };
};

/** A store that refuses everything, as private browsing does. */
const refusingStore = (): MilestoneStore => ({
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
});

describe('markReached', () => {
  it('is true the first time and false afterwards', () => {
    // The return value is what decides whether an event is sent, so a milestone
    // called from eleven save paths still produces one event.
    const store = memoryStore();

    expect(markReached(store, 'first_task')).toBe(true);
    expect(markReached(store, 'first_task')).toBe(false);
    expect(markReached(store, 'first_task')).toBe(false);
  });

  it('keeps milestones apart', () => {
    const store = memoryStore();
    markReached(store, 'first_task');

    expect(hasReached(store, 'first_task')).toBe(true);
    expect(hasReached(store, 'first_export')).toBe(false);
    expect(markReached(store, 'first_export')).toBe(true);
  });

  it('records when it happened, not just that it did', () => {
    const store = memoryStore();
    markReached(store, 'role_chosen');

    const stored = store.getItem('md.activation.role_chosen');
    expect(stored).not.toBeNull();
    expect(Number.isNaN(Date.parse(stored as string))).toBe(false);
  });

  it('namespaces its keys so it cannot collide with other stored state', () => {
    const store = memoryStore();
    markReached(store, 'first_grade');

    expect(store.getItem('md.activation.first_grade')).not.toBeNull();
    expect(store.getItem('first_grade')).toBeNull();
  });
});

describe('when storage is unavailable', () => {
  it('reports the milestone as sent rather than swallowing it', () => {
    // Private browsing throws on both read and write. Sending the event again
    // next time reads as one extra event; not sending it reads as a user who
    // never got there.
    const store = refusingStore();

    expect(markReached(store, 'first_task')).toBe(true);
    expect(markReached(store, 'first_task')).toBe(true);
  });

  it('never throws out into the caller', () => {
    // This sits inside save paths. A analytics helper must not be able to fail
    // a teacher's save.
    const store = refusingStore();

    expect(() => hasReached(store, 'first_export')).not.toThrow();
    expect(() => reachedMilestones(store)).not.toThrow();
    expect(() => nextMilestone(store)).not.toThrow();
  });
});

describe('reading the funnel', () => {
  it('lists what has been reached, in funnel order', () => {
    const store = memoryStore();
    markReached(store, 'first_grade');
    markReached(store, 'role_chosen');

    expect(reachedMilestones(store)).toEqual(['role_chosen', 'first_grade']);
  });

  it('names the first milestone still missing', () => {
    const store = memoryStore();
    expect(nextMilestone(store)).toBe('role_chosen');

    markReached(store, 'role_chosen');
    expect(nextMilestone(store)).toBe('first_task');
  });

  it('skips a milestone reached out of order', () => {
    // A teacher can grade before exporting. Nothing stops them, and the funnel
    // order exists to make a drop-off readable, not to enforce a path.
    const store = memoryStore();
    markReached(store, 'role_chosen');
    markReached(store, 'first_export');

    expect(nextMilestone(store)).toBe('first_task');
  });

  it('is null once every milestone is reached', () => {
    const store = memoryStore();
    for (const milestone of ACTIVATION_ORDER) markReached(store, milestone);

    expect(nextMilestone(store)).toBeNull();
    expect(reachedMilestones(store)).toEqual([...ACTIVATION_ORDER]);
  });
});

describe('milestoneStep', () => {
  it('numbers the funnel from one', () => {
    expect(milestoneStep('role_chosen')).toBe(1);
    expect(milestoneStep('first_grade')).toBe(ACTIVATION_ORDER.length);
  });

  it('gives every milestone a distinct step', () => {
    const steps = ACTIVATION_ORDER.map(milestoneStep);
    expect(new Set(steps).size).toBe(ACTIVATION_ORDER.length);
  });
});

describe('the milestone set', () => {
  it('holds no duplicates', () => {
    expect(new Set(ACTIVATION_ORDER).size).toBe(ACTIVATION_ORDER.length);
  });

  it('starts at signup and ends at the loop that brings a teacher back', () => {
    expect(ACTIVATION_ORDER[0]).toBe<ActivationMilestone>('role_chosen');
    expect(ACTIVATION_ORDER).toContain<ActivationMilestone>('first_export');
  });
});
