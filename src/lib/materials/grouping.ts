/**
 * Grouping tasks by the official curriculum rather than by free text
 * (EXPERT_LEVEL_MASTER_PLAN, 6.3).
 *
 * The factory grouped on `curriculum_topic`, a free-text string the model
 * writes — so "Линеарни равенки", "линеарни равенки" and "Равенки (линеарни)"
 * became three separate groups. Structured `curriculum_refs` carry a stable
 * `topic_id` and БРО outcome codes, so grouping on those keeps one topic in one
 * place. Tasks that have not been classified yet still fall back to their text
 * topic instead of disappearing.
 */
import { CurriculumRef, MathTask } from '../schema';

export interface TaskGroup {
  /** Stable key: a curriculum topic_id, or `topic:<text>` for unclassified tasks. */
  key: string;
  label: string;
  /** БРО outcome codes covered by this group, deduped and sorted. */
  outcomeCodes: string[];
  /** True when the group came from structured refs rather than free text. */
  classified: boolean;
  tasks: MathTask[];
}

export const UNCLASSIFIED_LABEL = 'Некатегоризирано';

/** The ref a task should be grouped under: the most confident one. */
export function primaryRef(task: MathTask): CurriculumRef | null {
  const refs = task.curriculum_refs;
  if (!Array.isArray(refs) || refs.length === 0) return null;

  return refs.reduce((best, ref) =>
    (ref?.confidence ?? 0) > (best?.confidence ?? 0) ? ref : best
  , refs[0]) ?? null;
}

/**
 * Groups tasks by curriculum topic. Classified groups come first, each ordered
 * by grade then name, with unclassified text topics after them — so a teacher
 * building a worksheet sees the curriculum-aligned material at the top.
 */
export function groupTasksByCurriculum(tasks: readonly MathTask[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();

  for (const task of tasks) {
    const ref = primaryRef(task);

    const key = ref?.topic_id
      ? ref.topic_id
      : `topic:${(task.curriculum_topic || UNCLASSIFIED_LABEL).trim().toLowerCase()}`;

    const label = ref?.topic_name?.trim()
      || task.curriculum_topic?.trim()
      || UNCLASSIFIED_LABEL;

    let group = groups.get(key);
    if (!group) {
      group = { key, label, outcomeCodes: [], classified: Boolean(ref?.topic_id), tasks: [] };
      groups.set(key, group);
    }

    group.tasks.push(task);
    for (const code of ref?.outcome_codes ?? []) {
      if (code && !group.outcomeCodes.includes(code)) group.outcomeCodes.push(code);
    }
  }

  for (const group of groups.values()) {
    group.outcomeCodes.sort();
  }

  return [...groups.values()].sort((a, b) => {
    if (a.classified !== b.classified) return a.classified ? -1 : 1;
    return a.label.localeCompare(b.label, 'mk');
  });
}

/** Every distinct БРО outcome code across the given tasks. */
export function coveredOutcomeCodes(tasks: readonly MathTask[]): string[] {
  const codes = new Set<string>();
  for (const task of tasks) {
    for (const ref of task.curriculum_refs ?? []) {
      for (const code of ref?.outcome_codes ?? []) {
        if (code) codes.add(code);
      }
    }
  }
  return [...codes].sort();
}
