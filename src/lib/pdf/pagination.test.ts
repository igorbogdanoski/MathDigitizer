import { describe, it, expect } from 'vitest';
import {
  BlockRect,
  computePageSlices,
  containsRawMathDelimiters,
  waitForMathRendering,
} from './pagination';

/** Blocks of equal height, stacked with no gaps. */
const stack = (heights: number[]): BlockRect[] => {
  let top = 0;
  return heights.map(height => {
    const block = { top, height };
    top += height;
    return block;
  });
};

describe('computePageSlices', () => {
  it('covers the whole document exactly once', () => {
    const blocks = stack([100, 100, 100, 100, 100]);
    const slices = computePageSlices(blocks, { pageHeight: 250, totalHeight: 500 });

    expect(slices[0].offset).toBe(0);
    const end = slices[slices.length - 1];
    expect(end.offset + end.height).toBeCloseTo(500, 5);

    // Contiguous: each slice starts where the previous ended
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i].offset).toBeCloseTo(slices[i - 1].offset + slices[i - 1].height, 5);
    }
  });

  it('never cuts through a block (the whole point)', () => {
    const blocks = stack([100, 100, 100, 100, 100]);
    const slices = computePageSlices(blocks, { pageHeight: 250, totalHeight: 500 });

    const cuts = slices.slice(1).map(s => s.offset);
    for (const cut of cuts) {
      const straddled = blocks.find(b => b.top < cut && b.top + b.height > cut);
      expect(straddled).toBeUndefined();
    }
  });

  it('breaks before a block that would straddle the boundary', () => {
    // Page height 250; blocks end at 100, 200, 300 — the third straddles 250
    const blocks = stack([100, 100, 100]);
    const slices = computePageSlices(blocks, { pageHeight: 250, totalHeight: 300 });

    expect(slices[0].height).toBe(200);
    expect(slices[1]).toEqual({ offset: 200, height: 100 });
  });

  it('fits a whole page when blocks align with it', () => {
    const blocks = stack([125, 125, 125, 125]);
    const slices = computePageSlices(blocks, { pageHeight: 250, totalHeight: 500 });
    expect(slices).toHaveLength(2);
    expect(slices[0]).toEqual({ offset: 0, height: 250 });
  });

  it('gives an oversized block its own page rather than clipping it', () => {
    // A single 600-tall block on 250-tall pages cannot be kept whole
    const blocks: BlockRect[] = [{ top: 0, height: 600 }];
    const slices = computePageSlices(blocks, { pageHeight: 250, totalHeight: 600 });

    expect(slices.length).toBeGreaterThan(1);
    const end = slices[slices.length - 1];
    expect(end.offset + end.height).toBeCloseTo(600, 5);
  });

  it('makes progress even when a tall block starts mid-page', () => {
    const blocks: BlockRect[] = [
      { top: 0, height: 100 },
      { top: 100, height: 900 },
    ];
    const slices = computePageSlices(blocks, { pageHeight: 250, totalHeight: 1000 });

    expect(slices.length).toBeGreaterThan(1);
    expect(slices.every(s => s.height > 0)).toBe(true);
    const end = slices[slices.length - 1];
    expect(end.offset + end.height).toBeCloseTo(1000, 5);
  });

  it('returns a single page when everything fits', () => {
    const slices = computePageSlices(stack([50, 50]), { pageHeight: 250, totalHeight: 100 });
    expect(slices).toEqual([{ offset: 0, height: 100 }]);
  });

  it('falls back to even slices when no blocks were measured', () => {
    const slices = computePageSlices([], { pageHeight: 100, totalHeight: 250 });
    expect(slices).toEqual([
      { offset: 0, height: 100 },
      { offset: 100, height: 100 },
      { offset: 200, height: 50 },
    ]);
  });

  it('handles degenerate inputs without looping forever', () => {
    expect(computePageSlices(stack([10]), { pageHeight: 0, totalHeight: 100 })).toEqual([]);
    expect(computePageSlices(stack([10]), { pageHeight: 100, totalHeight: 0 })).toEqual([]);
  });

  it('ignores malformed block rects', () => {
    const blocks = [
      { top: 0, height: 100 },
      { top: NaN, height: 50 },
      { top: 100, height: -5 },
    ] as BlockRect[];
    expect(() => computePageSlices(blocks, { pageHeight: 250, totalHeight: 200 })).not.toThrow();
  });

  it('sorts blocks that arrive out of order', () => {
    const blocks: BlockRect[] = [
      { top: 200, height: 100 },
      { top: 0, height: 100 },
      { top: 100, height: 100 },
    ];
    const slices = computePageSlices(blocks, { pageHeight: 250, totalHeight: 300 });
    expect(slices[0].height).toBe(200);
  });
});

describe('containsRawMathDelimiters', () => {
  it('detects unrendered inline and display math', () => {
    expect(containsRawMathDelimiters('Реши $x+1$')).toBe(true);
    expect(containsRawMathDelimiters('$$x^2$$')).toBe(true);
  });

  it('does not flag plain prose or a lone dollar', () => {
    expect(containsRawMathDelimiters('нема формули')).toBe(false);
    expect(containsRawMathDelimiters('цена 5$')).toBe(false);
  });
});

describe('waitForMathRendering', () => {
  const container = (html: string): HTMLElement => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
  };

  it('returns immediately when the maths is already rendered', async () => {
    const waits: number[] = [];
    const ready = await waitForMathRendering(container('<span class="katex">x</span>'), {
      wait: async (ms) => { waits.push(ms); },
    });
    expect(ready).toBe(true);
  });

  it('treats a container with no maths at all as ready', async () => {
    expect(await waitForMathRendering(container('<p>само текст</p>'), { wait: async () => {} })).toBe(true);
  });

  it('waits while a placeholder is still pending, then succeeds', async () => {
    const el = container('<span data-math-pending>$x$</span>');
    let ticks = 0;

    const ready = await waitForMathRendering(el, {
      pollIntervalMs: 1,
      timeoutMs: 100,
      now: () => ticks,
      wait: async () => {
        ticks += 1;
        if (ticks === 3) el.innerHTML = '<span class="katex">x</span>';
      },
    });

    expect(ready).toBe(true);
    expect(ticks).toBeGreaterThanOrEqual(3);
  });

  it('gives up after the timeout instead of hanging the export', async () => {
    let ticks = 0;
    const ready = await waitForMathRendering(container('<span data-math-pending>$x$</span>'), {
      pollIntervalMs: 1,
      timeoutMs: 5,
      now: () => ticks,
      wait: async () => { ticks += 1; },
    });

    expect(ready).toBe(false);
  });
});
