import type { ComputeEngine } from '@cortex-js/compute-engine';

// @cortex-js/compute-engine is ~450 KB gzipped — far too heavy to sit in
// InteractiveSolver's eager import graph for a background pre-check most
// steps won't even need. Loaded lazily, only once a step actually has a
// plausible math expression to compare (see tryFastStepVerify below), and
// cached across calls within the session once loaded.
let _cePromise: Promise<ComputeEngine> | null = null;
export function getComputeEngine(): Promise<ComputeEngine> {
  if (!_cePromise) {
    _cePromise = import('@cortex-js/compute-engine').then((mod) => new mod.ComputeEngine());
  }
  return _cePromise;
}

/**
 * Pulls the most likely math expression out of a string that may also
 * contain prose (Macedonian explanation text, "Одговор:", etc.). Prefers
 * LaTeX delimited by $...$/$$...$$, then falls back to the substring after
 * the last "=" sign, then the whole trimmed string as a last resort.
 */
function looksMostlyMathematical(segment: string): boolean {
  const nonSpace = segment.replace(/\s+/g, '');
  if (!nonSpace || nonSpace.length > 200) return false;
  const mathLikeChars = (nonSpace.match(/[0-9+\-*/^=(){}\\a-zA-Z]/g) || []).length;
  return mathLikeChars / nonSpace.length > 0.6;
}

export function extractMathExpression(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const dollarMatch = trimmed.match(/\$\$?([^$]+)\$\$?/g);
  if (dollarMatch && dollarMatch.length > 0) {
    const last = dollarMatch[dollarMatch.length - 1];
    return last.replace(/\$/g, '').trim();
  }

  // Split on sentence/clause boundaries (Macedonian prose commonly wraps
  // the actual equation in a lead-in like "Значи:" or "Оттука добиваме,").
  // Walk backwards and take the last clause that reads as mostly math
  // rather than assuming the whole string — a lead-in sentence with a
  // single "=" inside it would otherwise get swept in wholesale. The
  // period/comma split deliberately skips decimal points (digit.digit /
  // digit,digit) so "x = 0.5" doesn't get chopped into "x = 0" + "5".
  const clauses = trimmed
    .split(/[:;]|(?<!\d)\.(?!\d)|(?<!\d),(?!\d)/)
    .map((c) => c.trim())
    .filter(Boolean);
  for (let i = clauses.length - 1; i >= 0; i--) {
    if (looksMostlyMathematical(clauses[i])) {
      return clauses[i];
    }
  }

  if (looksMostlyMathematical(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Attempts a fast, deterministic, free verification of a student's step
 * against the corresponding expected step from the task's solution —
 * catches the common case where a student's answer is symbolically
 * equivalent to the textbook one (0.5x vs x/2, 2(a+b) vs 2a+2b, etc.)
 * without needing an AI call.
 *
 * Returns null (never a hard "false") whenever it isn't confident — a
 * missed fast-path just means the caller falls back to full AI
 * verification, so this can only ever help, never produce a false
 * rejection. The extraction pre-check runs synchronously first so the
 * (lazily-loaded) Compute Engine is never even fetched for inputs that
 * clearly aren't a bare math expression.
 */
export async function tryFastStepVerify(
  expectedStepText: string | undefined,
  studentInput: string
): Promise<{ isCorrect: true; feedback: string } | null> {
  if (!expectedStepText) return null;

  const expectedExpr = extractMathExpression(expectedStepText);
  const studentExpr = extractMathExpression(studentInput);
  if (!expectedExpr || !studentExpr) return null;

  try {
    const ce = await getComputeEngine();
    const expected = ce.parse(expectedExpr);
    const student = ce.parse(studentExpr);

    if (expected.isValid === false || student.isValid === false) return null;

    if (expected.isEqual(student)) {
      return {
        isCorrect: true,
        feedback: 'Точно! Тоа е правилен чекор — продолжи натаму.',
      };
    }
  } catch {
    // Parsing/evaluation errors are expected for expressions outside
    // Compute Engine's grammar (e.g. prose that slipped through the
    // extraction heuristic) — just defer to the AI as usual.
    return null;
  }

  return null;
}
