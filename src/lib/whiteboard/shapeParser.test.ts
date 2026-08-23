import { describe, it, expect } from 'vitest';
import {
  parseShapeDescription,
  buildJsxGraphScript,
  describeToJsxGraphBlock,
  toJsExpression,
} from './shapeParser';

const parse = (text: string) => parseShapeDescription(text).shapes;

describe('parseShapeDescription — points', () => {
  it('reads coordinates in Macedonian', () => {
    expect(parse('точка A(2,3)')).toEqual([{ kind: 'point', labels: ['A'], coords: [2, 3] }]);
  });

  it('reads coordinates in English and with a semicolon separator', () => {
    expect(parse('point B(-1; 4)')).toEqual([{ kind: 'point', labels: ['B'], coords: [-1, 4] }]);
  });

  it('accepts decimal coordinates written with a decimal point', () => {
    expect(parse('точка C(1.5; -2.5)')[0].coords).toEqual([1.5, -2.5]);
  });

  it('accepts a bare label as a point', () => {
    expect(parse('A')).toEqual([{ kind: 'point', labels: ['A'] }]);
  });

  it('keeps the coordinates when a point is mentioned twice', () => {
    const shapes = parse('точка A(2,3), точка A');
    expect(shapes).toHaveLength(1);
    expect(shapes[0].coords).toEqual([2, 3]);
  });
});

describe('parseShapeDescription — lines and polygons', () => {
  it('parses a segment', () => {
    expect(parse('отсечка AB')).toEqual([{ kind: 'segment', labels: ['A', 'B'] }]);
    expect(parse('segment CD')).toEqual([{ kind: 'segment', labels: ['C', 'D'] }]);
  });

  it('treats a bare label pair as a segment', () => {
    expect(parse('AB')).toEqual([{ kind: 'segment', labels: ['A', 'B'] }]);
  });

  it('parses a line through two points', () => {
    expect(parse('права низ A и B')).toEqual([{ kind: 'line', labels: ['A', 'B'] }]);
  });

  it('parses a triangle', () => {
    expect(parse('триаголник ABC')).toEqual([{ kind: 'polygon', labels: ['A', 'B', 'C'] }]);
  });

  it('parses a general polygon with more vertices', () => {
    expect(parse('многуаголник ABCD')).toEqual([{ kind: 'polygon', labels: ['A', 'B', 'C', 'D'] }]);
  });

  it('parses an angle', () => {
    expect(parse('агол ABC')).toEqual([{ kind: 'angle', labels: ['A', 'B', 'C'] }]);
  });
});

describe('parseShapeDescription — circles', () => {
  it('parses centre and numeric radius', () => {
    expect(parse('круг со центар A и радиус 5')).toEqual([{ kind: 'circle', labels: ['A'], radius: 5 }]);
  });

  it('parses a circle through a second point', () => {
    expect(parse('кружница низ A и B')).toEqual([{ kind: 'circle', labels: ['A', 'B'] }]);
  });

  it('accepts a decimal radius written with a comma', () => {
    expect(parse('круг со центар A радиус 2,5')[0].radius).toBe(2.5);
  });
});

describe('parseShapeDescription — functions', () => {
  it('parses a quadratic', () => {
    const [shape] = parse('f(x)=x^2');
    expect(shape.kind).toBe('functiongraph');
    expect(shape.functionName).toBe('f');
    expect(shape.expression).toBe('x**2');
  });

  it('converts school notation into JS', () => {
    expect(toJsExpression('2x^2 - 3')).toBe('2*x**2-3');
    expect(toJsExpression('sin(x)')).toBe('Math.sin(x)');
    expect(toJsExpression('sqrt(x) + pi')).toBe('Math.sqrt(x)+Math.PI');
  });
});

describe('parseShapeDescription — multiple clauses and failures', () => {
  it('parses several shapes from one description', () => {
    const shapes = parse('точка A(0,0), точка B(4,0), отсечка AB, круг со центар A и радиус 4');
    expect(shapes.map(s => s.kind)).toEqual(['point', 'point', 'segment', 'circle']);
  });

  it('reports what it did not understand instead of guessing', () => {
    const result = parseShapeDescription('точка A(1,1), нацртај нешто убаво');
    expect(result.shapes).toHaveLength(1);
    expect(result.unrecognized).toEqual(['нацртај нешто убаво']);
  });

  it('is deterministic — the same text always yields the same shapes', () => {
    const text = 'триаголник ABC, круг со центар A и радиус 3';
    expect(parse(text)).toEqual(parse(text));
  });

  it('returns nothing for empty input', () => {
    expect(parseShapeDescription('')).toEqual({ shapes: [], unrecognized: [] });
  });
});

describe('buildJsxGraphScript', () => {
  it('emits point creation with the given coordinates and name', () => {
    const code = buildJsxGraphScript(parse('точка A(2,3)'));
    expect(code).toContain("board.create('point', [2, 3]");
    expect(code).toContain("name: 'A'");
  });

  it('declares each referenced point exactly once', () => {
    const code = buildJsxGraphScript(parse('триаголник ABC, отсечка AB'));
    expect(code.match(/board\.create\('point'/g)).toHaveLength(3);
    expect(code).toContain("board.create('polygon'");
    expect(code).toContain("board.create('segment'");
  });

  it('prefers the teacher\'s coordinates over fallback positions', () => {
    const code = buildJsxGraphScript(parse('отсечка AB, точка A(7,7)'));
    expect(code).toContain('[7, 7]');
  });

  it('gives unpositioned points deterministic fallback coordinates', () => {
    const first = buildJsxGraphScript(parse('триаголник ABC'));
    const second = buildJsxGraphScript(parse('триаголник ABC'));
    expect(first).toBe(second);
    expect(first).toContain("board.create('point'");
  });

  it('emits a circle by radius and a circle by point', () => {
    expect(buildJsxGraphScript(parse('круг со центар A и радиус 5'))).toContain("board.create('circle', [p_A, 5]");
    expect(buildJsxGraphScript(parse('кружница низ A и B'))).toContain("board.create('circle', [p_A, p_B]");
  });

  it('emits a function graph as a real JS callback', () => {
    const code = buildJsxGraphScript(parse('f(x)=x^2-1'));
    expect(code).toContain("board.create('functiongraph', [function(x) { return x**2-1; }]");
  });

  it('emits nothing for no shapes', () => {
    expect(buildJsxGraphScript([])).toBe('');
  });
});

describe('describeToJsxGraphBlock', () => {
  it('returns renderable code plus anything it could not parse', () => {
    const { code, unrecognized } = describeToJsxGraphBlock('триаголник ABC, бла бла');
    expect(code).toContain("board.create('polygon'");
    expect(unrecognized).toEqual(['бла бла']);
  });
});
