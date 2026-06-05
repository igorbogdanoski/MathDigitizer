#!/usr/bin/env node
/**
 * Generates public/sitemap.xml with today's date as lastmod.
 * Run automatically as part of the build step.
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../public/sitemap.xml');

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const urls = [
  { loc: 'https://math.mismath.net/', changefreq: 'weekly', priority: '1.0' },
  { loc: 'https://math.mismath.net/pricing', changefreq: 'weekly', priority: '0.9' },
  { loc: 'https://math.mismath.net/blog/ocr-matematika', changefreq: 'monthly', priority: '0.8' },
  { loc: 'https://math.mismath.net/blog/latex-ekstrakcija', changefreq: 'monthly', priority: '0.8' },
  { loc: 'https://math.mismath.net/blog/live-mathkahoot', changefreq: 'monthly', priority: '0.8' },
];

const entries = urls.map(({ loc, changefreq, priority }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

writeFileSync(outPath, xml, 'utf8');
console.log(`✓ sitemap.xml written with lastmod ${today}`);
