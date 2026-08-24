/**
 * Ink geometry — pure functions behind the professional pen/tablet experience
 * (EXPERT_LEVEL_MASTER_PLAN, Phase 4.1 and 4.3).
 *
 * Nothing here touches the DOM, Konva or the network, so the feel of the pen
 * (width response, smoothing, palm rejection) is unit-testable in isolation.
 */

export interface InkPoint {
  x: number;
  y: number;
  /** Normalized 0–1 stylus pressure; 0.5 is the neutral value browsers report for mouse/touch. */
  pressure?: number;
  /** Timestamp in ms, used for velocity-based tapering. */
  t?: number;
}

export const NEUTRAL_PRESSURE = 0.5;

export function distance(a: InkPoint, b: InkPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Drops points closer than `minDistance` to the previously kept one.
 * Pointer devices fire far more events than the ink needs; decimating first
 * makes both the smoothing and the network stream cheaper. The first and last
 * points are always preserved so strokes never lose their endpoints.
 */
export function decimatePoints(points: InkPoint[], minDistance = 2): InkPoint[] {
  if (points.length <= 2) return [...points];

  const kept: InkPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (distance(kept[kept.length - 1], points[i]) >= minDistance) {
      kept.push(points[i]);
    }
  }
  kept.push(points[points.length - 1]);
  return kept;
}

/**
 * Quadratic-midpoint smoothing: the curve passes through the midpoint of each
 * pair of raw points, using the raw point itself as the control point. This is
 * the standard way to turn jittery pointer samples into a continuous line
 * without the overshoot that Konva's `tension` produces on sharp corners.
 */
export function smoothStroke(points: InkPoint[], samplesPerSegment = 6): InkPoint[] {
  if (points.length < 3) return [...points];
  const samples = Math.max(1, Math.floor(samplesPerSegment));

  const out: InkPoint[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i];
    const start = midpoint(points[i - 1], control);
    const end = midpoint(control, points[i + 1]);

    for (let s = 1; s <= samples; s++) {
      out.push(quadraticAt(start, control, end, s / samples));
    }
  }

  out.push(points[points.length - 1]);
  return out;
}

/**
 * Incremental counterpart of `smoothStroke`: given the raw samples collected so
 * far, returns only the curve points that the newest sample makes final.
 *
 * Streaming these instead of the raw samples is what keeps the local ink and
 * every remote copy byte-identical — both sides append the same points, so a
 * stroke never renders differently on the board that drew it.
 *
 * Feeding every raw point through this and appending the last raw point on
 * pointer-up produces exactly `smoothStroke(raw)`.
 */
export function smoothTail(raw: InkPoint[], samplesPerSegment = 6): InkPoint[] {
  if (raw.length < 3) return [];
  const samples = Math.max(1, Math.floor(samplesPerSegment));

  const control = raw[raw.length - 2];
  const start = midpoint(raw[raw.length - 3], control);
  const end = midpoint(control, raw[raw.length - 1]);

  const out: InkPoint[] = [];
  for (let s = 1; s <= samples; s++) {
    out.push(quadraticAt(start, control, end, s / samples));
  }
  return out;
}

function midpoint(a: InkPoint, b: InkPoint): InkPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    pressure: averagePressure(a, b),
    t: a.t !== undefined && b.t !== undefined ? (a.t + b.t) / 2 : a.t ?? b.t,
  };
}

function averagePressure(a: InkPoint, b: InkPoint): number | undefined {
  if (a.pressure === undefined && b.pressure === undefined) return undefined;
  return ((a.pressure ?? NEUTRAL_PRESSURE) + (b.pressure ?? NEUTRAL_PRESSURE)) / 2;
}

function quadraticAt(start: InkPoint, control: InkPoint, end: InkPoint, u: number): InkPoint {
  const inv = 1 - u;
  const w0 = inv * inv;
  const w1 = 2 * inv * u;
  const w2 = u * u;
  return {
    x: w0 * start.x + w1 * control.x + w2 * end.x,
    y: w0 * start.y + w1 * control.y + w2 * end.y,
    pressure: start.pressure !== undefined || end.pressure !== undefined
      ? inv * (start.pressure ?? NEUTRAL_PRESSURE) + u * (end.pressure ?? NEUTRAL_PRESSURE)
      : undefined,
    t: start.t !== undefined && end.t !== undefined ? inv * start.t + u * end.t : undefined,
  };
}

