/**
 * Splits an extracted textbook into chapters
 * (EXPERT_LEVEL_MASTER_PLAN, 10.1).
 *
 * Distillation runs per chapter, not per book: a 300-page textbook does not fit
 * in a context window, and feeding it in arbitrary slices cuts definitions away
 * from the worked examples that explain them. Chapters are the unit the author
 * already chose, so they are the unit to keep.
 *
 * Everything here is deterministic and offset-based. The one invariant worth
 * stating outright: **reassembling the chapters reproduces the input exactly.**
 * A segmenter that silently drops a page would produce a knowledge base missing
 * material no one could name, and nothing downstream would look wrong.
 */

export interface Chapter {
  /** 0-based position in the book. */
  index: number;
  /** The heading line, or a generated label when the book has no headings. */
  title: string;
  /** Body text, excluding the heading line. */
  text: string;
  /** Offset of the chapter (heading included) in the source text. */
  start: number;
  /** Offset one past the end of the chapter in the source text. */
  end: number;
  /** True when the split came from size, not from a heading in the book. */
  synthetic: boolean;
}

/**
 * Below this, a heading is treated as a false positive and folded into the
 * previous chapter — a lone bold word between two paragraphs is not a chapter.
 */
export const MIN_CHAPTER_CHARS = 200;

/** Size of a synthetic slice when the book carries no headings at all. */
export const SYNTHETIC_CHAPTER_CHARS = 6000;

/**
 * Fewer numbered headings than this is not a numbering scheme.
 *
 * From book-to-skill's `_numbered_titles_are_structural`.
 */
export const MIN_NUMBERED_TITLES = 3;

/**
 * Median body text under numbered headings, below which the numbering is a list
 * rather than a table of contents.
 *
 * The decision is made across all numbered headings at once, not heading by
 * heading. Neither test separates the two shapes alone: a three-step exercise
 * list ascends from 1 exactly as a chapter list does, and one long section is
 * not a scheme. book-to-skill measured median body per section — tutorial steps
 * ~20 chars, doc sections ~500, paper sections ~2 000, real chapters ~5 000 —
 * and put the floor an order of magnitude under the smallest real chapter and
 * an order above the largest step.
 */
export const MIN_NUMBERED_BODY_CHARS = 200;

/** Index of the numbered pattern in HEADING_PATTERNS. */
const NUMBERED_PATTERN = 1;
/** Index of the all-capitals pattern in HEADING_PATTERNS. */
const CAPS_PATTERN = 2;

/**
 * Heading shapes seen in Macedonian textbooks and БРО programmes.
 *
 * Each must match a whole line. Numbered headings are additionally weighed as a
 * group — see `numberedHeadingsAreStructural`.
 */
const HEADING_PATTERNS: RegExp[] = [
  // ТЕМА 1: БРОЈНИ МНОЖЕСТВА / ГЛАВА II — Алгебра
  /^\s*(?:тема|глава|дел|поглавје)\s+[\dIVXivx]+\s*[.:—–-]?\s*.{0,120}$/i,
  // 1. НАСЛОВ  /  1.2. Наслов  /  1.2.3 Наслов
  /^\s*\d+(?:\.\d+){0,2}\.?\s+\S.{0,120}$/,
  // A line in capitals: ЛИНЕАРНИ РАВЕНКИ
  /^\s*[\p{Lu}\p{Nd}][\p{Lu}\p{Nd}\s,.\-–—:()]{4,80}$/u,
];

/** A capitalised line is only a heading if it is genuinely upper-case. */
function isAllCapsHeading(line: string): boolean {
  const letters = [...line].filter(ch => /\p{L}/u.test(ch));
  if (letters.length < 4) return false;
  return letters.every(ch => ch === ch.toUpperCase());
}

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;

  // A sentence that happens to be short is not a heading. The section number is
  // stripped before the check: the dot in `1. Собирање` is part of the number,
  // and reading it as a sentence break rejected the commonest heading shape
  // there is. What it still rejects — `1. Пресметај. 2. Спореди.` — is a run of
  // exercises, which is what the guard is for.
  const withoutNumber = trimmed.replace(/^\d+(?:\.\d+){0,2}\.?\s*/, '');
  if (/[.!?]\s+\S/.test(withoutNumber)) return false;

  for (const [i, pattern] of HEADING_PATTERNS.entries()) {
    if (!pattern.test(trimmed)) continue;
    if (i === CAPS_PATTERN && !isAllCapsHeading(trimmed)) continue;
    return true;
  }
  return false;
}

