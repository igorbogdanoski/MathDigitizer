import { describe, it, expect } from 'vitest';
import { MathNode, parseLatex, splitMathSegments } from './latexToMath';

/** Flattens an AST back to a readable shape string, for compact assertions. */
const shape = (nodes: MathNode[]): string =>
  nodes.map(n => {
    switch (n.kind) {
      case 'run': return `"${n.text}"`;
      case 'fraction': return `frac(${shape(n.numerator)},${shape(n.denominator)})`;
      case 'radical': return n.degree ? `root(${shape(n.degree)},${shape(n.radicand)})` : `sqrt(${shape(n.radicand)})`;
      case 'superscript': return `sup(${shape(n.base)},${shape(n.exponent)})`;
      case 'subscript': return `sub(${shape(n.base)},${shape(n.subscript)})`;
      case 'subsuperscript': return `subsup(${shape(n.base)},${shape(n.subscript)},${shape(n.exponent)})`;
      case 'nary': return `${n.operator}(${shape(n.lower)},${shape(n.upper)},${shape(n.body)})`;
      case 'brackets': return `${n.style}[${shape(n.children)}]`;
    }
  }).join('+');

describe('parseLatex — structure', () => {
  it('parses a fraction', () => {
    expect(shape(parseLatex('\\frac{1}{2}'))).toBe('frac("1","2")');
  });

  it('parses nested fractions', () => {
    expect(shape(parseLatex('\\frac{\\frac{a}{b}}{c}'))).toBe('frac(frac("a","b"),"c")');
  });

  it('parses a square root and an n-th root', () => {
    expect(shape(parseLatex('\\sqrt{x}'))).toBe('sqrt("x")');
    expect(shape(parseLatex('\\sqrt[3]{x}'))).toBe('root("3","x")');
  });

  it('parses superscripts and subscripts', () => {
    expect(shape(parseLatex('x^2'))).toBe('sup("x","2")');
    expect(shape(parseLatex('a_i'))).toBe('sub("a","i")');
  });

  it('combines a subscript and superscript on the same base', () => {
    expect(shape(parseLatex('x_i^2'))).toBe('subsup("x","i","2")');
    expect(shape(parseLatex('x^2_i'))).toBe('subsup("x","i","2")');
  });

  it('parses braced exponents', () => {
    expect(shape(parseLatex('e^{2x}'))).toBe('sup("e","2x")');
  });

  it('parses a sum with limits', () => {
    expect(shape(parseLatex('\\sum_{i=1}^{n} i'))).toBe('sum("i=1","n"," i")');
  });

  it('parses an integral with limits', () => {
    expect(shape(parseLatex('\\int_{a}^{b} x'))).toBe('integral("a","b"," x")');
  });

  it('parses \\left( … \\right) as brackets', () => {
    expect(shape(parseLatex('\\left(x+1\\right)'))).toBe('round["x+1"]');
  });

  it('parses square brackets from \\left[ … \\right]', () => {
    expect(shape(parseLatex('\\left[x\\right]'))).toBe('square["x"]');
  });
});

describe('parseLatex — symbols and text', () => {
  it('maps greek letters to characters', () => {
    expect(shape(parseLatex('\\pi'))).toBe('"π"');
    expect(shape(parseLatex('\\alpha\\beta'))).toBe('"α"+"β"');
  });

  it('maps relational and arithmetic operators', () => {
    expect(shape(parseLatex('\\leq'))).toBe('"≤"');
    expect(shape(parseLatex('\\cdot'))).toBe('"·"');
    expect(shape(parseLatex('\\infty'))).toBe('"∞"');
  });

  it('keeps function names upright', () => {
    expect(shape(parseLatex('\\sin'))).toBe('"sin"');
  });

  it('unwraps \\text{...}', () => {
    expect(shape(parseLatex('\\text{ако}'))).toBe('"ако"');
  });

  it('keeps an unknown macro visible instead of dropping it', () => {
    expect(shape(parseLatex('\\weirdmacro'))).toBe('"weirdmacro"');
  });

  it('handles escaped punctuation', () => {
    expect(shape(parseLatex('\\{'))).toBe('"{"');
  });
});

describe('parseLatex — robustness', () => {
  it('returns nothing for empty input', () => {
    expect(parseLatex('')).toEqual([]);
    expect(parseLatex(undefined as any)).toEqual([]);
  });

  it('survives an unclosed group without hanging', () => {
    expect(() => parseLatex('\\frac{1}{')).not.toThrow();
    expect(() => parseLatex('x^{')).not.toThrow();
  });

  it('survives a stray closing brace', () => {
    expect(() => parseLatex('x}')).not.toThrow();
  });

  it('parses a realistic mixed expression', () => {
    const nodes = parseLatex('\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('fraction');
    expect(shape(nodes)).toContain('sqrt(');
    expect(shape(nodes)).toContain('"±"');
  });
});

describe('splitMathSegments', () => {
  it('splits inline math out of prose', () => {
    expect(splitMathSegments('Реши $x+1=2$ сега')).toEqual([
      { type: 'text', content: 'Реши ' },
      { type: 'math', content: 'x+1=2', display: false },
      { type: 'text', content: ' сега' },
    ]);
  });

  it('marks display math', () => {
    expect(splitMathSegments('$$x^2$$')).toEqual([
      { type: 'math', content: 'x^2', display: true },
    ]);
  });

  it('handles several formulas in one string', () => {
    const segments = splitMathSegments('$a$ и $b$');
    expect(segments.filter(s => s.type === 'math')).toHaveLength(2);
  });

  it('returns plain prose untouched', () => {
    expect(splitMathSegments('нема математика тука')).toEqual([
      { type: 'text', content: 'нема математика тука' },
    ]);
  });

  it('handles empty and missing input', () => {
    expect(splitMathSegments('')).toEqual([]);
    expect(splitMathSegments(undefined as any)).toEqual([]);
  });

  it('leaves a lone dollar sign as text', () => {
    expect(splitMathSegments('цена 5$')).toEqual([{ type: 'text', content: 'цена 5$' }]);
  });
});
