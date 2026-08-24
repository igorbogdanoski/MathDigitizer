/**
 * Cross-App Shared Task Format (v1.0)
 * ────────────────────────────────────────────────────────────────────────────
 * Canonical interchange format for sharing extracted math tasks between the
 * mismath.net app family:
 *
 *   - math.mismath.net  (MathDigitizer Pro)  — source of extracted tasks
 *   - ai.mismath.net    (math-curriculum-ai-navigator) — curriculum navigation
 *   - slides.mismath.net (mkd-slidea)        — presentations / live teaching
 *
 * Contract rules (see docs/SHARED_CURRICULUM_CONTRACT.md):
 *   - Curriculum outcome codes (БРО codes, e.g. "МА.6.2.3") travel WITH the
 *     content. They are NEVER guessed from text. MathDigitizer's MathTask does
 *     not carry per-task outcome codes yet, so derived `curriculum_refs`
 *     entries ship with `outcome_codes: []` until the `outcomes` field lands
 *     on MathTask (contract §4).
 *
 * The converters here are pure (no DOM, no Firebase) so they can run both in
 * the browser (Export panel) and on the Express server (/api/export/*).
 */

import { MathTask } from './schema';
// The light index, not the corpus: this module only ever *names* curriculum
// entries — it never renders outcome wording — and importing curriculumData
// pulled 571 KB of prose into every route that saves or shares a task.
import {
  CURRICULUM_INDEX,
  type CurriculumGradeIndex,
  type CurriculumTopicIndex,
} from './curriculumIndex';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SharedTaskCurriculumRef {
  education_track: string;
  grade: string;
  topic_id: string;
  topic_name: string;
  outcome_codes: string[];
}

export interface SharedTask {
  id: string;
  title: string;
  original_text: string; // LaTeX-enabled
  solution_steps: string[];
  latex_formulas: string[];
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'task' | 'theory';
  dok_level?: number;
  bloom_taxonomy?: string;
  grade_level?: string;
  curriculum_refs?: SharedTaskCurriculumRef[];
  geogebra_commands?: string[];
  hints?: string[];
  created_at: string;
  source: 'mathdigitizer';
  format_version: '1.0';
}

export type SharedTaskExportTarget = 'ai-navigator' | 'slides' | 'generic';

export interface SharedTaskExport {
  export_id: string;
  exported_at: string;
  app_target: SharedTaskExportTarget;
  tasks: SharedTask[];
  metadata: {
    total_tasks: number;
    grades: string[];
    topics: string[];
  };
}

// ─── Internals ───────────────────────────────────────────────────────────────

const ROMAN_GRADES: Record<string, string> = {
  i: '1', ii: '2', iii: '3', iv: '4', v: '5',
  vi: '6', vii: '7', viii: '8', ix: '9',
};

/**
 * Best-effort normalization of MathTask.grade_level (free text coming from AI
 * extraction — "6", "6то одд.", "VI одделение", "1год"…) onto the canonical
 * CurriculumGradeIndex entries of the БРО curriculum. Returns undefined when no
 * confident match exists — consumers must treat curriculum data as optional.
 */
function resolveCurriculumGrades(gradeLevel?: string): CurriculumGradeIndex[] {
  if (!gradeLevel) return [];
  const raw = gradeLevel.trim();
  if (!raw) return [];

  // 1) Exact key or label match ("6", "VI одделение", "1год", …)
  const exact = CURRICULUM_INDEX.filter(
    (g) => g.grade === raw || g.level_label === raw
  );
  if (exact.length > 0) return exact;

  const lower = raw.toLowerCase();

  // 2) Roman-numeral grades ("VI одделение", "vii одд.")
  const romanMatch = lower.match(/^\s*([ivx]+)\s/);
  if (romanMatch && ROMAN_GRADES[romanMatch[1]]) {
    const digit = ROMAN_GRADES[romanMatch[1]];
    return CURRICULUM_INDEX.filter(
      (g) => g.grade === digit && g.education_track === 'primary'
    );
  }

  // 3) Leading digit ("6то одделение", "6 одд.", "2 година …")
  const digitMatch = raw.match(/^\s*(\d+)/);
  if (digitMatch) {
    const digit = digitMatch[1];
    if (/год/i.test(raw)) {
      // "1 година" without further qualifier maps to the general gymnasium
      // track ("1год"); МИГ/стручно variants need the exact key.
      return CURRICULUM_INDEX.filter((g) => g.grade === `${digit}год`);
    }
    return CURRICULUM_INDEX.filter(
      (g) => g.grade === digit && g.education_track === 'primary'
    );
  }

  return [];
}

