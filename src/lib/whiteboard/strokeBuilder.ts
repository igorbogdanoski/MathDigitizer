/**
 * Turns a stream of pointer samples into ink increments.
 *
 * Both whiteboards and the e2e probe drive this same object, so what the
 * teacher sees, what remote participants receive and what the tests exercise
 * are produced by one implementation rather than three similar ones.
 *
 * Each `addSample` returns only the *new* points, already decimated, smoothed
 * and width-resolved — which is exactly what gets appended locally and what
 * gets put on the wire.
 */
import {
  InkPoint,
  buildStrokeWidths,
  distance,
  resolveStrokeWidth,
  smoothTail,
  toFlatArray,
} from './ink';

export interface InkIncrement {
  points: number[];
  widths: number[];
}

export interface StrokeBuilderOptions {
  baseWidth: number;
  pointerType?: string;
  /** Minimum travel between kept samples; pointer devices oversample heavily. */
  minSampleDistance?: number;
  samplesPerSegment?: number;
}

export class StrokeBuilder {
  private readonly baseWidth: number;
  private readonly pointerType: string;
  private readonly minSampleDistance: number;
  private readonly samplesPerSegment: number;
  private readonly raw: InkPoint[];
  private lastEmitted: InkPoint;
  private finished = false;

  constructor(first: InkPoint, options: StrokeBuilderOptions) {
    this.baseWidth = options.baseWidth;
    this.pointerType = options.pointerType ?? 'mouse';
    this.minSampleDistance = options.minSampleDistance ?? 2;
    this.samplesPerSegment = options.samplesPerSegment ?? 6;
    this.raw = [first];
    this.lastEmitted = first;
  }

  /** Width of the very first point — the stroke's starting cap. */
  get initialWidth(): number {
    return resolveStrokeWidth({
      baseWidth: this.baseWidth,
      pressure: this.raw[0].pressure,
      pointerType: this.pointerType,
    });
  }

  get initialPoint(): InkPoint {
    return this.raw[0];
  }

  /** Number of raw samples kept after decimation — useful for diagnostics. */
  get sampleCount(): number {
    return this.raw.length;
  }

  /**
   * Feeds one pointer sample. Returns the ink to append, or null when the
   * sample was decimated away or is not yet enough to close a curve segment.
   */
  addSample(point: InkPoint): InkIncrement | null {
    if (this.finished) return null;

    const last = this.raw[this.raw.length - 1];
    if (distance(last, point) < this.minSampleDistance) return null;

    this.raw.push(point);

    const tail = smoothTail(this.raw, this.samplesPerSegment);
    if (tail.length === 0) return null;

    return this.emit(tail);
  }

  /**
   * Closes the stroke on its newest raw sample, which `smoothTail` never emits.
   * Returns null when there is nothing left to add.
   */
  finish(): InkIncrement | null {
    if (this.finished) return null;
    this.finished = true;

    if (this.raw.length < 2) return null;
    const finalPoint = this.raw[this.raw.length - 1];
    if (distance(this.lastEmitted, finalPoint) === 0) return null;

    return this.emit([finalPoint]);
  }

  private emit(points: InkPoint[]): InkIncrement {
    // The previous sample provides the velocity context for the first width,
    // then gets dropped — otherwise every batch would start at full width.
    const widths = buildStrokeWidths(
      [this.lastEmitted, ...points],
      this.baseWidth,
      this.pointerType
    ).slice(1);

    this.lastEmitted = points[points.length - 1];
    return { points: toFlatArray(points), widths };
  }
}
