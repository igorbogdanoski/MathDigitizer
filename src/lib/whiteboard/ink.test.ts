import { describe, it, expect } from 'vitest';
import {
  InkPoint,
  distance,
  decimatePoints,
  smoothStroke,
  smoothTail,
  pointVelocity,
  resolveStrokeWidth,
  buildStrokeWidths,
  buildWidthRuns,
  toFlatArray,
  fromFlatArray,
  shouldIgnorePointer,
} from './ink';

const p = (x: number, y: number, over: Partial<InkPoint> = {}): InkPoint => ({ x, y, ...over });

describe('decimatePoints', () => {
  it('drops samples closer than the threshold', () => {
    const dense = [p(0, 0), p(0.5, 0), p(1, 0), p(10, 0)];
    expect(decimatePoints(dense, 2)).toEqual([p(0, 0), p(10, 0)]);
  });

  it('always keeps the first and last point', () => {
    const out = decimatePoints([p(0, 0), p(0.1, 0), p(0.2, 0)], 5);
    expect(out[0]).toEqual(p(0, 0));
    expect(out[out.length - 1]).toEqual(p(0.2, 0));
  });

  it('keeps points that are far enough apart', () => {
    const spread = [p(0, 0), p(10, 0), p(20, 0), p(30, 0)];
    expect(decimatePoints(spread, 2)).toHaveLength(4);
  });

  it('passes short strokes through untouched', () => {
    expect(decimatePoints([p(1, 1)], 5)).toEqual([p(1, 1)]);
    expect(decimatePoints([], 5)).toEqual([]);
  });
});

describe('smoothStroke', () => {
  it('keeps the original endpoints', () => {
    const out = smoothStroke([p(0, 0), p(10, 10), p(20, 0)], 4);
    expect(out[0]).toMatchObject({ x: 0, y: 0 });
    expect(out[out.length - 1]).toMatchObject({ x: 20, y: 0 });
  });

  it('densifies the stroke with interpolated samples', () => {
    const out = smoothStroke([p(0, 0), p(10, 10), p(20, 0)], 4);
    expect(out.length).toBeGreaterThan(3);
  });

  it('stays on the line for collinear input (no overshoot)', () => {
    const out = smoothStroke([p(0, 0), p(10, 0), p(20, 0), p(30, 0)], 5);
    for (const point of out) expect(Math.abs(point.y)).toBeLessThan(1e-9);
  });

  it('never leaves the bounding box of the input (unlike tension-based curves)', () => {
    const input = [p(0, 0), p(10, 40), p(20, 0), p(30, 40)];
    const out = smoothStroke(input, 8);
    const maxY = Math.max(...input.map(i => i.y));
    const minY = Math.min(...input.map(i => i.y));
    for (const point of out) {
      expect(point.y).toBeLessThanOrEqual(maxY + 1e-9);
      expect(point.y).toBeGreaterThanOrEqual(minY - 1e-9);
    }
  });

  it('interpolates pressure along the curve', () => {
    const out = smoothStroke(
      [p(0, 0, { pressure: 0.2 }), p(10, 0, { pressure: 0.8 }), p(20, 0, { pressure: 0.2 })],
      4
    );
    expect(out.every(point => point.pressure === undefined || (point.pressure >= 0.2 && point.pressure <= 0.8))).toBe(true);
  });

  it('returns short strokes unchanged', () => {
    expect(smoothStroke([p(0, 0), p(5, 5)])).toEqual([p(0, 0), p(5, 5)]);
  });
});

describe('smoothTail (incremental smoothing)', () => {
  const raw = [p(0, 0), p(10, 20), p(20, 0), p(30, 20), p(40, 0)];

  it('emits nothing until three samples exist', () => {
    expect(smoothTail([p(0, 0)])).toEqual([]);
    expect(smoothTail([p(0, 0), p(10, 0)])).toEqual([]);
  });

  it('reproduces smoothStroke exactly when fed sample by sample', () => {
    const streamed: InkPoint[] = [raw[0]];
    for (let n = 2; n <= raw.length; n++) {
      streamed.push(...smoothTail(raw.slice(0, n), 6));
    }
    streamed.push(raw[raw.length - 1]);

    expect(streamed).toEqual(smoothStroke(raw, 6));
  });

  it('emits one batch per sample, sized by samplesPerSegment', () => {
    expect(smoothTail(raw.slice(0, 3), 4)).toHaveLength(4);
    expect(smoothTail(raw.slice(0, 3), 1)).toHaveLength(1);
  });
});

describe('pointVelocity', () => {
  it('is distance over elapsed time', () => {
    expect(pointVelocity(p(0, 0, { t: 0 }), p(30, 0, { t: 10 }))).toBe(3);
  });

  it('is zero without usable timestamps', () => {
    expect(pointVelocity(p(0, 0), p(30, 0))).toBe(0);
    expect(pointVelocity(p(0, 0, { t: 5 }), p(30, 0, { t: 5 }))).toBe(0);
  });
});

