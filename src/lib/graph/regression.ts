/**
 * Deterministic curve fitting for digitized points
 * (EXPERT_LEVEL_MASTER_PLAN, 8.3).
 *
 * The digitizer asked a model what function a graph showed. A model can be
 * confidently wrong about a curve it cannot see precisely; least squares
 * cannot. These fits are computed from the digitized points themselves, so the
 * suggestion is arithmetic rather than opinion — and the R² says how well it
 * actually describes the points, which a model's answer never does.
 */

export type FitKind = 'linear' | 'quadratic' | 'exponential' | 'power';

export interface Point {
  x: number;
  y: number;
}

export interface FitResult {
  kind: FitKind;
  /** Coefficients, highest power last for polynomials: [a, b] → a + bx. */
  coefficients: number[];
  /** Coefficient of determination, 0–1; higher fits the points better. */
  r2: number;
  /** Root-mean-square residual in the units of y. */
  rmse: number;
  /**
   * How many points the fit was actually computed on.
   *
   * Exponential and power fits drop points a logarithm cannot take, so a fit
   * can score well by quietly ignoring half the data. Comparing R² without
   * this would let the fit that saw the least win.
   */
  pointsUsed: number;
  /** LaTeX form of the fitted function, ready for MathRenderer. */
  latex: string;
  /** Evaluates the fit at x. */
  evaluate: (x: number) => number;
}

const usable = (points: readonly Point[]): Point[] =>
  points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));

/** Rounds for display without pretending to precision the data cannot support. */
function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.abs(value) >= 1000 || Math.abs(value) < 0.001
    ? value.toPrecision(4)
    : String(Math.round(value * 10000) / 10000);
  return rounded.replace(/\.?0+$/, '') || '0';
}

/** Signed term such as ` + 3x` / ` - 3x`, skipped when the coefficient is zero. */
function term(coefficient: number, suffix: string): string {
  if (Math.abs(coefficient) < 1e-12) return '';
  const sign = coefficient < 0 ? ' - ' : ' + ';
  return `${sign}${fmt(Math.abs(coefficient))}${suffix}`;
}

function scoreFit(points: readonly Point[], evaluate: (x: number) => number): { r2: number; rmse: number } {
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = evaluate(p.x);
    if (!Number.isFinite(predicted)) return { r2: 0, rmse: Infinity };
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  // A perfectly flat dataset has no variance to explain; a fit that reproduces
  // it exactly is a perfect fit, not an undefined one.
  const r2 = ssTot < 1e-12 ? (ssRes < 1e-12 ? 1 : 0) : Math.max(0, 1 - ssRes / ssTot);
  return { r2, rmse: Math.sqrt(ssRes / points.length) };
}

/** y = a + bx */
export function fitLinear(input: readonly Point[]): FitResult | null {
  const points = usable(input);
  if (points.length < 2) return null;

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) return null; // all points share one x

  const b = (n * sumXY - sumX * sumY) / denominator;
  const a = (sumY - b * sumX) / n;
  const evaluate = (x: number) => a + b * x;

  return {
    kind: 'linear',
    pointsUsed: points.length,
    coefficients: [a, b],
    ...scoreFit(points, evaluate),
    latex: `y = ${fmt(a)}${term(b, 'x')}`.replace(`y = ${fmt(a)} + `, a === 0 ? 'y = ' : `y = ${fmt(a)} + `),
    evaluate,
  };
}

/** y = a + bx + cx², via the 3×3 normal equations. */
export function fitQuadratic(input: readonly Point[]): FitResult | null {
  const points = usable(input);
  if (points.length < 3) return null;

  const sums = { n: points.length, x: 0, x2: 0, x3: 0, x4: 0, y: 0, xy: 0, x2y: 0 };
  for (const p of points) {
    const x2 = p.x * p.x;
    sums.x += p.x;
    sums.x2 += x2;
    sums.x3 += x2 * p.x;
    sums.x4 += x2 * x2;
    sums.y += p.y;
    sums.xy += p.x * p.y;
    sums.x2y += x2 * p.y;
  }

  const solved = solve3x3(
    [
      [sums.n, sums.x, sums.x2],
      [sums.x, sums.x2, sums.x3],
      [sums.x2, sums.x3, sums.x4],
    ],
    [sums.y, sums.xy, sums.x2y]
  );
  if (!solved) return null;

  const [a, b, c] = solved;
  const evaluate = (x: number) => a + b * x + c * x * x;

  return {
    kind: 'quadratic',
    pointsUsed: points.length,
    coefficients: [a, b, c],
    ...scoreFit(points, evaluate),
    latex: `y = ${fmt(a)}${term(b, 'x')}${term(c, 'x^2')}`,
    evaluate,
  };
}

