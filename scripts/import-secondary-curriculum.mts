/**
 * Imports the vocational and gymnasium-elective programmes that MathDigitizer
 * was missing (EXPERT_LEVEL_MASTER_PLAN, 9.2).
 *
 * MathDigitizer modelled all vocational education as a single four-year track,
 * but БРО runs three distinct programmes — two-, three- and four-year — with
 * different hours and different themes. A teacher in a three-year profile was
 * therefore shown another programme's outcomes. The five gymnasium electives
 * were absent entirely.
 *
 * Source: the author's own curriculum repository, math-curriculum-ai-navigator,
 * which carries the official БРО programmes with document numbers and hours.
 * The existing four-year blocks (`1год-струк`…`4год-струк`) are left untouched —
 * they already match `vocational4` exactly — so nothing that references them breaks.
 *
 * Run: npx tsx scripts/import-secondary-curriculum.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const NAVIGATOR = 'C:/Users/pc4all/Downloads/math-curriculum-ai-navigator/data/secondary';
const OUT = 'src/lib/curriculumSecondary.ts';

interface NavConcept {
  id: string;
  title: string;
  description?: string;
  assessmentStandards?: string[];
  activities?: string[];
  priorKnowledgeIds?: string[];
}

interface NavTopic {
  id: string;
  title: string;
  suggestedHours?: number;
  topicLearningOutcomes?: string[];
  concepts?: NavConcept[];
}

interface NavGrade {
  id: string;
  level: number;
  title: string;
  secondaryTrack: string;
  weeklyHours?: number;
  levelDescription?: string;
  topics: NavTopic[];
}

/**
 * Grade tokens for the imported programmes.
 *
 * Deliberately distinct from the existing `*-струк` keys, which stay as the
 * four-year track: reusing them would silently reassign every saved task.
 */
const PROGRAMMES: Array<{
  module: string;
  exportName: string;
  gradeToken: string;
  track: string;
  levelLabel: string;
  /** The БРО decision this programme comes from, where it is known. */
  document?: { number: string; date: string; inForceFrom: string };
}> = [
  /**
   * II година гимназија, the programme in force from 2026/2027.
   *
   * Imported under its own token rather than replacing `2год`. The grade token
   * is part of every outcome code, so writing this programme onto `2год` would
   * either collide with the superseded codes or silently redefine them — and
   * every `curriculum_refs` a teacher saved against the old programme points at
   * exactly those codes. `2год` is marked `superseded_by` instead, and stays
   * resolvable.
   *
   * The navigator's transcription was checked against the signed document
   * (бр. 13-13739/9, 28.10.2025) before this import: six topics, the same
   * titles, hours 23/20/20/10/15/20 summing to 108, and 6/4/3/2/3/2 learning
   * outcomes. Every figure matches.
   */
  {
    module: 'gymnasium',
    exportName: 'gymnasiumGrade11',
    gradeToken: '2год-2026',
    track: 'secondary_general',
    levelLabel: 'II година гимназија',
    document: { number: '13-13739/9', date: '2025-10-28', inForceFrom: '2026/2027' },
  },

  { module: 'vocational2', exportName: 'vocational2Grade10', gradeToken: '1год-струк2', track: 'secondary_vocational_2', levelLabel: 'I година — стручно 2-годишно' },
  { module: 'vocational2', exportName: 'vocational2Grade11', gradeToken: '2год-струк2', track: 'secondary_vocational_2', levelLabel: 'II година — стручно 2-годишно' },

  { module: 'vocational3', exportName: 'vocational3Grade10', gradeToken: '1год-струк3', track: 'secondary_vocational_3', levelLabel: 'I година — стручно 3-годишно' },
  { module: 'vocational3', exportName: 'vocational3Grade11', gradeToken: '2год-струк3', track: 'secondary_vocational_3', levelLabel: 'II година — стручно 3-годишно' },
  { module: 'vocational3', exportName: 'vocational3Grade12', gradeToken: '3год-струк3', track: 'secondary_vocational_3', levelLabel: 'III година — стручно 3-годишно' },

  { module: 'gymnasium_electives', exportName: 'elementaryAlgebraGrade11', gradeToken: '2год-изб-еалг', track: 'gymnasium_elective', levelLabel: 'II година гимназија — Елементарна алгебра (изборен)' },
  { module: 'gymnasium_electives', exportName: 'elementaryAlgebraGeometryGrade11', gradeToken: '2год-изб-еалгео', track: 'gymnasium_elective', levelLabel: 'II година гимназија — Елементарна алгебра и геометрија (изборен)' },
  { module: 'gymnasium_electives', exportName: 'algebraGrade12', gradeToken: '3год-изб-алг', track: 'gymnasium_elective', levelLabel: 'III година гимназија — Алгебра (изборен)' },
  { module: 'gymnasium_electives', exportName: 'linearAlgebraAnalyticGeometryGrade12', gradeToken: '3год-изб-лааг', track: 'gymnasium_elective', levelLabel: 'III година гимназија — Линеарна алгебра и аналитичка геометрија (изборен)' },
  { module: 'gymnasium_electives', exportName: 'mathematicalAnalysisGrade13', gradeToken: '4год-изб-манал', track: 'gymnasium_elective', levelLabel: 'IV година гимназија — Математичка анализа (изборен)' },
];