/**
 * Matches MathTask.curriculum_topic (free text) to an official curriculum
 * topic inside the resolved grade entries. Only exact id / name / name_short
 * equality or an exact keyword hit is accepted — fuzzy text matching is
 * deliberately avoided (contract §3: never guess from text).
 */
function resolveCurriculumTopic(
  grades: CurriculumGradeIndex[],
  curriculumTopic?: string
): { grade: CurriculumGradeIndex; topic: CurriculumTopicIndex } | undefined {
  if (!curriculumTopic) return undefined;
  const wanted = curriculumTopic.trim().toLowerCase();
  if (!wanted) return undefined;

  for (const grade of grades) {
    for (const topic of grade.topics) {
      const exactMatch =
        topic.id.toLowerCase() === wanted ||
        topic.name.toLowerCase() === wanted ||
        topic.name_short.toLowerCase() === wanted;
      const keywordMatch = topic.keywords.some(
        (k) => k.toLowerCase() === wanted
      );
      if (exactMatch || keywordMatch) {
        return { grade, topic };
      }
    }
  }
  return undefined;
}

/** Deterministic fallback id for tasks that were never persisted. */
function fallbackId(task: MathTask): string {
  const seed = `${task.title}|${task.original_text}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0; // djb2
  }
  return `local-${hash.toString(36)}`;
}

function generateId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

// ─── Converters ──────────────────────────────────────────────────────────────

/**
 * Convert an internal MathTask into the cross-app SharedTask shape.
 */
export function toSharedTask(task: MathTask): SharedTask {
  const grades = resolveCurriculumGrades(task.grade_level);
  const resolved = resolveCurriculumTopic(grades, task.curriculum_topic);

  const shared: SharedTask = {
    id: task.id || fallbackId(task),
    title: task.title,
    original_text: task.original_text,
    solution_steps: task.solution_steps || [],
    latex_formulas: task.latex_formulas || [],
    tags: task.tags || [],
    difficulty: task.difficulty || 'medium',
    type: task.type === 'theory' ? 'theory' : 'task',
    created_at: task.created_at || new Date().toISOString(),
    source: 'mathdigitizer',
    format_version: '1.0',
  };

  if (typeof task.dok_level === 'number') shared.dok_level = task.dok_level;
  if (task.bloom_taxonomy) shared.bloom_taxonomy = task.bloom_taxonomy;
  if (task.grade_level) shared.grade_level = task.grade_level;
  if (task.geogebra_commands && task.geogebra_commands.length > 0) {
    shared.geogebra_commands = task.geogebra_commands;
  }
  if (task.hints && task.hints.length > 0) shared.hints = task.hints;

  if (resolved) {
    shared.curriculum_refs = [
      {
        education_track: resolved.grade.education_track,
        grade: resolved.grade.grade,
        topic_id: resolved.topic.id,
        topic_name: resolved.topic.name,
        // Outcome codes are intentionally empty until MathTask carries an
        // `outcomes: string[]` field (SHARED_CURRICULUM_CONTRACT §3–§4).
        outcome_codes: [],
      },
    ];
  }

  return shared;
}

/**
 * Normalize a free-form target string to the SharedTaskExport app_target enum.
 */
export function normalizeExportTarget(target: string): SharedTaskExportTarget {
  const t = (target || '').toLowerCase();
  if (t === 'slides' || t === 'slidea' || t === 'mkd-slidea') return 'slides';
  if (
    t === 'ai-navigator' ||
    t === 'curriculum' ||
    t === 'navigator' ||
    t === 'ai'
  ) {
    return 'ai-navigator';
  }
  return 'generic';
}

/**
 * Bundle tasks into a full SharedTaskExport envelope.
 */
export function toSharedTaskExport(
  tasks: MathTask[],
  target: string
): SharedTaskExport {
  const sharedTasks = tasks.map(toSharedTask);

  const grades = Array.from(
    new Set(sharedTasks.map((t) => t.grade_level).filter((g): g is string => !!g))
  ).sort();
  const topics = Array.from(
    new Set(
      sharedTasks
        .flatMap((t) => t.curriculum_refs?.map((r) => r.topic_name) ?? [])
        .concat(tasks.map((t) => t.curriculum_topic).filter((c): c is string => !!c))
    )
  ).sort();

  return {
    export_id: generateId('exp'),
    exported_at: new Date().toISOString(),
    app_target: normalizeExportTarget(target),
    tasks: sharedTasks,
    metadata: {
      total_tasks: sharedTasks.length,
      grades,
      topics,
    },
  };
}

// ─── Text serializers (used by GET /api/export/tasks?format=… and the UI) ───

function escapeLatex(text: string): string {
  // Preserve inline math ($...$) by only escaping special chars outside of it.
  return text
    .split(/(\$[^$]*\$)/g)
    .map((segment, i) =>
      i % 2 === 1
        ? segment
        : segment.replace(/([&%_#])/g, '\\$1')
    )
    .join('');
}

/**
 * Render SharedTasks as a standalone LaTeX document.
 */
export function sharedTasksToLatex(tasks: SharedTask[]): string {
  let tex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}
\\title{Математички Материјали}
\\author{Генерирано од MathDigitizer Pro — Cross-App Export API}
\\begin{document}
\\maketitle

`;

  tasks.forEach((task, index) => {
    tex += `\\section*{${task.type === 'theory' ? 'Теорија' : 'Задача'} ${index + 1}: ${escapeLatex(task.title)}}\n`;
    tex += `\\textbf{Тежина:} ${task.difficulty} \\quad `;
    if (task.grade_level) tex += `\\textbf{Одделение:} ${escapeLatex(task.grade_level)}`;
    tex += `\n\n`;

    tex += `${task.original_text.replace(/\n\n/g, '\\par\n\n')}\n\n`;

    if (task.solution_steps.length > 0) {
      tex += `\\subsection*{${task.type === 'theory' ? 'Клучни точки' : 'Решение'}}\n`;
      tex += `\\begin{enumerate}\n`;
      task.solution_steps.forEach((step) => {
        tex += `  \\item ${step.replace(/\n/g, ' ')}\n`;
      });
      tex += `\\end{enumerate}\n\n`;
    }

    if (task.latex_formulas.length > 0) {
      tex += `\\subsection*{Формули}\n\\begin{itemize}\n`;
      task.latex_formulas.forEach((f) => {
        tex += `  \\item $${f}$\n`;
      });
      tex += `\\end{itemize}\n\n`;
    }
  });

  tex += `\\end{document}`;
  return tex;
}

