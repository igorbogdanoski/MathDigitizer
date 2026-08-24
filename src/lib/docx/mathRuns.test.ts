import { describe, it, expect } from 'vitest';
import { Document, Packer, Paragraph } from 'docx';
import { latexToDocxMath, buildRichChildren, mathParagraph } from './mathRuns';

/**
 * Packs paragraphs into a real .docx and returns document.xml as text, so the
 * assertions are about the actual OMML Word will read — not about our own
 * intermediate objects.
 */
async function documentXml(children: Paragraph[]): Promise<string> {
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buffer = await Packer.toBuffer(doc);

  // A .docx is a zip; find document.xml by scanning the raw bytes for its
  // uncompressed marker is unreliable, so use the same unzip docx depends on.
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(buffer));
  const entry = Object.keys(files).find(name => name.endsWith('word/document.xml'));
  if (!entry) throw new Error('document.xml not found in the packed docx');
  return strFromU8(files[entry]);
}

describe('latexToDocxMath — real OMML output', () => {
  it('emits an oMath element, not literal LaTeX text', async () => {
    const xml = await documentXml([new Paragraph({ children: [latexToDocxMath('\\frac{1}{2}')] })]);

    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:f>'); // fraction
    expect(xml).not.toContain('\\frac');
  });

  it('emits a radical for a square root', async () => {
    const xml = await documentXml([new Paragraph({ children: [latexToDocxMath('\\sqrt{x+1}')] })]);
    expect(xml).toContain('<m:rad>');
    expect(xml).not.toContain('\\sqrt');
  });

  it('emits a superscript for a power', async () => {
    const xml = await documentXml([new Paragraph({ children: [latexToDocxMath('x^2')] })]);
    expect(xml).toContain('<m:sSup>');
  });

  it('emits an n-ary operator for a sum', async () => {
    const xml = await documentXml([new Paragraph({ children: [latexToDocxMath('\\sum_{i=1}^{n} i')] })]);
    expect(xml).toContain('<m:nary>');
  });

  it('renders greek letters as characters', async () => {
    const xml = await documentXml([new Paragraph({ children: [latexToDocxMath('\\pi r^2')] })]);
    expect(xml).toContain('π');
    expect(xml).not.toContain('\\pi');
  });

  it('survives an empty expression without producing invalid XML', async () => {
    await expect(documentXml([new Paragraph({ children: [latexToDocxMath('')] })])).resolves.toContain('<m:oMath>');
  });
});

describe('buildRichChildren', () => {
  it('keeps prose as text and turns formulas into equations', async () => {
    const xml = await documentXml([new Paragraph({ children: buildRichChildren('Реши $x^2=4$ сега') })]);

    expect(xml).toContain('Реши');
    expect(xml).toContain('сега');
    expect(xml).toContain('<m:oMath>');
    expect(xml).not.toContain('$x^2=4$');
  });

  it('handles text with no maths at all', async () => {
    const xml = await documentXml([new Paragraph({ children: buildRichChildren('само текст') })]);
    expect(xml).toContain('само текст');
    expect(xml).not.toContain('<m:oMath>');
  });

  it('handles several formulas in one paragraph', async () => {
    const xml = await documentXml([new Paragraph({ children: buildRichChildren('$a^2$ и $b^2$') })]);
    expect(xml.match(/<m:oMath>/g) ?? []).toHaveLength(2);
  });
});

describe('mathParagraph', () => {
  it('produces a paragraph whose maths is rendered', async () => {
    const xml = await documentXml([mathParagraph('Формула: $\\frac{a}{b}$')]);
    expect(xml).toContain('<m:f>');
    expect(xml).toContain('Формула');
  });
});
