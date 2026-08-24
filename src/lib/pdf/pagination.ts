/**
 * PDF pagination that respects content blocks
 * (EXPERT_LEVEL_MASTER_PLAN, 6.1).
 *
 * The old exporter rasterised the whole document into one tall canvas and then
 * re-drew it shifted by exactly one page height per page. That cuts wherever
 * the page boundary happens to land — routinely through the middle of a
 * formula or a task. Here the block geometry decides where pages break, so a
 * block is never split across two pages.
 */

export interface BlockRect {
  /** Offset from the top of the measured container, in the same unit as height. */
  top: number;
  height: number;
}

export interface PageSlice {
  /** Where this page starts within the full canvas. */
  offset: number;
  /** How much of the canvas this page shows. */
  height: number;
}

export interface PaginationOptions {
  /** Usable height of one page, in the same unit as the block rects. */
  pageHeight: number;
  /** Total height of the rendered content. */
  totalHeight: number;
}

/**
 * Splits content into pages that only break between blocks.
 *
 * A block taller than a page cannot be kept whole — it gets a page (or several)
 * to itself and is split as a last resort, which is still better than silently
 * clipping it.
 */
export function computePageSlices(blocks: readonly BlockRect[], options: PaginationOptions): PageSlice[] {
  const { pageHeight, totalHeight } = options;
  if (!(pageHeight > 0) || !(totalHeight > 0)) return [];

  const ordered = [...blocks]
    .filter(b => Number.isFinite(b.top) && Number.isFinite(b.height) && b.height >= 0)
    .sort((a, b) => a.top - b.top);

  if (ordered.length === 0) {
    return evenSlices(totalHeight, pageHeight);
  }

  const slices: PageSlice[] = [];
  let pageStart = 0;

  while (pageStart < totalHeight - 0.5) {
    const pageEnd = pageStart + pageHeight;

    if (pageEnd >= totalHeight) {
      slices.push({ offset: pageStart, height: totalHeight - pageStart });
      break;
    }

    // The first block that would be cut by this page boundary.
    const straddling = ordered.find(b => b.top < pageEnd && b.top + b.height > pageEnd);

    let cut = pageEnd;
    if (straddling) {
      // Break before the straddling block, unless it starts at (or before) the
      // page start — a block taller than a page has to be split.
      cut = straddling.top > pageStart + 0.5 ? straddling.top : pageEnd;
    }

    slices.push({ offset: pageStart, height: cut - pageStart });
    pageStart = cut;
  }

  return slices;
}

function evenSlices(totalHeight: number, pageHeight: number): PageSlice[] {
  const slices: PageSlice[] = [];
  for (let offset = 0; offset < totalHeight - 0.5; offset += pageHeight) {
    slices.push({ offset, height: Math.min(pageHeight, totalHeight - offset) });
  }
  return slices;
}

/**
 * Reads block geometry out of a rendered container.
 *
 * Elements marked `data-pdf-block` are the unit of pagination; without any, the
 * container's direct children are used, which is the sensible default for a
 * document made of stacked sections.
 */
export function measureBlocks(container: HTMLElement): BlockRect[] {
  const marked = container.querySelectorAll<HTMLElement>('[data-pdf-block]');
  const elements: HTMLElement[] = marked.length > 0
    ? Array.from(marked)
    : (Array.from(container.children) as HTMLElement[]);

  const containerTop = container.getBoundingClientRect().top;

  return elements.map(el => {
    const rect = el.getBoundingClientRect();
    return { top: rect.top - containerTop, height: rect.height };
  });
}

export interface MathReadyOptions {
  /** Give up after this long and export anyway, rather than hanging. */
  timeoutMs?: number;
  pollIntervalMs?: number;
  /** Injectable for tests. */
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

/**
 * Waits until KaTeX has actually rendered and its fonts are loaded.
 *
 * Replaces a blind `setTimeout(600)`, which was both too long on a fast machine
 * and too short for a document with many formulas — the failure mode being a
 * PDF full of raw `$...$` source.
 */
export async function waitForMathRendering(
  container: HTMLElement,
  options: MathReadyOptions = {}
): Promise<boolean> {
  const {
    timeoutMs = 5000,
    pollIntervalMs = 50,
    now = () => Date.now(),
    wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  } = options;

  const deadline = now() + timeoutMs;

  // Fonts must be ready or formulas measure at the wrong size.
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) {
    await Promise.race([fonts.ready, wait(timeoutMs)]);
  }

  while (now() < deadline) {
    if (isMathRendered(container)) return true;
    await wait(pollIntervalMs);
  }

  return isMathRendered(container);
}

/**
 * True when every math placeholder in the container has become a rendered
 * KaTeX node. A container with no math at all is trivially ready.
 */
export function isMathRendered(container: HTMLElement): boolean {
  // Un-rendered math still shows its delimiters in a text node.
  const rendered = container.querySelectorAll('.katex').length;
  const pending = container.querySelectorAll('[data-math-pending]').length;

  if (pending > 0) return false;
  if (rendered > 0) return true;

  return !containsRawMathDelimiters(container.textContent || '');
}

/** Detects `$…$` / `$$…$$` source that should have been rendered by now. */
export function containsRawMathDelimiters(text: string): boolean {
  return /\$\$[^$]+\$\$|\$[^$\n]+\$/.test(text);
}
