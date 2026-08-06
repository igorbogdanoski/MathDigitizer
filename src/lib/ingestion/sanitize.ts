/**
 * Deterministic text sanitization for ingestion/prompt safety.
 * Removes invisible and bidi-control Unicode code points that can hide
 * adversarial instructions without changing visible text meaning.
 */

export interface SanitizeStats {
  originalLength: number;
  sanitizedLength: number;
  removedInvisibleCount: number;
  removedBidiCount: number;
  changed: boolean;
}

export interface SanitizeResult {
  text: string;
  stats: SanitizeStats;
}

const INVISIBLE_CODEPOINTS = new Set<number>([
  0x200b, // zero width space
  0x200c, // zero width non-joiner
  0x200d, // zero width joiner
  0x2060, // word joiner
  0xfeff, // zero width no-break space / BOM
  0x2061, // function application
  0x2062, // invisible times
  0x2063, // invisible separator
  0x2064, // invisible plus
]);

const BIDI_CONTROL_CODEPOINTS = new Set<number>([
  0x200e, // LRM
  0x200f, // RLM
  0x202a, // LRE
  0x202b, // RLE
  0x202c, // PDF
  0x202d, // LRO
  0x202e, // RLO
  0x2066, // LRI
  0x2067, // RLI
  0x2068, // FSI
  0x2069, // PDI
]);

export function sanitizeIngestionText(input: string): SanitizeResult {
  let removedInvisibleCount = 0;
  let removedBidiCount = 0;

  let output = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;

    // Unicode tags block U+E0000..U+E007F can carry hidden payload.
    if (cp >= 0xe0000 && cp <= 0xe007f) {
      removedInvisibleCount += 1;
      continue;
    }

    if (INVISIBLE_CODEPOINTS.has(cp)) {
      removedInvisibleCount += 1;
      continue;
    }

    if (BIDI_CONTROL_CODEPOINTS.has(cp)) {
      removedBidiCount += 1;
      continue;
    }

    output += ch;
  }

  const stats: SanitizeStats = {
    originalLength: input.length,
    sanitizedLength: output.length,
    removedInvisibleCount,
    removedBidiCount,
    changed: output !== input,
  };

  return { text: output, stats };
}
