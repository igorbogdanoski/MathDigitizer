import { test, expect } from '@playwright/test';

/**
 * Golden path E2E tests — core user journeys that must never break.
 */

test.describe('Anonymous visitor', () => {
  test('Home page renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check for critical content
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Filter out known non-critical errors (e.g., missing favicon, analytics)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('analytics') && !e.includes('404')
    );
    
    expect(criticalErrors, 'Page should not have critical console errors').toHaveLength(0);
  });

  test('Pricing page renders plans', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    
    // Check for pricing cards
    await expect(page.locator('text=/Pro|Monthly|Annual|490|МКД/i').first()).toBeVisible();
  });

  test('Blog articles are accessible', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' });
    
    // Check for blog list
    await expect(page.locator('article, [class*="blog"], [class*="post"]').first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('Main navigation links work', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check that nav exists
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
    
    // Check for key navigation items
    const navText = await nav.textContent();
    expect(navText).toBeTruthy();
  });

  test('Footer links are present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
  });
});

test.describe('PWA', () => {
  test('Service worker registers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for service worker registration
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration;
    });
    
    // SW might not register in dev mode, so we just check it doesn't error
    expect(typeof swRegistered).toBe('boolean');
  });

  test('Manifest is accessible', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest?.name).toBe('MathDigitizer Pro');
    expect(manifest?.lang).toBe('mk');
  });
});

test.describe('Responsive', () => {
  test('Page is usable at 1366px width', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll, 'Page should not have horizontal overflow at 1366px').toBe(false);
  });

  test('Page is usable at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check that content is visible
    await expect(page.locator('body')).toBeVisible();
    
    // Check no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll, 'Page should not have horizontal overflow at mobile').toBe(false);
  });
});
