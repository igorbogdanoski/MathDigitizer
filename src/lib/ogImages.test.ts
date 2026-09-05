import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { getRouteSeo } from './seo';

/**
 * The share cards are committed assets, not build output.
 *
 * They are rendered by `npm run og:image`, which needs the Playwright browser —
 * and the deploy runs in CI, where that may not be installed. A share image is
 * not worth a failed deployment, so the PNGs live in the repository and this
 * holds them to what the meta tags promise.
 *
 * Worth remembering what it replaced: the old generator drew rectangles pixel
 * by pixel with nothing but built-in Node, so it could not draw text. The card
 * every shared link showed had a gradient, some circles, and **not one word on
 * it** — no product name, no description. It was 8 KB because flat colour was
 * all it contained, and nobody noticed because you only see it from outside the
 * app.
 */

/** Reads width and height straight out of the PNG's IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(buffer.subarray(0, 8).equals(signature), `${path} is not a PNG`).toBe(true);

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const ROUTES = ['/', '/pricing', '/blog/ocr-matematika', '/blog/latex-ekstrakcija', '/blog/live-mathkahoot'];

describe('share cards', () => {
  it('exist for every public route', () => {
    const missing = ROUTES
      .map(route => ({ route, image: getRouteSeo(route).ogImage }))
      .filter(entry => !entry.image || !existsSync(`public${entry.image}`))
      .map(entry => `${entry.route} -> ${entry.image ?? 'none'}`);

    expect(missing, 'run: npm run og:image').toEqual([]);
  });

  it('are the size the meta tags claim', () => {
    // og:image:width and og:image:height in index.html say 1200x630. A card of
    // another size is cropped by the chat app, usually through the text.
    for (const route of ROUTES) {
      const image = getRouteSeo(route).ogImage as string;
      expect(pngSize(`public${image}`), image).toEqual({ width: 1200, height: 630 });
    }
  });

  it('carry a rendered image rather than flat colour', () => {
    // The one assertion that would have caught the old card. Text and gradients
    // do not compress the way a handful of rectangles does; 8 KB at this size
    // means there is nothing on it.
    for (const route of ROUTES) {
      const image = getRouteSeo(route).ogImage as string;
      const bytes = statSync(`public${image}`).size;

      expect(bytes, `${image} is ${(bytes / 1024).toFixed(0)} KB — too flat to hold text`)
        .toBeGreaterThan(40_000);
    }
  });

  it('give each public route a card of its own', () => {
    // A shared article showing the home page's card is the same failure as a
    // shared article showing the home page's title.
    const images = ROUTES.map(route => getRouteSeo(route).ogImage);
    expect(new Set(images).size, images.join(' | ')).toBe(ROUTES.length);
  });

  it('keep the path older shared links already point at', () => {
    // Links shared before this change name /og-image.png. It stays, holding the
    // default card, so those keep resolving.
    expect(existsSync('public/og-image.png')).toBe(true);
    expect(pngSize('public/og-image.png')).toEqual({ width: 1200, height: 630 });

    // Size and dimensions alone let the flat 8 KB card sit here unnoticed: it
    // was also 1200x630, and for months it was what every previously shared
    // link resolved to. Hold the legacy path to the same "has text on it" bar
    // as the cards above.
    const bytes = statSync('public/og-image.png').size;
    expect(bytes, `og-image.png is ${(bytes / 1024).toFixed(0)} KB — too flat to hold text`)
      .toBeGreaterThan(40_000);
  });

  it('keep the legacy path byte-identical to the default card', () => {
    // Nothing regenerates og-image.png against the cards, so the one file the
    // generator writes twice is the one that can quietly drift. Old shared
    // links should show what a new one shows.
    expect(readFileSync('public/og-image.png').equals(readFileSync('public/og/default.png')))
      .toBe(true);
  });
});
