/**
 * Classification domain — helpers for mapping library tasks to official БРО
 * curriculum topics (curriculum_refs).
 *
 * The AI classification pipeline (RAG candidates → constrained Gemini call →
 * validation) lives in ./curriculum.ts (classifyTaskCurriculum /
 * batchClassifyTasks). This module keeps the query builder and the manual
 * assignment path used by admin UIs.
 */
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MathTask, CurriculumRef } from '../schema';

/** Build the search query text for a task. */
export function buildTaskClassificationQuery(task: MathTask): string {
  const parts = [
    task.title,
    task.original_text?.slice(0, 400),
    task.curriculum_topic,
    ...(task.tags || []),
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * Manually assign a curriculum topic to a task (confidence 1, source 'manual').
 * Overwrites any previous curriculum_refs.
 */
export async function assignTaskCurriculumTopic(
  taskId: string,
  topic: { topic_id: string; topic_name: string; grade: string; education_track: string; outcome_codes?: string[] },
): Promise<void> {
  const ref: CurriculumRef = {
    education_track: topic.education_track,
    grade: topic.grade,
    topic_id: topic.topic_id,
    topic_name: topic.topic_name,
    outcome_codes: topic.outcome_codes || [],
    confidence: 1,
    source: 'manual',
  };
  await updateDoc(doc(db, 'tasks', taskId), {
    curriculum_refs: [ref],
    curriculum_topic: topic.topic_name,
  });
}
