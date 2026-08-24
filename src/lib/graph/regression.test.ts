import { describe, it, expect } from 'vitest';
import {
  Point,
  bestFit,
  fitAll,
  fitExponential,
  fitLinear,
  fitPower,
  fitQuadratic,
} from './regression';

const sample = (fn: (x: number) => number, xs: number[]): Point[] =>
  xs.map(x => ({ x, y: fn(x) }));

describe('fitLinear', () => {
  it('recovers an exact line', () => {
    const fit = fitLinear(sample(x => 3 + 2 * x, [0, 1, 2, 3, 4]))!;

    expect(fit.coefficients[0]).toBeCloseTo(3, 9);
    expect(fit.coefficients[1]).toBeCloseTo(2, 9);
    expect(fit.r2).toBeCloseTo(1, 9);
    expect(fit.rmse).toBeLessThan(1e-9);
  });

  it('fits a noisy line closely but not exactly', () => {
    const fit = fitLinear([{ x: 0, y: 0.1 }, { x: 1, y: 1.9 }, { x: 2, y: 4.1 }, { x: 3, y: 5.9 }])!;
    expect(fit.coefficients[1]).toBeCloseTo(2, 1);
    expect(fit.r2).toBeGreaterThan(0.99);
    expect(fit.rmse).toBeGreaterThan(0);
  });

  it('needs two points and a spread of x', () => {
    expect(fitLinear([{ x: 1, y: 1 }])).toBeNull();
    expect(fitLinear([{ x: 1, y: 1 }, { x: 1, y: 5 }])).toBeNull();
  });

  it('evaluates and renders itself', () => {
    const fit = fitLinear(sample(x => 3 + 2 * x, [0, 1, 2]))!;
    expect(fit.evaluate(10)).toBeCloseTo(23, 9);
    expect(fit.latex).toContain('x');
  });

  it('handles a flat line', () => {
    const fit = fitLinear(sample(() => 5, [0, 1, 2, 3]))!;
    expect(fit.coefficients[1]).toBeCloseTo(0, 9);
    expect(fit.r2).toBe(1);
  });
});

describe('fitQuadratic', () => {
  it('recovers an exact parabola', () => {
    const fit = fitQuadratic(sample(x => 1 - 2 * x + 3 * x * x, [-2, -1, 0, 1, 2, 3]))!;

    expect(fit.coefficients[0]).toBeCloseTo(1, 6);
    expect(fit.coefficients[1]).toBeCloseTo(-2, 6);
    expect(fit.coefficients[2]).toBeCloseTo(3, 6);
    expect(fit.r2).toBeCloseTo(1, 6);
  });

  it('needs three points', () => {
    expect(fitQuadratic([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
  });

  it('returns null for a singular system', () => {
    expect(fitQuadratic([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }])).toBeNull();
  });

  it('renders the squared term', () => {
    expect(fitQuadratic(sample(x => x * x, [-1, 0, 1, 2]))!.latex).toContain('x^2');
  });
});

describe('fitExponential', () => {
  it('recovers an exact exponential', () => {
    const fit = fitExponential(sample(x => 2 * Math.exp(0.5 * x), [0, 1, 2, 3, 4]))!;

    expect(fit.coefficients[0]).toBeCloseTo(2, 6);
    expect(fit.coefficients[1]).toBeCloseTo(0.5, 6);
    expect(fit.r2).toBeGreaterThan(0.999);
  });

  it('scores against the original y, not the log-transformed one', () => {
    // Otherwise R² would not be comparable with the other fits
    const fit = fitExponential(sample(x => 2 * Math.exp(0.5 * x), [0, 1, 2, 3]))!;
    expect(fit.rmse).toBeLessThan(0.01);
  });

  it('drops non-positive y, which the log cannot take', () => {
    const fit = fitExponential([{ x: 0, y: 1 }, { x: 1, y: -5 }, { x: 2, y: 4 }, { x: 3, y: 8 }]);
    expect(fit).not.toBeNull();
    expect(Number.isFinite(fit!.coefficients[1])).toBe(true);
  });

  it('returns null when nothing is left to fit', () => {
    expect(fitExponential([{ x: 0, y: -1 }, { x: 1, y: -2 }])).toBeNull();
  });
});

describe('fitPower', () => {
  it('recovers an exact power law', () => {
    const fit = fitPower(sample(x => 3 * Math.pow(x, 2), [1, 2, 3, 4, 5]))!;
    expect(fit.coefficients[0]).toBeCloseTo(3, 5);
    expect(fit.coefficients[1]).toBeCloseTo(2, 5);
  });

  it('needs positive x and y', () => {
    expect(fitPower([{ x: 0, y: 1 }, { x: -1, y: 2 }])).toBeNull();
  });
});

describe('fitAll', () => {
  it('orders candidates by how well they fit', () => {
    const fits = fitAll(sample(x => x * x, [1, 2, 3, 4, 5]));
    expect(fits.length).toBeGreaterThan(1);
    for (let i = 1; i < fits.length; i++) {
      expect(fits[i - 1].r2).toBeGreaterThanOrEqual(fits[i].r2);
    }
  });

  it('returns nothing for too few points', () => {
    expect(fitAll([{ x: 1, y: 1 }])).toEqual([]);
  });
});

describe('bestFit', () => {
  it('suggests a line for line-shaped points, not a quadratic that fits marginally better', () => {
    // A quadratic can always match a line at least as well; a tiny R² gain is
    // not evidence of curvature.
    const fit = bestFit([{ x: 0, y: 0.02 }, { x: 1, y: 1.99 }, { x: 2, y: 4.01 }, { x: 3, y: 5.98 }])!;
    expect(fit.kind).toBe('linear');
  });

  it('suggests a quadratic when the points genuinely curve', () => {
    expect(bestFit(sample(x => x * x, [-3, -2, -1, 0, 1, 2, 3]))!.kind).toBe('quadratic');
  });

  it('suggests an exponential for exponential growth', () => {
    const fit = bestFit(sample(x => 2 * Math.exp(0.9 * x), [0, 1, 2, 3, 4, 5]))!;
    expect(['exponential', 'power']).toContain(fit.kind);
    expect(fit.r2).toBeGreaterThan(0.99);
  });

  it('never suggests a fit that ignored part of the data', () => {
    // A power fit needs x, y > 0, so on y = x² over [-3..3] it sees only three
    // of the seven points and scores a perfect R² on that slice. Comparing R²
    // alone would let the fit that saw the least data win.
    const points = sample(x => x * x, [-3, -2, -1, 0, 1, 2, 3]);
    const chosen = bestFit(points)!;

    expect(chosen.pointsUsed).toBe(points.length);
    expect(chosen.kind).toBe('quadratic');
  });

  it('falls back to a partial fit only when nothing covers the data', () => {
    // Every point has y > 0 and x > 0 here, so coverage is full for all fits
    const positive = sample(x => 2 * Math.pow(x, 1.5), [1, 2, 3, 4]);
    expect(bestFit(positive)!.pointsUsed).toBe(4);
  });

  it('returns null with nothing to fit', () => {
    expect(bestFit([])).toBeNull();
  });

  it('honours a stricter simplicity preference', () => {
    const curved = sample(x => 0.1 * x * x + x, [0, 1, 2, 3, 4]);
    // With a huge required gain, the simpler fit always wins
    expect(bestFit(curved, 1)!.kind).toBe('linear');
  });
});
