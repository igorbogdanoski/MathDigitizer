import { describe, it, expect } from 'vitest';
import {
  ReplotSeries,
  buildReplotScript,
  computeBoundingBox,
  fitLatexToExpression,
  pointsToCsv,
  toJsxGraphBlock,
} from './replot';

const series = (points: Array<[number, number]>, color = '#e11d48', name?: string): ReplotSeries => ({
  points: points.map(([x, y]) => ({ x, y })),
  color,
  ...(name ? { name } : {}),
});

describe('computeBoundingBox', () => {
  it('contains every point with a margin', () => {
    const { box } = computeBoundingBox([series([[0, 0], [10, 20]])], 0.1);
    const [left, top, right, bottom] = box;

    expect(left).toBeLessThan(0);
    expect(right).toBeGreaterThan(10);
    expect(bottom).toBeLessThan(0);
    expect(top).toBeGreaterThan(20);
  });

  it('uses the JSXGraph order — left, top, right, bottom', () => {
    const [left, top, right, bottom] = computeBoundingBox([series([[0, 0], [10, 20]])]).box;
    expect(left).toBeLessThan(right);
    expect(top).toBeGreaterThan(bottom);
  });

  it('does not collapse when every point shares an x', () => {
    const [left, , right] = computeBoundingBox([series([[5, 0], [5, 10]])]).box;
    expect(right).toBeGreaterThan(left);
  });

  it('does not collapse when every point shares a y', () => {
    const [, top, , bottom] = computeBoundingBox([series([[0, 5], [10, 5]])]).box;
    expect(top).toBeGreaterThan(bottom);
  });

  it('falls back to a default window with no points', () => {
    expect(computeBoundingBox([]).box).toEqual([-5, 5, 5, -5]);
    expect(computeBoundingBox([series([])]).box).toEqual([-5, 5, 5, -5]);
  });

  it('ignores non-finite points', () => {
    const withGarbage: ReplotSeries = { points: [{ x: 0, y: 0 }, { x: NaN, y: 5 }, { x: 10, y: 10 }], color: '#000' };
    const [, top] = computeBoundingBox([withGarbage]).box;
    expect(Number.isFinite(top)).toBe(true);
  });
});

describe('buildReplotScript', () => {
  const points = series([[0, 0], [1, 2], [2, 4]]);

  it('draws both axes', () => {
    const script = buildReplotScript({ series: [points] });
    expect(script).toContain("board.create('axis'");
    expect(script.match(/board\.create\('axis'/g)).toHaveLength(2);
  });

  it('plots one marker per point, in the dataset colour', () => {
    const script = buildReplotScript({ series: [points] });
    expect(script.match(/board\.create\('point'/g)).toHaveLength(3);
    expect(script).toContain('#e11d48');
  });

  it('keeps datasets apart', () => {
    const script = buildReplotScript({ series: [points, series([[5, 5]], '#16a34a')] });
    expect(script).toContain('#16a34a');
    expect(script.match(/board\.create\('point'/g)).toHaveLength(4);
  });

  it('plots the function only across the measured range', () => {
    // Extrapolating a fit beyond its data would show unearned confidence
    const script = buildReplotScript({ series: [points], functionExpression: '2*x' });
    expect(script).toContain("board.create('functiongraph'");
    expect(script).toContain('return 2*x;');
    // Range args come right after the function, before the styling object
    expect(script).toMatch(/\},\s*0,\s*2\]/);
  });

  it('omits the curve when no expression was given', () => {
    expect(buildReplotScript({ series: [points] })).not.toContain('functiongraph');
  });

  it('sets a bounding box before drawing', () => {
    expect(buildReplotScript({ series: [points] }).split('\n')[0]).toContain('setBoundingBox');
  });

  it('survives empty series', () => {
    expect(() => buildReplotScript({ series: [] })).not.toThrow();
  });
});

describe('fitLatexToExpression', () => {
  it('converts a linear fit', () => {
    expect(fitLatexToExpression('y = 3 + 2x')).toBe('3+2*x');
  });

  it('converts a quadratic fit', () => {
    expect(fitLatexToExpression('y = 1 - 2x + 3x^2')).toBe('1-2*x+3*Math.pow(x,2)');
  });

  it('converts an exponential fit', () => {
    expect(fitLatexToExpression('y = 2e^{0.5x}')).toContain('Math.exp(0.5*x)');
  });

  it('converts a power fit', () => {
    expect(fitLatexToExpression('y = 3x^{2}')).toContain('Math.pow(x,2)');
  });

  it('rejects anything outside the fitters vocabulary', () => {
    expect(fitLatexToExpression('y = \\sin(x)')).toBeNull();
    expect(fitLatexToExpression('y = alert(1)')).toBeNull();
  });

  it('handles empty input', () => {
    expect(fitLatexToExpression('')).toBeNull();
    expect(fitLatexToExpression('y = ')).toBeNull();
  });
});

describe('toJsxGraphBlock', () => {
  it('wraps the script in the fence the renderer routes on', () => {
    const block = toJsxGraphBlock('board.create();');
    expect(block.startsWith('```jsxgraph')).toBe(true);
    expect(block.trimEnd().endsWith('```')).toBe(true);
  });
});

describe('pointsToCsv', () => {
  it('writes a header and one row per point', () => {
    const csv = pointsToCsv([series([[0, 0], [1, 2]], '#000', 'Мерење 1')]);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('x,y,dataset');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('0,0,Мерење 1');
  });

  it('names unnamed datasets by index', () => {
    expect(pointsToCsv([series([[1, 1]])])).toContain('dataset 1');
  });

  it('strips characters that would break the row', () => {
    expect(pointsToCsv([series([[1, 1]], '#000', 'a,b"c')])).toContain('a b c');
  });

  it('skips non-finite points', () => {
    const broken: ReplotSeries = { points: [{ x: 1, y: 1 }, { x: NaN, y: 2 }], color: '#000' };
    expect(pointsToCsv([broken]).split('\r\n')).toHaveLength(2);
  });
});
