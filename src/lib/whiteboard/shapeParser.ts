/**
 * Deterministic "text → geometry" parser for the whiteboard
 * (EXPERT_LEVEL_MASTER_PLAN, Phase 4.6).
 *
 * A teacher types "триаголник ABC" or "круг со центар A и радиус 5" and gets a
 * real construction — no model call, no latency, no hallucinated coordinates.
 * Everything is grammar-driven, so the same sentence always yields the same
 * figure, and unknown phrases fail loudly instead of guessing.
 *
 * Output is a JSXGraph script that the existing GeometryWorkspace renderer
 * executes, so nothing new has to be installed or wired.
 */

export type ShapeKind = 'point' | 'segment' | 'line' | 'polygon' | 'circle' | 'functiongraph' | 'angle';

export interface ShapeSpec {
  kind: ShapeKind;
  /** Point labels this shape refers to, in order. */
  labels: string[];
  /** Literal coordinates, for points declared as A(2,3). */
  coords?: [number, number];
  /** Circle radius, when given numerically. */
  radius?: number;
  /** Right-hand side of a function definition, already in JS syntax. */
  expression?: string;
  /** Function name, e.g. 'f' in f(x)=x^2. */
  functionName?: string;
}

export interface ParseResult {
  shapes: ShapeSpec[];
  /** Phrases the grammar did not recognize — surfaced to the teacher, never guessed at. */
  unrecognized: string[];
}

/** Keyword table; every shape reads both Macedonian and English. */
const KEYWORDS = {
  point: ['точка', 'point'],
  segment: ['отсечка', 'segment'],
  line: ['права', 'line'],
  triangle: ['триаголник', 'triangle'],
  polygon: ['многуаголник', 'полигон', 'polygon', 'четириаголник', 'quadrilateral'],
  circle: ['кружница', 'круг', 'circle'],
  angle: ['агол', 'angle'],
};

const RADIUS_WORDS = ['радиус', 'radius', 'r'];

/** Default positions for labels used before they were ever given coordinates. */
const FALLBACK_POSITIONS: Array<[number, number]> = [
  [-3, -2], [3, -2], [0, 3], [-3, 3], [3, 3], [0, -3], [-5, 0], [5, 0],
];

function hasKeyword(text: string, words: string[]): boolean {
  return words.some(word => new RegExp(`(^|[^\\p{L}])${escapeRegex(word)}([^\\p{L}]|$)`, 'iu').test(text));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Point labels are single uppercase Latin letters with an optional digit index,
 * and they are routinely written run together ("ABC" for a triangle).
 *
 * Only tokens made entirely of such labels count, so the capital in "Point A"
 * or "Круг" is never mistaken for a vertex.
 */
function extractLabels(text: string): string[] {
  const tokens = text.match(/[\p{L}\d]+/gu) ?? [];
  const labels: string[] = [];

  for (const token of tokens) {
    if (!/^(?:[A-Z]\d?)+$/.test(token)) continue;
    labels.push(...(token.match(/[A-Z]\d?/g) ?? []));
  }

  return [...new Set(labels)];
}

/** Reads "A(2,3)" / "A(2; 3)" declarations, with comma or point decimals. */
function extractCoordinatePoints(text: string): ShapeSpec[] {
  const out: ShapeSpec[] = [];
  const pattern = /\b([A-Z]\d?)\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    out.push({
      kind: 'point',
      labels: [match[1]],
      coords: [toNumber(match[2]), toNumber(match[3])],
    });
  }
  return out;
}

function toNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

/** Converts school notation into the JS the JSXGraph function graph expects. */
export function toJsExpression(source: string): string {
  return source
    .replace(/\s+/g, '')
    .replace(/\^/g, '**')
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/\b(sin|cos|tan|sqrt|abs|log|exp)\b/g, 'Math.$1')
    .replace(/\bln\b/g, 'Math.log')
    .replace(/\bpi\b|π/gi, 'Math.PI');
}