describe('resolveStrokeWidth', () => {
  it('follows pen pressure', () => {
    const light = resolveStrokeWidth({ baseWidth: 4, pressure: 0.1, pointerType: 'pen' });
    const heavy = resolveStrokeWidth({ baseWidth: 4, pressure: 1, pointerType: 'pen' });
    expect(heavy).toBeGreaterThan(light);
  });

  it('ignores the browser default pressure for mouse and touch', () => {
    // Mouse always reports 0.5 — treating that as pressure would halve every line
    expect(resolveStrokeWidth({ baseWidth: 4, pressure: 0.5, pointerType: 'mouse' })).toBe(4);
    expect(resolveStrokeWidth({ baseWidth: 4, pressure: 0.5, pointerType: 'touch' })).toBe(4);
  });

  it('tapers with speed', () => {
    const slow = resolveStrokeWidth({ baseWidth: 4, velocity: 0 });
    const fast = resolveStrokeWidth({ baseWidth: 4, velocity: 3 });
    expect(fast).toBeLessThan(slow);
  });

  it('stays inside the configured ratio bounds', () => {
    const tiny = resolveStrokeWidth({ baseWidth: 10, pressure: 0.001, velocity: 99, pointerType: 'pen' });
    const huge = resolveStrokeWidth({ baseWidth: 10, pressure: 1, velocity: 0, pointerType: 'pen' });
    expect(tiny).toBeGreaterThanOrEqual(10 * 0.35);
    expect(huge).toBeLessThanOrEqual(10 * 1.8);
  });
});

describe('buildStrokeWidths', () => {
  it('produces one width per point', () => {
    const points = [p(0, 0, { t: 0, pressure: 0.2 }), p(5, 0, { t: 10, pressure: 0.9 })];
    expect(buildStrokeWidths(points, 4, 'pen')).toHaveLength(2);
  });

  it('reacts to pressure changes along the stroke', () => {
    const points = [
      p(0, 0, { t: 0, pressure: 0.1 }),
      p(5, 0, { t: 100, pressure: 0.1 }),
      p(10, 0, { t: 200, pressure: 1 }),
    ];
    const widths = buildStrokeWidths(points, 4, 'pen');
    expect(widths[2]).toBeGreaterThan(widths[1]);
  });
});

describe('buildWidthRuns', () => {
  it('emits a single run for a constant-width stroke', () => {
    const points = [p(0, 0), p(10, 0), p(20, 0)];
    const runs = buildWidthRuns(points, [3, 3, 3]);
    expect(runs).toHaveLength(1);
    expect(runs[0].points).toEqual([0, 0, 10, 0, 20, 0]);
  });

  it('splits when the width crosses a bucket boundary', () => {
    const points = [p(0, 0), p(10, 0), p(20, 0)];
    const runs = buildWidthRuns(points, [1, 1, 6]);
    expect(runs.length).toBeGreaterThan(1);
    expect(runs[runs.length - 1].width).toBeGreaterThan(runs[0].width);
  });

  it('keeps runs connected by repeating the shared point', () => {
    const points = [p(0, 0), p(10, 0), p(20, 0)];
    const runs = buildWidthRuns(points, [1, 1, 6]);
    const firstEnd = runs[0].points.slice(-2);
    const secondStart = runs[1].points.slice(0, 2);
    expect(secondStart).toEqual(firstEnd);
  });

  it('handles degenerate strokes', () => {
    expect(buildWidthRuns([], [])).toEqual([]);
    expect(buildWidthRuns([p(1, 2)], [3])).toEqual([{ points: [1, 2], width: 3 }]);
  });
});

describe('flat array conversion', () => {
  it('round-trips coordinates', () => {
    const flat = toFlatArray([p(1, 2), p(3, 4)]);
    expect(flat).toEqual([1, 2, 3, 4]);
    expect(fromFlatArray(flat)).toEqual([p(1, 2), p(3, 4)]);
  });

  it('ignores a trailing odd value', () => {
    expect(fromFlatArray([1, 2, 3])).toEqual([p(1, 2)]);
  });
});

describe('shouldIgnorePointer (palm rejection)', () => {
  it('suppresses touch while the pen is in use', () => {
    expect(shouldIgnorePointer({ pointerType: 'touch', penLastSeenAt: 1000, now: 1200 })).toBe(true);
  });

  it('lets touch draw again once the pen window expires', () => {
    expect(shouldIgnorePointer({ pointerType: 'touch', penLastSeenAt: 1000, now: 5000 })).toBe(false);
  });

  it('never suppresses pen or mouse input', () => {
    expect(shouldIgnorePointer({ pointerType: 'pen', penLastSeenAt: 1000, now: 1000 })).toBe(false);
    expect(shouldIgnorePointer({ pointerType: 'mouse', penLastSeenAt: 1000, now: 1000 })).toBe(false);
  });

  it('allows touch on devices where no pen was ever used', () => {
    expect(shouldIgnorePointer({ pointerType: 'touch', penLastSeenAt: null, now: 9999 })).toBe(false);
  });

  it('honours a custom pen window', () => {
    expect(shouldIgnorePointer({ pointerType: 'touch', penLastSeenAt: 0, now: 800, penModeWindowMs: 500 })).toBe(false);
    expect(shouldIgnorePointer({ pointerType: 'touch', penLastSeenAt: 0, now: 300, penModeWindowMs: 500 })).toBe(true);
  });
});

describe('distance', () => {
  it('is euclidean', () => {
    expect(distance(p(0, 0), p(3, 4))).toBe(5);
  });
});
