/**
 * Generates a light index of the curriculum corpus.
 *
 * The full corpus is 571 KB, and 81% of that is prose: outcome texts, classroom
 * activities and assessment standards. Several screens need none of it — the
 * analytics coverage panel and the student knowledge path only ever read topic
 * ids, names and counts — yet importing the corpus pulled all of it into their
 * route bundle, which put /analytics within 30 KB of its budget.
 *
 * This emits just the identifying data. Anything that needs the wording still
 * imports curriculumData directly; a test holds the two to each other so the
 * index cannot drift from the corpus it describes.
 *
 * Run: npx tsx scripts/build-curriculum-index.mts
 */
import fs from 'node:fs';
import { ALL_MK_CURRICULUM } from '../src/lib/curriculumData';

const OUT = 'src/lib/curriculumIndex.ts';

const lit = (value: string): string =>
  `'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const grades = ALL_MK_CURRICULUM.map(grade => {
  const topics = grade.topics.map(topic =>
    `      { id: ${lit(topic.id)}, name: ${lit(topic.name)}, name_short: ${lit(topic.name_short)}, ` +
    `hours: ${topic.hours}, outcome_count: ${topic.outcomes.length}, ` +
    `outcome_codes: [${topic.outcomes.map(o => lit(o.code)).join(', ')}], ` +
    `keywords: [${(topic.keywords ?? []).map(lit).join(', ')}] },`
  ).join('\n');

  return `  {
    grade: ${lit(grade.grade)},
    level_label: ${lit(grade.level_label)},
    education_track: ${lit(grade.education_track)},
    hours_per_week: ${grade.hours_per_week},
    topics: [
${topics}
    ],
  },`;
}).join('\n');

const outcomeTotal = ALL_MK_CURRICULUM.reduce(
  (sum, g) => sum + g.topics.reduce((a, t) => a + t.outcomes.length, 0), 0
);

const file = `// GENERATED — do not edit by hand.
// Regenerate with: npx tsx scripts/build-curriculum-index.mts
//
// A light index over the БРО curriculum: ${ALL_MK_CURRICULUM.length} programmes,
// ${ALL_MK_CURRICULUM.reduce((s, g) => s + g.topics.length, 0)} topics, ${outcomeTotal} outcome codes — identifying data only.
//
// Import this wherever you need to *name* or *count* curriculum entries;
// import curriculumData only where the actual wording is used (RAG context,
// classification, the admin review UI). curriculumIndex.test.ts holds the two
// to each other, so this file cannot drift from the corpus.

export interface CurriculumTopicIndex {
  id: string;
  name: string;
  name_short: string;
  hours: number;
  outcome_count: number;
  outcome_codes: string[];
  /** Search vocabulary — matched against, never rendered as prose. */
  keywords: string[];
}

export interface CurriculumGradeIndex {
  grade: string;
  level_label: string;
  education_track: string;
  hours_per_week: number;
  topics: CurriculumTopicIndex[];
}

export const CURRICULUM_INDEX: CurriculumGradeIndex[] = [
${grades}
];

/** Every topic across every programme, flattened with its grade. */
export function allIndexedTopics(): Array<{ grade: CurriculumGradeIndex; topic: CurriculumTopicIndex }> {
  return CURRICULUM_INDEX.flatMap(grade => grade.topics.map(topic => ({ grade, topic })));
}
`;

fs.writeFileSync(OUT, file, 'utf8');

const bytes = Buffer.byteLength(file, 'utf8');
console.log(`wrote ${OUT} — ${(bytes / 1024).toFixed(0)} KB`);
console.log(`programmes: ${ALL_MK_CURRICULUM.length} | outcome codes: ${outcomeTotal}`);
