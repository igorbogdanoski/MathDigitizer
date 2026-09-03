/**
 * Rebuilds lines and tables from positioned text fragments.
 *
 * A PDF has no paragraphs and no tables — it has glyphs at coordinates. The
 * extractor used to take every fragment on a page and join them with a single
 * space, which throws away not just the table structure but the *line* breaks:
 *
 *     Задача 1 2x + 3 = 7 x = 2 Задача 2 3x − 1 = 8 x = 3
 *
 * In a textbook that is often a three-column table of tasks, and once flattened
 * nothing downstream can tell which answer belongs to which task. The grader
 * then distils "misconceptions" from a text where the numbers have been
 * shuffled together.
 *
 * This uses what `pdfjs` already hands over — the transform matrix of every
 * fragment — to put the rows and columns back:
 *
 *  - fragments whose baselines agree, within a tolerance scaled to the font
 *    size, are one line;
 *  - inside a line, a horizontal gap much wider than that line's own spaces is
 *    a column boundary, not a word space;
 *  - two or more consecutive lines that both split into columns are a table,
 *    and are emitted as a Markdown table so the cell relationships survive
 *    into the prompt.
 *
 * Everything is a heuristic over coordinates, so each threshold below says what
 * it is protecting against.
 */

/** One positioned fragment, as `pdfjs` reports it from `getTextContent()`. */
export interface TextFragment {
  str: string;
  /** `[scaleX, skewX, skewY, scaleY, translateX, translateY]`. */
  transform: number[];
  width: number;
  height?: number;
}

export interface LayoutLine {
  cells: string[];
  /** Baseline, in PDF user space: y grows upwards. */
  y: number;
}

/**
 * Baselines rarely match exactly — subscripts, different fonts on one line and
 * rounding all move them a little. A fraction of the font height keeps
 * `x²` on the same line as the `x` beside it while still separating two rows.
 */
export const BASELINE_TOLERANCE = 0.6;

/**
 * A gap wider than this many times the font size is a column boundary.
 *
 * Measured against the font rather than against the line's other gaps. The
 * first attempt compared each gap to the median gap on the line, which fails in
 * exactly the common case: when every cell is a single fragment — a table of
 * short answers — every gap *is* a column gap, so the median is one too and
 * nothing ever exceeds it.
 *
 * 1.5em leaves room above a stretched space in justified text (which reaches
 * roughly an em at its worst) without missing real columns, which are typically
 * several ems apart.
 */
export const COLUMN_GAP_EM = 1.5;

/** Floor for very small type, where 1.5em is only a few points. */
export const MIN_COLUMN_GAP = 8;

/** One multi-column line is a coincidence; two in a row is a table. */
export const MIN_TABLE_ROWS = 2;

/**
 * A gutter must be at least this fraction of the page's width to count as a
 * page-level column break.
 *
 * Found by running the pass over a real answers page from a Year 8 textbook: it
 * is set in two page columns, and grouping by baseline alone stitched a line
 * from the left column to an unrelated line on the right. Flattened text made
 * that obvious nonsense; structured text made it *look* trustworthy, which is
 * worse.
 */
export const MIN_GUTTER_RATIO = 0.03;

/**
 * Each side of a gutter must hold at least this share of the fragments.
 *
 * Without it, a page number alone in the corner or a marginal note splits the
 * page into "columns" of 200 fragments and 3.
 */
export const MIN_COLUMN_SHARE = 0.2;

/**
 * Share of fragments allowed to cross a gutter and still leave it a gutter.
 *
 * A running header and a page number span the full width of a two-column page,
 * so demanding a perfectly clean band finds no gutter at all on exactly the
 * pages that have one. The crossing fragments end up in the left column, which
 * is where a header belongs in reading order anyway.
 */
export const MAX_GUTTER_CROSSING_SHARE = 0.04;

/** Columns within columns happen; three levels is past any real page. */
export const MAX_COLUMN_DEPTH = 3;

/**
 * A real text column contains at least this many lines of running prose.
 *
 * The guard exists because of a diagram-heavy review page: exercise numbers run
 * down the left margin, that strip has a clean gutter beside it, and splitting
 * on it tore every exercise number away from the exercise it labels. A margin
 * strip is made of single tokens; a column of text is not. So both sides have
 * to look like text before the page is treated as two columns.
 */
export const MIN_PROSE_LINES = 3;

/** Characters that make a line count as prose rather than a label. */
export const PROSE_LINE_CHARS = 25;

const isBlank = (value: string) => value.trim().length === 0;

