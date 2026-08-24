import { test, expect } from '@playwright/test';

/**
 * The app must open when the browser refuses site data.
 *
 * `localStorage` does not return null when storage is blocked — it throws. In a
 * locked-down school browser, that exception happened inside an effect on the
 * very first render, reached the error boundary, and a teacher met an error
 * screen instead of the app, with nothing on it to say why.
 *
 * This blocks storage the way such a browser does — the property is present and
 * every access raises — and then asks only that the page still works.
 */
const BLOCK_STORAGE = `
  const raise = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  const blocked = { getItem: raise, setItem: raise, removeItem: raise, clear: raise, key: raise, length: 0 };
  Object.defineProperty(window, 'localStorage', { get: () => blocked, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { get: () => blocked, configurable: true });
`;

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/pricing', name: 'pricing' },
  { path: '/play', name: 'live game join' },
];

for (const route of ROUTES) {
  test(`${route.name} opens with site data blocked`, async ({ page }) => {
    await page.addInitScript(BLOCK_STORAGE);

    const crashes: string[] = [];
    page.on('pageerror', error => crashes.push(error.message));

    await page.goto(route.path, { waitUntil: 'domcontentloaded' });

    // Real content, not the error boundary.
    await expect(page.locator('h1, h2, main, form').first()).toBeVisible({ timeout: 15_000 });

    const showsErrorScreen = await page.evaluate(() =>
      // The exact text ErrorBoundary renders. Guessing at it once made these
      // tests pass while the error screen was on the page.
      /Настана грешка|Something went wrong/i.test(document.body.innerText)
    );

    expect(showsErrorScreen, `${route.path} rendered the error boundary`).toBe(false);
    expect(
      crashes.filter(m => /localStorage|SecurityError|storage/i.test(m)),
      `${route.path} threw on storage`,
    ).toEqual([]);
  });
}

test('a student can still reach the game join form', async ({ page }) => {
  // The case that would fail in the middle of a lesson: the guest id is read
  // from storage on the first render.
  await page.addInitScript(BLOCK_STORAGE);
  await page.goto('/play', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('input').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input')).toHaveCount(2);
});
