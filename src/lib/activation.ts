/**
 * Whether a teacher ever got something out of the app.
 *
 * Everything measured today is the commercial funnel: `pricing_view`,
 * `receipt_submitted`, `pro_activated`, and the trial banners. That tells us how
 * many people looked at the price and how many paid — and nothing at all about
 * the half that comes first.
 *
 * Which means a low conversion rate is currently unreadable. It could be that
 * teachers never got any value, or that they got it and the price or the payment
 * method is wrong. Those need opposite fixes, and guessing between them is how
 * a product spends months on the wrong one.
 *
 * So: four milestones, each a real moment in this app, each fired the first time
 * it happens. Not usage counts — `extraction_used` already covers volume. These
 * answer "did they get there at all", which is the question the funnel is
 * missing.
 *
 * Deliberately per device, not per account. Storing them on the user profile
 * would mean widening the validation on `users`, which is the most tightly
 * checked document in the system, and doing that for measurement is the wrong
 * trade. A teacher who signs up on a laptop and returns on a tablet may fire a
 * milestone twice; GA4 counts users who ever fired an event, so the funnel still
 * reads correctly, and the cost is a slightly inflated event count rather than a
 * wrong conclusion. If these are ever shown *in* the app — a getting-started
 * checklist — that is the point to move them server-side, not before.
 */

export type ActivationMilestone =
  /** Picked a role and started the trial. Everyone who signs up reaches this. */
  | 'role_chosen'
  /** A task landed in their library — extracted, scanned or written. */
  | 'first_task'
  /**
   * Something left the app as a file they can take to class.
   *
   * This is the one that matters most. A teacher who has exported a worksheet
   * has held the product's output in their hand; one who has not has only
   * looked at a screen.
   */
  | 'first_export'
  /** A student's work was graded — the loop that brings them back. */
  | 'first_grade';

/**
 * The order a teacher normally reaches them.
 *
 * Not enforced — a teacher can grade before exporting, and nothing here stops
 * them. The order is what makes a drop-off readable: if `first_task` is high and
 * `first_export` is low, the work is getting stuck between the two.
 */
export const ACTIVATION_ORDER: readonly ActivationMilestone[] = [
  'role_chosen',
  'first_task',
  'first_export',
  'first_grade',
];

const KEY_PREFIX = 'md.activation.';

/** The slice of `Storage` this needs, so it can be tested without a browser. */
export interface MilestoneStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function hasReached(store: MilestoneStore, milestone: ActivationMilestone): boolean {
  try {
    return store.getItem(`${KEY_PREFIX}${milestone}`) !== null;
  } catch {
    // Private browsing and blocked site data both throw on access. A milestone
    // that cannot be remembered is reported as not reached, which fires the
    // event again rather than losing it.
    return false;
  }
}

/**
 * Records a milestone.
 *
 * Returns true only the first time, which is what the caller uses to decide
 * whether to send the event. Safe to call from anywhere, as often as it likes —
 * that is what lets it sit in eleven different save paths without each one
 * needing to know whether it is the first.
 */
export function markReached(store: MilestoneStore, milestone: ActivationMilestone): boolean {
  if (hasReached(store, milestone)) return false;

  try {
    store.setItem(`${KEY_PREFIX}${milestone}`, new Date().toISOString());
  } catch {
    // Storage refused. The event is still worth sending; it will simply be sent
    // again next time, which reads as one extra event rather than a lost user.
  }
  return true;
}

export function reachedMilestones(store: MilestoneStore): ActivationMilestone[] {
  return ACTIVATION_ORDER.filter(milestone => hasReached(store, milestone));
}

/**
 * The first milestone not yet reached, or null when all are.
 *
 * Exported for the getting-started checklist this measurement is meant to
 * inform — once there is data to say what belongs in it.
 */
export function nextMilestone(store: MilestoneStore): ActivationMilestone | null {
  return ACTIVATION_ORDER.find(milestone => !hasReached(store, milestone)) ?? null;
}

/** How far along the funnel a milestone sits, 1-based, for the event payload. */
export function milestoneStep(milestone: ActivationMilestone): number {
  return ACTIVATION_ORDER.indexOf(milestone) + 1;
}
