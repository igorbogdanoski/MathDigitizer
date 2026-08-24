import { describe, it, expect } from 'vitest';
import { StrokeBuilder } from './strokeBuilder';
import { InkPoint, smoothStroke, toFlatArray } from './ink';

const p = (x: number, y: number, over: Partial<InkPoint> = {}): InkPoint => ({ x, y, t: x, ...over });

const drive = (raw: InkPoint[], baseWidth = 3, pointerType = 'mouse') => {
  const builder = new StrokeBuilder(raw[0], { baseWidth, pointerType });
  const points: number[] = [raw[0].x, raw[0].y];
  const widths: number[] = [builder.initialWidth];

  for (const sample of raw.slice(1)) {
    const inc = builder.addSample(sample);
    if (inc) {
      points.push(...inc.points);
      widths.push(...inc.widths);
    }
  }
  const closing = builder.finish();
  if (closing) {
    points.push(...closing.points);
    widths.push(...closing.widths);
  }
  return { builder, points, widths };
};

describe('StrokeBuilder', () => {
  const raw = [p(0, 0), p(10, 20), p(20, 0), p(30, 20), p(40, 0)];

  it('produces exactly the batch smoothing result', () => {
    const { points } = drive(raw);
    expect(points).toEqual(toFlatArray(smoothStroke(raw, 6)));
  });

  it('emits one width per emitted point', () => {
    const { points, widths } = drive(raw);
    expect(widths).toHaveLength(points.length / 2);
  });

  it('decimates samples that barely moved', () => {
    const builder = new StrokeBuilder(p(0, 0), { baseWidth: 3, minSampleDistance: 5 });
    expect(builder.addSample(p(1, 0))).toBeNull();
    expect(builder.addSample(p(2, 0))).toBeNull();
    expect(builder.sampleCount).toBe(1);

    builder.addSample(p(20, 0));
    expect(builder.sampleCount).toBe(2);
  });

  it('emits nothing until a curve segment can be closed', () => {
    const builder = new StrokeBuilder(p(0, 0), { baseWidth: 3 });
    // Second sample only defines a segment; nothing is final yet.
    expect(builder.addSample(p(20, 0))).toBeNull();
    expect(builder.addSample(p(40, 0))).not.toBeNull();
  });

  it('closes the stroke on the newest raw sample', () => {
    const { points } = drive([p(0, 0), p(20, 0), p(40, 0)]);
    expect(points.slice(-2)).toEqual([40, 0]);
  });

  it('finishes only once', () => {
    const builder = new StrokeBuilder(p(0, 0), { baseWidth: 3 });
    builder.addSample(p(20, 0));
    builder.addSample(p(40, 0));
    expect(builder.finish()).not.toBeNull();
    expect(builder.finish()).toBeNull();
    expect(builder.addSample(p(60, 0))).toBeNull();
  });

  it('has nothing to close for a single-tap stroke', () => {
    const builder = new StrokeBuilder(p(5, 5), { baseWidth: 3 });
    expect(builder.finish()).toBeNull();
  });

  it('varies width with pen pressure', () => {
    const pen = drive([
      p(0, 0, { pressure: 0.1 }),
      p(20, 0, { pressure: 0.1 }),
      p(40, 0, { pressure: 1 }),
      p(60, 0, { pressure: 1 }),
    ], 4, 'pen');

    expect(Math.max(...pen.widths)).toBeGreaterThan(Math.min(...pen.widths));
  });

  it('ignores pressure for a mouse, where the browser always reports 0.5', () => {
    const geometry: Array<Partial<InkPoint>> = [{ pressure: 0.1 }, { pressure: 0.1 }, { pressure: 1 }, { pressure: 1 }];
    const withPressure = drive(geometry.map((over, i) => p(i * 20, 0, over)), 4, 'mouse');
    const neutral = drive(geometry.map((_, i) => p(i * 20, 0, { pressure: 0.5 })), 4, 'mouse');

    // Only velocity shapes a mouse line, so both runs must be identical.
    expect(withPressure.widths).toEqual(neutral.widths);
  });

  it('exposes the starting point and its width', () => {
    const builder = new StrokeBuilder(p(7, 8, { pressure: 1 }), { baseWidth: 4, pointerType: 'pen' });
    expect(builder.initialPoint).toMatchObject({ x: 7, y: 8 });
    expect(builder.initialWidth).toBeGreaterThan(4);
  });
});
