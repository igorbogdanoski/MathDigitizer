/**
 * Slidea Interchange Format Converter
 * ────────────────────────────────────────────────────────────────────────────
 * Converts MathDigitizer tasks into the Slidea Interchange Format used by
 * slides.mismath.net (MKD Slidea) for importing educational content.
 *
 * Format spec (per SHARED_CURRICULUM_CONTRACT.md §6):
 * {
 *   "slidea_import": 1,
 *   "title": "Проценти — вежби",
 *   "curriculum": { "outcomes": ["МА.6.2.3"] },
 *   "activities": [
 *     { "type": "quiz", "question": "…", "options": [...] }
 *   ]
 * }
 *
 * Rules:
 * - outcomes travel WITH content, never guessed from text
 * - Empty outcomes = "we don't know", not a bug
 * - Partial imports are by design (12 good + 1 broken = 12 imported + 1 reported)
 */

import { MathTask } from './schema';
import { SharedTask, toSharedTask } from './sharedTaskFormat';

// ─── Slidea Interchange Types ────────────────────────────────────────────────

export type SlideaActivityType = 'quiz' | 'question' | 'content' | 'steps' | 'geogebra';

export interface SlideaQuizOption {
  text: string;
  correct: boolean;
}

export interface SlideaActivity {
  type: SlideaActivityType;
  /** Quiz/question text (LaTeX-enabled) */
  question?: string;
  /** Multiple choice options (for quiz type) */
  options?: SlideaQuizOption[];
  /** Content body (for content type) */
  content?: string;
  /** Solution steps (for steps type) */
  steps?: string[];
  /** GeoGebra commands (for geogebra type) */
  geogebra_commands?: string[];
  /** Activity-level outcomes (override document-level) */
  outcomes?: string[];
  /** Hints for the activity */
  hints?: string[];
  /** Teacher notes */
  notes?: string;
}

export interface SlideaInterchangeDocument {
  /** Format version marker — always 1 */
  slidea_import: 1;
  /** Document title */
  title: string;
  /** Optional description */
  description?: string;
  /** Document-level curriculum block */
  curriculum?: {
    outcomes: string[];
    grade?: string;
    topic?: string;
  };
  /** Activities (questions, quizzes, content) */
  activities: SlideaActivity[];
  /** Metadata */
  metadata?: {
    source: 'mathdigitizer';
    source_task_id?: string;
    difficulty?: string;
    dok_level?: number;
    created_at?: string;
    exported_at: string;
  };
}

// ─── Converters ──────────────────────────────────────────────────────────────

/**
 * Convert a single MathTask into a Slidea Interchange Document.
 * Each task becomes a document with activities derived from its structure.
 */
export function taskToSlideaDocument(task: MathTask): SlideaInterchangeDocument {
  const shared = toSharedTask(task);
  return sharedTaskToSlideaDocument(shared);
}

/**
 * Convert a SharedTask into a Slidea Interchange Document.
 */
