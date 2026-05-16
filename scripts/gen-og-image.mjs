/**
 * Generates public/og-image.png — 1200x630 branded PNG using only built-in Node.js.
 * Run: node scripts/gen-og-image.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const W = 1200;
const H = 630;

// ── CRC32 ──────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// ── Pixel helpers ──────────────────────────────────────────────────────────
const rowBytes = 1 + W * 3; // filter byte + RGB
const raw = Buffer.alloc(H * rowBytes, 0);

function setPixel(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const off = y * rowBytes + 1 + x * 3;
  raw[off] = r; raw[off + 1] = g; raw[off + 2] = b;
}

function fillRect(x0, y0, x1, y1, r, g, b) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++)
      setPixel(x, y, r, g, b);
}

function fillCircle(cx, cy, radius, r, g, b) {
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2)
        setPixel(x, y, r, g, b);
}

// ── Background gradient: indigo #4f46e5 → deep purple #1e1b4b ─────────────
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const r = Math.round(79  + (30  - 79)  * t);
  const g = Math.round(70  + (27  - 70)  * t);
  const b = Math.round(229 + (75  - 229) * t);
  for (let x = 0; x < W; x++) setPixel(x, y, r, g, b);
}

// ── Decorative circles (brand feel) ───────────────────────────────────────
fillCircle(980, 120, 180, 99, 88, 239);   // violet #6358ef, top-right
fillCircle(1100, 500, 120, 67, 56, 202);  // darker indigo
fillCircle(120, 520, 100, 55, 48, 163);   // bottom-left accent

// ── White card panel ───────────────────────────────────────────────────────
fillRect(60, 60, W - 60, H - 60, 255, 255, 255);  // white card
// Card inner shadow (thin dark border)
fillRect(60, 60, W - 60, 64, 229, 231, 235);       // top edge
fillRect(60, H - 64, W - 60, H - 60, 229, 231, 235);

// ── Left accent bar (indigo) ───────────────────────────────────────────────
fillRect(60, 60, 76, H - 60, 79, 70, 229);

// ── Logo block: "MD" dark square ──────────────────────────────────────────
fillRect(100, 95, 190, 175, 79, 70, 229);   // indigo square
// White "M" approximation (two vertical + diagonal blocks)
fillRect(108, 103, 116, 165, 255, 255, 255);
fillRect(140, 103, 148, 165, 255, 255, 255);
fillRect(108, 103, 150, 119, 255, 255, 255);  // top bar

// ── Title bar: thick dark line under logo ─────────────────────────────────
fillRect(100, 185, 900, 193, 79, 70, 229);

// ── Feature pill blocks ───────────────────────────────────────────────────
const pills = [
  [100, 210, 280, 248, 238, 242, 255, 79, 70, 229],   // light indigo pill
  [296, 210, 480, 248, 240, 253, 244, 22, 163, 74],   // light green pill
  [496, 210, 660, 248, 254, 252, 232, 202, 138, 4],   // light amber pill
  [676, 210, 840, 248, 254, 242, 242, 239, 68, 68],   // light red pill
];
for (const [x0, y0, x1, y1, br, bg, bb, cr, cg, cb] of pills) {
  fillRect(x0, y0, x1, y1, br, bg, bb);
  fillRect(x0, y0, x0 + 6, y1, cr, cg, cb);  // colored left border
}

// ── Price badge (bottom right of card) ────────────────────────────────────
fillRect(820, 330, 1060, 430, 79, 70, 229);    // indigo badge
fillRect(826, 336, 1054, 424, 255, 255, 255);  // white inner
fillRect(826, 336, 1054, 356, 79, 70, 229);    // indigo top strip

// ── Bottom strip: domain ───────────────────────────────────────────────────
fillRect(60, H - 100, W - 60, H - 60, 249, 250, 251);
fillRect(60, H - 100, W - 60, H - 96, 79, 70, 229);  // indigo top line

// ── Wave decoration (bottom left) ────────────────────────────────────────
for (let x = 100; x < 700; x++) {
  const yWave = Math.round(490 + 12 * Math.sin((x - 100) * 0.03));
  fillRect(x, yWave, x + 1, yWave + 4, 165, 180, 252);  // indigo-300
}

// ── IHDR chunk ────────────────────────────────────────────────────────────
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // 8-bit
ihdr[9] = 2;  // RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', idat),
  pngChunk('IEND', Buffer.alloc(0)),
]);

writeFileSync('public/og-image.png', png);
console.log(`✓ public/og-image.png generated (${(png.length / 1024).toFixed(1)} KB)`);
