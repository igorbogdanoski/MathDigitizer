import { describe, it, expect } from 'vitest';
import { groupIntoLines, reconstructPageText, splitIntoColumns, htmlTablesToMarkdown, type TextFragment } from './layout';

/**
 * The extractor used to join every fragment on a page with a single space, so a
 * table of tasks came out as one run of words:
 *
 *     Задача 1 2x + 3 = 7 x = 2 Задача 2 3x − 1 = 8 x = 3
 *
 * Which answer belongs to which task is gone, and the grader distils
 * "misconceptions" from that. These tests are written against positioned
 * fragments — the shape `pdfjs` actually returns — so they run without a PDF.
 */

/** Builds a fragment the way pdfjs reports one. */
function at(x: number, y: number, str: string, size = 10): TextFragment {
  return {
    str,
    // Only translateX/translateY and scaleY are read; the rest mirror pdfjs.
    transform: [size, 0, 0, size, x, y],
    // ~0.5em per character is close enough for a monospaced stand-in.
    width: str.length * size * 0.5,
    height: size,
  };
}

/**
 * Lays words out along one baseline, each a space apart — the way a line of
 * prose actually arrives, rather than at coordinates picked by hand.
 */
function run(x: number, y: number, words: string[], space = 4, size = 10): TextFragment[] {
  let cursor = x;
  return words.map(word => {
    const fragment = at(cursor, y, word, size);
    cursor += fragment.width + space;
    return fragment;
  });
}

describe('grouping fragments into lines', () => {
  it('puts fragments that share a baseline on one line', () => {
    const lines = groupIntoLines(run(50, 700, ['Реши', 'ја', 'равенката']));

    expect(lines).toHaveLength(1);
    expect(lines[0].cells).toEqual(['Реши ја равенката']);
  });

  it('reads top to bottom, because y grows upwards in a PDF', () => {
    const lines = groupIntoLines([at(50, 600, 'втор'), at(50, 700, 'прв'), at(50, 500, 'трет')]);

    expect(lines.map(line => line.cells[0])).toEqual(['прв', 'втор', 'трет']);
  });

  it('keeps a superscript on the line it belongs to', () => {
    // x² arrives as two fragments with different baselines. Splitting them
    // would turn every quadratic in the book into two lines.
    const lines = groupIntoLines([at(50, 700, 'x'), at(56, 703.5, '2'), at(64, 700, '+ 1 = 0')]);

    expect(lines).toHaveLength(1);
  });

  it('separates two rows of a table', () => {
    const lines = groupIntoLines([at(50, 700, 'ред 1'), at(50, 680, 'ред 2')]);

    expect(lines.map(line => line.cells[0])).toEqual(['ред 1', 'ред 2']);
  });
});

describe('splitting a line into cells', () => {
  it('treats a wide gap as a column boundary', () => {
    const lines = groupIntoLines([at(50, 700, 'Задача 1'), at(300, 700, '2x + 3 = 7'), at(500, 700, 'x = 2')]);

    expect(lines[0].cells).toEqual(['Задача 1', '2x + 3 = 7', 'x = 2']);
  });

  it('does not split justified prose into imaginary columns', () => {
    // Justified text stretches its spaces, and a space of 9 at 10pt is about as
    // stretched as justification gets. Against a lower threshold this sentence
    // came out as a six-column table.
    const fragments = run(50, 700, ['Логаритамската', 'равенка', 'се', 'решава', 'со', 'проверка'], 9);

    expect(groupIntoLines(fragments)[0].cells).toHaveLength(1);
  });

  it('adds the spaces pdfjs leaves out, but not where glyphs touch', () => {
    // Fragments arrive without their spaces. A zero or negative gap is kerning
    // or a split ligature, and must not gain one.
    const touching = groupIntoLines([
      { str: 'фи', transform: [10, 0, 0, 10, 50, 700], width: 12, height: 10 },
      { str: 'кс', transform: [10, 0, 0, 10, 62, 700], width: 12, height: 10 },
    ]);

    expect(touching[0].cells).toEqual(['фикс']);
  });

  it('scales the threshold to the font, not to a fixed number of points', () => {
    // The same visual gap means different things at 8pt and at 24pt.
    const heading = groupIntoLines([at(50, 700, 'Глава', 24), at(140, 700, 'Логаритми', 24)]);

    expect(heading[0].cells).toEqual(['Глава Логаритми']);
  });
});

describe('rendering', () => {
  it('turns consecutive columned lines into a Markdown table', () => {
    const text = reconstructPageText([
      at(50, 700, 'Задача'), at(300, 700, 'Равенка'), at(500, 700, 'Решение'),
      at(50, 680, '1'), at(300, 680, '2x + 3 = 7'), at(500, 680, 'x = 2'),
      at(50, 660, '2'), at(300, 660, '3x − 1 = 8'), at(500, 660, 'x = 3'),
    ]);

    expect(text).toBe([
      '| Задача | Равенка | Решение |',
      '| --- | --- | --- |',
      '| 1 | 2x + 3 = 7 | x = 2 |',
      '| 2 | 3x − 1 = 8 | x = 3 |',
    ].join('\n'));
  });

  it('keeps which answer belongs to which task', () => {
    // The whole point. Before this, the same page produced one line in which
    // the numbers had been shuffled together.
    const text = reconstructPageText([
      at(50, 700, 'Задача 1'), at(300, 700, 'x = 2'),
      at(50, 680, 'Задача 2'), at(300, 680, 'x = 3'),
    ]);

    expect(text).toContain('| Задача 1 | x = 2 |');
    expect(text).toContain('| Задача 2 | x = 3 |');
    expect(text).not.toContain('Задача 1 x = 2 Задача 2');
  });

  it('does not call a single columned line a table', () => {
    // A heading with a page number on the right splits into two cells and is
    // not a table.
    const text = reconstructPageText([
      at(50, 700, 'Логаритамски равенки'), at(520, 700, '47'),
      at(50, 670, 'Во оваа глава ги решаваме'),
    ]);

    expect(text).not.toContain('---');
    expect(text.split('\n')[0]).toBe('Логаритамски равенки  47');
  });

  it('pads short rows so the columns stay aligned', () => {
    const text = reconstructPageText([
      at(50, 700, 'a'), at(300, 700, 'b'), at(500, 700, 'c'),
      at(50, 680, 'd'), at(300, 680, 'e'),
    ]);

    expect(text).toContain('| d | e |  |');
  });

  it('survives a page with nothing on it', () => {
    expect(reconstructPageText([])).toBe('');
    expect(reconstructPageText([at(50, 700, '   ')])).toBe('');
  });
});

