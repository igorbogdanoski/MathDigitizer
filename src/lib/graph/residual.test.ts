import { describe, it, expect } from 'vitest';
import {
  GOOD_RELATIVE,
  evaluateResidual,
  normalizeEquation,
  relativePercent,
} from './residual';
import { Point } from './regression';

/** Stand-in evaluator, so the residual logic is tested without ComputeEngine. */
const evaluator = (fn: (x: number) => number | null) =>
  (_expression: string, x: number) => fn(x);

const sample = (fn: (x: number) => number, xs: number[]): Point[] =>
  xs.map(x => ({ x, y: fn(x) }));

describe('normalizeEquation', () => {
  it('strips the LaTeX delimiters', () => {
    expect(normalizeEquation('$2x + 1$')).toBe('2x + 1');
    expect(normalizeEquation('\\(2x\\)')).toBe('2x');
    expect(normalizeEquation('\\[x^2\\]')).toBe('x^2');
  });

  it('strips a function or y prefix', () => {
    expect(normalizeEquation('f(x) = 2x + 1')).toBe('2x + 1');
    expect(normalizeEquation('y = x^2')).toBe('x^2');
    expect(normalizeEquation('$g(x)=3x$')).toBe('3x');
  });

  it('leaves a bare expression alone', () => {
    expect(normalizeEquation('2x + 1')).toBe('2x + 1');
  });

  it('handles empty input', () => {
    expect(normalizeEquation('')).toBe('');
    expect(normalizeEquation(undefined as any)).toBe('');
  });
});

describe('evaluateResidual', () => {
  const points = sample(x => 2 * x + 1, [0, 1, 2, 3, 4]);

  it('reports a good verdict when the equation matches the points', async () => {
    const report = await evaluateResidual('y = 2x + 1', points, {
      evaluator: evaluator(x => 2 * x + 1),
    });

    expect(report.verdict).toBe('good');
    expect(report.rmse).toBeLessThan(1e-9);
    expect(report.relative).toBeLessThanOrEqual(GOOD_RELATIVE);
    expect(report.evaluated).toBe(5);
    expect(report.skipped).toBe(0);
  });

  it('reports poor when the model got the graph wrong', async () => {
    const report = await evaluateResidual('y = 10x', points, {
      evaluator: evaluator(x => 10 * x),
    });

    expect(report.verdict).toBe('poor');
    expect(report.relative).toBeGreaterThan(0.2);
    expect(report.maxDeviation).toBeGreaterThan(5);
  });

  it('reports approximate for a near miss', async () => {
    const report = await evaluateResidual('y = 2x + 1', points, {
      // Off by a tenth of the y spread's ~10% band
      evaluator: evaluator(x => 2 * x + 1.7),
    });
    expect(report.verdict).toBe('approximate');
  });

  it('is scale-independent — the same shape misfit scores the same', async () => {
    const small = sample(x => x, [0, 1, 2, 3, 4]);
    const large = sample(x => 1000 * x, [0, 1, 2, 3, 4]);

    const a = await evaluateResidual('x', small, { evaluator: evaluator(x => x * 1.1) });
    const b = await evaluateResidual('1000x', large, { evaluator: evaluator(x => 1000 * x * 1.1) });

    expect(a.relative).toBeCloseTo(b.relative, 6);
  });

  it('skips points the equation cannot be evaluated at', async () => {
    const report = await evaluateResidual('1/x', sample(x => 1 / (x || 1), [0, 1, 2, 3]), {
      evaluator: evaluator(x => (x === 0 ? null : 1 / x)),
    });

    expect(report.skipped).toBe(1);
    expect(report.evaluated).toBe(3);
  });

  it('says unverifiable rather than poor when almost nothing evaluated', async () => {
    // An equation that could not be evaluated has not been shown to be wrong
    const report = await evaluateResidual('???', points, { evaluator: evaluator(() => null) });

    expect(report.verdict).toBe('unverifiable');
    expect(report.evaluated).toBe(0);
    expect(report.skipped).toBe(5);
  });

  it('is unverifiable with no equation or no points', async () => {
    expect((await evaluateResidual('', points, { evaluator: evaluator(x => x) })).verdict).toBe('unverifiable');
    expect((await evaluateResidual('x', [], { evaluator: evaluator(x => x) })).verdict).toBe('unverifiable');
  });

  it('ignores points with non-finite coordinates', async () => {
    const report = await evaluateResidual('x', [...points, { x: NaN, y: 5 }], {
      evaluator: evaluator(x => 2 * x + 1),
    });
    expect(report.evaluated).toBe(5);
  });

  it('handles a flat graph the equation reproduces exactly', async () => {
    const flat = sample(() => 7, [0, 1, 2, 3]);
    const report = await evaluateResidual('7', flat, { evaluator: evaluator(() => 7) });

    expect(report.verdict).toBe('good');
    expect(report.relative).toBe(0);
  });

  it('does not call a flat graph a good match for a wrong constant', async () => {
    const flat = sample(() => 7, [0, 1, 2, 3]);
    const report = await evaluateResidual('9', flat, { evaluator: evaluator(() => 9) });
    expect(report.verdict).toBe('poor');
  });
});

describe('relativePercent', () => {
  it('renders the relative residual as a percentage', async () => {
    const report = await evaluateResidual('x', sample(x => x, [0, 1, 2, 3, 4]), {
      evaluator: evaluator(x => x + 0.4),
    });
    expect(relativePercent(report)).toBeCloseTo(10, 0);
  });
});
