import { test, expect } from '@playwright/test';

/**
 * E2E tests for new feature routes added in feat/i18n-infrastructure:
 * Gradebook, Early Warning, Differentiation, and enhanced Pricing.
 *
 * Uses `domcontentloaded` + explicit element waits instead of `networkidle`
 * because the Vite dev server keeps HMR websocket connections open.
 */

test.describe('New feature auth gates', () => {
  const protectedRoutes = [
    { path: '/gradebook', name: 'Дневник на оцени' },
    { path: '/early-warning', name: 'Early Warning' },
    { path: '/differentiation', name: 'Диференцијација' },
  ];

  for (const route of protectedRoutes) {
    test(`${route.path} shows sign-in gate for anonymous visitors`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      // AuthRequiredGate renders "Потребна е најава" heading
      await expect(
        page.getByText('Потребна е најава'),
        `${route.path} should show auth gate`
      ).toBeVisible({ timeout: 15_000 });

      // Should have a Google sign-in button
      await expect(page.getByText('Најави се со Google')).toBeVisible();

      // Should have a back-to-home link
      await expect(page.getByText('Назад на почетна')).toBeVisible();
    });
  }
});

test.describe('Pricing page — enhanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    // Wait for the pricing hero to render
    await expect(page.getByText('490 МКД месечно')).toBeVisible({ timeout: 15_000 });
  });

  test('renders hero section with pricing badges', async ({ page }) => {
    await expect(page.getByText('4.900 МКД годишно')).toBeVisible();
  });

  test('billing period toggle switches between monthly and annual', async ({ page }) => {
    // Default is annual — check annual price is shown in the sidebar
    await expect(page.getByText('4.900 МКД').first()).toBeVisible();

    // The billing toggle is a grid of 2 buttons; click the first one (monthly)
    const toggleGrid = page.locator('div.grid.grid-cols-2');
    const firstToggle = toggleGrid.locator('button').first();
    await firstToggle.click();

    // After clicking monthly, the sidebar should show 490 МКД
    await expect(page.getByText('490 МКД').first()).toBeVisible();
  });

  test('shows manual payment details (IBAN, PayPal)', async ({ page }) => {
    await expect(page.getByText('MK07210501596102457')).toBeVisible();
    await expect(page.getByText('igor.bogdanoski@mismath.net').first()).toBeVisible();
  });

  test('receipt submission form is present', async ({ page }) => {
    await expect(page.getByText('Испрати доказ за уплата')).toBeVisible();
    await expect(page.locator('input[placeholder="Име и презиме"]').first()).toBeVisible();
  });

  test('school plan section is present', async ({ page }) => {
    await expect(page.getByText('Школски план', { exact: true }).first()).toBeVisible();
  });

  test('annual plan shows savings badge', async ({ page }) => {
    await expect(page.getByText(/Заштеда/i).first()).toBeVisible();
  });
});

test.describe('Blog articles', () => {
  const blogRoutes = [
    '/blog/ocr-matematika',
    '/blog/latex-ekstrakcija',
    '/blog/live-mathkahoot',
  ];

  for (const route of blogRoutes) {
    test(`${route} renders article content`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Each blog article should have a heading (h2 is the top-level in BlogArticle)
      await expect(page.locator('h2').first()).toBeVisible({ timeout: 15_000 });

      // Should have substantial article content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(200);
    });
  }
});

test.describe('Billing dashboard', () => {
  test('/billing shows sign-in gate for anonymous visitors', async ({ page }) => {
    await page.goto('/billing', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByText('Потребна е најава'),
      '/billing should show auth gate'
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Најави се со Google')).toBeVisible();
  });
});

test.describe('Responsive — mobile overflow', () => {
  const pages = [
    { path: '/pricing', name: 'pricing', waitFor: 'text=490 МКД месечно' },
    { path: '/blog/ocr-matematika', name: 'blog article', waitFor: 'h2' },
    { path: '/billing', name: 'billing', waitFor: 'text=Потребна е најава' },
  ];

  for (const page of pages) {
    test(`no horizontal overflow at 375px on ${page.name}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      const mobilePage = await context.newPage();
      await mobilePage.goto(page.path, { waitUntil: 'domcontentloaded' });

      // Wait for the page's real content to render so we measure the settled
      // layout, not a transient mid-load state (lazy chunks + auth resolution)
      await mobilePage.locator(page.waitFor).first().waitFor({ state: 'visible', timeout: 20_000 });
      await mobilePage.waitForTimeout(500);

      const hasHorizontalScroll = await mobilePage.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });

      expect(
        hasHorizontalScroll,
        `${page.name} should not have horizontal overflow at 375px`
      ).toBe(false);

      await context.close();
    });
  }
});

test.describe('Home page — key sections', () => {
  test('hero section renders with navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('nav, header').first()).toBeVisible();
  });

  test('no critical console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Give the page time to load lazy chunks
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

    const critical = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('analytics') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource')
    );

    expect(critical, 'No critical console errors').toHaveLength(0);
  });
});
