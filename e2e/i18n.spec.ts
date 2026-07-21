import { test, expect } from '@playwright/test';

/**
 * E2E tests for i18n language switching (MK / EN / AL).
 *
 * Uses `domcontentloaded` + explicit element waits instead of `networkidle`
 * because the Vite dev server keeps HMR websocket connections open.
 */

test.describe('Language switcher', () => {
  test('language switcher button is visible in the layout', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const switcher = page.locator('button[aria-label="Change language"]');
    await expect(switcher).toBeVisible({ timeout: 15_000 });
  });

  test('opens dropdown with all three languages', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const switcher = page.locator('button[aria-label="Change language"]');
    await expect(switcher).toBeVisible({ timeout: 15_000 });
    await switcher.click();

    // Scope to the dropdown panel (absolute-positioned div)
    const dropdown = page.locator('div.absolute');
    await expect(dropdown.getByText('Македонски')).toBeVisible();
    await expect(dropdown.getByText('Albanian')).toBeVisible();
    await expect(dropdown.getByText('English')).toBeVisible();
  });

  test('switches to English and persists', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const switcher = page.locator('button[aria-label="Change language"]');
    await expect(switcher).toBeVisible({ timeout: 15_000 });
    await switcher.click();
    await page.locator('div.absolute').getByText('English').click();

    const stored = await page.evaluate(() =>
      localStorage.getItem('mathdigitizer_language')
    );
    expect(stored).toBe('en');

    await expect(switcher).toContainText('EN');
  });

  test('switches to Albanian and persists', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const switcher = page.locator('button[aria-label="Change language"]');
    await expect(switcher).toBeVisible({ timeout: 15_000 });
    await switcher.click();
    await page.locator('div.absolute').getByText('Albanian').click();

    const stored = await page.evaluate(() =>
      localStorage.getItem('mathdigitizer_language')
    );
    expect(stored).toBe('al');

    await expect(switcher).toContainText('AL');
  });

  test('language choice persists across page reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const switcher = page.locator('button[aria-label="Change language"]');
    await expect(switcher).toBeVisible({ timeout: 15_000 });
    await switcher.click();
    await page.locator('div.absolute').getByText('English').click();

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('button[aria-label="Change language"]')
    ).toContainText('EN', { timeout: 15_000 });
  });
});
