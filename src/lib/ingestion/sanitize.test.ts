import { describe, expect, it } from 'vitest';
import { sanitizeIngestionText } from './sanitize';

describe('sanitizeIngestionText', () => {
  it('removes zero-width and bidi controls', () => {
    const input = 'abc\u200Bdef\u202Eghi';
    const result = sanitizeIngestionText(input);
    expect(result.text).toBe('abcdefghi');
    expect(result.stats.removedInvisibleCount).toBe(1);
    expect(result.stats.removedBidiCount).toBe(1);
    expect(result.stats.changed).toBe(true);
  });

  it('removes unicode tag block payloads', () => {
    const input = `safe${String.fromCodePoint(0xe0061)}text`;
    const result = sanitizeIngestionText(input);
    expect(result.text).toBe('safetext');
    expect(result.stats.removedInvisibleCount).toBe(1);
  });

  it('keeps normal text untouched', () => {
    const input = 'Regular math: x^2 + y^2 = z^2';
    const result = sanitizeIngestionText(input);
    expect(result.text).toBe(input);
    expect(result.stats.changed).toBe(false);
  });
});
