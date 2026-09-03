import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveTheme, applyTheme, setTheme, isDark, THEME_KEY } from './theme';
import { resetStorageProbe } from './safeStorage';

/**
 * The theme has to be decided in one place, and that place has to run for every
 * route.
 *
 * It used to be decided in `Layout.tsx`. Screens outside the shell — /pricing,
 * /play, /exam/:id — therefore ignored the saved preference on a cold load, and
 * kept the `dark` class without a dark ground when reached by clicking a link
 * from inside the app. On /pricing that put 74 pieces of text at a contrast
 * ratio of roughly 1.1: pale text on a pale ground, invisible rather than
 * merely hard to read.
 */
beforeEach(() => {
  document.documentElement.className = '';
  localStorage.clear();
  resetStorageProbe();
});

describe('resolveTheme', () => {
  it('honours what the user chose', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    expect(resolveTheme()).toBe('dark');

    localStorage.setItem(THEME_KEY, 'light');
    expect(resolveTheme()).toBe('light');
  });

  it('follows the system when the user never chose', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark') }));
    expect(resolveTheme()).toBe('dark');
    vi.unstubAllGlobals();
  });

  it('falls back to light rather than throwing without matchMedia', () => {
    // Old WebViews and some test environments have no matchMedia. A missing
    // media API must not be the reason a page fails to render.
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme()).toBe('light');
    vi.unstubAllGlobals();
  });

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem(THEME_KEY, 'midnight');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(resolveTheme()).toBe('light');
    vi.unstubAllGlobals();
  });
});

describe('applying it', () => {
  it('puts the class the stylesheet keys off on the root element', () => {
    applyTheme('dark');
    expect(isDark()).toBe(true);

    applyTheme('light');
    expect(isDark()).toBe(false);
  });

  it('remembers the choice, so the next page load starts right', () => {
    setTheme('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(resolveTheme()).toBe('dark');
  });

  it('still changes the page when storage refuses to keep the choice', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.');
    });
    resetStorageProbe();

    expect(() => setTheme('dark')).not.toThrow();
    expect(isDark()).toBe(true);

    setItem.mockRestore();
    resetStorageProbe();
  });
});

describe('every route gets a theme, not only the ones inside the shell', () => {
  const html = readFileSync('index.html', 'utf8');

  it('applies it in the document, before the first paint', () => {
    // In React it would run after hydration — too late for the flash, and never
    // at all for a route that renders no shell.
    expect(html).toMatch(/<script>[\s\S]*classList\.add\('dark'\)[\s\S]*<\/script>/);
  });

  it('reads localStorage inside a try, because it throws when site data is blocked', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    const read = script.indexOf('localStorage.getItem');

    expect(read, 'the boot script no longer reads the stored theme').toBeGreaterThan(-1);
    expect(script.lastIndexOf('try', read), 'unguarded localStorage read').toBeGreaterThan(-1);
  });

  it('uses the same storage key the app writes', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    expect(script).toContain(`'${THEME_KEY}'`);
  });
});

describe('the ground follows the theme', () => {
  const css = readFileSync('src/index.css', 'utf8');

  it('gives body a dark background', () => {
    // Without this the shell hides the problem — it paints its own dark
    // container — and every route outside the shell shows dark, translucent
    // panels on a light ground.
    const body = /body \{([\s\S]*?)\}/.exec(css)?.[1] ?? '';

    expect(body).toMatch(/dark:bg-/);
    expect(body).toMatch(/dark:text-/);
  });
});
