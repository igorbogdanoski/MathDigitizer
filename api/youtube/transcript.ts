import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, parseSafeUrl } from '../_shared';

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
  const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']);
  if (!youtubeHosts.has(parsed.hostname.toLowerCase())) {
    return res.status(400).json({ error: 'Дозволени се само YouTube URL-а' });
  }

  try {
    console.log(`[YoutubeScraper] Fetching transcript for: ${url}`);
    const module = (await import('youtube-transcript')) as any;
    const YoutubeTranscript = module.YoutubeTranscript || module.default?.YoutubeTranscript || module.default;

    let transcript;
    try {
      transcript = await YoutubeTranscript.fetchTranscript(url, { lang: 'mk' });
      console.log(`[YoutubeScraper] Successful extraction using 'mk' language.`);
    } catch {
      console.log(`[YoutubeScraper] Language 'mk' failed, trying 'en'...`);
      try {
        transcript = await YoutubeTranscript.fetchTranscript(url, { lang: 'en' });
        console.log(`[YoutubeScraper] Successful extraction using 'en' language.`);
      } catch {
        console.log(`[YoutubeScraper] Language 'en' failed, fetching default transcript...`);
        transcript = await YoutubeTranscript.fetchTranscript(url);
        console.log(`[YoutubeScraper] Successful extraction using default language.`);
      }
    }

    const fullText = transcript.map((t: any) => t.text).join(' ');

    return res.status(200).json({
      url,
      transcript: fullText,
      fragments: transcript,
    });
  } catch (error: any) {
    console.error('[YoutubeScraper] Error:', error.message || error);
    return res.status(500).json({
      error: 'Не можам да го извлечам транскриптот. Видеото можеби нема превод или е приватно.',
    });
  }
}
