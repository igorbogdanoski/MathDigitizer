/**
 * Writes one HTML file per public route, with that route's SEO baked in.
 *
 * The app is a client-rendered SPA: every URL was served the same `index.html`,
 * so a crawler and a social scraper saw the home page's title, description and
 * `og:*` on every page. Facebook, Viber and LinkedIn do not run JavaScript, so
 * sharing an article showed the wrong card — always, and silently.
 *
 * This does not render the app. It runs `getRouteSeo` — the same function the
 * browser runs — at build time and writes its output into a copy of the built
 * `index.html` for each route. What that fixes is the head: correct title,
 * description, canonical, `og:*` and JSON-LD per URL. The body is still the SPA
 * shell, which Google renders; the scrapers that never render now get the right
 * answer without needing to.
 *
 * Run: npx tsx scripts/prerender-seo.mts   (wired into `npm run build`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { getRouteSeo } from '../src/lib/seo';
import { applyRouteSeo } from '../src/lib/seoHtml';

const DIST = 'dist';

/**
 * Routes worth a file of their own: the ones a stranger can reach.
 *
 * Gated routes are deliberately absent. They are `noindex` already and nobody
 * shares a link to a page that redirects them to a login, so a file for each
 * would be weight in the deploy for no reader.
 */
const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/blog/ocr-matematika',
  '/blog/latex-ekstrakcija',
  '/blog/live-mathkahoot',
];

const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

let written = 0;
for (const route of PUBLIC_ROUTES) {
  const seo = getRouteSeo(route);
  const html = applyRouteSeo(template, route, seo);

  // The root overwrites dist/index.html itself; every other route becomes a
  // directory with an index.html, which is what Apache serves for that path.
  const target = route === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, route, 'index.html');

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, 'utf8');
  written++;

  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
  console.log(`  ${route.padEnd(28)} ${title}`);
}

console.log(`\nprerendered ${written} routes`);

// A route whose file is not served is a route that silently kept the old
// behaviour, so fail rather than let that reach production unnoticed.
for (const route of PUBLIC_ROUTES) {
  if (route === '/') continue;
  const target = path.join(DIST, route, 'index.html');
  if (!fs.existsSync(target)) {
    console.error(`Missing prerendered file for ${route}`);
    process.exit(1);
  }
}
