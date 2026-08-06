// Generate operationalCurriculum.ts from parsed JSON files
import { readFileSync, writeFileSync } from 'fs';

const g7 = JSON.parse(readFileSync('scripts/curriculum-grade7.json', 'utf-8'));
const g9 = JSON.parse(readFileSync('scripts/curriculum-grade9.json', 'utf-8'));

function genUnit(u) {
  return `  { annualOrder: ${u.annualOrder}, week: ${u.week}, semester: '${u.semester}', id: '${u.id}', topic: '${u.topic.replace(/'/g, "\\'")}', unit: '${u.unit.replace(/'/g, "\\'")}' }`;
}

function genGrade(g) {
  const topics = g.topics.map(t =>
    `    { name: '${t.name.replace(/'/g, "\\'")}', hours: ${t.hours}, unitIds: [${t.unitIds.map(id => `'${id}'`).join(', ')}] }`
  ).join(',\n');
  const units = g.units.map(genUnit).join(',\n');
  return `  '${g.grade}': {\n    grade: '${g.grade}',\n    totalUnits: ${g.totalUnits},\n    topics: [\n${topics}\n    ],\n    units: [\n${units}\n    ]\n  }`;
}

const ts = `// Operational Curriculum — lesson-by-lesson teaching plans
// Source: БРО annual distribution documents (DOCX), parsed ${new Date().toISOString().split('T')[0]}
// Structure: grade → topics (with hours) → units (144 per grade, annualOrder 1-144)

export interface OperationalLesson {
  annualOrder: number;
  week: number;
  semester: 'I' | 'II';
  id: string; // e.g. G07-T01-L001
  topic: string;
  unit: string;
}

export interface OperationalTopic {
  name: string;
  hours: number;
  unitIds: string[];
}

export interface OperationalGrade {
  grade: string;
  totalUnits: number;
  topics: OperationalTopic[];
  units: OperationalLesson[];
}

export const OPERATIONAL_CURRICULUM: Record<string, OperationalGrade> = {
${genGrade(g7)},
${genGrade(g9)}
};

// Helper: find lesson by ID
export function getLessonById(id: string): OperationalLesson | undefined {
  for (const grade of Object.values(OPERATIONAL_CURRICULUM)) {
    const lesson = grade.units.find(u => u.id === id);
    if (lesson) return lesson;
  }
  return undefined;
}

// Helper: find lessons by topic name (fuzzy)
export function getLessonsByTopic(grade: string, topicQuery: string): OperationalLesson[] {
  const g = OPERATIONAL_CURRICULUM[grade];
  if (!g) return [];
  const q = topicQuery.toLowerCase();
  return g.units.filter(u => u.topic.toLowerCase().includes(q) || u.unit.toLowerCase().includes(q));
}

// Helper: get current lesson by week (for "what's being taught now")
export function getLessonsByWeek(grade: string, week: number, semester?: 'I' | 'II'): OperationalLesson[] {
  const g = OPERATIONAL_CURRICULUM[grade];
  if (!g) return [];
  return g.units.filter(u => u.week === week && (!semester || u.semester === semester));
}

// All available grades
export const OPERATIONAL_GRADES = Object.keys(OPERATIONAL_CURRICULUM);
`;

writeFileSync('src/lib/operationalCurriculum.ts', ts, 'utf-8');
console.log(`Generated src/lib/operationalCurriculum.ts`);
console.log(`Grade 7: ${g7.totalUnits} units, ${g7.topics.length} topics`);
console.log(`Grade 9: ${g9.totalUnits} units, ${g9.topics.length} topics`);
