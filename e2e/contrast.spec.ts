import { test, expect, Page } from '@playwright/test';

/**
 * Text has to be readable in both themes, on every public route.
 *
 * `/pricing` was not. Reached by clicking the header link from inside the app,
 * it rendered its dark panels on a light ground — `body` had no dark background
 * and the theme was decided inside the app shell, which that route did not
 * render. 74 pieces of text sat at a contrast ratio near 1.1: not "hard to
 * read", invisible. Cold-loading the same URL looked fine, which is why nobody
 * caught it from a browser.
 *
 * ## Why this measures pixels
 *
 * Computed styles cannot tell you what is behind a piece of text. Gradients,
 * translucent panels and stacked cards all compose, and every attempt to guess
 * the ground from `background-color` produced findings that were wrong in both
 * directions — first 59 imaginary ones from misreading `oklch()` as `rgb()`,
 * then white-on-white for a perfectly good indigo button whose only sin was
 * living in a sticky header.
 *
 * So: hide every glyph, photograph the viewport, and read the pixel that was
 * behind each text node — one photograph per element, taken at the moment it is
 * measured. Not one picture of the whole page: a sticky header travels with the
 * scroll, so its document coordinates would hold whatever content happens to
 * sit there. Not a cached frame either, because the hero's entrance glow sweeps
 * across the page and a stale frame reported a badge as unreadable that in fact
 * reads at 9:1. Freezing animations instead is worse — it changes the layout,
 * and then the coordinates describe a page that is no longer on screen.
 *
 * Two things are deliberately skipped, because they cannot be judged this way
 * and produce noise rather than findings:
 *
 *  - text covered by something else (a toast, a modal) — the overlay's colour
 *    is not the text's ground;
 *  - gradient-clipped text (`bg-clip-text`), whose `color` is transparent and
 *    whose real colour is a background.
 *
 * The ground is the median of several points across the text's box rather than
 * one pixel. A single sample is brittle where text sits on a rounded pill with
 * a bright border: the point lands on the glow and the line is reported as
 * unreadable while the eye, which integrates across the whole run of text, has
 * no trouble with it.
 */

interface LowContrast {
  text: string;
  ratio: number;
  required: number;
  color: string;
  ground: string;
}

/**
 * `/play` earns its place here: it is one of the routes still rendered outside
 * the app shell, so it is the ground under it — `body` — that has to carry the
 * theme. On the routes inside the shell, the shell paints its own container and
 * would hide a missing `body` background entirely.
 */
const CONTRAST_ROUTES = ['/', '/pricing', '/play'];

/** Routes a visitor might land on and should be able to leave. A game join
 *  screen is deliberately not one of them — it is full-screen by design. */
const NAVIGABLE_ROUTES = ['/', '/pricing'];

