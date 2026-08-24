import { describe, it, expect } from 'vitest';
import { segmentChapters } from './chapters';
import {
  CJK_CHARS_PER_TOKEN,
  WORDS_PER_TOKEN,
  buildTokenBudget,
  estimateTokens,
} from './tokenBudget';

describe('estimateTokens', () => {
  it('counts whitespace-delimited text by words', () => {
    const text = 'Реши ја равенката два икс плус пет';
    expect(estimateTokens(text)).toBe(Math.floor(7 / WORDS_PER_TOKEN));
  });

  it('is deterministic — the same text always gives the same number', () => {
    const text = 'Собирање и одземање на дропки со ист именител.';
    expect(estimateTokens(text)).toBe(estimateTokens(text));
  });

  it('counts a script without spaces by character, not by word', () => {
    // Otherwise a space-less passage estimates at a couple of tokens and the
    // whole figure is out by orders of magnitude.
    const text = '数学的方法论与应用研究';
    expect(estimateTokens(text)).toBe(Math.floor(text.length / CJK_CHARS_PER_TOKEN));
    expect(estimateTokens(text)).toBeGreaterThan(2);
  });

  it('handles a passage mixing both', () => {
    expect(estimateTokens('Пример 数学 текст')).toBeGreaterThan(estimateTokens('Пример текст'));
  });

  it('is zero for empty or blank text', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   \n  ')).toBe(0);
  });

  it('grows with the text', () => {
    const short = 'еден два три';
    expect(estimateTokens(short.repeat(10))).toBeGreaterThan(estimateTokens(short));
  });
});

describe('buildTokenBudget', () => {
  const book = (chapterCount: number, wordsEach: number) =>
    segmentChapters(
      Array.from({ length: chapterCount }, (_, i) =>
        `ТЕМА ${i + 1}: НАСЛОВ\n${'збор '.repeat(wordsEach)}\n`
      ).join('')
    );

  it('reports the whole book as the sum of its chapters', () => {
    const chapters = book(5, 400);
    const budget = buildTokenBudget(chapters, { coreTokens: 1000, chapterTokens: 400 });

    const summed = chapters.reduce((sum, c) => sum + estimateTokens(c.text), 0);
    expect(budget.wholeBook).toBe(summed);
  });

  it('holds distillation to the hardest baseline, not the flattering one', () => {
    // Comparing against the whole book every time makes distillation look good
    // regardless. The baseline that matters is a reader who already knows which
    // chapter they need.
    const chapters = book(12, 800);
    const budget = buildTokenBudget(chapters, { coreTokens: 1200, chapterTokens: 500 });

    expect(budget.bestChapter).toBeLessThan(budget.wholeBook);
    expect(budget.bestChapter).toBeLessThan(budget.discoveryLoop);
  });

  it('says so when distilling is not worth it', () => {
    // A short book read directly beats a distilled core plus a chapter. A tool
    // that always reports a win is not measuring anything.
    const chapters = book(3, 40);
    const budget = buildTokenBudget(chapters, { coreTokens: 4000, chapterTokens: 800 });

    expect(budget.worthwhile).toBe(false);
    expect(budget.savingVsWholeBook).toBeLessThan(1);
  });

  it('says so when distilling does pay', () => {
    const chapters = book(20, 3000);
    const budget = buildTokenBudget(chapters, { coreTokens: 1200, chapterTokens: 600 });

    expect(budget.worthwhile).toBe(true);
    expect(budget.savingVsWholeBook).toBeGreaterThan(5);
    expect(budget.savingVsDiscoveryLoop).toBeGreaterThan(1);
  });

  it('counts the discovery loop as two chapters, not one', () => {
    const chapters = book(10, 1000);
    const budget = buildTokenBudget(chapters, { coreTokens: 1000, chapterTokens: 400 });

    // A definition rarely sits in the chapter that uses it.
    expect(budget.discoveryLoop).toBeGreaterThan(budget.bestChapter);
  });

  it('does not divide by zero when nothing was distilled', () => {
    const budget = buildTokenBudget(book(3, 100), { coreTokens: 0, chapterTokens: 0 });

    expect(budget.savingVsWholeBook).toBe(0);
    expect(budget.savingVsDiscoveryLoop).toBe(0);
    expect(Number.isFinite(budget.distilled)).toBe(true);
  });

  it('handles a book with no chapters', () => {
    const budget = buildTokenBudget([], { coreTokens: 500, chapterTokens: 200 });

    expect(budget.wholeBook).toBe(0);
    expect(budget.worthwhile).toBe(false);
  });
});
