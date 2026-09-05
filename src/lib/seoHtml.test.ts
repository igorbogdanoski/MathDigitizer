import { describe, it, expect } from 'vitest';
import {
  SITE_URL,
  absoluteRouteUrl,
  applyRouteSeo,
  escapeAttribute,
  injectStructuredData,
  replaceCanonical,
  replaceMetaContent,
  replaceTitle,
  SITE_NAME,
  composeTitle,
} from './seoHtml';
import { getRouteSeo } from './seo';
import { readFile } from 'node:fs/promises';

const template = `<!doctype html>
<html lang="mk">
<head>
<title>MathDigitizer Pro | Помалку хаос. Повеќе математика.</title>
<link rel="canonical" href="https://math.mismath.net/" />
<meta name="description" content="старо" />
<meta name="keywords" content="старо" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="старо" />
<meta property="og:description" content="старо" />
<meta property="og:url" content="https://math.mismath.net/" />
<meta property="og:image" content="https://math.mismath.net/og/default.png" />
<meta property="og:image:alt" content="старо" />
<meta name="twitter:title" content="старо" />
<meta name="twitter:description" content="старо" />
<meta name="twitter:image" content="https://math.mismath.net/og/default.png" />
</head>
<body><div id="root"></div></body>
</html>`;

/**
 * Every URL used to be served the same `index.html`. The half that costs most
 * is sharing: Facebook, Viber and LinkedIn read `og:*` from the HTML they are
 * served and never run JavaScript, so sharing an article showed the home page.
 */
describe('applyRouteSeo', () => {
  it('gives a route its own title, description and canonical', () => {
    const html = applyRouteSeo(template, '/pricing', {
      title: 'Цени',
      description: 'Претплата за наставници.',
      keywords: 'цени, претплата',
    });

    expect(html).toContain('<title>Цени | MathDigitizer Pro</title>');
    expect(html).toContain('content="Претплата за наставници."');
    expect(html).toContain('href="https://math.mismath.net/pricing"');
  });

  it('gives the share card the same title as the page it opens', () => {
    // A card that disagrees with its destination is worse than a plain one.
    const html = applyRouteSeo(template, '/pricing', {
      title: 'Цени',
      description: 'Претплата за наставници.',
      keywords: 'ц',
    });

    expect(html).toContain('<meta property="og:title" content="Цени | MathDigitizer Pro"');
    expect(html).toContain('<meta name="twitter:title" content="Цени | MathDigitizer Pro"');
    expect(html).toContain('<meta property="og:url" content="https://math.mismath.net/pricing"');
  });

  it('gives a route with its own card that card', () => {
    const html = applyRouteSeo(template, '/pricing', {
      title: 'Цени', description: 'о', keywords: 'к', ogImage: '/og/pricing.png',
    });

    expect(html).toContain('<meta property="og:image" content="https://math.mismath.net/og/pricing.png"');
    expect(html).toContain('<meta name="twitter:image" content="https://math.mismath.net/og/pricing.png"');
    // Absolute, always: a relative og:image is ignored by every scraper.
    expect(html).not.toContain('content="/og/pricing.png"');
  });

  it('describes the card it just swapped in', () => {
    // og:image:alt is read aloud by screen readers on Facebook and Mastodon; a
    // new card with the previous card's description is worse than none.
    const html = applyRouteSeo(template, '/pricing', {
      title: 'Цени', description: 'о', keywords: 'к', ogImage: '/og/pricing.png',
    });

    expect(html).toContain('<meta property="og:image:alt" content="Цени"');
  });

  it('leaves the default card in place for a route without one', () => {
    // Gated screens have no card of their own and need none — nobody shares a
    // link to a page that asks them to sign in.
    const html = applyRouteSeo(template, '/library', {
      title: 'Библиотека', description: 'о', keywords: 'к',
    });

    expect(html).toContain('<meta property="og:image" content="https://math.mismath.net/og/default.png"');
  });

  it('marks a gated route noindex', () => {
    const html = applyRouteSeo(template, '/library', {
      title: 'Библиотека', description: 'о', keywords: 'к', noindex: true,
    });

    expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
  });

  it('writes the structured data the app already builds', () => {
    // seo.ts has built Organization, WebSite and SoftwareApplication all along;
    // it only ever ran in the browser, so no crawler saw any of it.
    const html = applyRouteSeo(template, '/', getRouteSeo('/'));

    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"SoftwareApplication"');
  });

  it('leaves the page otherwise untouched', () => {
    const html = applyRouteSeo(template, '/pricing', { title: 'Ц', description: 'о', keywords: 'к' });

    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<meta property="og:image" content="https://math.mismath.net/og/default.png"');
    expect(html).toContain('<html lang="mk">');
  });

  it('is idempotent — running it twice changes nothing further', () => {
    const seo = getRouteSeo('/pricing');
    const once = applyRouteSeo(template, '/pricing', seo);

    expect(applyRouteSeo(once, '/pricing', seo)).toBe(once);
  });
});