/** Reads "f(x)=x^2-1" style definitions. */
function extractFunctions(text: string): ShapeSpec[] {
  const out: ShapeSpec[] = [];
  const pattern = /\b([a-z])\s*\(\s*x\s*\)\s*=\s*([^,;\n]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const expression = toJsExpression(match[2]);
    if (!expression) continue;
    out.push({ kind: 'functiongraph', labels: [], functionName: match[1], expression });
  }
  return out;
}

function extractRadius(text: string): number | undefined {
  for (const word of RADIUS_WORDS) {
    const match = text.match(new RegExp(`${escapeRegex(word)}\\s*[=:]?\\s*(\\d+(?:[.,]\\d+)?)`, 'iu'));
    if (match) return toNumber(match[1]);
  }
  // "круг со центар A и 5" — a bare number is the radius when a circle is meant.
  const bare = text.match(/(?:^|[^\d(])(\d+(?:[.,]\d+)?)\s*$/);
  return bare ? toNumber(bare[1]) : undefined;
}

/** Parses one clause (a single shape instruction). */
function parseClause(clause: string): ShapeSpec[] | null {
  const text = clause.trim();
  if (!text) return null;

  const functions = extractFunctions(text);
  if (functions.length > 0) return functions;

  const coordPoints = extractCoordinatePoints(text);
  const labels = extractLabels(text);

  if (hasKeyword(text, KEYWORDS.circle)) {
    const radius = extractRadius(text);
    if (labels.length >= 1 && radius !== undefined) {
      return [...coordPoints, { kind: 'circle', labels: [labels[0]], radius }];
    }
    if (labels.length >= 2) {
      // "кружница низ A и B" — B lies on the circle centred at A
      return [...coordPoints, { kind: 'circle', labels: [labels[0], labels[1]] }];
    }
    return null;
  }

  if (hasKeyword(text, KEYWORDS.triangle) && labels.length >= 3) {
    return [...coordPoints, { kind: 'polygon', labels: labels.slice(0, 3) }];
  }

  if (hasKeyword(text, KEYWORDS.polygon) && labels.length >= 3) {
    return [...coordPoints, { kind: 'polygon', labels }];
  }

  if (hasKeyword(text, KEYWORDS.angle) && labels.length >= 3) {
    return [...coordPoints, { kind: 'angle', labels: labels.slice(0, 3) }];
  }

  if (hasKeyword(text, KEYWORDS.segment) && labels.length >= 2) {
    return [...coordPoints, { kind: 'segment', labels: labels.slice(0, 2) }];
  }

  if (hasKeyword(text, KEYWORDS.line) && labels.length >= 2) {
    return [...coordPoints, { kind: 'line', labels: labels.slice(0, 2) }];
  }

  if (hasKeyword(text, KEYWORDS.point) || coordPoints.length > 0) {
    if (coordPoints.length > 0) return coordPoints;
    return labels.map(label => ({ kind: 'point' as const, labels: [label] }));
  }

  // "AB" alone is a segment; a bare label alone is a point.
  const compact = text.replace(/\s+/g, '');
  if (/^[A-Z]\d?[A-Z]\d?$/.test(compact) && labels.length === 2) {
    return [{ kind: 'segment', labels }];
  }
  if (/^[A-Z]\d?$/.test(compact)) {
    return [{ kind: 'point', labels }];
  }

  return null;
}

/**
 * Parses a free-text description into shape specs.
 * Clauses are separated by commas, semicolons, newlines or the word "и"/"and".
 */
export function parseShapeDescription(input: string): ParseResult {
  const shapes: ShapeSpec[] = [];
  const unrecognized: string[] = [];

  const clauses = splitClauses(input);
  for (const clause of clauses) {
    const parsed = parseClause(clause);
    if (parsed && parsed.length > 0) shapes.push(...parsed);
    else if (clause.trim()) unrecognized.push(clause.trim());
  }

  return { shapes: dedupePoints(shapes), unrecognized };
}

/**
 * Splits on commas, semicolons and newlines — but never inside parentheses,
 * so a coordinate pair like `A(2,3)` stays one clause.
 *
 * "и"/"and" is deliberately not a separator: it usually joins two labels of a
 * single shape ("права низ A и B").
 */
function splitClauses(input: string): string[] {
  const clauses: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);

    // In Macedonian a comma between two digits is a decimal separator
    // ("радиус 2,5"), never a clause break.
    const isDecimalComma =
      char === ',' && /\d/.test(input[i - 1] ?? '') && /\d/.test(input[i + 1] ?? '');

    if (depth === 0 && !isDecimalComma && (char === ',' || char === ';' || char === '\n')) {
      clauses.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  clauses.push(current);

  return clauses.map(part => part.trim()).filter(Boolean);
}

/** A point declared twice (once with coordinates) keeps the coordinates. */
function dedupePoints(shapes: ShapeSpec[]): ShapeSpec[] {
  const out: ShapeSpec[] = [];
  for (const shape of shapes) {
    if (shape.kind !== 'point') {
      out.push(shape);
      continue;
    }
    const existingIndex = out.findIndex(s => s.kind === 'point' && s.labels[0] === shape.labels[0]);
    if (existingIndex === -1) {
      out.push(shape);
    } else if (shape.coords && !out[existingIndex].coords) {
      out[existingIndex] = shape;
    }
  }
  return out;
}

/**
 * Renders shape specs as a JSXGraph script for GeometryWorkspace.
 * Points referenced but never given coordinates get deterministic fallback
 * positions, so the same description always draws the same figure.
 */
export function buildJsxGraphScript(shapes: ShapeSpec[]): string {
  if (shapes.length === 0) return '';

  const lines: string[] = [];
  const declared = new Map<string, string>();
  let fallbackIndex = 0;

  const ensurePoint = (label: string, coords?: [number, number]) => {
    if (declared.has(label)) return declared.get(label)!;
    const variable = `p_${label.replace(/\W/g, '')}`;
    const position = coords ?? FALLBACK_POSITIONS[fallbackIndex++ % FALLBACK_POSITIONS.length];
    lines.push(
      `var ${variable} = board.create('point', [${position[0]}, ${position[1]}], {name: '${label}', size: 3, fixed: false});`
    );
    declared.set(label, variable);
    return variable;
  };

  // Declare every explicitly positioned point first, so references resolve to
  // the teacher's coordinates rather than to a fallback.
  for (const shape of shapes) {
    if (shape.kind === 'point' && shape.coords) ensurePoint(shape.labels[0], shape.coords);
  }

  for (const shape of shapes) {
    switch (shape.kind) {
      case 'point':
        ensurePoint(shape.labels[0], shape.coords);
        break;

      case 'segment': {
        const [a, b] = shape.labels.map(l => ensurePoint(l));
        lines.push(`board.create('segment', [${a}, ${b}], {strokeWidth: 2});`);
        break;
      }

      case 'line': {
        const [a, b] = shape.labels.map(l => ensurePoint(l));
        lines.push(`board.create('line', [${a}, ${b}], {strokeWidth: 2});`);
        break;
      }

      case 'polygon': {
        const vertices = shape.labels.map(l => ensurePoint(l));
        lines.push(`board.create('polygon', [${vertices.join(', ')}], {fillOpacity: 0.15});`);
        break;
      }

      case 'angle': {
        const [a, b, c] = shape.labels.map(l => ensurePoint(l));
        lines.push(`board.create('angle', [${a}, ${b}, ${c}], {radius: 1});`);
        break;
      }

      case 'circle': {
        const center = ensurePoint(shape.labels[0]);
        if (shape.radius !== undefined) {
          lines.push(`board.create('circle', [${center}, ${shape.radius}], {strokeWidth: 2});`);
        } else {
          const through = ensurePoint(shape.labels[1]);
          lines.push(`board.create('circle', [${center}, ${through}], {strokeWidth: 2});`);
        }
        break;
      }

      case 'functiongraph':
        lines.push(
          `board.create('functiongraph', [function(x) { return ${shape.expression}; }], {strokeWidth: 2, name: '${shape.functionName ?? 'f'}'});`
        );
        break;
    }
  }

  return lines.join('\n');
}

/** One-shot helper: description in, renderable jsxgraph fence out. */
export function describeToJsxGraphBlock(input: string): { code: string; unrecognized: string[] } {
  const { shapes, unrecognized } = parseShapeDescription(input);
  return { code: buildJsxGraphScript(shapes), unrecognized };
}
