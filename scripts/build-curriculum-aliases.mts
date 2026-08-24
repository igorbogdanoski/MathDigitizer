/**
 * Builds the legacy → current outcome-code map (EXPERT_LEVEL_MASTER_PLAN, 9.3).
 *
 * Phase 9.1 repaired the corpus: 241 outcomes shared a code with an unrelated
 * outcome, and a bad decode had corrupted others (`МА.3<?>од.2.21`). Repairing
 * them meant renumbering, and a `curriculum_refs` entry saved before that holds
 * nothing but the bare code string. 206 codes that a teacher could have tagged
 * a task with no longer resolve to anything.
 *
 * This recovers the ones that can be recovered. An old code is only aliased
 * when it stood for exactly one outcome text back then and that text is carried
 * by exactly one outcome now — the mapping is then a fact, not a guess, which
 * is what the shared contract's §3 requires ("кодот се носи со содржината,
 * никогаш не се погодува").
 *
 * The codes that were already duplicated are deliberately *not* aliased. A ref
 * to `ГЕ.1год-миг.1.1` genuinely meant one of seven different outcomes and
 * nothing in the saved data says which. They are listed separately so the UI
 * can say "this tag is from before the correction and is ambiguous" instead of
 * silently picking one or silently dropping it.
 *
 * Run: npx tsx scripts/build-curriculum-aliases.mts
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_MK_CURRICULUM } from '../src/lib/curriculumData';
import { SECONDARY_EXTRA_CURRICULUM } from '../src/lib/curriculumSecondary';

/** Last commit before the 9.1 curriculum repairs. */
const PRE_REPAIR_REF = '5113ace';
const SCRATCH = 'scripts/.curriculumData.pre-repair.ts';
/** The first import of the БРО programmes — kept as evidence of origin. */
const FIRST_IMPORT = 'scripts/bro-curriculum-output.json';
const OUT = 'src/lib/curriculumAliases.ts';

const norm = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

fs.writeFileSync(
  SCRATCH,
  execSync(`git show ${PRE_REPAIR_REF}:src/lib/curriculumData.ts`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
  'utf8',
);

let before: Array<{ topics: Array<{ outcomes: Array<{ code: string; text: string }> }> }>;
try {
  const module = await import(pathToFileURL(path.resolve(SCRATCH)).href);
  before = module.ALL_MK_CURRICULUM;
} finally {
  fs.unlinkSync(SCRATCH);
}

/** Every text each old code stood for. More than one means it was a duplicate. */
const oldCodeTexts = new Map<string, Set<string>>();
for (const grade of before)
  for (const topic of grade.topics)
    for (const outcome of topic.outcomes) {
      const texts = oldCodeTexts.get(outcome.code) ?? new Set<string>();
      texts.add(norm(outcome.text));
      oldCodeTexts.set(outcome.code, texts);
    }

const currentCodes = new Set<string>();
const codesByText = new Map<string, string[]>();
for (const grade of ALL_MK_CURRICULUM)
  for (const topic of grade.topics)
    for (const outcome of topic.outcomes) {
      currentCodes.add(outcome.code);
      const key = norm(outcome.text);
      codesByText.set(key, [...(codesByText.get(key) ?? []), outcome.code]);
    }

const aliases: Array<[string, string]> = [];
const ambiguous: string[] = [];
let withdrawn = 0;

for (const [code, texts] of [...oldCodeTexts.entries()].sort()) {
  if (currentCodes.has(code)) continue;

  const targets = new Set([...texts].flatMap(text => codesByText.get(text) ?? []));

  if (texts.size === 1 && targets.size === 1) aliases.push([code, [...targets][0]]);
  else if (targets.size > 1) ambiguous.push(code);
  else withdrawn++;
}

// ─── Provenance: where each code in today's corpus came from ─────────────────
//
// Four origins, checked in order, plus the bucket that matters most: outcomes
// whose text appears in no source we hold. Those stay in the corpus — the
// wording is genuine БРО phrasing — but §9 of the contract promises that origin
// is knowable per code, so they are named here rather than lost inside a total.
//
// `repaired` is kept separate from `identical` deliberately. Those outcomes sit
// under the very same code they were imported with; only the text differs,
// because the import had lost Cyrillic letters to a bad decode. Folding them in
// with `identical` would overstate how much of the corpus stands untouched.

const firstImportCodes = new Map<string, string>();
// Collected separately, not from the map's values: the import has codes shared
// by several outcomes — that is what 9.1 repaired — and keying by code alone
// would drop every text but the last, making outcomes look untraceable when
// their wording is right there in the file.
const firstImportTexts = new Set<string>();
{
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      if (typeof node.code === 'string' && typeof node.text === 'string') {
        firstImportCodes.set(node.code, norm(node.text));
        firstImportTexts.add(norm(node.text));
      }
      Object.values(node).forEach(walk);
    }
  };
  walk(JSON.parse(fs.readFileSync(FIRST_IMPORT, 'utf8')));
}
const navigatorGrades = new Set(SECONDARY_EXTRA_CURRICULUM.map(g => g.grade));

const provenance = { identical: 0, repaired: 0, renumbered: 0, navigator: 0 };
const unverified: Array<[string, string]> = [];

