import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'dist', 'assets');
// Raw limit. gemini + vendor chunks are ~105KB gzipped — well within network budget.
const MAX_JS_KB = Number(process.env.BUNDLE_MAX_JS_KB || 600);
const MAX_CSS_KB = Number(process.env.BUNDLE_MAX_CSS_KB || 300);

// This gate exists to catch accidentally-bloated EAGER bundles on the
// initial-load critical path. A chunk that only exists behind a genuine
// dynamic import() — fetched for a small minority of sessions, well after
// first paint — doesn't violate that intent even if it's individually
// large, so it's exempted here by name rather than by raising the blanket
// limit (which would stop catching real regressions in eager chunks).
// Verify any addition is actually behind a dynamic import before listing it.
const LAZY_CHUNK_ALLOWLIST = [
  // @cortex-js/compute-engine (~1.6 MB) — dynamically imported inside
  // lib/mathVerify.ts, only fetched when InteractiveSolver attempts its
  // fast-path step check, never on initial page load.
  /^vendor-cortex-js-compute-engine-/,
];

function isAllowlistedLazyChunk(filename) {
  return LAZY_CHUNK_ALLOWLIST.some((pattern) => pattern.test(filename));
}

function toKb(bytes) {
  return bytes / 1024;
}

async function getAssetFiles() {
  const names = await readdir(ASSETS_DIR);
  return names
    .filter((name) => !name.endsWith('.map'))
    .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
    .map((name) => path.join(ASSETS_DIR, name));
}

async function main() {
  const files = await getAssetFiles();

  const overBudget = [];
  for (const filePath of files) {
    const filename = path.basename(filePath);
    if (isAllowlistedLazyChunk(filename)) continue;

    const info = await stat(filePath);
    const kb = toKb(info.size);
    const ext = path.extname(filePath);
    const threshold = ext === '.css' ? MAX_CSS_KB : MAX_JS_KB;

    if (kb > threshold) {
      overBudget.push({
        file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
        kb,
        threshold,
      });
    }
  }

  if (overBudget.length > 0) {
    console.error('Bundle budget gate failed. Oversized assets found:');
    overBudget.forEach((item) => {
      console.error(`- ${item.file}: ${item.kb.toFixed(2)} KB (limit ${item.threshold} KB)`);
    });
    process.exit(1);
  }

  console.log(`Bundle budget gate passed. Limits: JS <= ${MAX_JS_KB} KB, CSS <= ${MAX_CSS_KB} KB`);
}

main().catch((error) => {
  console.error('Bundle budget check failed unexpectedly:', error);
  process.exit(1);
});