/** Groups fragments into lines by baseline, then orders each line left to right. */
export function groupIntoLines(fragments: readonly TextFragment[]): LayoutLine[] {
  const placed = fragments
    .filter(fragment => !isBlank(fragment.str))
    .map(fragment => ({
      text: fragment.str,
      x: fragment.transform[4],
      y: fragment.transform[5],
      width: fragment.width,
      height: fragment.height ?? (Math.abs(fragment.transform[3]) || 10),
    }));

  if (placed.length === 0) return [];

  // Top to bottom. y grows upwards in PDF space, so descending y is reading
  // order.
  const rows: (typeof placed)[] = [];
  for (const fragment of [...placed].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const current = rows[rows.length - 1];
    const tolerance = fragment.height * BASELINE_TOLERANCE;

    if (current && Math.abs(current[0].y - fragment.y) <= tolerance) {
      current.push(fragment);
    } else {
      rows.push([fragment]);
    }
  }

  return rows.map(row => {
    const ordered = [...row].sort((a, b) => a.x - b.x);
    return { cells: splitIntoCells(ordered), y: ordered[0].y };
  });
}

/**
 * Splits one line's fragments into cells wherever the gap is too wide to be a
 * space.
 *
 * The comparison is against that line's own gaps rather than a fixed number of
 * points, because a caption at 8pt and a heading at 24pt have very different
 * ideas of how wide a space is.
 */
function splitIntoCells(
  ordered: readonly { text: string; x: number; width: number; height: number }[],
): string[] {
  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    gaps.push(ordered[i].x - (ordered[i - 1].x + ordered[i - 1].width));
  }

  // The largest font on the line sets the scale, so a subscript does not lower
  // the bar and split the line it is sitting on.
  const em = Math.max(...ordered.map(fragment => fragment.height));
  const threshold = Math.max(em * COLUMN_GAP_EM, MIN_COLUMN_GAP);

  const cells: string[] = [];
  let cell = ordered[0].text;

  for (let i = 1; i < ordered.length; i += 1) {
    const gap = gaps[i - 1];
    if (gap >= threshold) {
      cells.push(cell.trim());
      cell = ordered[i].text;
    } else {
      // pdfjs emits fragments without their spaces, so a gap that is a space
      // has to become one. Zero or negative means the glyphs touch — kerning,
      // or a ligature split across fragments — and must not gain a space.
      cell += (gap > 0 ? ' ' : '') + ordered[i].text;
    }
  }
  cells.push(cell.trim());

  return cells.filter(value => value.length > 0);
}

/**
 * Renders lines back to text, with runs of multi-column lines as Markdown
 * tables.
 *
 * Markdown because that is what the model reads best, and because a pipe table
 * keeps the cell relationship visible to a human reading the prompt log.
 */
export function renderLines(lines: readonly LayoutLine[]): string {
  const out: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.cells.length < 2) {
      out.push(line.cells.join(' '));
      index += 1;
      continue;
    }

    // Collect the run of consecutive lines that also split into columns.
    const run: LayoutLine[] = [];
    while (index < lines.length && lines[index].cells.length >= 2) {
      run.push(lines[index]);
      index += 1;
    }

    if (run.length < MIN_TABLE_ROWS) {
      // A single columned line is far more likely to be a heading with a page
      // number, or a formula with wide spacing, than a one-row table.
      out.push(run.map(row => row.cells.join('  ')).join('\n'));
      continue;
    }

    out.push(renderTable(run));
  }

  return out.join('\n');
}

function renderTable(rows: readonly LayoutLine[]): string {
  const columns = Math.max(...rows.map(row => row.cells.length));
  const pad = (cells: readonly string[]) =>
    Array.from({ length: columns }, (_, i) => cells[i] ?? '');

  const [header, ...body] = rows;

  return [
    `| ${pad(header.cells).join(' | ')} |`,
    `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`,
    ...body.map(row => `| ${pad(row.cells).join(' | ')} |`),
  ].join('\n');
}

/**
 * Splits a page into its reading columns, left to right.
 *
 * A textbook page set in two columns has, by construction, a vertical band that
 * no line of text crosses. Finding it matters before anything else: grouping by
 * baseline first would join a line in the left column to whatever happens to
 * sit at the same height on the right.
 *
 * Returns a single group when the page is one column, which is the common case.
 */
