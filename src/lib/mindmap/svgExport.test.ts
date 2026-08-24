import { describe, it, expect } from 'vitest';
import { addEdge, addNode, attachOutcome, createConceptMap } from './graph';
import { buildExportSvg, escapeXml } from './svgExport';

const map = () => {
  let m = createConceptMap('m1', 'u', 'Дропки');
  m = addNode(m, { id: 'a', label: 'Дропка', x: 0, y: 0 });
  m = addNode(m, { id: 'b', label: 'Именител', x: 120, y: 60 });
  return addEdge(m, { id: 'e1', source: 'a', target: 'b', kind: 'requires', label: 'бара' });
};

describe('escapeXml', () => {
  it('escapes every character that changes how XML is parsed', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;');
  });

  it('escapes the ampersand first, so escapes are not double-escaped', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves Cyrillic and mathematics alone', () => {
    expect(escapeXml('Дропка x² ≤ 5')).toBe('Дропка x² ≤ 5');
  });
});

describe('buildExportSvg', () => {
  it('produces a standalone document with the right namespace', () => {
    const svg = buildExportSvg(map());

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('escapes a label a teacher typed', () => {
    // The PNG conversion feeds this string to an image element. Markup that
    // survives into it is markup a browser parses — the label must not be able
    // to close the text element it sits in.
    let m = createConceptMap('m', 'u', 'Мапа');
    m = addNode(m, { id: 'x', label: '</text><script>alert(1)</script>', x: 0, y: 0 });

    const svg = buildExportSvg(m);

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;/text&gt;');
  });

  it('escapes an ampersand, which otherwise makes the file unopenable', () => {
    let m = createConceptMap('m', 'u', 'Собирање & одземање');
    m = addNode(m, { id: 'x', label: 'a & b', x: 0, y: 0 });

    const svg = buildExportSvg(m);

    expect(svg).toContain('Собирање &amp; одземање');
    expect(svg).toContain('a &amp; b');
    // The real assertion: not one bare ampersand survives anywhere in the file.
    expect(/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(svg)).toBe(false);
  });

  it('keeps a short label on one line', () => {
    // Splitting `a & b` across two lines makes one concept look like two.
    let m = createConceptMap('m', 'u', 'M');
    m = addNode(m, { id: 'x', label: 'Дропка', x: 0, y: 0 });

    expect(buildExportSvg(m).match(/fill="#1e293b"/g)).toHaveLength(1);
  });

  it('wraps a label long enough to run off the picture', () => {
    let m = createConceptMap('m', 'u', 'M');
    m = addNode(m, { id: 'x', label: 'Собирање и одземање на дропки', x: 0, y: 0 });

    expect(buildExportSvg(m).match(/fill="#1e293b"/g)).toHaveLength(2);
  });

  it('escapes an edge label too', () => {
    let m = createConceptMap('m', 'u', 'M');
    m = addNode(m, { id: 'a', label: 'A', x: 0, y: 0 });
    m = addNode(m, { id: 'b', label: 'B', x: 50, y: 0 });
    m = addEdge(m, { id: 'e', source: 'a', target: 'b', kind: 'relates', label: 'x < y' });

    expect(buildExportSvg(m)).toContain('x &lt; y');
  });

  it('fits the viewBox to where the teacher actually put the nodes', () => {
    // Nodes can be dragged into negative coordinates. A fixed viewBox would
    // crop the map without saying so.
    let m = createConceptMap('m', 'u', 'M');
    m = addNode(m, { id: 'a', label: 'A', x: -300, y: -200 });
    m = addNode(m, { id: 'b', label: 'B', x: 100, y: 100 });

    const viewBox = /viewBox="(-?\d+\.?\d*) (-?\d+\.?\d*) /.exec(buildExportSvg(m))!;

    expect(Number(viewBox[1])).toBeLessThan(-300);
    expect(Number(viewBox[2])).toBeLessThan(-200);
  });

  it('draws the outcome codes a teacher attached', () => {
    // A printed map without them is just a diagram; they are why the concept
    // is on the map at all.
    const m = attachOutcome(map(), 'a', 'МА.5.2.1');
    expect(buildExportSvg(m)).toContain('МА.5.2.1');
  });

  it('summarises rather than overprinting when a node has several codes', () => {
    let m = attachOutcome(map(), 'a', 'МА.5.2.1');
    m = attachOutcome(m, 'a', 'МА.5.2.2');
    m = attachOutcome(m, 'a', 'МА.5.2.3');

    const svg = buildExportSvg(m);
    expect(svg).toContain('МА.5.2.1');
    expect(svg).toContain('+2');
  });

  it('distinguishes a prerequisite from a plain connection', () => {
    const svg = buildExportSvg(map());
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('marker-end');
  });

  it('paints a background, so the PNG is not blank on paper', () => {
    expect(buildExportSvg(map())).toContain('fill="#ffffff"');
    expect(buildExportSvg(map(), { background: '#000000' })).toContain('fill="#000000"');
  });

  it('produces a valid document for an empty map', () => {
    const svg = buildExportSvg(createConceptMap('m', 'u', 'Празна'));

    expect(svg).toContain('Празна');
    expect(svg).toContain('</svg>');
  });

  it('skips an edge whose endpoint is missing instead of writing a broken file', () => {
    const broken = { ...map(), edges: [{ id: 'e', source: 'a', target: 'ghost', kind: 'relates' as const }] };
    const svg = buildExportSvg(broken);

    expect(svg).toContain('</svg>');
    expect(svg).not.toContain('<line');
  });

  it('is deterministic — the same map always gives the same file', () => {
    const m = map();
    expect(buildExportSvg(m)).toBe(buildExportSvg(m));
  });
});
