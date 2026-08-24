import { describe, it, expect, vi } from 'vitest';
import {
  MIN_USEFUL_TEXT,
  clipForPrompt,
  extractDocumentText,
  isDocx,
  isPdf,
  isPlainText,
  normalizeExtractedText,
} from './extractText';

describe('file type detection', () => {
  it('recognises a PDF by mime type or extension', () => {
    expect(isPdf({ name: 'a.pdf', type: 'application/pdf' })).toBe(true);
    expect(isPdf({ name: 'PROGRAMA.PDF' })).toBe(true);
    expect(isPdf({ name: 'a.docx', type: 'application/msword' })).toBe(false);
  });

  it('recognises a DOCX', () => {
    expect(isDocx({ name: 'a.docx' })).toBe(true);
    expect(isDocx({
      name: 'no-extension',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })).toBe(true);
  });

  it('recognises plain text formats', () => {
    expect(isPlainText({ name: 'notes.txt' })).toBe(true);
    expect(isPlainText({ name: 'notes.md' })).toBe(true);
    expect(isPlainText({ name: 'x', type: 'text/plain' })).toBe(true);
    expect(isPlainText({ name: 'a.pdf', type: 'application/pdf' })).toBe(false);
  });
});

describe('normalizeExtractedText', () => {
  it('collapses the ragged whitespace a PDF text layer produces', () => {
    expect(normalizeExtractedText('Тема   1 \n\n\n\n  Втора   тема  ')).toBe('Тема 1\n\nВтора тема');
  });

  it('normalises windows line endings', () => {
    expect(normalizeExtractedText('a\r\nb')).toBe('a\nb');
  });

  it('handles empty input', () => {
    expect(normalizeExtractedText('   \n\n  ')).toBe('');
  });
});

describe('clipForPrompt', () => {
  it('leaves short text untouched', () => {
    expect(clipForPrompt('кратко', 100)).toBe('кратко');
  });

  it('keeps the head and the tail when clipping', () => {
    const text = 'A'.repeat(500) + 'ZZZ';
    const clipped = clipForPrompt(text, 100);

    expect(clipped.length).toBeLessThan(text.length);
    expect(clipped.startsWith('A')).toBe(true);
    expect(clipped.endsWith('ZZZ')).toBe(true);
    expect(clipped).toContain('[…]');
  });
});

/** Minimal File stand-in — jsdom's File lacks arrayBuffer/text in this setup. */
const fakeFile = (name: string, type: string, content: string): File => ({
  name,
  type,
  text: async () => content,
  arrayBuffer: async () => new TextEncoder().encode(content).buffer,
} as unknown as File);

describe('extractDocumentText', () => {
  it('reads a plain text file', async () => {
    const result = await extractDocumentText(fakeFile('p.txt', 'text/plain', 'Тема 1: Линеарни равенки. '.repeat(5)));

    expect(result.source).toBe('text');
    expect(result.empty).toBe(false);
    expect(result.text).toContain('Линеарни равенки');
  });

  it('flags a document with too little text as empty', async () => {
    const result = await extractDocumentText(fakeFile('p.txt', 'text/plain', 'кратко'));
    expect(result.empty).toBe(true);
    expect(result.text.length).toBeLessThan(MIN_USEFUL_TEXT);
  });

  it('reports an unsupported type as empty rather than guessing', async () => {
    const result = await extractDocumentText(fakeFile('a.xyz', 'application/octet-stream', 'x'.repeat(200)));
    expect(result).toMatchObject({ empty: true, text: '', pageCount: 0 });
  });

  it('reads a DOCX through mammoth', async () => {
    vi.doMock('mammoth', () => ({
      extractRawText: async () => ({ value: 'Модул 3: Геометрија. '.repeat(5) }),
    }));

    const { extractDocumentText: fresh } = await import('./extractText');
    const result = await fresh(fakeFile('p.docx', '', 'ignored'));

    expect(result.source).toBe('docx');
    expect(result.text).toContain('Геометрија');
    expect(result.empty).toBe(false);

    vi.doUnmock('mammoth');
  });
});