/** Latin slug of a Macedonian title, for a stable topic id. */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ѓ: 'gj', е: 'e', ж: 'zh', з: 'z', ѕ: 'dz',
  и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', ќ: 'kj', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', џ: 'dj', ш: 'sh',
};

function slug(text: string): string {
  return [...text.toLowerCase()]
    .map(ch => TRANSLIT[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '-'))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Escapes a value for a single-quoted TypeScript string literal. */
const lit = (value: string): string =>
  `'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ').trim()}'`;

/** Title-case-ish short name: first few words, without the shouting. */
function shortName(title: string): string {
  const words = title.trim().split(/\s+/).slice(0, 4).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

const blocks: string[] = [];
let topicCount = 0;
let outcomeCount = 0;

for (const programme of PROGRAMMES) {
  const url = pathToFileURL(path.join(NAVIGATOR, `${programme.module}.ts`)).href;
  const module = await import(url);
  const source: NavGrade = module[programme.exportName];

  if (!source) {
    console.error(`missing export ${programme.exportName} in ${programme.module}`);
    continue;
  }

  const usedIds = new Set<string>();
  const topics: string[] = [];

  source.topics.forEach((topic, index) => {
    const outcomes = (topic.topicLearningOutcomes ?? []).filter(o => o?.trim());
    if (outcomes.length === 0) return;

    let id = `mk-${programme.gradeToken}-${slug(topic.title)}`;
    while (usedIds.has(id)) id += '-2';
    usedIds.add(id);

    const concepts = topic.concepts ?? [];
    // Concept titles are the vocabulary a keyword search should match on.
    const keywords = [...new Set(concepts.flatMap(c => c.title.toLowerCase().split(/[\s,]+/)))]
      .filter(k => k.length > 3)
      .slice(0, 12);

    // Real classroom activities from the programme — not invented examples.
    const activities = concepts.flatMap(c => c.activities ?? []).slice(0, 4);
    const standards = concepts.flatMap(c => c.assessmentStandards ?? []).slice(0, 12);
    const prerequisites = [...new Set(concepts.flatMap(c => c.priorKnowledgeIds ?? []))].slice(0, 8);

    const outcomeLines = outcomes
      .map((text, i) => `        { code: 'МА.${programme.gradeToken}.${index + 1}.${i + 1}', text: ${lit(text)} },`)
      .join('\n');

    outcomeCount += outcomes.length;
    topicCount++;

    topics.push(
`    {
      id: ${lit(id)},
      name: ${lit(topic.title)},
      name_short: ${lit(shortName(topic.title))},
      hours: ${topic.suggestedHours ?? 0},
      outcomes: [
${outcomeLines}
      ],
${standards.length ? `      assessment_standards: [\n${standards.map(s => `        ${lit(s)},`).join('\n')}\n      ],\n` : ''}      keywords: [${keywords.map(lit).join(', ')}],
      example_tasks: [${activities.map(lit).join(', ')}],
${prerequisites.length ? `      prerequisite_concept_ids: [${prerequisites.map(lit).join(', ')}],\n` : ''}    },`
    );
  });

  const documentLine = programme.document
    ? `
    document: { number: ${lit(programme.document.number)}, `
      + `date: ${lit(programme.document.date)}, `
      + `inForceFrom: ${lit(programme.document.inForceFrom)} },`
    : '';

  blocks.push(
`  {
    grade: ${lit(programme.gradeToken)},
    level_label: ${lit(programme.levelLabel)},
    education_track: '${programme.track}',
    hours_per_week: ${source.weeklyHours ?? 2},${documentLine}
    topics: [
${topics.join('\n')}
    ],
  },`
  );
}

const header = `// GENERATED — do not edit by hand.
// Source: math-curriculum-ai-navigator (the author's own curriculum repository),
// data/secondary/{vocational2,vocational3,gymnasium_electives}.ts, which carry
// the official БРО programmes with their document numbers and hours.
//
// Regenerate with: npx tsx scripts/import-secondary-curriculum.mts
//
// Why this file exists (EXPERT_LEVEL_MASTER_PLAN, 9.2): curriculumData.ts
// modelled all vocational education as one four-year track, so a teacher in a
// two- or three-year profile was shown another programme's outcomes. The five
// gymnasium electives were missing entirely. The existing \`*-струк\` blocks are
// the four-year programme and stay where they are.

import type { CurriculumGrade } from './curriculumData';

export const SECONDARY_EXTRA_CURRICULUM: CurriculumGrade[] = [
${blocks.join('\n')}
];
`;

fs.writeFileSync(OUT, header, 'utf8');
console.log(`wrote ${OUT}`);
console.log(`programmes: ${blocks.length} | topics: ${topicCount} | outcomes: ${outcomeCount}`);