export function sharedTaskToSlideaDocument(task: SharedTask): SlideaInterchangeDocument {
  const outcomes = task.curriculum_refs?.flatMap(r => r.outcome_codes) ?? [];
  const grade = task.curriculum_refs?.[0]?.grade ?? task.grade_level;
  const topic = task.curriculum_refs?.[0]?.topic_name;

  const activities: SlideaActivity[] = [];

  // 1. Main question/task as content
  activities.push({
    type: task.type === 'theory' ? 'content' : 'question',
    question: task.type === 'task' ? task.original_text : undefined,
    content: task.type === 'theory' ? task.original_text : undefined,
    outcomes: outcomes.length > 0 ? outcomes : undefined,
    hints: task.hints?.length ? task.hints : undefined,
  });

  // 2. Solution steps (if present)
  if (task.solution_steps.length > 0) {
    activities.push({
      type: 'steps',
      steps: task.solution_steps,
      notes: task.type === 'task' ? 'Чекор-по-чекор решение' : 'Клучни точки',
    });
  }

  // 3. GeoGebra visualization (if commands present)
  if (task.geogebra_commands?.length) {
    activities.push({
      type: 'geogebra',
      geogebra_commands: task.geogebra_commands,
      notes: 'Интерактивна визуелизација',
    });
  }

  // 4. LaTeX formulas as content (if separate from main text)
  if (task.latex_formulas.length > 0 && task.latex_formulas.length !== task.solution_steps.length) {
    activities.push({
      type: 'content',
      content: task.latex_formulas.map(f => `$$${f}$$`).join('\n\n'),
      notes: 'Издвоени формули',
    });
  }

  return {
    slidea_import: 1,
    title: task.title,
    description: task.type === 'theory' ? 'Теоретски материјал' : 'Математичка задача',
    curriculum: outcomes.length > 0 || grade || topic ? {
      outcomes,
      grade: grade || undefined,
      topic: topic || undefined,
    } : undefined,
    activities,
    metadata: {
      source: 'mathdigitizer',
      source_task_id: task.id,
      difficulty: task.difficulty,
      dok_level: task.dok_level,
      created_at: task.created_at,
      exported_at: new Date().toISOString(),
    },
  };
}

/**
 * Convert multiple tasks into a single Slidea Interchange Document.
 * Useful for creating a lesson/worksheet from multiple tasks.
 */
export function tasksToSlideaDocument(
  tasks: MathTask[],
  title?: string
): SlideaInterchangeDocument {
  const sharedTasks = tasks.map(toSharedTask);

  // Collect all outcomes (deduplicated)
  const allOutcomes = Array.from(new Set(
    sharedTasks.flatMap(t => t.curriculum_refs?.flatMap(r => r.outcome_codes) ?? [])
  ));

  // Collect grades and topics
  const grades = Array.from(new Set(
    sharedTasks.map(t => t.curriculum_refs?.[0]?.grade ?? t.grade_level).filter(Boolean)
  )) as string[];
  const topics = Array.from(new Set(
    sharedTasks.map(t => t.curriculum_refs?.[0]?.topic_name).filter(Boolean)
  )) as string[];

  const activities: SlideaActivity[] = [];

  for (const task of sharedTasks) {
    const outcomes = task.curriculum_refs?.flatMap(r => r.outcome_codes) ?? [];

    // Add task as question/content
    activities.push({
      type: task.type === 'theory' ? 'content' : 'question',
      question: task.type === 'task' ? task.original_text : undefined,
      content: task.type === 'theory' ? task.original_text : undefined,
      outcomes: outcomes.length > 0 ? outcomes : undefined,
      hints: task.hints?.length ? task.hints : undefined,
      notes: task.title, // Use title as note for multi-task docs
    });

    // Add solution steps
    if (task.solution_steps.length > 0) {
      activities.push({
        type: 'steps',
        steps: task.solution_steps,
        notes: `Решение: ${task.title}`,
      });
    }

    // Add GeoGebra if present
    if (task.geogebra_commands?.length) {
      activities.push({
        type: 'geogebra',
        geogebra_commands: task.geogebra_commands,
      });
    }
  }

  return {
    slidea_import: 1,
    title: title || `Математички материјали (${tasks.length} задачи)`,
    description: `Експортирано од MathDigitizer Pro`,
    curriculum: allOutcomes.length > 0 || grades.length > 0 ? {
      outcomes: allOutcomes,
      grade: grades.length === 1 ? grades[0] : undefined,
      topic: topics.length === 1 ? topics[0] : undefined,
    } : undefined,
    activities,
    metadata: {
      source: 'mathdigitizer',
      difficulty: tasks.length === 1 ? tasks[0].difficulty : undefined,
      exported_at: new Date().toISOString(),
    },
  };
}

