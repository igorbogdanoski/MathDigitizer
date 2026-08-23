/**
 * Axis calibration for the graph digitizer
 * (EXPERT_LEVEL_MASTER_PLAN, 8.2).
 *
 * Calibration maps image pixels onto real coordinates. The original mapping
 * divided by `p2.pixel.x - p1.pixel.x` with no guard, so two calibration points
 * sharing an x (easy to do by clicking twice on a vertical axis) produced
 * Infinity and then silent NaN through every digitized point.
 *
 * This module validates the calibration first, supports a least-squares fit
 * from three or more points, and never returns a non-finite coordinate.
 */

export type ScaleType = 'linear' | 'log';

export interface CalibPoint {
  pixel: { x: number; y: number };
  real: { x: number; y: number };
}

export type CalibrationIssue =
  | 'missing-points'
  | 'coincident-x'
  | 'coincident-y'
  | 'equal-real-x'
  | 'equal-real-y'
  | 'non-positive-log-x'
  | 'non-positive-log-y';

export interface CalibrationCheck {
  ok: boolean;
  issues: CalibrationIssue[];
}

/** Pixels closer than this on an axis count as the same click. */
const MIN_PIXEL_SEPARATION = 2;

/**
 * Checks a two-point calibration before it can produce garbage.
 * Every issue is reported, so the UI can tell the teacher what to fix rather
 * than only that something is wrong.
 */
export function validateCalibration(
  p1: CalibPoint | null | undefined,
  p2: CalibPoint | null | undefined,
  xScale: ScaleType = 'linear',
  yScale: ScaleType = 'linear'
): CalibrationCheck {
  if (!p1 || !p2) return { ok: false, issues: ['missing-points'] };

  const issues: CalibrationIssue[] = [];

  if (Math.abs(p2.pixel.x - p1.pixel.x) < MIN_PIXEL_SEPARATION) issues.push('coincident-x');
  if (Math.abs(p2.pixel.y - p1.pixel.y) < MIN_PIXEL_SEPARATION) issues.push('coincident-y');
  if (p1.real.x === p2.real.x) issues.push('equal-real-x');
  if (p1.real.y === p2.real.y) issues.push('equal-real-y');

  // A log axis cannot pass through or below zero.
  if (xScale === 'log' && (p1.real.x <= 0 || p2.real.x <= 0)) issues.push('non-positive-log-x');
  if (yScale === 'log' && (p1.real.y <= 0 || p2.real.y <= 0)) issues.push('non-positive-log-y');

  return { ok: issues.length === 0, issues };
}

/**
 * Maps a pixel to real coordinates.
 * Returns null rather than NaN when the calibration cannot support the mapping —
 * a caller that ignores that gets no points, not silently wrong ones.
 */
export function pixelToReal(
  px: number,
  py: number,
  p1: CalibPoint,
  p2: CalibPoint,
  xScale: ScaleType = 'linear',
  yScale: ScaleType = 'linear'
): { x: number; y: number } | null {
  if (!validateCalibration(p1, p2, xScale, yScale).ok) return null;

  const dx = p2.pixel.x - p1.pixel.x;
  const dy = p2.pixel.y - p1.pixel.y;

  const x = xScale === 'log'
    ? Math.pow(10, interpolate(Math.log10(p1.real.x), Math.log10(p2.real.x), (px - p1.pixel.x) / dx))
    : interpolate(p1.real.x, p2.real.x, (px - p1.pixel.x) / dx);

  const y = yScale === 'log'
    ? Math.pow(10, interpolate(Math.log10(p1.real.y), Math.log10(p2.real.y), (py - p1.pixel.y) / dy))
    : interpolate(p1.real.y, p2.real.y, (py - p1.pixel.y) / dy);

  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function interpolate(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

export interface AffineCalibration {
  /** real = scale * pixel + offset, per axis. */
  xScaleFactor: number;
  xOffset: number;
  yScaleFactor: number;
  yOffset: number;
  /** Largest absolute residual across the calibration points, in real units. */
  maxResidual: number;
  pointCount: number;
}

/**
 * Least-squares affine calibration from three or more reference points.
 *
 * Two points fix the mapping exactly, which means any imprecision in a click
 * becomes systematic error over the whole graph. With three or more, the fit
 * averages the clicks out, and `maxResidual` says how well they agree — a large
 * residual means one of the reference points was misplaced.
 */
export function fitAffineCalibration(points: readonly CalibPoint[]): AffineCalibration | null {
  const usable = points.filter(p =>
    p && Number.isFinite(p.pixel.x) && Number.isFinite(p.pixel.y) &&
    Number.isFinite(p.real.x) && Number.isFinite(p.real.y)
  );
  if (usable.length < 3) return null;

  const x = fitAxis(usable.map(p => [p.pixel.x, p.real.x]));
  const y = fitAxis(usable.map(p => [p.pixel.y, p.real.y]));
  if (!x || !y) return null;

  const maxResidual = usable.reduce((worst, p) => Math.max(
    worst,
    Math.abs(x.scale * p.pixel.x + x.offset - p.real.x),
    Math.abs(y.scale * p.pixel.y + y.offset - p.real.y),
  ), 0);

  return {
    xScaleFactor: x.scale,
    xOffset: x.offset,
    yScaleFactor: y.scale,
    yOffset: y.offset,
    maxResidual,
    pointCount: usable.length,
  };
}

/** Ordinary least squares for one axis: real = scale * pixel + offset. */
function fitAxis(pairs: Array<[number, number]>): { scale: number; offset: number } | null {
  const n = pairs.length;
  const sumP = pairs.reduce((s, [p]) => s + p, 0);
  const sumR = pairs.reduce((s, [, r]) => s + r, 0);
  const sumPP = pairs.reduce((s, [p]) => s + p * p, 0);
  const sumPR = pairs.reduce((s, [p, r]) => s + p * r, 0);

  const denominator = n * sumPP - sumP * sumP;
  // All reference pixels on one line for this axis — the axis is not determined.
  if (Math.abs(denominator) < 1e-9) return null;

  const scale = (n * sumPR - sumP * sumR) / denominator;
  const offset = (sumR - scale * sumP) / n;

  return Number.isFinite(scale) && Number.isFinite(offset) ? { scale, offset } : null;
}

/** Applies a fitted affine calibration to a pixel. */
export function applyAffine(calibration: AffineCalibration, px: number, py: number): { x: number; y: number } {
  return {
    x: calibration.xScaleFactor * px + calibration.xOffset,
    y: calibration.yScaleFactor * py + calibration.yOffset,
  };
}
