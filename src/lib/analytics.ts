import { ActivationMilestone, markReached, milestoneStep } from './activation';

declare function gtag(...args: any[]): void;

function g(...args: any[]) {
  if (typeof gtag === 'function') gtag(...args);
}

/** Call once after login + profile load. Enables user-scoped reports in GA4. */
export function identifyUser(uid: string, role: 'teacher' | 'student', isPro: boolean) {
  g('set', { user_id: uid });
  g('set', 'user_properties', {
    user_role: role,
    is_pro: isPro ? 'yes' : 'no',
  });
}

/** Call on sign-out to detach the user_id from subsequent hits. */
export function clearUserIdentity() {
  g('set', { user_id: undefined });
  g('set', 'user_properties', { user_role: undefined, is_pro: undefined });
}

export function trackPricingView() {
  g('event', 'pricing_view', { event_category: 'conversion_funnel' });
}

export function trackReceiptSubmitted(plan: string) {
  g('event', 'receipt_submitted', { event_category: 'conversion_funnel', plan });
}

export function trackProActivated(plan: string) {
  g('event', 'pro_activated', { event_category: 'conversion_funnel', plan });
}

export function trackExtraction(source_type: string) {
  g('event', 'extraction_used', { event_category: 'engagement', source_type });
}

export function trackIngestionSecurity(signal: {
  source_type: string;
  severity: 'none' | 'low' | 'medium' | 'high';
  sanitized: 'yes' | 'no';
}) {
  g('event', 'ingestion_security_signal', {
    event_category: 'quality_security',
    source_type: signal.source_type,
    severity: signal.severity,
    sanitized: signal.sanitized,
  });
}

export function trackTrialExpired() {
  g('event', 'trial_expired', { event_category: 'conversion_funnel' });
}

export function trackTrialUrgency(days_left: number) {
  g('event', 'trial_urgency_shown', { event_category: 'conversion_funnel', days_left });
}

/**
 * Records the first time a teacher reaches an activation milestone.
 *
 * Idempotent per device: safe to call from any of the paths that can produce a
 * task, an export or a grade, without each one needing to know whether it is
 * the first. Only the first call sends anything.
 *
 * This is the half of the funnel that was missing. Everything above measures
 * whether someone paid; without these, a low conversion rate cannot be read —
 * it looks the same whether teachers never got value or got it and balked at
 * the price, and those need opposite fixes.
 */
export function trackActivation(milestone: ActivationMilestone): void {
  const store = typeof localStorage !== 'undefined' ? localStorage : null;
  if (!store) return;

  if (!markReached(store, milestone)) return;

  g('event', 'activation_milestone', {
    event_category: 'activation_funnel',
    milestone,
    step: milestoneStep(milestone),
  });
}