export function splitIntoColumns(
  fragments: readonly TextFragment[],
  depth = 0,
): TextFragment[][] {
  if (fragments.length < 8 || depth >= MAX_COLUMN_DEPTH) return [fragments as TextFragment[]];

  const spans = fragments.map(fragment => ({
    fragment,
    left: fragment.transform[4],
    right: fragment.transform[4] + fragment.width,
  }));

  const pageLeft = Math.min(...spans.map(span => span.left));
  const pageRight = Math.max(...spans.map(span => span.right));
  const pageWidth = pageRight - pageLeft;
  if (pageWidth <= 0) return [fragments as TextFragment[]];

  // Walk candidate split positions across the middle of the page and keep the
  // widest run that nothing crosses. Only the middle: a wide left margin is not
  // a gutter, it is a margin.
  const step = Math.max(pageWidth / 400, 1);
  const allowedCrossings = Math.floor(fragments.length * MAX_GUTTER_CROSSING_SHARE);
  let best: { start: number; end: number } | null = null;
  let runStart: number | null = null;

  for (let x = pageLeft + pageWidth * 0.25; x <= pageLeft + pageWidth * 0.75; x += step) {
    const crossings = spans.filter(span => span.left < x && span.right > x).length;
    const crossed = crossings > allowedCrossings;

    if (!crossed) {
      runStart ??= x;
    } else if (runStart !== null) {
      if (!best || x - runStart > best.end - best.start) best = { start: runStart, end: x };
      runStart = null;
    }
  }
  if (runStart !== null) {
    const end = pageLeft + pageWidth * 0.75;
    if (!best || end - runStart > best.end - best.start) best = { start: runStart, end };
  }

  if (!best || best.end - best.start < pageWidth * MIN_GUTTER_RATIO) {
    return [fragments as TextFragment[]];
  }

  const middle = (best.start + best.end) / 2;
  const leftSpans = spans.filter(span => span.right <= middle);
  const rightSpans = spans.filter(span => span.right > middle);

  const share = Math.min(leftSpans.length, rightSpans.length) / fragments.length;
  if (share < MIN_COLUMN_SHARE) return [fragments as TextFragment[]];

  // A table's column gap and a page's gutter are indistinguishable from the gap
  // alone — both are bands no text crosses. What separates them is proportion.
  // A page gutter is narrow relative to the columns it divides, because the
  // text fills those columns; a table's gap is wide relative to its cells,
  // which are short. Without this a three-column table of tasks was split into
  // two "page columns" and its rows were pulled apart.
  const widthOf = (group: typeof spans) =>
    Math.max(...group.map(span => span.right)) - Math.min(...group.map(span => span.left));
  const gutter = best.end - best.start;

  if (gutter > 0.5 * Math.min(widthOf(leftSpans), widthOf(rightSpans))) {
    return [fragments as TextFragment[]];
  }

  const left = leftSpans.map(span => span.fragment);
  const right = rightSpans.map(span => span.fragment);

  const proseLines = (group: readonly TextFragment[]) =>
    groupIntoLines(group).filter(line => line.cells.join(' ').length >= PROSE_LINE_CHARS).length;

  if (proseLines(left) < MIN_PROSE_LINES || proseLines(right) < MIN_PROSE_LINES) {
    return [fragments as TextFragment[]];
  }

  // Recurse: a two-column page can hold a two-column block, and an answer key
  // routinely runs four or more.
  return [
    ...splitIntoColumns(left, depth + 1),
    ...splitIntoColumns(right, depth + 1),
  ];
}

/** The whole pass: positioned fragments in, structured text out. */
export function reconstructPageText(fragments: readonly TextFragment[]): string {
  return splitIntoColumns(fragments)
    .map(column => renderLines(groupIntoLines(column)))
    .filter(text => text.trim().length > 0)
    .join('\n\n');
}

/**
 * Converts the tables in mammoth's HTML to Markdown, and strips the rest.
 *
 * `mammoth.extractRawText` loses DOCX tables the same way the old PDF path lost
 * them: the cells arrive as a run of words with no indication of which row or
 * column they came from. Its HTML output keeps the `<table>`, so the tables are
 * taken from there and everything else is reduced to plain lines.
 *
 * Deliberately a regex pass rather than a DOM parse: this also runs where there
 * is no `DOMParser`, and the input is mammoth's own narrow, predictable output
 * rather than arbitrary web HTML.
 */
export function htmlTablesToMarkdown(html: string): string {
  const decode = (value: string) =>
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Last, so a literal &amp;lt; does not become a tag.
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

  const tableToMarkdown = (table: string): string => {
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(match =>
      [...match[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(cell => decode(cell[1])),
    );

    const filled = rows.filter(row => row.some(cell => cell.length > 0));
    if (filled.length === 0) return '';

    const columns = Math.max(...filled.map(row => row.length));
    const pad = (row: readonly string[]) => Array.from({ length: columns }, (_, i) => row[i] ?? '');
    const [header, ...body] = filled;

    return [
      '',
      `| ${pad(header).join(' | ')} |`,
      `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`,
      ...body.map(row => `| ${pad(row).join(' | ')} |`),
      '',
    ].join('\n');
  };

  const withTables = html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, tableToMarkdown);

  return withTables
    // Block boundaries become line breaks before the tags are stripped, or the
    // whole document collapses into one paragraph.
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
