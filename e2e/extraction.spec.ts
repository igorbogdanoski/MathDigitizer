import { test, expect } from '@playwright/test';

/**
 * /extract E2E — Phase 1.4 of EXPERT_LEVEL_MASTER_PLAN.
 *
 * There is no Gemini key locally, so every model/scrape endpoint is intercepted
 * with `page.route`. The route is teacher-gated, so the contract under test is:
 * an anonymous visitor gets the auth gate, and NO extraction traffic is emitted
 * before authentication.
 */

const AI_ENDPOINTS = [
  '**/generativelanguage.googleapis.com/**',
  '**/api/ai/**',
  '**/api/scrape**',
];

test.describe('/extract', () => {
  test('gates anonymous visitors and emits no extraction traffic', async ({ page }) => {
    const aiCalls: string[] = [];

    for (const pattern of AI_ENDPOINTS) {
      await page.route(pattern, async (route) => {
        aiCalls.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ text: '[]' }),
        });
      });
    }

    await page.goto('/extract', { waitUntil: 'domcontentloaded' });

    // The teacher gate (ProtectedRoute) renders instead of the extractor
    await expect(page.locator('text=/Најави се|Sign in|Kyçu/i').first()).toBeVisible({ timeout: 15_000 });

    // The extraction submit control must not be reachable while unauthenticated
    await expect(page.locator('textarea')).toHaveCount(0);

    expect(aiCalls, 'no AI/scrape calls before authentication').toEqual([]);
  });

  test('renders without critical console errors or horizontal overflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const pattern of AI_ENDPOINTS) {
      await page.route(pattern, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      );
    }

    await page.goto('/extract', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('analytics') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource')
    );
    expect(criticalErrors).toHaveLength(0);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});
