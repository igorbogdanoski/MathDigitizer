/**
 * Curriculum-organized export for ai.mismath.net (math-curriculum-ai-navigator).
 *
 * Groups tasks by their curriculum_refs.topic_id so the navigator can attach
 * extracted tasks directly to official curriculum topics. Tasks without any
 * resolvable curriculum reference are collected under the stable
 * "uncategorized" bucket — consumers decide what to do with them.
 */

import { MathTask } from './schema';
import { SharedTask, toSharedTask } from './sharedTaskFormat';

export const UNCATEGORIZED_TOPIC_ID = 'uncategorized';

export interface CurriculumTaskGroup {
  topic_id: string;
  topic_name: string;
  grade: string;
  tasks: SharedTask[];
}

/**
 * Group tasks by curriculum topic.
 *
 * A task with multiple curriculum_refs entries appears once per referenced
 * topic. Returns a record keyed by topic_id for direct lookup.
 */
export function tasksByCurriculum(
  tasks: MathTask[]
): Record<string, CurriculumTaskGroup> {
  const groups: Record<string, CurriculumTaskGroup> = {};

  const pushToGroup = (key: string, group: CurriculumTaskGroup, task: SharedTask) => {
    if (!groups[key]) {
      groups[key] = group;
    }
    groups[key].tasks.push(task);
  };

  for (const task of tasks) {
    const shared = toSharedTask(task);
    const refs = shared.curriculum_refs;

    if (!refs || refs.length === 0) {
      pushToGroup(
        UNCATEGORIZED_TOPIC_ID,
        {
          topic_id: UNCATEGORIZED_TOPIC_ID,
          topic_name: 'Некатегоризирани',
          grade: shared.grade_level || '',
          tasks: [],
        },
        shared
      );
      continue;
    }

    for (const ref of refs) {
      pushToGroup(
        ref.topic_id,
        {
          topic_id: ref.topic_id,
          topic_name: ref.topic_name,
          grade: ref.grade,
          tasks: [],
        },
        shared
      );
    }
  }

  return groups;
}