describe('the served markup cannot drift from the rendered markup', () => {
  it('is the one function SEO.tsx also uses', async () => {
    // Not two implementations held together by a test — one function imported
    // by both, so the served <title> and the rendered one cannot disagree.
    const source = await readFile('src/components/SEO.tsx', 'utf8');

    expect(source).toContain("from '../lib/seoHtml'");
    expect(source).toContain('composeTitle(title)');
  });

  it('appends the product name once, and only when it is missing', () => {
    // The home page title already names the product. Appending it again gave
    // it three times, and a search result cuts off around sixty characters —
    // right where the repetition starts.
    expect(composeTitle('Цени и претплата')).toBe(`Цени и претплата | ${SITE_NAME}`);
    expect(composeTitle(`${SITE_NAME} | Напредна едукација`)).toBe(`${SITE_NAME} | Напредна едукација`);
  });
});

describe('escaping', () => {
  it('escapes a quote that would otherwise close the attribute', () => {
    const html = applyRouteSeo(template, '/x', {
      title: 'Наслов "во наводници"', description: 'о', keywords: 'к',
    });

    expect(html).toContain('&quot;во наводници&quot;');
    expect(html).not.toContain('content="Наслов "во');
  });

  it('escapes the ampersand and the angle brackets', () => {
    expect(escapeAttribute('a & b <c>')).toBe('a &amp; b &lt;c&gt;');
  });

  it('stops a JSON-LD value from closing the script block', () => {
    // The one sequence that can break out of a JSON-LD block from inside a
    // string value.
    const html = injectStructuredData(template, { name: '</script><img onerror=x>' });

    expect(html).not.toContain('</script><img');
    expect(html).toContain('<\\/script');
  });
});

describe('the individual replacements', () => {
  it('replaces a meta tag by name and by property', () => {
    expect(replaceMetaContent(template, 'name', 'description', 'ново')).toContain('content="ново"');
    expect(replaceMetaContent(template, 'property', 'og:title', 'ново')).toContain('content="ново"');
  });

  it('leaves the html alone when the tag is not in the template', () => {
    // The template decides which tags exist; inventing one here would let the
    // built page carry a tag the app does not render.
    expect(replaceMetaContent(template, 'name', 'nonexistent', 'x')).toBe(template);
  });

  it('replaces rather than appends a second JSON-LD block', () => {
    const once = injectStructuredData(template, { a: 1 });
    const twice = injectStructuredData(once, { b: 2 });

    expect(twice.match(/application\/ld\+json/g)).toHaveLength(1);
    expect(twice).toContain('"b":2');
  });

  it('replaces the title and the canonical', () => {
    expect(replaceTitle(template, 'Нов')).toContain('<title>Нов</title>');
    expect(replaceCanonical(template, 'https://math.mismath.net/x')).toContain('href="https://math.mismath.net/x"');
  });
});

describe('absoluteRouteUrl', () => {
  it('matches the URL shape the sitemap already uses', () => {
    // A canonical that disagrees with the sitemap replaces one problem with
    // another.
    expect(absoluteRouteUrl('/')).toBe(`${SITE_URL}/`);
    expect(absoluteRouteUrl('/pricing')).toBe(`${SITE_URL}/pricing`);
    expect(absoluteRouteUrl('/blog/ocr-matematika')).toBe(`${SITE_URL}/blog/ocr-matematika`);
  });

  it('drops a trailing slash from a non-root route', () => {
    expect(absoluteRouteUrl('/pricing/')).toBe(`${SITE_URL}/pricing`);
  });
});
