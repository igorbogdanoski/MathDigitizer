/**
 * Patches @vitest/runner/dist/chunk-artifact.js to work around a Windows
 * drive-letter casing bug (c: vs C:) that causes Node.js to load two
 * separate module instances, breaking vitest's shared state.
 *
 * Root cause: Vite's module runner resolves paths with uppercase drive
 * letters while the worker uses lowercase, so `file:///c:/...` and
 * `file:///C:/...` are treated as different modules.
 *
 * Fix: share critical module-level state via globalThis.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname, '..', 'node_modules', '@vitest', 'runner', 'dist', 'chunk-artifact.js'
);

if (!fs.existsSync(target)) {
  console.log('[fix-vitest-runner] @vitest/runner not found, skipping patch');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');

if (src.includes('__vitest_runner')) {
  console.log('[fix-vitest-runner] already patched');
  process.exit(0);
}

const replacements = [
  // Share WeakMaps via globalThis
  [
    'const fnMap = new WeakMap();',
    'const fnMap = globalThis.__vitest_fnMap ??= new WeakMap();'
  ],
  [
    'const testFixtureMap = new WeakMap();',
    'const testFixtureMap = globalThis.__vitest_testFixtureMap ??= new WeakMap();'
  ],
  [
    'const hooksMap = new WeakMap();',
    'const hooksMap = globalThis.__vitest_hooksMap ??= new WeakMap();'
  ],
  // Share collectorContext via globalThis
  [
    'const collectorContext = {\n\ttasks: [],\n\tcurrentSuite: null\n};',
    'const collectorContext = globalThis.__vitest_collector_context ??= {\n\ttasks: [],\n\tcurrentSuite: null\n};'
  ],
  // getRunner fallback
  [
    'function getRunner() {\n\tassert(runner, "the runner");\n\treturn runner;\n}',
    'function getRunner() {\n\tconst r = runner || globalThis.__vitest_runner;\n\tassert(r, "the runner");\n\treturn r;\n}'
  ],
  // createDefaultSuite fallback
  [
    'const config = runner.config.sequence;',
    'const config = (runner || globalThis.__vitest_runner)?.config?.sequence ?? {};'
  ],
  // clearCollectorContext: also set globalThis
  [
    'function clearCollectorContext(file, currentRunner) {\n\tcurrentTestFilepath = file.filepath;\n\trunner = currentRunner;',
    'function clearCollectorContext(file, currentRunner) {\n\tcurrentTestFilepath = file.filepath;\n\trunner = currentRunner;\n\tglobalThis.__vitest_runner = currentRunner;'
  ],
  // matchesTags fallback
  [
    'function matchesTags(testTags) {\n\tconst runner = getRunner();\n\tconst tagsFilter = runner._currentSpecification?.testTagsFilter ?? runner.config.tagsFilter;',
    'function matchesTags(testTags) {\n\tconst runner = runner || globalThis.__vitest_runner;\n\tif (!runner) return true;\n\tconst tagsFilter = runner._currentSpecification?.testTagsFilter ?? runner.config.tagsFilter;'
  ],
  // createSuiteCollector: add _runner fallback
  [
    'function createSuiteCollector(name, factory = () => {}, mode, each, suiteOptions) {\n\tconst tasks = [];\n\tlet suite;',
    'function createSuiteCollector(name, factory = () => {}, mode, each, suiteOptions) {\n\tconst tasks = [];\n\tlet suite;\n\tconst _runner = runner || globalThis.__vitest_runner;'
  ],
  // initSuite: use _runner
  [
    'validateTags(runner.config, suiteTags);',
    'validateTags(_runner?.config ?? {}, suiteTags);'
  ],
  // initSuite: includeTaskLocation
  [
    'if (runner && includeLocation && runner.config.includeTaskLocation)',
    'if (_runner && includeLocation && _runner.config.includeTaskLocation)'
  ],
  // createSuiteCollector: tag validation
  [
    'const tagDefinition = runner.config.tags?.find((t) => t.name === tag);\n\t\t\tif (!tagDefinition && runner.config.strictTags) {\n\t\t\t\tthrow createNoTagsError(runner.config.tags, tag);',
    'const tagDefinition = _runner?.config?.tags?.find((t) => t.name === tag);\n\t\t\tif (!tagDefinition && _runner?.config?.strictTags) {\n\t\t\t\tthrow createNoTagsError(_runner.config.tags, tag);'
  ],
  // createSuiteCollector: timeout
  [
    'const timeout = options.timeout ?? runner.config.testTimeout;',
    'const timeout = options.timeout ?? _runner?.config?.testTimeout;'
  ],
  // createSuiteCollector: retry
  [
    'retry: options.retry ?? runner.config.retry,',
    'retry: options.retry ?? _runner?.config?.retry,'
  ],
  // createSuiteCollector: concurrent
  [
    'if (options.concurrent ?? (!options.sequential && runner.config.sequence.concurrent))',
    'if (options.concurrent ?? (!options.sequential && _runner?.config?.sequence?.concurrent))'
  ],
  // createSuiteCollector: createTestContext
  [
    'const context = createTestContext(task, runner);',
    'const context = createTestContext(task, _runner);'
  ],
  // createSuiteCollector: includeTaskLocation
  [
    'if (runner.config.includeTaskLocation) {',
    'if (_runner?.config?.includeTaskLocation) {'
  ],
  // suiteFn: shuffle
  [
    'runner?.config.sequence.shuffle',
    '(runner || globalThis.__vitest_runner)?.config?.sequence?.shuffle'
  ],
];

let changed = 0;
for (const [from, to] of replacements) {
  if (src.includes(from)) {
    src = src.replace(from, to);
    changed++;
  }
}

fs.writeFileSync(target, src, 'utf8');
console.log(`[fix-vitest-runner] applied ${changed}/${replacements.length} patches`);