describe('page columns', () => {
  /** A block of prose lines down one side of the page. */
  const prose = (x: number, count: number) =>
    Array.from({ length: count }, (_, i) =>
      run(x, 700 - i * 14, ['Логаритамската', 'равенка', 'се', 'решава', 'со', 'проверка'])).flat();

  it('splits a page set in two columns of text', () => {
    const columns = splitIntoColumns([...prose(50, 5), ...prose(340, 5)]);

    expect(columns).toHaveLength(2);
    // Left column first: reading order, not file order.
    expect(columns[0][0].transform[4]).toBeLessThan(columns[1][0].transform[4]);
  });

  it('reads each column top to bottom instead of stitching across the gutter', () => {
    const text = reconstructPageText([
      ...run(50, 700, ['Левата', 'колона', 'почнува', 'тука', 'и', 'продолжува']),
      ...run(50, 686, ['Левата', 'колона', 'продолжува', 'на', 'втор', 'ред']),
      ...run(50, 672, ['Левата', 'колона', 'завршува', 'на', 'трет', 'ред']),
      // A real gutter is narrow relative to the columns it divides — that is
      // what tells it apart from the gap inside a table.
      ...run(280, 700, ['Десната', 'колона', 'почнува', 'тука', 'и', 'продолжува']),
      ...run(280, 686, ['Десната', 'колона', 'продолжува', 'на', 'втор', 'ред']),
      ...run(280, 672, ['Десната', 'колона', 'завршува', 'на', 'трет', 'ред']),
    ]);

    const lines = text.split('\n').filter(line => line.trim());
    expect(lines.filter(line => line.startsWith('Левата')).length).toBe(3);
    // All of the left column comes before any of the right.
    expect(lines.findIndex(line => line.startsWith('Десната')))
      .toBeGreaterThan(lines.findLastIndex(line => line.startsWith('Левата')));
  });

  it('does not split a margin strip of exercise numbers off its content', () => {
    // A diagram-heavy review page has the exercise numbers running down the
    // left margin. There is a clean gutter beside that strip, and splitting on
    // it tore every number away from the exercise it labels — the text got a
    // tidy structure and the wrong one.
    const numbers = ['1', '2A', 'a', 'd', '2', '2B', '3'].flatMap((label, i) => [at(30, 700 - i * 30, label)]);
    const columns = splitIntoColumns([...numbers, ...prose(90, 7)]);

    expect(columns).toHaveLength(1);
  });

  it('does not mistake the column gap of a table for a page gutter', () => {
    // Both are bands no text crosses. A page gutter is narrow relative to the
    // columns it divides; a table's gap is wide relative to its short cells.
    const columns = splitIntoColumns([
      at(50, 700, '1'), at(300, 700, 'x = 2'),
      at(50, 680, '2'), at(300, 680, 'x = 3'),
      at(50, 660, '3'), at(300, 660, 'x = 4'),
      at(50, 640, '4'), at(300, 640, 'x = 5'),
    ]);

    expect(columns).toHaveLength(1);
  });

  it('leaves a short page alone', () => {
    expect(splitIntoColumns([at(50, 700, 'кратко')])).toHaveLength(1);
  });
});

describe('DOCX tables, via mammoth HTML', () => {
  it('renders a table as Markdown', () => {
    const html = '<table><tr><th>Задача</th><th>Решение</th></tr>'
      + '<tr><td>2x = 4</td><td>x = 2</td></tr></table>';

    expect(htmlTablesToMarkdown(html)).toBe([
      '| Задача | Решение |',
      '| --- | --- |',
      '| 2x = 4 | x = 2 |',
    ].join('\n'));
  });

  it('keeps the prose around a table on its own lines', () => {
    const html = '<p>Пред табелата</p><table><tr><td>1</td><td>2</td></tr>'
      + '<tr><td>3</td><td>4</td></tr></table><p>По табелата</p>';
    const text = htmlTablesToMarkdown(html);

    expect(text.startsWith('Пред табелата')).toBe(true);
    expect(text.endsWith('По табелата')).toBe(true);
    expect(text).toContain('| 1 | 2 |');
  });

  it('decodes entities without turning a written &lt; into a tag', () => {
    const html = '<p>Ако a &lt; b и b &amp;lt; c</p>';

    expect(htmlTablesToMarkdown(html)).toBe('Ако a < b и b &lt; c');
  });

  it('drops a table with no content rather than emitting an empty grid', () => {
    expect(htmlTablesToMarkdown('<table><tr><td></td><td>  </td></tr></table>')).toBe('');
  });

  it('does not collapse paragraphs into one line', () => {
    expect(htmlTablesToMarkdown('<p>прв</p><p>втор</p>')).toBe('прв\nвтор');
  });
});
