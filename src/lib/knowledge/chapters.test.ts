import { describe, it, expect } from 'vitest';
import {
  MIN_CHAPTER_CHARS,
  SYNTHETIC_CHAPTER_CHARS,
  reassemble,
  segmentChapters,
} from './chapters';

/** Body text long enough to clear the short-chapter floor. */
const body = (label: string) => `${label} `.repeat(Math.ceil(MIN_CHAPTER_CHARS / label.length)) + '\n';

describe('segmentChapters', () => {
  it('loses nothing — the chapters reassemble into the source', () => {
    // The invariant that matters most. A segmenter that dropped a page would
    // produce a knowledge base missing material nobody could name, and no
    // screen anywhere would look wrong.
    const source = [
      'Предговор кон изданието.\n',
      body('вовед'),
      'ТЕМА 1: БРОЈНИ МНОЖЕСТВА\n',
      body('множества'),
      'ТЕМА 2: ЛИНЕАРНИ РАВЕНКИ\n',
      body('равенки'),
    ].join('');

    const chapters = segmentChapters(source);

    expect(chapters.length).toBeGreaterThan(1);
    expect(reassemble(chapters, source)).toBe(source);
  });

  it('produces offsets that are ordered and never overlap', () => {
    const source = `ГЛАВА I\n${body('а')}ГЛАВА II\n${body('б')}ГЛАВА III\n${body('в')}`;
    const chapters = segmentChapters(source);

    expect(chapters[0].start).toBe(0);
    expect(chapters[chapters.length - 1].end).toBe(source.length);

    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i].start).toBe(chapters[i - 1].end);
      expect(chapters[i].end).toBeGreaterThan(chapters[i].start);
    }
  });

  it('numbers chapters consecutively from zero', () => {
    const source = `ТЕМА 1\n${body('а')}ТЕМА 2\n${body('б')}`;
    expect(segmentChapters(source).map(c => c.index)).toEqual([0, 1]);
  });

  it('takes the heading as the title and leaves it out of the body', () => {
    const source = `ЛИНЕАРНИ РАВЕНКИ\n${body('решавање')}`;
    const [chapter] = segmentChapters(source);

    expect(chapter.title).toBe('ЛИНЕАРНИ РАВЕНКИ');
    expect(chapter.text).not.toContain('ЛИНЕАРНИ РАВЕНКИ');
    expect(chapter.text).toContain('решавање');
    expect(chapter.synthetic).toBe(false);
  });

  it('keeps front matter before the first heading', () => {
    // A preface is not a chapter the author numbered, but discarding it would
    // break reassembly and lose real content.
    const preface = 'Оваа книга е наменета за наставници.\n' + body('предговор');
    const source = `${preface}ТЕМА 1\n${body('тело')}`;

    const chapters = segmentChapters(source);

    expect(chapters[0].start).toBe(0);
    expect(chapters[0].synthetic).toBe(true);
    expect(chapters[0].text).toContain('наменета за наставници');
    expect(reassemble(chapters, source)).toBe(source);
  });

  it('recognises numbered section headings that carry a book under them', () => {
    const source =
      `1. Собирање\n${body('собирање')}` +
      `2. Одземање\n${body('одземање')}` +
      `3. Множење\n${body('множење')}`;

    expect(segmentChapters(source).map(c => c.title))
      .toEqual(['1. Собирање', '2. Одземање', '3. Множење']);
  });

  it('treats a numbered list with little text under it as exercises, not chapters', () => {
    // The rule ported from book-to-skill: judge the numbering as a whole by the
    // median body under it, not heading by heading. `1./2./3.` ascends from 1
    // in an exercise list exactly as it does in a table of contents, so the
    // numbers themselves cannot tell the two apart.
    const source =
      `ЗАДАЧИ ЗА ВЕЖБАЊЕ\n` +
      body('вежба') +
      `1. Пресметај\n2. Спореди\n3. Објасни\n4. Провери\n` +
      body('продолжение');

    expect(segmentChapters(source).map(c => c.title)).toEqual(['ЗАДАЧИ ЗА ВЕЖБАЊЕ']);
    expect(reassemble(segmentChapters(source), source)).toBe(source);
  });

  it('needs more than two numbered headings before calling it a scheme', () => {
    // Two is not a numbering scheme. A book with exactly two numbered sections
    // falls back rather than splitting on a pattern that thin.
    const source = `1. Прво\n${body('прво')}2. Второ\n${body('второ')}`;
    expect(segmentChapters(source).map(c => c.title).some(t => t.startsWith('1.'))).toBe(false);
  });

  it('does not open a chapter on a numbered exercise inside a paragraph', () => {
    // `1. Пресметај…` on a line with the rest of a sentence after it is an
    // exercise, not a chapter.
    const source =
      `ЗАДАЧИ ЗА ВЕЖБАЊЕ\n` +
      body('вежба') +
      `1. Пресметај. 2. Спореди. 3. Објасни.\n` +
      body('продолжение');

    const titles = segmentChapters(source).map(c => c.title);
    expect(titles.some(t => t.startsWith('1. Пресметај'))).toBe(false);
  });

  it('folds a heading with almost no text under it into the chapter before', () => {
    // Textbooks stack a number and a name on separate lines; each would
    // otherwise become a chapter holding typography rather than content.
    const source =
      `ТЕМА 1\n` + body('вистинско тело') +
      `ГЛАВА II\n` +          // a heading with nothing under it
      `ЛИНЕАРНИ РАВЕНКИ\n` + body('второ тело');

    const chapters = segmentChapters(source);

    expect(chapters.every(c => c.end - c.start >= MIN_CHAPTER_CHARS)).toBe(true);
    expect(reassemble(chapters, source)).toBe(source);
  });

  it('slices a book with no headings into bounded pieces', () => {
    const source = 'реченица со текст. '.repeat(2000);
    const chapters = segmentChapters(source);

    expect(chapters.length).toBeGreaterThan(1);
    expect(chapters.every(c => c.synthetic)).toBe(true);
    expect(chapters.every(c => c.end - c.start <= SYNTHETIC_CHAPTER_CHARS * 1.5)).toBe(true);
    expect(reassemble(chapters, source)).toBe(source);
  });

  it('cuts a synthetic slice at a paragraph rather than mid-sentence', () => {
    const paragraph = 'Ова е реченица од текстот. '.repeat(60) + '\n\n';
    const source = paragraph.repeat(20);

    const chapters = segmentChapters(source);
    expect(chapters.length).toBeGreaterThan(1);

    // Every cut but the last lands right after a paragraph break.
    for (const chapter of chapters.slice(1)) {
      expect(source.slice(chapter.start - 2, chapter.start)).toBe('\n\n');
    }
  });

  it('terminates on one unbroken run of text', () => {
    // No paragraph or line break to cut on; the slicer must still advance.
    const source = 'x'.repeat(SYNTHETIC_CHAPTER_CHARS * 3);
    const chapters = segmentChapters(source);

    expect(chapters.length).toBe(3);
    expect(reassemble(chapters, source)).toBe(source);
  });

  it('returns nothing for an empty or blank document', () => {
    expect(segmentChapters('')).toEqual([]);
    expect(segmentChapters('   \n\n  ')).toEqual([]);
  });

  it('handles a book that is one short chapter', () => {
    const source = 'ТЕМА 1\nКратко тело.\n';
    const chapters = segmentChapters(source);

    expect(chapters).toHaveLength(1);
    expect(reassemble(chapters, source)).toBe(source);
  });
});
