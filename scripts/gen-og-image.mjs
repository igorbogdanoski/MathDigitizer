/**
 * Generates the share cards under public/og/.
 *
 * The previous version drew rectangles pixel by pixel with nothing but built-in
 * Node, which meant it could not draw text — so the card that appeared whenever
 * anyone shared a link had a gradient, some circles, a crude "M" made of three
 * bars, and **not one word on it**. Not the product name, not what it does. It
 * compressed to 8 KB because flat colour is all it was.
 *
 * This renders real HTML in the browser Playwright already provides for the e2e
 * suite, so the card has actual typography, and screenshots it at 1200×630.
 *
 * Deliberately NOT part of `npm run build`. The deploy runs in CI, where the
 * Playwright browser may not be installed, and a share image is not worth a
 * failed deployment. The PNGs are committed like any other asset and this
 * regenerates them on demand:
 *
 *     npm run og:image
 *
 * `src/lib/ogImages.test.ts` asserts the committed files exist and are the size
 * the meta tags claim, so one can never go missing quietly.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const WIDTH = 1200;
const HEIGHT = 630;
const OUT_DIR = 'public/og';

/**
 * One card per public route, plus the default.
 *
 * `eyebrow` names the kind of page, `title` is what the reader came for, and
 * `note` is the single concrete detail that makes the card worth looking at.
 * Kept short on purpose: a share card is read in the half second before someone
 * decides whether to tap.
 */
const CARDS = [
  {
    file: 'default.png',
    eyebrow: 'За наставници по математика',
    title: 'Помалку хаос.\nПовеќе математика.',
    note: 'Дигитализација, оценување и наставни програми — во еден систем',
  },
  {
    file: 'pricing.png',
    eyebrow: 'Цени и претплата',
    title: 'Почни бесплатно.\nПлати кога вреди.',
    note: 'Pro за наставници · лиценци за училишта · плаќање преку банка',
  },
  {
    file: 'blog-ocr-matematika.png',
    eyebrow: 'Водич за наставници',
    title: 'Дигитализирај\nматематички задачи',
    note: 'Од фотографија на ракопис до задача што се уредува и печати',
  },
  {
    file: 'blog-latex-ekstrakcija.png',
    eyebrow: 'Водич за наставници',
    title: 'LaTeX од\nYouTube видео',
    note: 'Извади ги задачите со формулите, без рачно препишување',
  },
  {
    file: 'blog-live-mathkahoot.png',
    eyebrow: 'Водич за наставници',
    title: 'Натпревар\nво живо',
    note: 'Вистинска математика на екран, резултати во аналитиката',
  },
];

/**
 * The card, as HTML.
 *
 * Dark indigo ground because the card is most often seen inside a chat app,
 * where a light card disappears into the bubble around it. The formula strip is
 * the one decorative element and it earns its place by saying what the product
 * is about before a word is read.
 */
function html({ eyebrow, title, note }) {
  const escape = value => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!doctype html>
<html lang="mk"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;800&family=JetBrains+Mono:wght@400&display=swap">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    background: #14142b;
    background-image:
      radial-gradient(900px 520px at 82% -10%, rgba(99,102,241,.45), transparent 60%),
      radial-gradient(700px 460px at 8% 110%, rgba(56,189,248,.22), transparent 60%);
    color: #f5f7ff;
    font-family: Manrope, ui-sans-serif, system-ui, sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 68px 76px;
    position: relative; overflow: hidden;
  }

  /* Formula strip: says "mathematics" before a word is read. */
  .formulas {
    position: absolute; inset: 0;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 30px; line-height: 2.4;
    color: rgba(165,180,252,.10);
    white-space: pre; letter-spacing: .06em;
    transform: rotate(-8deg) translate(-40px, -30px);
    pointer-events: none;
  }

  .mark { display: flex; align-items: center; gap: 16px; }
  .glyph {
    width: 56px; height: 56px; border-radius: 15px;
    background: linear-gradient(140deg, #6366f1, #3b82f6);
    display: grid; place-items: center;
    font-size: 30px; font-weight: 800; color: #fff;
    box-shadow: 0 10px 30px rgba(79,70,229,.45);
  }
  .wordmark { font-size: 25px; font-weight: 800; letter-spacing: -.015em; }
  .wordmark span { color: #a5b4fc; font-weight: 500; }

  .eyebrow {
    font-size: 19px; font-weight: 800; letter-spacing: .14em;
    text-transform: uppercase; color: #8ea2ff; margin-bottom: 20px;
  }
  h1 {
    font-size: 76px; font-weight: 800; line-height: 1.06;
    letter-spacing: -.03em; white-space: pre-line;
  }
  .note {
    margin-top: 26px; font-size: 25px; font-weight: 500;
    color: #c3cbe8; max-width: 22ch; line-height: 1.45;
  }

  footer {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 21px; font-weight: 500; color: #9aa6cc;
  }
  .domain { color: #f5f7ff; font-weight: 800; }
  .rule { height: 5px; width: 118px; border-radius: 3px;
          background: linear-gradient(90deg, #6366f1, #38bdf8); }
</style></head>
<body>
  <div class="formulas">∫ f(x)dx    x² + bx + c = 0    √(a² + b²)    Δ = b² − 4ac
sin²α + cos²α = 1    lim(x→0)    a/b + c/d    π r²    ∑ xᵢ
f'(x) = 2x    (a+b)² = a² + 2ab + b²    log₂ 8 = 3    ∠ABC = 90°</div>

  <div class="mark">
    <div class="glyph">M</div>
    <div class="wordmark">MathDigitizer <span>Pro</span></div>
  </div>

  <div>
    <div class="eyebrow">${escape(eyebrow)}</div>
    <h1>${escape(title)}</h1>
    <p class="note">${escape(note)}</p>
  </div>

  <footer>
    <span class="domain">math.mismath.net</span>
    <div class="rule"></div>
  </footer>
</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

mkdirSync(OUT_DIR, { recursive: true });

for (const card of CARDS) {
  await page.setContent(html(card), { waitUntil: 'networkidle' });
  // The webfont must be in before the shot, or the card ships in a fallback.
  await page.evaluate(() => document.fonts.ready);

  const png = await page.screenshot({ type: 'png' });
  writeFileSync(`${OUT_DIR}/${card.file}`, png);
  console.log(`  ${card.file.padEnd(30)} ${(png.length / 1024).toFixed(0)} KB`);
}

// The historical path, kept because links already shared point at it.
writeFileSync('public/og-image.png', await (async () => {
  await page.setContent(html(CARDS[0]), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: 'png' });
})());
console.log('  og-image.png (legacy path, same as default)');

await browser.close();
console.log(`\n${CARDS.length} cards written to ${OUT_DIR}/`);
