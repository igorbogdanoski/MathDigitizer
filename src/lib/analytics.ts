declare function gtag(...args: any[]): void;

function g(...args: any[]) {
  if (typeof gtag === 'function') gtag(...args);
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