for (const grade of ALL_MK_CURRICULUM)
  for (const topic of grade.topics)
    for (const outcome of topic.outcomes) {
      if (navigatorGrades.has(grade.grade)) { provenance.navigator++; continue; }

      const importedText = firstImportCodes.get(outcome.code);
      if (importedText !== undefined) {
        if (importedText === norm(outcome.text)) provenance.identical++;
        else provenance.repaired++;
        continue;
      }

      if (firstImportTexts.has(norm(outcome.text))) provenance.renumbered++;
      else unverified.push([outcome.code, outcome.text]);
    }

const lit = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const file = `// GENERATED — do not edit by hand.
// Regenerate with: npx tsx scripts/build-curriculum-aliases.mts
//
// Outcome codes that existed before the 9.1 corpus repair and no longer do.
// A curriculum_refs entry saved back then holds only the bare code string, so
// without this map those tags resolve to nothing: the task drops out of the
// mastery rollup and out of every cross-app comparison, with no error anywhere.

/**
 * Old code → the code that carries the same outcome today.
 *
 * Only 1:1 matches are here. Each entry means the old code stood for exactly
 * one outcome text and exactly one current outcome carries that same text — so
 * following it recovers what the teacher meant, rather than guessing at it.
 */
export const CURRICULUM_CODE_ALIASES: Readonly<Record<string, string>> = {
${aliases.map(([from, to]) => `  ${lit(from)}: ${lit(to)},`).join('\n')}
};

/**
 * Codes that were shared by several unrelated outcomes before the repair.
 *
 * These are deliberately not aliased. \`ГЕ.1год-миг.1.1\` stood for seven
 * different outcomes at once, and nothing in a saved ref says which one was
 * meant. Picking one would invent attribution; dropping it silently would hide
 * that the tag ever existed. Surfacing it lets a teacher re-tag the task.
 */
export const AMBIGUOUS_LEGACY_CODES: readonly string[] = [
${ambiguous.map(code => `  ${lit(code)},`).join('\n')}
];

const AMBIGUOUS = new Set<string>(AMBIGUOUS_LEGACY_CODES);

export type OutcomeCodeStatus = 'current' | 'renamed' | 'ambiguous' | 'unknown';

export interface ResolvedOutcomeCode {
  /** The code to use. Unchanged unless the status is \`renamed\`. */
  code: string;
  status: OutcomeCodeStatus;
}

/**
 * Resolves a possibly-legacy outcome code against today's corpus.
 *
 * \`current\` — the code is live.
 * \`renamed\` — it was renumbered by the 9.1 repair; \`code\` is the current one.
 * \`ambiguous\` — it was shared by several outcomes and cannot be recovered.
 * \`unknown\` — no such code, then or now.
 *
 * Callers that count or compare must not treat \`ambiguous\` as a real code:
 * that is the one case where the honest answer is "we do not know".
 */
export function resolveOutcomeCode(
  code: string,
  isCurrent: (code: string) => boolean,
): ResolvedOutcomeCode {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return { code: trimmed, status: 'unknown' };
  if (isCurrent(trimmed)) return { code: trimmed, status: 'current' };

  const alias = CURRICULUM_CODE_ALIASES[trimmed];
  if (alias) return { code: alias, status: 'renamed' };
  if (AMBIGUOUS.has(trimmed)) return { code: trimmed, status: 'ambiguous' };

  return { code: trimmed, status: 'unknown' };
}

/**
 * Where the codes in today's corpus came from (shared contract §9).
 *
 * \`identical\`  — code and text stand literally as in scripts/bro-curriculum-output.json.
 * \`repaired\`   — same code; the imported text had lost letters to a bad decode.
 * \`renumbered\` — same text word for word; the code changed in the 9.1 repair.
 * \`navigator\`  — imported in 9.2 from math-curriculum-ai-navigator, data/secondary.
 * \`unverified\` — the text appears in no source we hold; see UNVERIFIED_ORIGIN_CODES.
 *
 * The four accounted-for buckets plus \`unverified\` cover every outcome in the
 * corpus; curriculumAliases.test.ts asserts the sum.
 */
export const CURRICULUM_PROVENANCE = {
  identical: ${provenance.identical},
  repaired: ${provenance.repaired},
  renumbered: ${provenance.renumbered},
  navigator: ${provenance.navigator},
  unverified: ${unverified.length},
} as const;

/**
 * Outcomes carried in the corpus whose text traces to no source we hold.
 *
 * They are kept, not deleted: the wording is genuine БРО phrasing and a teacher
 * in those programmes needs the outcome. But the contract requires that origin
 * be knowable per code, and for these it is not — so they are named, so that
 * "we have not verified this one" is something the project can say out loud
 * rather than a gap hidden inside a total.
 */
export const UNVERIFIED_ORIGIN_CODES: ReadonlyArray<{ code: string; text: string }> = [
${unverified.map(([code, text]) => `  { code: ${lit(code)}, text: ${lit(text)} },`).join('\n')}
];
`;

fs.writeFileSync(OUT, file, 'utf8');
console.log(`wrote ${OUT}`);
console.log(`aliased: ${aliases.length} | ambiguous: ${ambiguous.length} | withdrawn: ${withdrawn}`);
console.log('provenance:', { ...provenance, unverified: unverified.length });