/**
 * Render SharedTasks as Markdown (remark-math compatible $...$ / $$...$$).
 */
export function sharedTasksToMarkdown(tasks: SharedTask[]): string {
  let md = `# Извлечени Едукативни Материјали\n\n`;
  md += `> Експортирано од MathDigitizer Pro (format_version 1.0)\n\n`;

  tasks.forEach((task, index) => {
    md += `## ${task.type === 'theory' ? 'Теорија' : 'Задача'} ${index + 1}: ${task.title}\n\n`;

    md += `**Мета-податоци:**\n`;
    if (task.grade_level) md += `- **Одделение:** ${task.grade_level}\n`;
    const topicNames = task.curriculum_refs?.map((r) => r.topic_name) ?? [];
    if (topicNames.length > 0) md += `- **Тема:** ${topicNames.join(', ')}\n`;
    if (task.dok_level) md += `- **DoK Ниво:** ${task.dok_level}\n`;
    if (task.bloom_taxonomy) md += `- **Bloom:** ${task.bloom_taxonomy}\n`;
    md += `- **Тежина:** ${task.difficulty}\n`;
    if (task.tags.length > 0) md += `- **Тагови:** ${task.tags.join(', ')}\n`;
    md += `\n`;

    md += `**${task.type === 'theory' ? 'Теоретско објаснување' : 'Оригинален текст'}:**\n${task.original_text}\n\n`;

    if (task.solution_steps.length > 0) {
      md += `### ${task.type === 'theory' ? 'Клучни точки' : 'Чекори за решавање'}:\n`;
      task.solution_steps.forEach((step, i) => {
        md += `${i + 1}. ${step}\n`;
      });
      md += `\n`;
    }

    if (task.latex_formulas.length > 0) {
      md += `### Издвоени Формули:\n`;
      task.latex_formulas.forEach((f) => {
        md += `- $$${f}$$\n`;
      });
      md += `\n`;
    }

    if (task.hints && task.hints.length > 0) {
      md += `### Помош (hints):\n`;
      task.hints.forEach((h) => {
        md += `- ${h}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
  });

  return md;
}