/** y = a·e^(bx), fitted linearly on ln y — requires strictly positive y. */
export function fitExponential(input: readonly Point[]): FitResult | null {
  const points = usable(input).filter(p => p.y > 0);
  if (points.length < 2) return null;

  const linear = fitLinear(points.map(p => ({ x: p.x, y: Math.log(p.y) })));
  if (!linear) return null;

  const a = Math.exp(linear.coefficients[0]);
  const b = linear.coefficients[1];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const evaluate = (x: number) => a * Math.exp(b * x);

  return {
    kind: 'exponential',
    pointsUsed: points.length,
    coefficients: [a, b],
    // Scored against the original y, not the log-transformed one, so the R² is
    // comparable with the other fits.
    ...scoreFit(points, evaluate),
    latex: `y = ${fmt(a)}e^{${fmt(b)}x}`,
    evaluate,
  };
}

/** y = a·x^b, fitted linearly on ln y vs ln x — requires x, y > 0. */
export function fitPower(input: readonly Point[]): FitResult | null {
  const points = usable(input).filter(p => p.x > 0 && p.y > 0);
  if (points.length < 2) return null;

  const linear = fitLinear(points.map(p => ({ x: Math.log(p.x), y: Math.log(p.y) })));
  if (!linear) return null;

  const a = Math.exp(linear.coefficients[0]);
  const b = linear.coefficients[1];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const evaluate = (x: number) => a * Math.pow(x, b);

  return {
    kind: 'power',
    pointsUsed: points.length,
    coefficients: [a, b],
    ...scoreFit(points, evaluate),
    latex: `y = ${fmt(a)}x^{${fmt(b)}}`,
    evaluate,
  };
}

/** Every fit the points support, best R² first. */
export function fitAll(points: readonly Point[]): FitResult[] {
  return [fitLinear(points), fitQuadratic(points), fitExponential(points), fitPower(points)]
    .filter((fit): fit is FitResult => fit !== null && Number.isFinite(fit.rmse))
    .sort((a, b) => b.r2 - a.r2);
}

/**
 * The fit to suggest.
 *
 * A quadratic can always match a line at least as well as a line does, so a
 * marginal R² gain is not evidence of curvature. The simpler fit is kept unless
 * the more complex one is clearly better.
 */
export function bestFit(points: readonly Point[], minimumGain = 0.02): FitResult | null {
  const fits = fitAll(points);
  if (fits.length === 0) return null;

  // A fit that could only use part of the data has not described the graph,
  // however well it matches the part it saw.
  const available = usable(points).length;
  const eligible = fits.filter(fit => fit.pointsUsed >= available * MIN_COVERAGE);
  const candidates = eligible.length > 0 ? eligible : fits;

  const simplicity: Record<FitKind, number> = { linear: 0, exponential: 1, power: 1, quadratic: 2 };
  const best = candidates[0];

  const simpler = candidates.find(fit =>
    simplicity[fit.kind] < simplicity[best.kind] && best.r2 - fit.r2 < minimumGain
  );

  return simpler ?? best;
}

/** Share of the digitized points a fit must use to be worth suggesting. */
export const MIN_COVERAGE = 0.9;

function solve3x3(matrix: number[][], rhs: number[]): number[] | null {
  // Gaussian elimination with partial pivoting.
  const m = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null; // singular
    [m[col], m[pivot]] = [m[pivot], m[col]];

    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k];
    }
  }

  const solution = [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  return solution.every(Number.isFinite) ? solution : null;
}
