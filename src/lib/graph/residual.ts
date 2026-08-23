/**
 * Residual check for a detected equation
 * (EXPERT_LEVEL_MASTER_PLAN, 8.1).
 *
 * The digitizer showed whatever equation the model reported, with no way to
 * tell whether it actually describes the digitized points. This evaluates the
 * equation over those points and reports how far off it is — so a wrong answer
 * is visible as a number rather than trusted as a label.
 *
 * Evaluation goes through ComputeEngine, the same engine the app already uses
 * to check student answers.
 */
import { Point } from './regression';

export interface ResidualReport {
  /** Root-mean-square residual, in the units of y. */
  rmse: number;
  /** RMSE relative to the spread of the digitized y values, 0–1+. */
  relative: number;
  /** Points the equation could be evaluated at. */
  evaluated: number;
  /** Points where evaluation failed (poles, domain errors, parse failure). */
  skipped: number;
  /** Largest single deviation. */
  maxDeviation: number;
  verdict: 'good' | 'approximate' | 'poor' | 'unverifiable';
}

/** Relative RMSE below this reads as a good description of the points. */
export const GOOD_RELATIVE = 0.05;
/** Above this the equation does not describe the points. */
export const POOR_RELATIVE = 0.2;

/**
 * Strips the presentation layer off an equation so it can be evaluated:
 * `$f(x) = 2x + 1$` becomes `2x + 1`.
 */
export function normalizeEquation(equation: string): string {
  return (equation || '')
    .replace(/\$/g, '')
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    .replace(/^\s*(?:[a-zA-Z]\s*\(\s*x\s*\)|y)\s*=\s*/i, '')
    .trim();
}

export interface EvaluateOptions {
  /** Injected so the check is testable without loading ComputeEngine. */
  evaluator?: (expression: string, x: number) => number | null;
}

/**
 * Builds an evaluator over ComputeEngine.
 * Returns null for any x the expression cannot produce a finite value at,
 * rather than letting NaN into the statistics.
 */
async function computeEngineEvaluator(): Promise<(expression: string, x: number) => number | null> {
  const { getComputeEngine } = await import('../mathVerify');
  const engine = await getComputeEngine();

  return (expression: string, x: number) => {
    try {
      const parsed = engine.parse(expression);
      const value = parsed.subs({ x }).N().valueOf();
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    } catch {
      return null;
    }
  };
}

/**
 * Measures how well `equation` describes `points`.
 *
 * `unverifiable` is a distinct verdict from `poor`: an equation the engine
 * could not evaluate has not been shown to be wrong, and saying so is more
 * honest than scoring it zero.
 */
export async function evaluateResidual(
  equation: string,
  points: readonly Point[],
  options: EvaluateOptions = {}
): Promise<ResidualReport> {
  const expression = normalizeEquation(equation);
  const usable = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));

  const empty: ResidualReport = {
    rmse: 0, relative: 0, evaluated: 0, skipped: usable.length,
    maxDeviation: 0, verdict: 'unverifiable',
  };
  if (!expression || usable.length === 0) return empty;

  const evaluate = options.evaluator ?? await computeEngineEvaluator();

  let sumSquares = 0;
  let evaluated = 0;
  let skipped = 0;
  let maxDeviation = 0;

  for (const point of usable) {
    const predicted = evaluate(expression, point.x);
    if (predicted === null) {
      skipped++;
      continue;
    }
    const deviation = Math.abs(predicted - point.y);
    sumSquares += deviation * deviation;
    maxDeviation = Math.max(maxDeviation, deviation);
    evaluated++;
  }

  // Too few points evaluated to say anything.
  if (evaluated < 2) return { ...empty, evaluated, skipped };

  const rmse = Math.sqrt(sumSquares / evaluated);
  const spread = ySpread(usable);
  const relative = spread > 0 ? rmse / spread : (rmse < 1e-9 ? 0 : 1);

  return {
    rmse,
    relative,
    evaluated,
    skipped,
    maxDeviation,
    verdict: relative <= GOOD_RELATIVE ? 'good' : relative <= POOR_RELATIVE ? 'approximate' : 'poor',
  };
}

/** Spread of the y values, used to make the residual scale-independent. */
function ySpread(points: readonly Point[]): number {
  const ys = points.map(p => p.y);
  return Math.max(...ys) - Math.min(...ys);
}

/** Percentage form for the UI, rounded to one decimal. */
export function relativePercent(report: ResidualReport): number {
  return Math.round(report.relative * 1000) / 10;
}
