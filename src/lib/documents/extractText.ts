/**
 * Deterministic text extraction from uploaded documents
 * (EXPERT_LEVEL_MASTER_PLAN, 6.5).
 *
 * CurriculumFactory used to send the model only the *file name* and ask it to
 * invent a plausible curriculum — extraction in name, hallucination in fact.
 * These helpers read the actual bytes: `pdfjs-dist` for PDFs, `mammoth` for
 * DOCX, plain decoding for text. Both libraries were already installed and
 * unused.
 */
import { sanitizeExtractedText } from './sanitizeText';
import { reconstructPageText, htmlTablesToMarkdown, type TextFragment } from './layout';

export interface ExtractedDocument {
  text: string;
  /** Pages for a PDF; 1 for other formats. */
  pageCount: number;
  source: 'pdf' | 'docx' | 'text';
  /** True when the file yielded no usable text (e.g. a scanned PDF). */
  empty: boolean;
  /**
   * Invisible characters removed before the text was normalized.
   *
   * This text goes into a model prompt, so an uploaded file is untrusted input
   * with a path into the model's context. A handful is typesetting; a large
   * count is text written to be read by the model and not by the teacher.
   */
  invisiblesRemoved: number;
}

/** Characters below which a document is treated as having no usable text. */
export const MIN_USEFUL_TEXT = 40;

export function isPdf(file: { name: string; type?: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isDocx(file: { name: string; type?: string }): boolean {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx$/i.test(file.name)
  );
}

export function isPlainText(file: { name: string; type?: string }): boolean {
  return (file.type ?? '').startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name);
}

/**
 * Collapses the ragged whitespace PDF text layers produce.
 *
 * Note this does not remove invisible characters — `[ 	]+` does not match a
 * zero-width space, and they are letters as far as trimming is concerned.
 * `sanitizeExtractedText` runs first, in `extractDocumentText`.
 */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(buffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  const pdfjs: any = await import('pdfjs-dist');

  // The worker cannot be bundled the usual way in this app, and the main-thread
  // fallback is fine for the modest documents a teacher uploads here.
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = '';

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorker: false, isEvalSupported: false }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    // Every fragment used to be joined with a single space, which threw away
    // the lines along with the columns: a three-column table of tasks became
    // one run of words, and nothing downstream could tell which answer went
    // with which task. `reconstructPageText` reads the positions pdfjs already
    // reports and puts the rows and tables back.
    const fragments = (content.items as any[]).filter(item => typeof item?.str === 'string');
    pages.push(reconstructPageText(fragments as TextFragment[]));
  }

  await doc.destroy?.();
  return { text: pages.join('\n\n'), pageCount: doc.numPages };
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth: any = await import('mammoth');

  // `extractRawText` loses DOCX tables the same way the old PDF path lost them.
  // The HTML output keeps the `<table>`, so the tables survive as Markdown and
  // everything else is reduced to plain lines.
  try {
    const html = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const converted = htmlTablesToMarkdown(html?.value ?? '');
    if (converted.trim().length > 0) return converted;
  } catch (error) {
    // A document mammoth can read as text but not as HTML is rare, and a
    // partial import is worse than a plain one — fall through.
    console.warn('DOCX HTML conversion failed; falling back to raw text:', error);
  }

  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result?.value ?? '';
}

/**
 * Reads a file's actual text content.
 *
 * An unsupported type, or a scanned PDF with no text layer, comes back with
 * `empty: true` — the caller must say so rather than quietly inventing content.
 */
export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  const finish = (
    raw: string,
    pageCount: number,
    source: ExtractedDocument['source'],
  ): ExtractedDocument => {
    // Sanitize before normalizing: whitespace collapsing would otherwise glue
    // hidden characters to their neighbours and hide how many there were.
    const { text: visible, removed } = sanitizeExtractedText(raw);
    const text = normalizeExtractedText(visible);
    return {
      text,
      pageCount,
      source,
      empty: text.length < MIN_USEFUL_TEXT,
      invisiblesRemoved: removed,
    };
  };

  if (isPdf(file)) {
    const { text, pageCount } = await extractPdf(await file.arrayBuffer());
    return finish(text, pageCount, 'pdf');
  }

  if (isDocx(file)) {
    return finish(await extractDocx(await file.arrayBuffer()), 1, 'docx');
  }

  if (isPlainText(file)) {
    return finish(await file.text(), 1, 'text');
  }

  return { text: '', pageCount: 0, source: 'text', empty: true, invisiblesRemoved: 0 };
}

/**
 * Trims extracted text to a model-friendly budget, keeping the beginning
 * (where a curriculum states its structure) and the end.
 */
export function clipForPrompt(text: string, maxChars = 24000): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[…]\n\n${text.slice(-tail)}`;
}
