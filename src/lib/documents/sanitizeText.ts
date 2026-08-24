/**
 * Strips invisible characters from extracted document text
 * (EXPERT_LEVEL_MASTER_PLAN, 10.1).
 *
 * An uploaded PDF or DOCX goes straight into a model prompt — the curriculum
 * factory, task extraction, and now textbook distillation all do this. That
 * makes an uploaded document an untrusted input with a path into the model's
 * context, and a teacher who opens the file sees nothing wrong: the characters
 * below render as no width at all, so text written in them is invisible on the
 * page and plain to the model.
 *
 * Ported from book-to-skill (github.com/virgiliojr94/book-to-skill,
 * `book_to_skill/sanitize.py`), whose grouping and reasoning are kept so the
 * two can be compared when either changes.
 */

/**
 * Zero-width and invisible spacers. Render as nothing, so text between them is
 * invisible to a human reading the page but plain to the model.
 */
const ZERO_WIDTH = new Set([
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0x2060, // WORD JOINER
  0xfeff, // ZERO WIDTH NO-BREAK SPACE / BOM outside position 0
  0x00ad, // SOFT HYPHEN — invisible except at a line break
  0x034f, // COMBINING GRAPHEME JOINER — no rendering effect at all
  0x180e, // MONGOLIAN VOWEL SEPARATOR
  0x2061, // FUNCTION APPLICATION
  0x2062, // INVISIBLE TIMES
  0x2063, // INVISIBLE SEPARATOR
  0x2064, // INVISIBLE PLUS
]);

/**
 * Bidirectional formatting controls — the Trojan Source class (CVE-2021-42574).
 *
 * These do not change the character sequence a model reads; they change the
 * order a human sees. A line can display as ordinary study text while the model
 * consumes an injected instruction, so the teacher approving an import and the
 * model reading it disagree about what the document says.
 *
 * Right-to-left books are unaffected: the Unicode bidi algorithm derives
 * direction from the letters themselves, so Arabic and Hebrew still render
 * correctly. Only explicit embeddings, overrides and isolates are dropped, and
 * running prose essentially never needs them.
 */
const BIDI_CONTROLS = new Set([
  0x200e, 0x200f, 0x061c,
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2066, 0x2067, 0x2068, 0x2069,
]);

/**
 * Blank-width characters that are letters rather than format controls, so a
 * category-based filter misses them and whitespace normalization keeps them.
 */
const INVISIBLE_LETTERS = new Set([
  0x115f, // HANGUL CHOSEONG FILLER
  0x1160, // HANGUL JUNGSEONG FILLER
  0x3164, // HANGUL FILLER
  0xffa0, // HALFWIDTH HANGUL FILLER
]);

/**
 * The Unicode tag block — originally language tags, now used to smuggle a whole
 * ASCII payload as invisible characters.
 */
const TAG_BLOCK_START = 0xe0000;
const TAG_BLOCK_END = 0xe007f;

/** True when the code point renders as nothing and should be removed. */
export function isInvisibleCodePoint(codePoint: number): boolean {
  return (
    ZERO_WIDTH.has(codePoint) ||
    BIDI_CONTROLS.has(codePoint) ||
    INVISIBLE_LETTERS.has(codePoint) ||
    (codePoint >= TAG_BLOCK_START && codePoint <= TAG_BLOCK_END)
  );
}

export interface SanitizedText {
  text: string;
  /** How many invisible characters were removed. */
  removed: number;
}

/**
 * Removes invisible code points, reporting how many.
 *
 * The count is not diagnostics. A document carrying hidden characters is worth
 * telling the teacher about — an ordinary textbook has none, and a handful is
 * a stray soft hyphen while a thousand is someone writing a message meant only
 * for the model.
 *
 * Iterates by code point, not by UTF-16 unit, so a tag-block character (which
 * is a surrogate pair) is matched and removed whole rather than leaving half
 * behind.
 */
export function sanitizeExtractedText(raw: string): SanitizedText {
  let removed = 0;
  let text = '';

  for (const character of raw) {
    if (isInvisibleCodePoint(character.codePointAt(0)!)) {
      removed++;
      continue;
    }
    text += character;
  }

  return { text, removed };
}

/**
 * Above this many invisible characters, the document is worth flagging to the
 * person importing it rather than cleaning silently.
 *
 * Typesetting leaves a few soft hyphens and joiners behind; it does not leave
 * dozens. The threshold is deliberately low — the cost of a false alarm is one
 * sentence in the UI, the cost of a miss is an instruction the teacher never
 * sees reaching the model.
 */
export const SUSPICIOUS_INVISIBLE_COUNT = 20;

export function hasSuspiciousInvisibles(result: SanitizedText): boolean {
  return result.removed >= SUSPICIOUS_INVISIBLE_COUNT;
}
