/**
 * Generate PNG icons from pwa-icon.svg for PWA manifest.
 * 
 * Usage:
 *   npm install sharp --save-dev
 *   node scripts/generate-pwa-icons.mjs
 * 
 * Generates:
 *   - public/pwa-icon-192.png (192x192)
 *   - public/pwa-icon-512.png (512x512)
 *   - public/pwa-icon-maskable.png (512x512 with padding for maskable)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function generateIcons() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('❌ sharp is not installed. Run: npm install sharp --save-dev');
    process.exit(1);
  }

  const svgPath = join(publicDir, 'pwa-icon.svg');
  const svgBuffer = readFileSync(svgPath);

  // Standard icons
  const sizes = [192, 512];
  for (const size of sizes) {
    const outputPath = join(publicDir, `pwa-icon-${size}.png`);
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✅ Generated pwa-icon-${size}.png`);
  }

  // Maskable icon (with padding)
  const maskableSize = 512;
  const padding = 80; // ~15% padding for maskable safe zone
  const innerSize = maskableSize - padding * 2;
  
  const maskablePath = join(publicDir, 'pwa-icon-maskable.png');
  await sharp(svgBuffer, { density: 300 })
    .resize(innerSize, innerSize)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 79, g: 70, b: 229, alpha: 1 }, // #4f46e5 (indigo-600)
    })
    .png()
    .toFile(maskablePath);
  console.log('✅ Generated pwa-icon-maskable.png');

  console.log('\n📝 Update vite.config.ts manifest.icons to use PNG files:');
  console.log(`
    icons: [
      { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
  `);
}

generateIcons().catch(console.error);
