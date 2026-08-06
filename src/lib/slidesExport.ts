/**
 * Slides export — converts MathTasks into a slide-deck structure consumed by
 * slides.mismath.net (mkd-slidea).
 *
 * Mapping rules:
 *   - 1 'title' slide per deck
 *   - 1 'question' slide per task (original_text + formulas + geogebra)
 *   - each solution_step becomes its own 'step' slide
 *   - the last solution step is also emitted as the 'answer' slide
 *   - 1 'summary' slide when the deck contains more than one task
 *   - teacher notes / hints travel in the question slide's `notes`
 */

import { MathTask } from './schema';

export interface Slide {
  id: number;
  type: 'title' | 'question' | 'step' | 'answer' | 'summary';
  content: string; // LaTeX-enabled
  latex?: string[];
  geogebra_commands?: string[];
  notes?: string; // teacher notes
}

export interface SlideDeck {
  title: string;
  slides: Slide[];
  metadata: { task_count: number; grade?: string; topic?: string };
}

function buildQuestionNotes(task: MathTask): string | undefined {
  const parts: string[] = [];
  if (task.teacher_notes) parts.push(task.teacher_notes);
  if (task.hints && task.hints.length > 0) {
    parts.push(task.hints.map((h, i) => `${i + 1}. ${h}`).join('\n'));
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/**
 * Convert a single task into a full slide deck (title + question + steps +
 * answer).
 */
export function taskToSlides(task: MathTask): SlideDeck {
  const slides: Slide[] = [];
  let nextId = 1;

  slides.push({
    id: nextId++,
    type: 'title',
    content: task.title,
    notes: task.grade_level
      ? `${task.type === 'theory' ? 'Теорија' : 'Задача'} — ${task.grade_level}`
      : undefined,
  });

  slides.push({
    id: nextId++,
    type: 'question',
    content: task.original_text,
    latex: task.latex_formulas?.length ? [...task.latex_formulas] : undefined,
    geogebra_commands: task.geogebra_commands?.length
      ? [...task.geogebra_commands]
      : undefined,
    notes: buildQuestionNotes(task),
  });

  const steps = task.solution_steps || [];
  steps.forEach((step, index) => {
    const isLast = index === steps.length - 1;
    slides.push({
      id: nextId++,
      type: isLast ? 'answer' : 'step',
      content: isLast ? step : `${index + 1}. ${step}`,
    });
  });

  return {
    title: task.title,
    slides,
    metadata: {
      task_count: 1,
      grade: task.grade_level,
      topic: task.curriculum_topic,
    },
  };
}

/**
 * Merge multiple tasks into one deck: one title slide, question/step/answer
 * slide groups per task, and a summary slide at the end.
 */
export function tasksToSlideDeck(tasks: MathTask[]): SlideDeck {
  if (tasks.length === 0) {
    return {
      title: 'Празен сет на слајдови',
      slides: [],
      metadata: { task_count: 0 },
    };
  }

  if (tasks.length === 1) {
    return taskToSlides(tasks[0]);
  }

  const slides: Slide[] = [];
  let nextId = 1;

  slides.push({
    id: nextId++,
    type: 'title',
    content: `Математички задачи (${tasks.length})`,
    notes: 'Збирен сет задачи експортиран од MathDigitizer Pro',
  });

  tasks.forEach((task, taskIndex) => {
    slides.push({
      id: nextId++,
      type: 'question',
      content: `${taskIndex + 1}. ${task.title}\n\n${task.original_text}`,
      latex: task.latex_formulas?.length ? [...task.latex_formulas] : undefined,
      geogebra_commands: task.geogebra_commands?.length
        ? [...task.geogebra_commands]
        : undefined,
      notes: buildQuestionNotes(task),
    });

    const steps = task.solution_steps || [];
    steps.forEach((step, stepIndex) => {
      const isLast = stepIndex === steps.length - 1;
      slides.push({
        id: nextId++,
        type: isLast ? 'answer' : 'step',
        content: isLast ? step : `${stepIndex + 1}. ${step}`,
      });
    });
  });

  slides.push({
    id: nextId++,
    type: 'summary',
    content: tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n'),
  });

  const grades = Array.from(
    new Set(tasks.map((t) => t.grade_level).filter((g): g is string => !!g))
  );
  const topics = Array.from(
    new Set(tasks.map((t) => t.curriculum_topic).filter((c): c is string => !!c))
  );

  return {
    title: `Математички задачи (${tasks.length})`,
    slides,
    metadata: {
      task_count: tasks.length,
      grade: grades.length === 1 ? grades[0] : undefined,
      topic: topics.length === 1 ? topics[0] : undefined,
    },
  };
}
