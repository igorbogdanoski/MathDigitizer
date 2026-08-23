import { describe, it, expect } from 'vitest';
import {
  CalibPoint,
  applyAffine,
  fitAffineCalibration,
  pixelToReal,
  validateCalibration,
} from './calibration';

const point = (px: number, py: number, rx: number, ry: number): CalibPoint => ({
  pixel: { x: px, y: py },
  real: { x: rx, y: ry },
});

// A 100px-per-unit graph with the y axis pointing down, as images do.
const p1 = point(100, 400, 0, 0);
const p2 = point(600, 100, 5, 3);

describe('validateCalibration', () => {
  it('accepts two well-separated points', () => {
    expect(validateCalibration(p1, p2)).toEqual({ ok: true, issues: [] });
  });

  it('rejects a missing point', () => {
    expect(validateCalibration(null, p2)).toEqual({ ok: false, issues: ['missing-points'] });
    expect(validateCalibration(p1, undefined)).toEqual({ ok: false, issues: ['missing-points'] });
  });

  it('catches coincident pixels — the division-by-zero the old code had', () => {
    const same = point(100, 400, 5, 3);
    expect(validateCalibration(p1, same).issues).toEqual(
      expect.arrayContaining(['coincident-x', 'coincident-y'])
    );
  });

  it('catches a click on the same vertical line', () => {
    expect(validateCalibration(p1, point(100, 100, 5, 3)).issues).toContain('coincident-x');
  });

  it('catches equal real values, which make the scale undefined', () => {
    expect(validateCalibration(p1, point(600, 100, 0, 3)).issues).toContain('equal-real-x');
    expect(validateCalibration(p1, point(600, 100, 5, 0)).issues).toContain('equal-real-y');
  });

  it('rejects non-positive values on a log axis', () => {
    expect(validateCalibration(p1, p2, 'log').issues).toContain('non-positive-log-x');
    expect(validateCalibration(point(100, 400, 1, 1), point(600, 100, 100, 1000), 'log', 'log').ok).toBe(true);
  });

  it('reports every issue at once, so the UI can say what to fix', () => {
    expect(validateCalibration(p1, point(100, 400, 0, 0)).issues.length).toBeGreaterThan(2);
  });
});

describe('pixelToReal', () => {
  it('maps the calibration points back to their own real values', () => {
    expect(pixelToReal(100, 400, p1, p2)).toEqual({ x: 0, y: 0 });
    expect(pixelToReal(600, 100, p1, p2)).toEqual({ x: 5, y: 3 });
  });

  it('interpolates linearly between them', () => {
    expect(pixelToReal(350, 250, p1, p2)).toEqual({ x: 2.5, y: 1.5 });
  });

  it('extrapolates beyond the calibration points', () => {
    expect(pixelToReal(1100, 400, p1, p2)?.x).toBe(10);
  });

  it('returns null instead of NaN for a broken calibration', () => {
    // The old implementation divided by zero here and produced Infinity
    expect(pixelToReal(300, 300, p1, point(100, 400, 5, 3))).toBeNull();
    expect(pixelToReal(300, 300, p1, p1)).toBeNull();
  });

  it('maps a log axis through the decades', () => {
    const lp1 = point(0, 0, 1, 1);
    const lp2 = point(100, 100, 100, 100);
    const mapped = pixelToReal(50, 50, lp1, lp2, 'log', 'log');

    expect(mapped?.x).toBeCloseTo(10, 6);
    expect(mapped?.y).toBeCloseTo(10, 6);
  });

  it('refuses a log axis calibrated through zero', () => {
    expect(pixelToReal(50, 50, point(0, 0, 0, 1), point(100, 100, 100, 100), 'log', 'log')).toBeNull();
  });
});

describe('fitAffineCalibration', () => {
  const exact = [point(0, 0, 0, 0), point(100, 100, 1, 2), point(200, 200, 2, 4)];

  it('needs at least three points', () => {
    expect(fitAffineCalibration(exact.slice(0, 2))).toBeNull();
  });

  it('recovers an exact affine mapping', () => {
    const fit = fitAffineCalibration(exact)!;
    expect(fit.xScaleFactor).toBeCloseTo(0.01, 9);
    expect(fit.yScaleFactor).toBeCloseTo(0.02, 9);
    expect(fit.maxResidual).toBeLessThan(1e-9);
    expect(fit.pointCount).toBe(3);
  });

  it('averages out an imprecise click instead of inheriting it', () => {
    const noisy = [...exact, point(300, 300, 3.05, 6.1)];
    const fit = fitAffineCalibration(noisy)!;

    // The fit stays close to the true scale rather than bending to the outlier
    expect(fit.xScaleFactor).toBeCloseTo(0.01, 3);
    // …and the residual reports that the points do not perfectly agree
    expect(fit.maxResidual).toBeGreaterThan(0);
  });

  it('returns null when the reference pixels do not span an axis', () => {
    const degenerate = [point(50, 0, 1, 0), point(50, 100, 2, 1), point(50, 200, 3, 2)];
    expect(fitAffineCalibration(degenerate)).toBeNull();
  });

  it('ignores points with non-finite values', () => {
    const withGarbage = [...exact, point(NaN, 300, 3, 6)];
    expect(fitAffineCalibration(withGarbage)?.pointCount).toBe(3);
  });

  it('applies the fitted calibration', () => {
    const fit = fitAffineCalibration(exact)!;
    expect(applyAffine(fit, 150, 150).x).toBeCloseTo(1.5, 9);
    expect(applyAffine(fit, 150, 150).y).toBeCloseTo(3, 9);
  });
});
