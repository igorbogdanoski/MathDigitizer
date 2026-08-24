/**
 * Re-plotting digitized data on real axes
 * (EXPERT_LEVEL_MASTER_PLAN, 8.4).
 *
 * The digitizer could show the points on the source image, but never on proper
 * axes — so a teacher could not see the extracted function beside the points it
 * was supposed to describe. This builds the JSXGraph script for that plot,
 * which the existing GeometryWorkspace renders.
 *
 * Pure: the bounding box, the axis ticks and the script are computed here and
 * only rendered elsewhere.
 */
import { Point } from './regression';

export interface ReplotSeries {
  points: Point[];
  /** Hex colour for this dataset's markers. */
  color: string;
  name?: string;
}

export interface ReplotOptions {
  series: ReplotSeries[];
  /** JS expression in `x`, plotted as a curve over the data range. */
  functionExpression?: string;
  /** Padding around the data as a share of its span. */
  padding?: number;
}

export interface BoundingBox {
  /** JSXGraph order: [left, top, right, bottom]. */
  box: [number, number, number, number];
}

/**
 * Bounding box that contains every point with a margin.
 *
 * A degenerate range (all points sharing an x or y) would collapse the axis, so
 * it falls back to a unit window around the value.
 */
export function computeBoundingBox(series: readonly ReplotSeries[], padding = 0.1): BoundingBox {
  const points = series.flatMap(s => s.points).filter(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );

  if (points.length === 0) return { box: [-5, 5, 5, -5] };

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  const [left, right] = padRange(Math.min(...xs), Math.max(...xs), padding);
  const [bottom, top] = padRange(Math.min(...ys), Math.max(...ys), padding);

  return { box: [left, top, right, bottom] };
}

function padRange(min: number, max: number, padding: number): [number, number] {
  const span = max - min;
  if (span < 1e-9) return [min - 1, max + 1];
  const margin = span * padding;
  return [min - margin, max + margin];
}

const num = (value: number): string => String(Math.round(value * 100000) / 100000);

/**
 * Builds the JSXGraph script: axes, the digitized points, and the fitted curve
 * over the range the data actually covers.
 */
export function buildReplotScript(options: ReplotOptions): string {
  const { series, functionExpression, padding = 0.1 } = options;
  const { box } = computeBoundingBox(series, padding);

  const lines: string[] = [
    `board.setBoundingBox([${box.map(num).join(', ')}], true);`,
    `board.create('axis', [[0, 0], [1, 0]], {name: 'x'});`,
    `board.create('axis', [[0, 0], [0, 1]], {name: 'y'});`,
  ];

  series.forEach((s, seriesIndex) => {
    s.points
      .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      .forEach((p, i) => {
        lines.push(
          `board.create('point', [${num(p.x)}, ${num(p.y)}], ` +
          `{name: '', size: 2, fixed: true, strokeColor: '${s.color}', fillColor: '${s.color}', ` +
          `withLabel: false, id: 'p_${seriesIndex}_${i}'});`
        );
      });
  });

  if (functionExpression) {
    // Plotted only across the measured range — extrapolating a fit beyond the
    // data it came from would show confidence the data does not support.
    const xs = series.flatMap(s => s.points.map(p => p.x)).filter(Number.isFinite);
    if (xs.length > 0) {
      lines.push(
        `board.create('functiongraph', [function(x) { return ${functionExpression}; }, ` +
        `${num(Math.min(...xs))}, ${num(Math.max(...xs))}], ` +
        `{strokeColor: '#4f46e5', strokeWidth: 2});`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Converts a fit's LaTeX into a JS expression the plot can evaluate.
 * Handles the forms the fitters produce; anything else returns null rather than
 * risking a malformed expression in the plot.
 */
export function fitLatexToExpression(latex: string): string | null {
  const body = (latex || '').replace(/^\s*y\s*=\s*/, '').trim();
  if (!body) return null;

  const expression = body
    .replace(/\s+/g, '')
    .replace(/e\^\{([^}]+)\}/g, 'Math.exp($1)')
    .replace(/x\^\{([^}]+)\}/g, 'Math.pow(x,$1)')
    .replace(/x\^(\d+)/g, 'Math.pow(x,$1)')
    .replace(/(\d)x/g, '$1*x')
    .replace(/(\d)Math\./g, '$1*Math.');

  // Only allow the vocabulary the fitters emit.
  return /^[-+*/().,\dxMathexppow\s]*$/.test(expression) ? expression : null;
}

/** Wraps the script in the fence MathRenderer routes to GeometryWorkspace. */
export function toJsxGraphBlock(script: string): string {
  return `\`\`\`jsxgraph\n${script}\n\`\`\``;
}

/** CSV of the digitized points, for a teacher who wants the raw numbers. */
export function pointsToCsv(series: readonly ReplotSeries[]): string {
  const rows = ['x,y,dataset'];
  series.forEach((s, index) => {
    for (const p of s.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      rows.push(`${p.x},${p.y},${(s.name || `dataset ${index + 1}`).replace(/[",]/g, ' ')}`);
    }
  });
  return rows.join('\r\n');
}
