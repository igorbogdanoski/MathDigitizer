/**
 * Output-validation domain — the single control point where AI artifacts get
 * shape-checked and math-checked before reaching Firestore or the UI
 * (EXPERT_LEVEL_MASTER_PLAN, Phase 0).
 *
 * Also owns the shared LaTeX normalization helpers (moved out of
 * MathRenderer/videoAgent so every feature validates the same way).
 */
import katex from 'katex';
import type { ComputeEngine } from '@cortex-js/compute-engine';
import { extractMathExpression, getComputeEngine } from '../mathVerify';

export function normalizeLatex(latex: string): string {
  return latex.replace(/\$/g, '').replace(/\s+/g, '').toLowerCase();
}

// AI-generated LaTeX occasionally comes back with a handful of predictable
// slips — an unclosed \left/\right pair, an odd number of braces, a bare
// backslash at the end of a line. None of these are fixable in general, but
// these specific patterns are common enough (and safe enough to auto-close)
// that fixing them here means the difference between "renders correctly" and
// "shows a raw KaTeX error" for a meaningful share of real content.
export function sanitizeLatex(source: string): string {
  let text = source;

  // Balance curly braces within each math segment ($...$, $$...$$, \(...\),
  // \[...\]) by appending any missing closing braces at the end of the
  // segment — far better than leaving KaTeX to fail on the whole formula.
  const mathSegmentPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;
  text = text.replace(mathSegmentPattern, (segment) => {
    let opens = 0;
    for (const ch of segment) {
      if (ch === '{') opens++;
      else if (ch === '}') opens--;
    }
    if (opens > 0) {
      // Insert missing closing braces just before the segment's own closing
      // delimiter, not after it.
      const closingDelimMatch = segment.match(/(\$\$|\$|\\\)|\\\])$/);
      const closingDelim = closingDelimMatch ? closingDelimMatch[0] : '';
      const body = closingDelim ? segment.slice(0, -closingDelim.length) : segment;
      return body + '}'.repeat(opens) + closingDelim;
    }
    return segment;
  });

  // \left...\right must be paired; an unmatched \left with no \right at all
  // in the same segment makes KaTeX refuse to render anything after it.
  text = text.replace(mathSegmentPattern, (segment) => {
    const leftCount = (segment.match(/\\left(?![a-zA-Z])/g) || []).length;
    const rightCount = (segment.match(/\\right(?![a-zA-Z])/g) || []).length;
    if (leftCount > rightCount) {
      const closingDelimMatch = segment.match(/(\$\$|\$|\\\)|\\\])$/);
      const closingDelim = closingDelimMatch ? closingDelimMatch[0] : '';
      const body = closingDelim ? segment.slice(0, -closingDelim.length) : segment;
      return body + ' \\right.'.repeat(leftCount - rightCount) + closingDelim;
    }
    return segment;
  });

  // Normalize common AI mistakes
  text = text
    // Fix double subscripts/superscripts: x_1_2 → x_{12}
    .replace(/([a-zA-Z])_(\d)_(\d)/g, '$1_{$2$3}')
    // Fix missing braces in fractions: \frac12 → \frac{1}{2}
    .replace(/\\frac(\d)(\d)/g, '\\frac{$1}{$2}')
    // Fix \sqrt without braces: \sqrt2 → \sqrt{2}
    .replace(/\\sqrt(\d+)/g, '\\sqrt{$1}')
    // Normalize \cdot vs \times (prefer \cdot for multiplication)
    .replace(/\\times(?=\s*\d)/g, '\\cdot')
    // Fix missing \ in common commands
    .replace(/(?<![\\])sin(?=\s*[\(\{])/g, '\\sin')
    .replace(/(?<![\\])cos(?=\s*[\(\{])/g, '\\cos')
    .replace(/(?<![\\])tan(?=\s*[\(\{])/g, '\\tan')
    .replace(/(?<![\\])log(?=\s*[\(\{])/g, '\\log')
    .replace(/(?<![\\])ln(?=\s*[\(\{])/g, '\\ln')
    // Fix double equals: x==5 → x=5
    .replace(/==/g, '=')
    // Fix missing spaces around equals in display math
    .replace(/\$\$([^$]+)\$\$/g, (match, content) => {
      // Add proper spacing around = in aligned environments
      const aligned = content.replace(/([^=\s])=([^=\s])/g, '$1 &= $2');
      return `$$${aligned}$$`;
    });

  return text;
}

export interface LatexIssue {
  segment: string;
  error: string;
}

/**
 * Parse-checks every $…$ / $$…$$ segment of a text with KaTeX AFTER the
 * shared AI-slip normalization, so only genuinely broken math is reported.
 */
export function validateLatex(text: string): LatexIssue[] {
  const issues: LatexIssue[] = [];
  const segments = sanitizeLatex(text).match(/\$\$[^$]+\$\$|\$[^$\n]+\$/g) ?? [];
  for (const segment of segments) {
    const inner = segment
      .replace(/^\$\$/, '')
      .replace(/\$\$$/, '')
      .replace(/^\$/, '')
      .replace(/\$$/, '')
      .trim();
    if (!inner) continue;
    try {
      katex.renderToString(inner, { throwOnError: true, strict: false });
    } catch (error) {
      issues.push({ segment, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return issues;
}

export interface KahootQuestionDraft {
  question: string;
  options: string[];
  correctIndex: number;
  timeLimit?: number;
  hints?: string[];
}

export interface KahootValidation {
  valid: KahootQuestionDraft[];
  keptIndexes: number[];
  dropped: Array<{ question: string; reasons: string[] }>;
}

/**
 * Shape-validates a generated quiz BEFORE it reaches Firestore or a live
 * game: exactly 4 non-empty unique options, integer correctIndex in 0-3.
 */
export function validateKahootQuiz(raw: unknown): KahootValidation {
  const list = Array.isArray(raw) ? raw : [];
  const valid: KahootQuestionDraft[] = [];
  const keptIndexes: number[] = [];
  const dropped: KahootValidation['dropped'] = [];

  let index = -1;
  for (const entry of list) {
    index += 1;
    const q = entry as Partial<KahootQuestionDraft> | null;
    const reasons: string[] = [];
    const question = typeof q?.question === 'string' ? q.question.trim() : '';
    if (!question) reasons.push('missing question text');

    const options = Array.isArray(q?.options)
      ? (q.options as unknown[]).filter((o): o is string => typeof o === 'string' && !!o.trim())
      : [];
    if (options.length !== 4) reasons.push(`expected 4 options, got ${options.length}`);
    if (options.length === 4 && new Set(options.map(normalizeLatex)).size !== 4) {
      reasons.push('duplicate options');
    }

    const correctIndex = typeof q?.correctIndex === 'number' && Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
    if (correctIndex < 0 || correctIndex > 3) reasons.push(`correctIndex out of range: ${String(q?.correctIndex)}`);

    if (reasons.length === 0) {
      valid.push({
        question,
        options,
        correctIndex,
        timeLimit: typeof q?.timeLimit === 'number' ? q.timeLimit : undefined,
        hints: Array.isArray(q?.hints) ? (q.hints as unknown[]).filter((h): h is string => typeof h === 'string') : undefined,
      });
      keptIndexes.push(index);
    } else {
      dropped.push({ question: question || '<missing>', reasons });
    }
  }

  return { valid, keptIndexes, dropped };
}

/**
 * Per-question flag: true when some distractor is symbolically equal to the
 * correct option (a quiz must never have two "correct" answers).
 */
export async function flagQuestionsWithEquivalentDistractors(questions: KahootQuestionDraft[]): Promise<boolean[]> {
  const flags = questions.map(() => false);
  let ce: ComputeEngine | null = null;

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const correctExpr = extractMathExpression(q.options[q.correctIndex]);
    if (!correctExpr) continue;

    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex || flags[qi]) continue;
      const optionExpr = extractMathExpression(q.options[i]);
      if (!optionExpr) continue;
      try {
        ce = ce ?? (await getComputeEngine());
        const option = ce.parse(optionExpr);
        const correct = ce.parse(correctExpr);
        if (option.isValid !== false && correct.isValid !== false && option.isEqual(correct)) {
          flags[qi] = true;
        }
      } catch {
        // outside Compute Engine's grammar — not a duplicate we can prove
      }
    }
  }

  return flags;
}

export async function findEquivalentDistractors(questions: KahootQuestionDraft[]): Promise<string[]> {
  const flags = await flagQuestionsWithEquivalentDistractors(questions);
  const issues: string[] = [];
  questions.forEach((q, qi) => {
    if (flags[qi]) issues.push(`"${q.question.slice(0, 60)}": a distractor equals the correct answer`);
  });
  return issues;
}
