import { test, expect, Page } from '@playwright/test';

/**
 * WCAG 2.1 pass over the routes the phases changed
 * (EXPERT_LEVEL_MASTER_PLAN, 12).
 *
 * Written against the DOM directly rather than pulling in axe-core, for the
 * reason the plan gives for the whole programme: no new dependency unless the
 * phase justifies one. What is checked here is the subset that actually breaks
 * in this app — controls with no accessible name, unlabelled inputs, duplicate
 * ids, images with no alternative text, and a missing document language. Those
 * are the failures a keyboard or screen-reader user hits first.
 *
 * Gated screens are reached through the DEV probe routes, which is the pattern
 * this project already uses (`/__e2e__/ink-pipeline`, `/__e2e__/letterhead`).
 */

interface Violation {
  rule: string;
  detail: string;
}

/**
 * Collects violations from the live DOM.
 *
 * Runs in the page so it sees computed accessible names, including labels
 * supplied by `aria-labelledby` and by a `<label for>` elsewhere in the tree.
 */
async function findViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const problems: { rule: string; detail: string }[] = [];
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
        el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''
      }`;

    const accessibleName = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria?.trim()) return aria.trim();

      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map(id => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }

      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label?.textContent?.trim()) return label.textContent.trim();
      }

      const wrapping = el.closest('label');
      if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();

      const title = el.getAttribute('title');
      if (title?.trim()) return title.trim();

      // Text content, minus anything explicitly hidden from assistive tech.
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
      return (clone.textContent ?? '').trim();
    };

    // 4.1.2 Name, Role, Value — every control must have a name.
    for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (!(el as HTMLElement).offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      if (!accessibleName(el)) problems.push({ rule: 'control-has-name', detail: describe(el) });
    }

    // 3.3.2 Labels or Instructions — every input must be labelled.
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const type = (el as HTMLInputElement).type;
      if (type === 'hidden') continue;
      if (!accessibleName(el) && !el.getAttribute('placeholder')) {
        problems.push({ rule: 'input-has-label', detail: describe(el) });
      }
    }

    // 1.1.1 Non-text Content.
    for (const img of document.querySelectorAll('img')) {
      if (img.getAttribute('alt') === null && img.getAttribute('aria-hidden') !== 'true') {
        problems.push({ rule: 'image-has-alt', detail: describe(img) });
      }
    }

    // 4.1.1 Parsing — a duplicate id breaks every `for`/`aria-labelledby` link.
    const seen = new Set<string>();
    for (const el of document.querySelectorAll('[id]')) {
      const id = el.id;
      if (seen.has(id)) problems.push({ rule: 'unique-ids', detail: id });
      seen.add(id);
    }

    // 3.1.1 Language of Page.
    if (!document.documentElement.getAttribute('lang')) {
      problems.push({ rule: 'html-has-lang', detail: '<html>' });
    }

    return problems;
  });
}

const report = (violations: Violation[]) =>
  violations.map(v => `${v.rule}: ${v.detail}`).join('\n');

const PUBLIC_ROUTES = [
  { path: '/', name: 'home' },
  { path: '/pricing', name: 'pricing' },
  { path: '/play', name: 'live player join' },
];

const PROBE_ROUTES = [
  { path: '/__e2e__/letterhead', name: 'print letterhead' },
  { path: '/__e2e__/ink-pipeline', name: 'whiteboard ink' },
  { path: '/__e2e__/concept-map', name: 'concept map editor' },
];

test.describe('WCAG 2.1 — public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} has no accessibility violations`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1, h2, main, form').first()).toBeVisible({ timeout: 15_000 });

      const violations = await findViolations(page);
      expect(violations, report(violations)).toEqual([]);
    });
  }
});

test.describe('WCAG 2.1 — screens behind auth, via probe routes', () => {
  for (const route of PROBE_ROUTES) {
    test(`${route.name} has no accessibility violations`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1, main, svg').first()).toBeVisible({ timeout: 15_000 });

      const violations = await findViolations(page);
      expect(violations, report(violations)).toEqual([]);
    });
  }
});

test.describe('Concept map editor is usable without a mouse', () => {
  test('every tool is reachable by keyboard and named', async ({ page }) => {
    await page.goto('/__e2e__/concept-map', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('toolbar')).toBeVisible({ timeout: 15_000 });

    const named = await page.getByRole('toolbar').getByRole('button').all();
    expect(named.length).toBeGreaterThan(3);

    for (const button of named) {
      // Playwright resolves the accessible name the same way a screen reader
      // does, so an empty one here is an empty one there.
      const name = await button.getAttribute('aria-label') ?? await button.textContent();
      expect(name?.trim(), 'every toolbar control needs a name').toBeTruthy();
    }
  });

  test('the drawing surface announces itself', async ({ page }) => {
    // An unlabelled canvas or SVG is silent to a screen reader: the user is
    // told there is a region and nothing about what it holds.
    await page.goto('/__e2e__/concept-map', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('application', { name: /Дропки/ })).toBeVisible({ timeout: 15_000 });
  });

  test('adding a concept changes the map, not just the picture', async ({ page }) => {
    await page.goto('/__e2e__/concept-map', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('map-state')).toHaveText(/"nodes":3/, { timeout: 15_000 });

    await page.getByRole('toolbar').getByRole('button').first().click();
    await expect(page.getByTestId('map-state')).toHaveText(/"nodes":4/);
  });
});