/**
 * Generate a quiz activity from a task (for interactive quizzes in Slidea).
 * Creates multiple-choice options from solution steps.
 */
export function taskToQuizActivity(task: MathTask): SlideaActivity {
  const shared = toSharedTask(task);
  const options: SlideaQuizOption[] = [];

  // Correct answer is the last solution step or a generated one
  const correctAnswer = task.solution_steps.length > 0
    ? task.solution_steps[task.solution_steps.length - 1]
    : 'Точниот одговор е даден во решението';

  options.push({ text: correctAnswer, correct: true });

  // Generate distractors from other steps or generic wrong answers
  const distractors = [
    task.solution_steps.length > 1 ? task.solution_steps[0] : 'Погрешен чекор 1',
    'Погрешен чекор 2 — провери ги операциите',
    'Погрешен чекор 3 — провери ги знаците',
  ];

  for (const d of distractors.slice(0, 3)) {
    options.push({ text: d, correct: false });
  }

  // Shuffle options
  const shuffled = options.sort(() => Math.random() - 0.5);

  return {
    type: 'quiz',
    question: task.original_text,
    options: shuffled,
    outcomes: shared.curriculum_refs?.flatMap(r => r.outcome_codes),
    hints: task.hints,
  };
}

// ─── Serialization ───────────────────────────────────────────────────────────

/**
 * Serialize a Slidea document to JSON string (for download/API).
 */
export function serializeSlideaDocument(doc: SlideaInterchangeDocument): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Validate a Slidea document structure.
 * Returns array of validation errors (empty = valid).
 */
export function validateSlideaDocument(doc: unknown): string[] {
  const errors: string[] = [];

  if (!doc || typeof doc !== 'object') {
    return ['Document must be an object'];
  }

  const d = doc as Record<string, unknown>;

  if (d.slidea_import !== 1) {
    errors.push('slidea_import must be 1');
  }

  if (!d.title || typeof d.title !== 'string') {
    errors.push('title is required and must be a string');
  }

  if (!Array.isArray(d.activities)) {
    errors.push('activities must be an array');
  } else {
    (d.activities as unknown[]).forEach((activity, i) => {
      const a = activity as Record<string, unknown>;
      if (!a.type || !['quiz', 'question', 'content', 'steps', 'geogebra'].includes(a.type as string)) {
        errors.push(`activities[${i}].type must be quiz|question|content|steps|geogebra`);
      }
      if (a.type === 'quiz' && !Array.isArray(a.options)) {
        errors.push(`activities[${i}] is quiz but has no options array`);
      }
      if (a.type === 'steps' && !Array.isArray(a.steps)) {
        errors.push(`activities[${i}] is steps but has no steps array`);
      }
    });
  }

  // Validate outcomes format (БРО codes)
  if (d.curriculum && typeof d.curriculum === 'object') {
    const curr = d.curriculum as Record<string, unknown>;
    if (Array.isArray(curr.outcomes)) {
      (curr.outcomes as unknown[]).forEach((code, i) => {
        if (typeof code !== 'string' || !/^МА\.\d+/.test(code)) {
          errors.push(`curriculum.outcomes[${i}] must be a valid БРО code (МА.X.Y.Z format)`);
        }
      });
    }
  }

  return errors;
}

/**
 * Create a download-ready Blob URL for a Slidea document.
 */
export function createSlideaDownloadUrl(doc: SlideaInterchangeDocument): string {
  const json = serializeSlideaDocument(doc);
  const blob = new Blob([json], { type: 'application/json' });
  return URL.createObjectURL(blob);
}

/**
 * Generate filename for a Slidea export.
 */
export function getSlideaFilename(title: string): string {
  const sanitized = title
    .replace(/[^\w\s\u0400-\u04FF-]/g, '') // Keep Cyrillic, word chars, spaces, hyphens
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const date = new Date().toISOString().split('T')[0];
  return `slidea-${sanitized}-${date}.json`;
}
