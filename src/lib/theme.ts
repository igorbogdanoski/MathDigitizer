/**
 * The one place that owns the light/dark choice.
 *
 * It used to live inside `Layout.tsx`, in a `useEffect`. Every screen inside
 * the shell got its theme from there, which hid the problem: `/pricing`,
 * `/play` and `/exam/:id` are mounted **outside** Layout, so on a cold load
 * they ignored the saved preference entirely — and if you reached them by
 * clicking a link from inside the app, the `dark` class Layout had already put
 * on `<html>` stayed while `body` kept its light background, because `body` had
 * no dark variant either.
 *
 * The result on `/pricing` was 74 pieces of text at a contrast ratio of about
 * 1.1 — pale slate on pale slate, the panels being translucent and the ground
 * beneath them still `bg-slate-50`. Not "hard to read": invisible. The same
 * page looked correct or broken depending on how you arrived at it.
 *
 * So the choice is read and applied here, called from `index.html` before the
 * first paint (which also removes the flash of the wrong theme), and Layout's
 * toggle writes through the same functions.
 */
import { readStored, writeStored } from './safeStorage';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'theme';

/** What the user chose, or what their system asks for when they never chose. */
export function resolveTheme(): Theme {
  const stored = readStored(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  // matchMedia is missing in some test environments and in old WebViews.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies a theme to the document. Persisting is the caller's decision. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Applies a theme and remembers it. Storage may refuse; the page still changes. */
export function setTheme(theme: Theme): void {
  applyTheme(theme);
  writeStored(THEME_KEY, theme);
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}
