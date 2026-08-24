/**
 * What distillation costs, and what it saves
 * (EXPERT_LEVEL_MASTER_PLAN, 10.2).
 *
 * Ported from book-to-skill's `tools/discovery_tax.py`
 * (github.com/virgiliojr94/book-to-skill).
 *
 * A distilled textbook is only worth building if reading it beats reading the
 * book. That is a claim with a number attached, and the number is easy to
 * flatter: compare against the whole book every time and distillation always
 * wins. So three baselines are reported, including the one that is hardest to
 * beat — a reader who already knows which chapter they need.
 *
 * The estimate is deterministic and dependency-free: the same book always
 * yields the same figure, so a change in the number means a change in the
 * pipeline rather than in a tokenizer version.
 */
import { Chapter } from './chapters';

/**
 * Words per token for whitespace-delimited text, as book-to-skill's extractor
 * uses. Macedonian is whitespace-delimited and morphologically rich, so its
 * words split into slightly more tokens than English; the ratio errs toward
 * under-reporting the saving, which is the right direction for a claim.
 */
export const WORDS_PER_TOKEN = 0.75;

/**
 * Characters per token for scripts that do not separate words with spaces.
 *
 * Without this branch a space-less document estimates at a handful of tokens
 * and the whole figure is out by orders of magnitude. Macedonian textbooks do
 * not need it; a quoted passage or a borrowed diagram might.
 */
export const CJK_CHARS_PER_TOKEN = 1.5;

const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]|[\u{20000}-\u{3ffff}]/gu;

/** A deterministic token estimate for a piece of text. */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const cjkCount = text.match(CJK)?.length ?? 0;
  if (cjkCount === 0) {
    return Math.floor(countWords(text) / WORDS_PER_TOKEN);
  }

  const latinWords = countWords(text.replace(CJK, ' '));
  return Math.floor(latinWords / WORDS_PER_TOKEN + cjkCount / CJK_CHARS_PER_TOKEN);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export interface TokenBudget {
  /** Reading the whole book into context. */
  wholeBook: number;
  /**
   * Best case without a distilled index: the reader already knows the chapter,
   * and reads the table of contents plus that one chapter.
   */
  bestChapter: number;
  /**
   * Realistic case without one: the same, plus a second chapter opened because
   * a definition turned out to live somewhere earlier.
   */
  discoveryLoop: number;
  /** Reading the distilled core plus one distilled chapter. */
  distilled: number;
  /** How many times smaller `distilled` is than `wholeBook`. */
  savingVsWholeBook: number;
  /** How many times smaller `distilled` is than `discoveryLoop`. */
  savingVsDiscoveryLoop: number;
  /**
   * True when distillation does not beat simply opening the right chapter.
   *
   * A short book, or one with few large chapters, can be cheaper read directly.
   * Saying so is the point of measuring: the tool that always reports a win is
   * not measuring anything.
   */
  worthwhile: boolean;
}

export interface DistilledSizes {
  /** The always-loaded core: mental models and the chapter index. */
  coreTokens: number;
  /** Mean size of one distilled chapter. */
  chapterTokens: number;
}

/**
 * Compares reading a distilled book with reading the book.
 *
 * `chapters` are the segmented source chapters; `distilled` is what
 * distillation produced, or is budgeted to produce.
 */
export function buildTokenBudget(
  chapters: readonly Chapter[],
  distilled: DistilledSizes,
): TokenBudget {
  const chapterTokens = chapters.map(c => estimateTokens(c.text));
  const wholeBook = chapterTokens.reduce((sum, n) => sum + n, 0);

  // The index a reader consults before opening anything: chapter titles only.
  const tocTokens = estimateTokens(chapters.map(c => c.title).join('\n'));

  const sorted = [...chapterTokens].sort((a, b) => a - b);
  const medianChapter = sorted.length
    ? sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;

  const bestChapter = Math.round(tocTokens + medianChapter);
  // One extra chapter, because a definition rarely sits where it is used.
  const discoveryLoop = Math.round(tocTokens + medianChapter * 2);
  const distilledTotal = distilled.coreTokens + distilled.chapterTokens;

  const ratio = (baseline: number) =>
    distilledTotal > 0 ? Math.round((baseline / distilledTotal) * 10) / 10 : 0;

  return {
    wholeBook,
    bestChapter,
    discoveryLoop,
    distilled: distilledTotal,
    savingVsWholeBook: ratio(wholeBook),
    savingVsDiscoveryLoop: ratio(discoveryLoop),
    worthwhile: distilledTotal < bestChapter,
  };
}
