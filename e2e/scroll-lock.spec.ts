import { test, expect } from '@playwright/test';

/**
 * Regression test for the scroll-lock bug class.
 * 
 * Bug: Some components set `document.body.style.overflow = 'hidden'` for modals
 * but fail to restore it on unmount, causing site-wide scroll lock.
 * 
 * This test loads every top-level route and asserts that `document.body`'s
 * computed `overflow-y` is never `hidden` outside of an actually-open modal.
 */

const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/blog',
  '/blog/ocr-math',
  '/blog/latex-extraction',
  '/blog/live-math-kahoot',
];

const PROTECTED_ROUTES = [
  '/library',
  '/dashboard',
  '/analytics',
  '/extraction',
  '/flashcards',
  '/solver',
  '/materials',
  '/pedagogue',
  '/grading',
  '/curriculum',
  '/classrooms',
  '/student-dashboard',
];

test.describe('Scroll-lock regression', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`body overflow-y is not hidden on ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      
      // Wait for any initial animations/modals to settle
      await page.waitForTimeout(1000);
      
      const overflowY = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowY;
      });
      
      expect(overflowY, `Body should not be scroll-locked on ${route}`).not.toBe('hidden');
    });
  }

  for (const route of PROTECTED_ROUTES) {
    test(`body overflow-y is not hidden on ${route} (redirects to auth)`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      
      // These routes redirect to auth or show a gate
      await page.waitForTimeout(1000);
      
      const overflowY = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowY;
      });
      
      expect(overflowY, `Body should not be scroll-locked on ${route}`).not.toBe('hidden');
    });
  }
});

test.describe('Modal scroll-lock cleanup', () => {
  test('scroll is restored after modal closes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Get initial overflow
    const initialOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflowY;
    });
    
    // If there's a modal trigger, click it
    const modalTrigger = page.locator('[data-testid="modal-trigger"], button:has-text("Отвори")').first();
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      await page.waitForTimeout(500);
      
      // Close the modal (Escape or close button)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      const afterOverflow = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowY;
      });
      
      expect(afterOverflow).toBe(initialOverflow);
    }
  });
});
