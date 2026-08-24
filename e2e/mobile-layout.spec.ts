import { test, expect } from '@playwright/test';

/**
 * The page must not scroll sideways on a phone.
 *
 * A layout that works on a desktop can become unusable on the device a teacher
 * actually carries, and it fails in one specific way: something wider than the
 * viewport makes the whole page scroll horizontally, which carries every
 * control off screen with it. Nothing reports that — the page still renders,
 * the tests still pass, and it only shows on a phone.
 *
 * Wide content is not the problem; wide content in its own scroll container is
 * correct, and a printable sheet is 210mm by definition. What this asserts is
 * that the *page* stays put.
 */
const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/pricing', name: 'pricing' },
  { path: '/play', name: 'live player join' },
  { path: '/__e2e__/concept-map', name: 'concept map editor' },
  { path: '/__e2e__/letterhead', name: 'printable letterhead' },
];

// A common small phone. Anything that fits here fits the ones above it.
test.use({ viewport: { width: 390, height: 844 } });

for (const route of ROUTES) {
  test(`${route.name} does not scroll sideways on a phone`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1, h2, main, form, svg').first()).toBeVisible({ timeout: 15_000 });

    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const culprits: string[] = [];

      // Only worth naming the elements when the page actually scrolls; they are
      // the diagnostic, not the assertion.
      if (doc.scrollWidth > doc.clientWidth + 2) {
        for (const el of document.querySelectorAll('*')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.right <= doc.clientWidth + 2) continue;

          const style = getComputedStyle(el);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
          if (el.closest('.overflow-x-auto, .overflow-auto, .overflow-scroll')) continue;

          const name = typeof el.className === 'string' && el.className
            ? `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`
            : el.tagName.toLowerCase();
          culprits.push(`${name} reaches ${Math.round(rect.right)}px`);
          if (culprits.length >= 5) break;
        }
      }

      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, culprits };
    });

    expect(
      report.scrollWidth,
      `${route.path} scrolls to ${report.scrollWidth}px in a ${report.clientWidth}px viewport. ` +
      `Widest: ${report.culprits.join(' | ') || 'not identified'}`,
    ).toBeLessThanOrEqual(report.clientWidth + 2);
  });
}
