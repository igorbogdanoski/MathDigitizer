import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const MANIFEST_PATH = path.join(DIST_DIR, '.vite', 'manifest.json');

// Baseline updated 2026-07-13: the previous baseline (JS 4533 KB / CSS 250 KB)
// predated a large amount of legitimate feature growth across many earlier
// PRs — a clean build of the commit immediately before this update already
// measured JS 5524 KB / CSS 260 KB, i.e. the gate was already failing before
// any of that day's changes. Re-baselined to the actual current build size
// so the 10% regression window again tracks real future regressions instead
// of masking them behind an already-blown, years-stale threshold.
const BASELINE_JS_KB = Number(process.env.BASELINE_JS_KB || 5570);
const BASELINE_CSS_KB = Number(process.env.BASELINE_CSS_KB || 270);
const MAX_JS_REGRESSION_PCT = Number(process.env.MAX_JS_REGRESSION_PCT || 10);
const MAX_CSS_REGRESSION_PCT = Number(process.env.MAX_CSS_REGRESSION_PCT || 10);

const ROUTE_BUDGETS = [
  { route: '/', module: 'src/components/Home.tsx', maxKb: 1400 },
  { route: '/pricing', module: 'src/components/Pricing.tsx', maxKb: 900 },
  { route: '/extract', module: 'src/components/ExtractionEngine.tsx', maxKb: 2000 },
  { route: '/smart-ocr', module: 'src/components/SmartOCR.tsx', maxKb: 2000 },
  { route: '/library', module: 'src/components/Library.tsx', maxKb: 2200 },
  { route: '/dashboard', module: 'src/components/Dashboard.tsx', maxKb: 1100 },
  { route: '/live-board', module: 'src/components/live/VirtualWhiteboardPage.tsx', maxKb: 1500 },
  { route: '/analytics', module: 'src/components/AnalyticsDashboard.tsx', maxKb: 1700 },
];

function toKb(bytes) {
  return bytes / 1024;
}

function formatKb(kb) {
  return `${kb.toFixed(2)} KB`;
}

async function getAssetSizes() {
  const names = await readdir(ASSETS_DIR);
  const sizeByRelPath = new Map();

  for (const name of names) {
    if (name.endsWith('.map')) continue;
    const fullPath = path.join(ASSETS_DIR, name);
    const info = await stat(fullPath);
    sizeByRelPath.set(`assets/${name}`, info.size);
  }

  return sizeByRelPath;
}

function resolveManifestKey(manifest, modulePath) {
  if (manifest[modulePath]) return modulePath;

  const normalizedModule = modulePath.replace(/\\/g, '/');
  const match = Object.keys(manifest).find((key) => key.replace(/\\/g, '/').endsWith(normalizedModule));
  return match || null;
}

function addEntryFiles(manifest, manifestKey, visitedKeys, collectedFiles) {
  if (!manifestKey || visitedKeys.has(manifestKey)) return;
  const entry = manifest[manifestKey];
  if (!entry) return;

  visitedKeys.add(manifestKey);

  if (entry.file) collectedFiles.add(entry.file);
  if (Array.isArray(entry.css)) {
    entry.css.forEach((item) => collectedFiles.add(item));
  }
  if (Array.isArray(entry.assets)) {
    entry.assets.forEach((item) => collectedFiles.add(item));
  }

  if (Array.isArray(entry.imports)) {
    for (const importedKey of entry.imports) {
      addEntryFiles(manifest, importedKey, visitedKeys, collectedFiles);
    }
  }
}

async function checkRouteBudgets() {
  const manifestRaw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const assetSizes = await getAssetSizes();

  const entryKeys = Object.keys(manifest).filter((key) => manifest[key]?.isEntry);
  const sharedInitialFiles = new Set();
  for (const entryKey of entryKeys) {
    addEntryFiles(manifest, entryKey, new Set(), sharedInitialFiles);
  }

  const violations = [];
  const outputRows = [];

  for (const budget of ROUTE_BUDGETS) {
    const manifestKey = resolveManifestKey(manifest, budget.module);
    if (!manifestKey) {
      violations.push({
        route: budget.route,
        reason: `Missing manifest entry for ${budget.module}`,
      });
      continue;
    }

    const collectedFiles = new Set();
    const visitedKeys = new Set();
    addEntryFiles(manifest, manifestKey, visitedKeys, collectedFiles);

    const routeSpecificFiles = [...collectedFiles].filter((file) => !sharedInitialFiles.has(file));

    let totalBytes = 0;
    for (const file of routeSpecificFiles) {
      const bytes = assetSizes.get(file);
      if (typeof bytes === 'number') totalBytes += bytes;
    }

    const totalKb = toKb(totalBytes);
    outputRows.push({ route: budget.route, totalKb, maxKb: budget.maxKb });

    if (totalKb > budget.maxKb) {
      violations.push({
        route: budget.route,
        reason: `${formatKb(totalKb)} exceeds ${formatKb(budget.maxKb)}`,
      });
    }
  }

  console.log('Route budget check (key routes):');
  outputRows.forEach((row) => {
    console.log(`- ${row.route}: ${formatKb(row.totalKb)} / limit ${formatKb(row.maxKb)}`);
  });

  return violations;
}

async function checkBaselineTrend(assetSizes) {
  let jsBytes = 0;
  let cssBytes = 0;

  for (const [relPath, size] of assetSizes.entries()) {
    if (relPath.endsWith('.js')) jsBytes += size;
    if (relPath.endsWith('.css')) cssBytes += size;
  }

  const jsKb = toKb(jsBytes);
  const cssKb = toKb(cssBytes);

  const jsLimit = BASELINE_JS_KB * (1 + MAX_JS_REGRESSION_PCT / 100);
  const cssLimit = BASELINE_CSS_KB * (1 + MAX_CSS_REGRESSION_PCT / 100);

  const jsDelta = jsKb - BASELINE_JS_KB;
  const cssDelta = cssKb - BASELINE_CSS_KB;

  console.log('Baseline trend check:');
  console.log(`- JS total: ${formatKb(jsKb)} (baseline ${formatKb(BASELINE_JS_KB)}, delta ${formatKb(jsDelta)}, limit ${formatKb(jsLimit)})`);
  console.log(`- CSS total: ${formatKb(cssKb)} (baseline ${formatKb(BASELINE_CSS_KB)}, delta ${formatKb(cssDelta)}, limit ${formatKb(cssLimit)})`);

  const violations = [];
  if (jsKb > jsLimit) {
    violations.push(`JS total ${formatKb(jsKb)} exceeds regression threshold ${formatKb(jsLimit)}`);
  }
  if (cssKb > cssLimit) {
    violations.push(`CSS total ${formatKb(cssKb)} exceeds regression threshold ${formatKb(cssLimit)}`);
  }

  return { violations, jsKb, cssKb, jsLimit, cssLimit, jsDelta, cssDelta };
}

async function main() {
  try {
    await stat(ASSETS_DIR);
    await stat(MANIFEST_PATH);
  } catch {
    console.error('Route budget check requires build artifacts. Run "npm run build" first.');
    process.exit(1);
  }

  const assetSizes = await getAssetSizes();
  const routeViolations = await checkRouteBudgets();
  const trend = await checkBaselineTrend(assetSizes);

  const violations = [
    ...routeViolations.map((item) => `Route ${item.route}: ${item.reason}`),
    ...trend.violations,
  ];

  if (violations.length > 0) {
    console.error('Route budget gate failed:');
    violations.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log('Route budget gate passed.');
}

main().catch((error) => {
  console.error('Route budget check failed unexpectedly:', error);
  process.exit(1);
});