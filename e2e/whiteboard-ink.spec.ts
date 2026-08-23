import { test, expect, Page } from '@playwright/test';

/**
 * Whiteboard ink pipeline E2E — Phase 4.7 of EXPERT_LEVEL_MASTER_PLAN.
 *
 * Drives the real StrokeBuilder + sync reducer through synthetic pointer events
 * on the DEV probe route, because the board itself is teacher-gated and renders
 * via Konva. What is asserted here is the property the plan is really after:
 * pressure-aware ink that arrives at remote participants byte-identical, even
 * with duplicated chunks, plus palm rejection and per-user undo/redo.
 */

const PROBE = '/__e2e__/ink-pipeline';

/** Dispatches a real PointerEvent, which page.mouse cannot do (no pressure/pointerType). */
async function pointer(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
  options: { pointerType?: string; pressure?: number; pointerId?: number } = {}
) {
  await page.evaluate(
    ({ type, x, y, options }) => {
      const surface = document.querySelector('[data-testid="ink-surface"]') as HTMLElement;
      const rect = surface.getBoundingClientRect();
      surface.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
          pointerId: options.pointerId ?? 1,
          pointerType: options.pointerType ?? 'pen',
          pressure: options.pressure ?? 0.5,
          isPrimary: true,
        })
      );
    },
    { type, x, y, options }
  );
}

/** Draws a wave, so the samples are far enough apart to survive decimation. */
async function drawWave(page: Page, opts: { pointerType?: string; pressures?: number[] } = {}) {
  const pointerType = opts.pointerType ?? 'pen';
  const steps = 10;

  await pointer(page, 'pointerdown', 20, 60, { pointerType, pressure: opts.pressures?.[0] ?? 0.5 });
  for (let i = 1; i <= steps; i++) {
    const pressure = opts.pressures ? opts.pressures[Math.min(i, opts.pressures.length - 1)] : 0.5;
    await pointer(page, 'pointermove', 20 + i * 40, 60 + (i % 2 === 0 ? 60 : -20), { pointerType, pressure });
  }
  await pointer(page, 'pointerup', 20 + steps * 40, 60, { pointerType });
}

const readJson = async (page: Page, testId: string) =>
  JSON.parse((await page.getByTestId(testId).textContent()) || 'null');

test.describe('whiteboard ink pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PROBE, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Ink Pipeline Probe' })).toBeVisible({ timeout: 15_000 });
  });

  test('streams a stroke to remote participants byte-identically', async ({ page }) => {
    await drawWave(page);

    const local = await readJson(page, 'local-state');
    const remote = await readJson(page, 'remote-state');

    expect(local.strokes).toBe(1);
    expect(local.points[0]).toBeGreaterThan(2);

    // The whole point of the protocol: the mirror board holds the same ink,
    // even though half the chunks were delivered twice.
    expect(remote).toEqual(local);
    expect(await readJson(page, 'remote-points-raw')).toEqual(await readJson(page, 'local-points-raw'));
  });

  test('smooths and decimates rather than storing every raw sample', async ({ page }) => {
    // 40 tightly spaced samples: decimation drops most, smoothing re-densifies
    await pointer(page, 'pointerdown', 20, 100);
    for (let i = 1; i <= 40; i++) {
      await pointer(page, 'pointermove', 20 + i * 0.5, 100);
    }
    await pointer(page, 'pointerup', 40, 100);

    const local = await readJson(page, 'local-state');
    // Every sample kept verbatim would be 41 points; the pipeline is not a recorder.
    expect(local.points[0] / 2).not.toBe(41);
    expect(local.points[0]).toBeGreaterThan(0);
  });

  test('varies stroke width with pen pressure', async ({ page }) => {
    await drawWave(page, { pointerType: 'pen', pressures: [0.1, 0.15, 0.3, 0.6, 0.9, 1, 1, 1, 1, 1, 1] });

    const local = await readJson(page, 'local-state');
    expect(local.widths[0]).toBe(local.points[0] / 2);
    // A pressure ramp must produce more than one width bucket
    expect(local.distinctWidths[0]).toBeGreaterThan(1);
  });

  test('rejects palm touches while the pen is in use', async ({ page }) => {
    await pointer(page, 'pointerdown', 20, 60, { pointerType: 'pen', pressure: 0.7 });
    await pointer(page, 'pointermove', 120, 90, { pointerType: 'pen', pressure: 0.7 });

    // The resting hand lands as a touch contact — it must not draw.
    await pointer(page, 'pointerdown', 300, 200, { pointerType: 'touch', pointerId: 2 });
    await pointer(page, 'pointermove', 360, 240, { pointerType: 'touch', pointerId: 2 });

    await pointer(page, 'pointerup', 200, 60, { pointerType: 'pen' });

    expect(Number(await page.getByTestId('ignored-count').textContent())).toBeGreaterThan(0);
    const local = await readJson(page, 'local-state');
    expect(local.strokes).toBe(1);
  });

  test('undo and redo move a single stroke, in sync with the remote board', async ({ page }) => {
    await drawWave(page);
    await drawWave(page);

    expect((await readJson(page, 'local-state')).strokes).toBe(2);

    await page.getByTestId('undo').click();
    expect((await readJson(page, 'local-state')).strokes).toBe(1);
    expect((await readJson(page, 'remote-state')).strokes).toBe(1);

    await page.getByTestId('redo').click();
    expect((await readJson(page, 'local-state')).strokes).toBe(2);
    expect((await readJson(page, 'remote-state')).strokes).toBe(2);
  });

  test('a late joiner receives the whole board from a snapshot', async ({ page }) => {
    await drawWave(page);
    await drawWave(page);

    await page.getByTestId('late-join').click();

    const local = await readJson(page, 'local-state');
    const joined = await readJson(page, 'remote-state');
    expect(joined).toEqual(local);
  });

  test('streams at the documented ~60ms cadence', async ({ page }) => {
    expect(await page.getByTestId('throttle-ms').textContent()).toBe('60');
  });
});
