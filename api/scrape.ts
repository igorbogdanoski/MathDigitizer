import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, parseSafeUrl, isPrivateHost, withTimeout } from './_shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: "Недостасува 'url' параметарот" });
  }

  const parsed = parseSafeUrl(url);
  if (!parsed) {
    return res.status(400).json({ error: 'Невалиден URL' });
  }
  if (isPrivateHost(parsed.hostname)) {
    return res.status(400).json({ error: 'Овој URL не е дозволен' });
  }

  try {
    console.log(`[WebScraper] Fetching content from: ${url}`);
    const fetchResponse = await fetch(parsed.toString(), {
      signal: withTimeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch status: ${fetchResponse.status}`);
    }

    const html = await fetchResponse.text();
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    // Preserve math notation before stripping <script> tags: MathJax/KaTeX
    // source is commonly embedded as <script type="math/tex">...</script> or
    // similar — losing these left every scraped page with its formulas
    // silently deleted. Pull them out as inline $...$ markers first.
    $('script[type*="math/tex"], script[type="math/asciimath"]').each((_, el) => {
      const tex = $(el).text().trim();
      if (tex) {
        $(el).replaceWith(` $${tex}$ `);
      }
    });

    // Remove remaining scripts, styles, nav, footer to get core content
    $('script, style, noscript, nav, footer, header, aside').remove();

    const title = $('title').text() || $('h1').first().text();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    // Safety limit for context (roughly 20k characters)
    if (text.length > 20000) {
      text = text.substring(0, 20000) + '... (кратено)';
    }

    return res.status(200).json({
      url,
      title: title.trim(),
      content: text,
    });
  } catch (error: any) {
    console.error('[WebScraper] Error:', error.message || error);
    return res.status(500).json({
      error: 'Не можам да ја извлечам содржината од овој веб-сајт.',
    });
  }
}