/** Whether a line's only claim to being a heading is that it starts with a number. */
function isNumberedOnly(line: string): boolean {
  const trimmed = line.trim();
  if (!HEADING_PATTERNS[NUMBERED_PATTERN].test(trimmed)) return false;
  if (HEADING_PATTERNS[0].test(trimmed)) return false;
  return !(HEADING_PATTERNS[CAPS_PATTERN].test(trimmed) && isAllCapsHeading(trimmed));
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Whether digit-led lines are a table of contents or a list of exercises.
 *
 * Ported from book-to-skill's `_numbered_titles_are_structural`, and
 * deliberately not based on the numbers. An ascending run starting at 1
 * describes `1. Пресметај / 2. Спореди / 3. Објасни` exactly as well as it
 * describes a book's sections; what separates them is how much text sits under
 * each. Requiring an unbroken run would instead throw away a whole book because
 * extraction dropped one heading.
 */
function numberedHeadingsAreStructural(source: string, offsets: number[], all: number[]): boolean {
  if (offsets.length < MIN_NUMBERED_TITLES) return false;

  const bodies = offsets.map(start => {
    const next = all.find(offset => offset > start) ?? source.length;
    const lineEnd = source.indexOf('\n', start);
    const bodyStart = lineEnd >= 0 && lineEnd < next ? lineEnd + 1 : next;
    return next - bodyStart;
  });

  return median(bodies) >= MIN_NUMBERED_BODY_CHARS;
}

/** Offsets at which each line starts, so chapters can be cut without copying. */
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

/**
 * Cuts text into slices of roughly `size`, preferring a paragraph break and
 * falling back to a line break, so a slice does not end mid-sentence.
 */
function syntheticBoundaries(text: string, size: number): number[] {
  const cuts: number[] = [0];
  let at = 0;

  while (text.length - at > size) {
    const window = text.slice(at + Math.floor(size / 2), at + size);
    const paragraph = window.lastIndexOf('\n\n');
    const line = window.lastIndexOf('\n');
    const offset = paragraph >= 0 ? paragraph + 2 : line >= 0 ? line + 1 : -1;

    const next = offset >= 0 ? at + Math.floor(size / 2) + offset : at + size;
    // Guard against a boundary search that fails to advance on pathological
    // input — an unbroken 100 KB line would otherwise loop forever.
    at = next > at ? next : at + size;
    cuts.push(at);
  }

  return cuts;
}

/**
 * The chapters of a book, in order.
 *
 * When no headings are found — a scanned book run through OCR, a plain export —
 * the text is cut into bounded slices marked `synthetic`, so a caller can tell
 * "the author's chapters" from "our best guess" and say so in the UI.
 */
export function segmentChapters(source: string): Chapter[] {
  if (!source.trim()) return [];

  const starts = lineStarts(source);
  const headingLines: number[] = [];
  const numberedOnly: number[] = [];

  for (const [lineIndex, start] of starts.entries()) {
    const end = lineIndex + 1 < starts.length ? starts[lineIndex + 1] - 1 : source.length;
    const line = source.slice(start, end);
    if (!looksLikeHeading(line)) continue;
    headingLines.push(start);
    if (isNumberedOnly(line)) numberedOnly.push(start);
  }

  // Numbered lines only count as chapter boundaries when the numbering carries
  // a book's worth of text under it. Without this an exercise list opens a
  // chapter per exercise, and the model is asked to distil a skill out of
  // "Пресметај".
  if (numberedOnly.length > 0 && !numberedHeadingsAreStructural(source, numberedOnly, headingLines)) {
    const rejected = new Set(numberedOnly);
    headingLines.splice(0, headingLines.length, ...headingLines.filter(o => !rejected.has(o)));
  }

  if (headingLines.length === 0) return sliceSynthetic(source);

  // Front matter before the first heading is a chapter of its own, so that the
  // reassembly invariant holds and a preface is never silently discarded.
  const boundaries = headingLines[0] === 0 ? headingLines : [0, ...headingLines];

  const raw: Chapter[] = boundaries.map((start, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : source.length;
    return buildChapter(source, start, end, i, boundaries[0] !== 0 && i === 0);
  });

  const merged = mergeShortChapters(source, raw);
  return merged.length > 0 ? merged : sliceSynthetic(source);
}

function buildChapter(
  source: string,
  start: number,
  end: number,
  index: number,
  isFrontMatter: boolean,
): Chapter {
  const block = source.slice(start, end);
  const newline = block.indexOf('\n');
  const firstLine = (newline >= 0 ? block.slice(0, newline) : block).trim();

  const hasHeading = !isFrontMatter && looksLikeHeading(firstLine);

  return {
    index,
    title: hasHeading ? firstLine : `[${index + 1}]`,
    text: hasHeading && newline >= 0 ? block.slice(newline + 1) : block,
    start,
    end,
    synthetic: !hasHeading,
  };
}

/**
 * Folds a chapter shorter than MIN_CHAPTER_CHARS into the one before it.
 *
 * Textbooks put a run of sub-headings together — a title page, a chapter number
 * and a chapter name on three lines — and each would otherwise open a chapter
 * holding almost nothing. Distilling those wastes a model call per fragment and
 * produces "skills" that are really typography.
 */
function mergeShortChapters(source: string, chapters: Chapter[]): Chapter[] {
  const kept: Chapter[] = [];

  for (const chapter of chapters) {
    const previous = kept[kept.length - 1];
    const tooShort = chapter.end - chapter.start < MIN_CHAPTER_CHARS;

    if (tooShort && previous) {
      previous.end = chapter.end;
      previous.text = source.slice(
        previous.start + (previous.synthetic ? 0 : previous.title.length),
        previous.end,
      ).replace(/^\n/, '');
      continue;
    }
    kept.push({ ...chapter, index: kept.length });
  }

  return kept;
}

function sliceSynthetic(source: string): Chapter[] {
  const cuts = syntheticBoundaries(source, SYNTHETIC_CHAPTER_CHARS);

  return cuts.map((start, i) => {
    const end = i + 1 < cuts.length ? cuts[i + 1] : source.length;
    return {
      index: i,
      title: `[${i + 1}]`,
      text: source.slice(start, end),
      start,
      end,
      synthetic: true,
    };
  });
}

/**
 * Reassembles the source from its chapters.
 *
 * Exported for the test that holds segmentation to being lossless, and usable
 * by any caller that wants to prove the same about a book it just ingested.
 */
export function reassemble(chapters: readonly Chapter[], source: string): string {
  return chapters.map(c => source.slice(c.start, c.end)).join('');
}
