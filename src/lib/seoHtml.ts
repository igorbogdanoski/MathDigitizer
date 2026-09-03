/**
 * Bakes a route's SEO into the built HTML.
 *
 * The app is a client-rendered SPA, so every URL was served the same
 * `index.html`: the same `<title>`, the same description, the same `og:*`, and
 * about 200 bytes of text. Three things follow from that, and the second is the
 * one that costs most:
 *
 * 1. Every indexable URL looked like a duplicate of the home page.
 * 2. **Sharing was broken.** Facebook, Viber and LinkedIn read `og:*` from the
 *    HTML they are served and do not run JavaScript. Sharing an article showed
 *    the home page's title, description and image — always.
 * 3. The structured data `seo.ts` already builds never reached a crawler,
 *    because it was injected after load.
 *
 * The fix is not new content. `getRouteSeo` already knows all of this per route;
 * it was only ever running in the browser. This runs the same function at build
 * time and writes the result into a copy of `index.html` per route, so the
 * markup a crawler is served and the markup the app renders come from one
 * source and cannot drift.
 *
 * Kept pure and separate from the build script so the transformation itself can
 * be tested without producing a build.
 */
import { RouteSeoConfig } from './seo';

export const SITE_URL = 'https://math.mismath.net';

export const SITE_NAME = 'MathDigitizer Pro';

/**
 * The full `<title>` for a page.
 *
 * `SEO.tsx` imports this rather than composing its own, so the title a crawler
 * is served and the title a visitor sees come from one function and cannot
 * disagree.
 *
 * A title that already names the product keeps it where the author put it. The
 * home page reads `MathDigitizer Pro | Напредна едукација и математика`, and
 * appending the name again gave it a third time — which is both worse to read
 * and, past roughly sixty characters, cut off in a search result exactly where
 * the repetition begins.
 */
export function composeTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}

/** Escapes a value for an HTML attribute. */
export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Replaces the content of a `<meta>` tag, matched by its name or property.
 *
 * Returns the html unchanged when the tag is not there. That is deliberate: the
 * template is the source of which tags exist, and inventing one here would let
 * the built page carry a tag the template does not, which is exactly the kind of
 * drift this module exists to prevent.
 */
export function replaceMetaContent(
  html: string,
  attribute: 'name' | 'property',
  key: string,
  value: string,
): string {
  const pattern = new RegExp(
    `(<meta\\s+${attribute}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content=")([^"]*)(")`,
    'i',
  );
  return html.replace(pattern, (_match, before, _old, after) =>
    `${before}${escapeAttribute(value)}${after}`);
}

export function replaceTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttribute(title)}</title>`);
}

export function replaceCanonical(html: string, url: string): string {
  return html.replace(
    /(<link\s+rel="canonical"\s+href=")([^"]*)(")/i,
    (_match, before, _old, after) => `${before}${escapeAttribute(url)}${after}`,
  );
}

/**
 * Replaces any existing JSON-LD block, or inserts one before `</head>`.
 *
 * Serialised with `JSON.stringify` and then escaped for `</script`, which is the
 * one sequence that can close the block early from inside a string value.
 */
export function injectStructuredData(html: string, data: unknown): string {
  if (data === undefined || data === null) return html;

  const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
  const block = `<script type="application/ld+json">${json}</script>`;

  const existing = /<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
  if (existing.test(html)) return html.replace(existing, block);

  return html.replace(/<\/head>/i, `  ${block}\n</head>`);
}

/**
 * The absolute URL for a route, in the shape the sitemap already uses.
 *
 * The root keeps its trailing slash; every other route has none, matching
 * `sitemap.xml` and the canonical links the app renders today. A canonical that
 * disagreed with the sitemap would be a new problem in place of the old one.
 */
export function absoluteRouteUrl(route: string): string {
  if (route === '/' || route === '') return `${SITE_URL}/`;
  return `${SITE_URL}${route.startsWith('/') ? route : `/${route}`}`.replace(/\/$/, '');
}

/**
 * Applies a route's SEO to the built template.
 *
 * `og:title` and `twitter:title` deliberately take the same value as `<title>`:
 * a share card that disagrees with the page it opens is worse than a plain one.
 */
export function applyRouteSeo(
  templateHtml: string,
  route: string,
  seo: RouteSeoConfig,
): string {
  const url = absoluteRouteUrl(seo.canonical ?? route);
  const title = composeTitle(seo.title);

  let html = replaceTitle(templateHtml, title);
  html = replaceCanonical(html, url);

  html = replaceMetaContent(html, 'name', 'description', seo.description);
  html = replaceMetaContent(html, 'name', 'keywords', seo.keywords);
  html = replaceMetaContent(html, 'name', 'robots', seo.noindex ? 'noindex, nofollow' : 'index, follow');

  html = replaceMetaContent(html, 'property', 'og:title', title);
  html = replaceMetaContent(html, 'property', 'og:description', seo.description);
  html = replaceMetaContent(html, 'property', 'og:url', url);

  html = replaceMetaContent(html, 'name', 'twitter:title', title);
  html = replaceMetaContent(html, 'name', 'twitter:description', seo.description);

  // The card a chat app shows. Routes without their own keep the default, which
  // the template already carries — replacing it with the same value is a no-op.
  if (seo.ogImage) {
    const image = `${SITE_URL}${seo.ogImage}`;
    html = replaceMetaContent(html, 'property', 'og:image', image);
    html = replaceMetaContent(html, 'name', 'twitter:image', image);
    html = replaceMetaContent(html, 'property', 'og:image:alt', seo.title);
  }

  return injectStructuredData(html, seo.structuredData);
}
