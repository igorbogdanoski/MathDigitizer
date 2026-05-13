import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'dist', 'assets');
const MAX_JS_KB = Number(process.env.BUNDLE_MAX_JS_KB || 500);
const MAX_CSS_KB = Number(process.env.BUNDLE_MAX_CSS_KB || 300);

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