/** Pointer speed in px/ms between two samples (0 when timestamps are missing). */
export function pointVelocity(a: InkPoint, b: InkPoint): number {
  if (a.t === undefined || b.t === undefined) return 0;
  const dt = b.t - a.t;
  if (dt <= 0) return 0;
  return distance(a, b) / dt;
}

export interface StrokeWidthOptions {
  baseWidth: number;
  pressure?: number;
  /** px/ms; faster strokes taper thinner, the way real ink behaves. */
  velocity?: number;
  pointerType?: string;
  minRatio?: number;
  maxRatio?: number;
}

/**
 * Resolves the width of one ink sample.
 *
 * A real stylus reports pressure, so its width follows the hand. Mouse and
 * touch always report the neutral 0.5, so for them only velocity tapering
 * applies — otherwise every mouse line would render at half width.
 */
export function resolveStrokeWidth({
  baseWidth,
  pressure,
  velocity = 0,
  pointerType = 'mouse',
  minRatio = 0.35,
  maxRatio = 1.8,
}: StrokeWidthOptions): number {
  const hasRealPressure = pointerType === 'pen' && typeof pressure === 'number' && pressure > 0;
  const pressureRatio = hasRealPressure ? 0.4 + 1.2 * pressure : 1;

  // Tapering saturates around 3 px/ms — a fast flick, not a normal stroke.
  const velocityRatio = 1 - 0.35 * Math.min(1, Math.max(0, velocity) / 3);

  const ratio = clamp(pressureRatio * velocityRatio, minRatio, maxRatio);
  return round2(baseWidth * ratio);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Per-point widths for a stroke, derived from pressure and velocity. */
export function buildStrokeWidths(
  points: InkPoint[],
  baseWidth: number,
  pointerType = 'mouse'
): number[] {
  return points.map((point, i) => {
    const previous = i > 0 ? points[i - 1] : undefined;
    return resolveStrokeWidth({
      baseWidth,
      pressure: point.pressure,
      velocity: previous ? pointVelocity(previous, point) : 0,
      pointerType,
    });
  });
}

export interface WidthRun {
  /** Flat [x, y, x, y, …] as Konva's Line expects. */
  points: number[];
  width: number;
}

/**
 * Groups consecutive samples whose width rounds into the same bucket, so a
 * variable-width stroke renders as a handful of polylines instead of one line
 * per sample. Without this, variable width would mean thousands of Konva nodes
 * on a busy board.
 */
export function buildWidthRuns(points: InkPoint[], widths: number[], bucket = 0.5): WidthRun[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ points: [points[0].x, points[0].y], width: widths[0] ?? 1 }];
  }

  const runs: WidthRun[] = [];
  let current: WidthRun | null = null;
  let currentBucket: number | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const segmentWidth = ((widths[i] ?? 1) + (widths[i + 1] ?? widths[i] ?? 1)) / 2;
    const bucketIndex = Math.round(segmentWidth / bucket);

    if (!current || bucketIndex !== currentBucket) {
      // Start the new run at the shared point so runs stay visually connected.
      current = { points: [points[i].x, points[i].y], width: round2(bucketIndex * bucket) || bucket };
      currentBucket = bucketIndex;
      runs.push(current);
    }
    current.points.push(points[i + 1].x, points[i + 1].y);
  }

  return runs;
}

export function toFlatArray(points: InkPoint[]): number[] {
  const flat: number[] = [];
  for (const point of points) flat.push(point.x, point.y);
  return flat;
}

export function fromFlatArray(flat: number[]): InkPoint[] {
  const points: InkPoint[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

export interface PalmRejectionState {
  pointerType: string;
  /** Timestamp of the last pen sample seen, or null if no pen has been used. */
  penLastSeenAt: number | null;
  now: number;
  /** How long a pen keeps touch input suppressed. */
  penModeWindowMs?: number;
}

/**
 * Palm rejection: while a pen is in use, touch contacts are the user's hand
 * resting on the tablet, not drawing input. Mouse input is never suppressed —
 * a teacher may switch back to a mouse without waiting out the window.
 */
export function shouldIgnorePointer({
  pointerType,
  penLastSeenAt,
  now,
  penModeWindowMs = 1500,
}: PalmRejectionState): boolean {
  if (pointerType !== 'touch') return false;
  if (penLastSeenAt === null) return false;
  return now - penLastSeenAt < penModeWindowMs;
}