/** WCAG 2.1 relative luminance. */
function luminance([r, g, b]: number[]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

async function collectTextNodes(page: Page) {
  return page.evaluate(async () => {
    // Canvas converts any CSS colour syntax to rgb. Necessary because Tailwind
    // v4 emits oklch(), which a regex over the digits reads as nonsense.
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    probe.canvas.width = probe.canvas.height = 1;
    const toRgb = (value: string) => {
      probe.fillStyle = '#000';
      probe.fillStyle = value;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const collected: { id: number; text: string; color: number[]; raw: string; required: number }[] = [];

    for (const el of document.querySelectorAll<HTMLElement>('p, span, div, h1, h2, h3, label, a, button, code, li, td')) {
      const text = [...el.childNodes]
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent!.trim())
        .join(' ')
        .trim();
      if (text.length < 3) continue;

      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      if (style.webkitBackgroundClip === 'text' || style.backgroundClip === 'text') continue;
      if (el.closest('h1')?.querySelector('[class*="bg-clip-text"]')) continue;
      if (!el.getBoundingClientRect().width) continue;

      // The hit test is viewport-relative, so the element has to be on screen
      // for it to mean anything. Scrolling also lets scroll-triggered
      // animations finish, which is how the page really looks.
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      await settle();

      const box = el.getBoundingClientRect();
      const y = Math.round(box.top + box.height / 2);
      if (!box.height || y < 0 || y >= window.innerHeight) continue;

      const hit = document.elementFromPoint(Math.round(box.left + Math.min(box.width / 2, 40)), y);
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue;

      const size = parseFloat(style.fontSize);
      const bold = parseInt(style.fontWeight, 10) >= 700;

      el.dataset.contrastAudit = String(collected.length + 1);
      collected.push({
        id: collected.length + 1,
        text: text.slice(0, 60),
        color: toRgb(style.color),
        raw: style.color,
        // WCAG: 3:1 for large text (24px, or 18.66px when bold), else 4.5:1.
        required: size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5,
      });
    }

    window.scrollTo(0, 0);
    return collected;
  });
}

async function findLowContrast(page: Page): Promise<LowContrast[]> {
  const nodes = await collectTextNodes(page);

  await page.addStyleTag({
    content: '*, *::before, *::after { color: transparent !important; text-shadow: none !important; }',
  });
  await page.waitForTimeout(300);

  async function measure(node: typeof nodes[number]): Promise<number | null> {
    const points = await page.evaluate((id: number) => {
      const el = document.querySelector<HTMLElement>(`[data-contrast-audit="${id}"]`)!;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const box = el.getBoundingClientRect();
      const y = Math.round(box.top + box.height / 2);
      const width = Math.min(box.width, 420);
      return [0.12, 0.28, 0.5, 0.72, 0.88].map(f => ({ x: Math.round(box.left + width * f), y }));
    }, node.id);

    // The browser decodes its own screenshot, so no image library is needed.
    const samples = await page.evaluate(async ({ png, points: pts }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0);

      return pts
        .filter(p => p.x >= 0 && p.y >= 0 && p.x < canvas.width && p.y < canvas.height)
        .map(p => {
          const [r, g, b] = ctx.getImageData(p.x, p.y, 1, 1).data;
          return [r, g, b];
        });
    }, { png: (await page.screenshot()).toString('base64'), points });

    if (samples.length === 0) return null;

    // Median by luminance: one stray bright pixel from a border glow should not
    // decide whether a whole line of text is readable.
    const byLuminance = samples.slice().sort((a, b) => luminance(a) - luminance(b));
    const ground = byLuminance[Math.floor(byLuminance.length / 2)];

    const a = luminance(node.color);
    const b = luminance(ground);
    lastGround = `rgb(${ground.join(',')})`;
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  let lastGround = '';
  const findings: LowContrast[] = [];

  for (const node of nodes) {
    const ratio = await measure(node);
    if (ratio === null || ratio >= node.required) continue;

    // Measure it again before reporting. Everything on this page moves — an
    // entrance glow sweeps the hero, panels fade in — and a single frame caught
    // mid-motion has already produced three findings that the eye, and a
    // photograph taken a moment later, both disagreed with. A defect in a
    // colour choice is reproducible; a frame is not.
    const confirm = await measure(node);
    if (confirm === null || confirm >= node.required) continue;

    findings.push({
      text: node.text,
      ratio: Number(Math.min(ratio, confirm).toFixed(2)),
      required: node.required,
      color: node.raw,
      ground: lastGround,
    });
  }

  return findings.sort((a, b) => a.ratio - b.ratio);
}

const report = (findings: LowContrast[]) =>
  findings.map(f => `  ${f.ratio} (need ${f.required})  ${f.color} on ${f.ground}  "${f.text}"`).join('\n');

test.describe('text is readable in both themes', () => {
  test.slow();

  for (const route of CONTRAST_ROUTES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${route} in ${theme}`, async ({ page }) => {
        await page.addInitScript(mode => {
          try { localStorage.setItem('theme', mode as string); } catch { /* blocked */ }
        }, theme);

        await page.goto(route, { waitUntil: 'domcontentloaded' });
        // /play is a full-screen join card with no <main> landmark of its own.
        await expect(page.locator('main, form, h1').first()).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(1500);

        expect(
          await page.evaluate(() => document.documentElement.classList.contains('dark')),
          `${route} ignored the stored theme — is it rendered outside the app shell?`,
        ).toBe(theme === 'dark');

        const findings = await findLowContrast(page);
        expect(findings, `\n${report(findings)}\n`).toEqual([]);
      });
    }
  }
});

test.describe('a visitor can always leave', () => {
  for (const route of NAVIGABLE_ROUTES) {
    test(`${route} has a way back into the app`, async ({ page }) => {
      // /pricing had exactly one link on it, a mailto. A visitor who did not
      // want to buy anything could only press Back — which is a strange thing
      // to do to the page you send people to when you want them to sign up.
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      await expect(page.locator('header, nav').first()).toBeVisible();
      await expect(page.locator('a[href="/"]').first()).toBeVisible();
    });
  }
});
