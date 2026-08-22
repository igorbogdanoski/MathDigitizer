import { describe, expect, it } from 'vitest';
import {
  findEquivalentDistractors,
  normalizeLatex,
  validateKahootQuiz,
  validateLatex,
  type KahootQuestionDraft,
} from './validate';

describe('normalizeLatex', () => {
  it('strips delimiters, whitespace and case', () => {
    expect(normalizeLatex(' $X + 1 = 2$ ')).toBe('x+1=2');
  });
});

describe('validateLatex', () => {
  it('accepts well-formed math', () => {
    expect(validateLatex('Решение: $x^2 + 1 = 2$ и $$\\int_0^1 x\\,dx$$')).toHaveLength(0);
  });

  it('auto-normalizes common AI slips before judging', () => {
    // \frac12 and an unclosed brace are both fixed by sanitizeLatex
    expect(validateLatex('$\\frac12$ и $x^{2$')).toHaveLength(0);
  });

  it('flags genuinely broken segments with the parse error', () => {
    const issues = validateLatex('ок $\\begin{$ крај');
    expect(issues).toHaveLength(1);
    expect(issues[0].error).toBeTruthy();
  });

  it('ignores prose without math delimiters', () => {
    expect(validateLatex('нема математика тука')).toHaveLength(0);
  });
});

describe('validateKahootQuiz', () => {
  const good = {
    question: 'Колку е 1+1?',
    options: ['2', '3', '4', '5'],
    correctIndex: 0,
  };

  it('keeps well-formed questions', () => {
    const { valid, dropped } = validateKahootQuiz([good]);
    expect(valid).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it('drops questions with out-of-range correctIndex', () => {
    const { valid, dropped } = validateKahootQuiz([{ ...good, correctIndex: 4 }]);
    expect(valid).toHaveLength(0);
    expect(dropped[0].reasons.join(' ')).toMatch(/correctIndex/);
  });

  it('drops questions without exactly 4 options', () => {
    const { valid } = validateKahootQuiz([{ ...good, options: ['2', '3', '4'] }]);
    expect(valid).toHaveLength(0);
  });

  it('drops questions with duplicate options', () => {
    const { valid, dropped } = validateKahootQuiz([{ ...good, options: ['2', '2', '4', '5'] }]);
    expect(valid).toHaveLength(0);
    expect(dropped[0].reasons.join(' ')).toMatch(/duplicate/);
  });

  it('tolerates non-array and malformed input', () => {
    expect(validateKahootQuiz(null).valid).toHaveLength(0);
    expect(validateKahootQuiz('nope').valid).toHaveLength(0);
  });
});

describe('findEquivalentDistractors', () => {
  it('flags a distractor symbolically equal to the correct option', async () => {
    const q: KahootQuestionDraft = {
      question: 'Реши x/2',
      options: ['$x/2$', '$0.5x$', '$x+1$'],
      correctIndex: 0,
    };
    const issues = await findEquivalentDistractors([q]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/distractor equals the correct answer/);
  });

  it('stays silent for genuinely different options and non-math text', async () => {
    const q: KahootQuestionDraft = {
      question: 'Избери',
      options: ['$x+1$', '$x+2$', 'не знам'],
      correctIndex: 0,
    };
    expect(await findEquivalentDistractors([q])).toHaveLength(0);
  });
});
