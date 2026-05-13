import { describe, it, expect, beforeEach } from 'vitest';
import { clearObservabilityEvents, captureError, getObservabilityEvents, recordRouteView, recordTiming } from './observability';

describe('observability', () => {
  beforeEach(() => {
    clearObservabilityEvents();
  });

  it('captures errors and timing events', () => {
    captureError(new Error('boom'), { name: 'unit-test', path: '/pricing' });
    recordTiming('route-render', 123.4, { path: '/pricing' });
    recordRouteView('/pricing');

    const events = getObservabilityEvents();
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('route');
    expect(events[1].type).toBe('timing');
    expect(events[2].type).toBe('error');
    expect(events[2].message).toContain('boom');
  });
});
