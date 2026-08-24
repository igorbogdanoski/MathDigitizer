/**
 * Curriculum coverage analytics — shared by CurriculumAdmin.tsx and the
 * AnalyticsDashboard coverage panel.
 *
 * A single client-side snapshot of the `tasks` collection is fetched and
 * matched against CURRICULUM_INDEX topics:
 *   1. Primary match: task.curriculum_refs[].topic_id
 *   2. Fallback match: task.curriculum_topic string equals a topic name
 *      (only for tasks that have no curriculum_refs)
 *
 * Coverage is reported twice: what a teacher has confirmed, and what the AI has
 * merely suggested (EXPERT_LEVEL_MASTER_PLAN, 9.5). Until now the two were
 * summed, so a grade could read "85% покриеност" on the strength of suggestions
 * nobody had looked at — the shared contract's §3 failure exactly, at the level
 * of a whole programme rather than one code. A head teacher reads that number
 * as a statement about their school.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { CurriculumRef, MathTask } from './schema';
// Coverage counts topics; it never reads their wording. The light index keeps
// the 571 KB corpus out of the analytics bundle.
import { CURRICULUM_INDEX } from './curriculumIndex';

export interface CoverageTaskEntry {
  id: string;
  title: string;
  original_text?: string; // kept for AI classification from the review queue
  tags?: string[];
  curriculum_topic?: string;
  curriculum_refs?: CurriculumRef[];
  difficulty?: string;
  grade_level?: string;
}

export interface GradeCoverage {
  grade: string;
  level_label: string;
  track: string;
  totalTopics: number;
  coveredTopics: number;
  pct: number; // % of topics with >= 1 mapped task, confirmed or suggested
  /** Topics with at least one teacher-confirmed task. */
  confirmedTopics: number;
  /** % of topics a teacher has actually confirmed — the defensible number. */
  confirmedPct: number;
}

export interface TrackCoverage {
  track: string;
  totalTopics: number;
  coveredTopics: number;
  pct: number;
  mappedTasks: number; // tasks whose best curriculum_ref points into this track
  confirmedTopics: number;
  confirmedPct: number;
}

export interface CoverageSnapshot {
  totalTasks: number;
  mappedTasks: number;
  unmappedTasks: number;
  mappingPct: number;
  lowConfidenceCount: number; // mapped but best confidence < 0.5
  /** Tasks whose mapping a teacher has confirmed. */
  confirmedTasks: number;
  /** Tasks mapped only by the AI, never reviewed. */
  suggestedTasks: number;
  topicCounts: Map<string, number>; // topic_id -> task count (incl. fallback)
  /** topic_id -> count of teacher-confirmed tasks only. */
  confirmedTopicCounts: Map<string, number>;
  gradeCoverage: GradeCoverage[];
  trackCoverage: TrackCoverage[];
  /** Tasks without any curriculum mapping. */
  unmappedList: CoverageTaskEntry[];
  /** Mapped tasks whose best confidence is < 0.5. */
  lowConfidenceList: (CoverageTaskEntry & { bestConfidence: number })[];
  /**
   * Tasks the AI mapped confidently and nobody has confirmed.
   *
   * These never reached the review queue before — only unmapped and
   * low-confidence tasks did — so a confident wrong guess counted toward
   * coverage and was never shown to anyone.
   */
  suggestedList: CoverageTaskEntry[];
}

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Whether a mapping carries a teacher's confirmation.
 *
 * A ref with no `source` predates the field. It is counted as suggested, not
 * confirmed: we do not know who put it there, and the direction that
 * under-claims is the only safe one when the number is read as "this programme
 * is covered".
 */
export const isConfirmedRef = (ref: CurriculumRef | undefined): boolean =>
  ref?.source === 'manual';

/** Fetch the minimal task fields needed for coverage analysis. */
export async function fetchCoverageTasks(): Promise<CoverageTaskEntry[]> {
  const snap = await getDocs(collection(db, 'tasks'));
  return snap.docs.map(d => {
    const data = d.data() as Partial<MathTask>;
    return {
      id: d.id,
      title: data.title || data.original_text?.slice(0, 60) || d.id,
      original_text: data.original_text,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
      curriculum_topic: data.curriculum_topic,
      curriculum_refs: Array.isArray(data.curriculum_refs) ? data.curriculum_refs : undefined,
      difficulty: data.difficulty,
      grade_level: data.grade_level,
    };
  });
}

/** Build the full coverage snapshot from a previously fetched task list. */
export function buildCoverageSnapshot(tasks: CoverageTaskEntry[]): CoverageSnapshot {
  // Index 1: topic_id -> tasks with an explicit curriculum_ref
  const refIndex = new Map<string, Set<string>>();
  // Index 1b: the same, restricted to mappings a teacher confirmed
  const confirmedIndex = new Map<string, Set<string>>();
  // Index 2: normalized topic name -> tasks WITHOUT refs (fallback match)
  const nameIndex = new Map<string, Set<string>>();

  let mappedTasks = 0;
  let confirmedTasks = 0;
  const unmappedList: CoverageTaskEntry[] = [];
  const lowConfidenceList: (CoverageTaskEntry & { bestConfidence: number })[] = [];
  const suggestedList: CoverageTaskEntry[] = [];

  for (const task of tasks) {
    const refs = task.curriculum_refs ?? [];
    if (refs.length > 0) {
      mappedTasks++;
      const hasConfirmation = refs.some(isConfirmedRef);
      if (hasConfirmation) confirmedTasks++;

      const seen = new Set<string>();
      for (const ref of refs) {
        if (!ref?.topic_id || seen.has(ref.topic_id)) continue;
        seen.add(ref.topic_id);
        if (!refIndex.has(ref.topic_id)) refIndex.set(ref.topic_id, new Set());
        refIndex.get(ref.topic_id)!.add(task.id);

        if (isConfirmedRef(ref)) {
          if (!confirmedIndex.has(ref.topic_id)) confirmedIndex.set(ref.topic_id, new Set());
          confirmedIndex.get(ref.topic_id)!.add(task.id);
        }
      }

      const bestConfidence = Math.max(...refs.map(r => r.confidence ?? 0));
      if (bestConfidence < 0.5) {
        lowConfidenceList.push({ ...task, bestConfidence });
      } else if (!hasConfirmation) {
        // Confident, unreviewed, and counted toward coverage until someone
        // looks at it. That is precisely the case worth surfacing.
        suggestedList.push(task);
      }
    } else {
      unmappedList.push(task);
      const name = task.curriculum_topic ? normalize(task.curriculum_topic) : '';
      if (name) {
        if (!nameIndex.has(name)) nameIndex.set(name, new Set());
        nameIndex.get(name)!.add(task.id);
      }
    }
  }

  // Per-topic counts + per-grade coverage
  const topicCounts = new Map<string, number>();
  const confirmedTopicCounts = new Map<string, number>();
  const gradeCoverage: GradeCoverage[] = [];
  const trackAgg = new Map<string, {
    totalTopics: number; coveredTopics: number; confirmedTopics: number; mappedTasks: number;
  }>();

  for (const grade of CURRICULUM_INDEX) {
    let covered = 0;
    let confirmed = 0;
    for (const topic of grade.topics) {
      const refSet = refIndex.get(topic.id);
      const fallbackSet = nameIndex.get(normalize(topic.name));
      const count = (refSet?.size ?? 0) + (fallbackSet?.size ?? 0);
      topicCounts.set(topic.id, count);
      if (count > 0) covered++;

      // The name fallback is a string match on free text, never a confirmation.
      const confirmedCount = confirmedIndex.get(topic.id)?.size ?? 0;
      confirmedTopicCounts.set(topic.id, confirmedCount);
      if (confirmedCount > 0) confirmed++;

      const agg = trackAgg.get(grade.education_track)
        ?? { totalTopics: 0, coveredTopics: 0, confirmedTopics: 0, mappedTasks: 0 };
      agg.totalTopics++;
      if (count > 0) agg.coveredTopics++;
      if (confirmedCount > 0) agg.confirmedTopics++;
      trackAgg.set(grade.education_track, agg);
    }
    gradeCoverage.push({
      grade: grade.grade,
      level_label: grade.level_label,
      track: grade.education_track,
      totalTopics: grade.topics.length,
      coveredTopics: covered,
      pct: grade.topics.length > 0 ? Math.round((covered / grade.topics.length) * 100) : 0,
      confirmedTopics: confirmed,
      confirmedPct: grade.topics.length > 0 ? Math.round((confirmed / grade.topics.length) * 100) : 0,
    });
  }

  // Tasks mapped per track (by best ref)
  for (const task of tasks) {
    const refs = task.curriculum_refs ?? [];
    if (refs.length === 0) continue;
    const best = [...refs].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (!best?.education_track) continue;
    const agg = trackAgg.get(best.education_track);
    if (agg) agg.mappedTasks++;
  }

  const trackCoverage: TrackCoverage[] = Array.from(trackAgg.entries()).map(([track, agg]) => ({
    track,
    totalTopics: agg.totalTopics,
    coveredTopics: agg.coveredTopics,
    pct: agg.totalTopics > 0 ? Math.round((agg.coveredTopics / agg.totalTopics) * 100) : 0,
    mappedTasks: agg.mappedTasks,
    confirmedTopics: agg.confirmedTopics,
    confirmedPct: agg.totalTopics > 0 ? Math.round((agg.confirmedTopics / agg.totalTopics) * 100) : 0,
  }));

  const totalTasks = tasks.length;
  const unmappedTasks = totalTasks - mappedTasks;

  return {
    totalTasks,
    mappedTasks,
    unmappedTasks,
    mappingPct: totalTasks > 0 ? Math.round((mappedTasks / totalTasks) * 100) : 0,
    lowConfidenceCount: lowConfidenceList.length,
    confirmedTasks,
    suggestedTasks: mappedTasks - confirmedTasks,
    topicCounts,
    confirmedTopicCounts,
    gradeCoverage,
    trackCoverage,
    unmappedList,
    lowConfidenceList,
    suggestedList,
  };
}

/** All topics that have zero mapped tasks (coverage gaps). */
export function getZeroTaskTopics(snapshot: CoverageSnapshot) {
  const gaps: { topic_id: string; name: string; grade: string; level_label: string; track: string }[] = [];
  for (const grade of CURRICULUM_INDEX) {
    for (const topic of grade.topics) {
      if ((snapshot.topicCounts.get(topic.id) ?? 0) === 0) {
        gaps.push({
          topic_id: topic.id,
          name: topic.name,
          grade: grade.grade,
          level_label: grade.level_label,
          track: grade.education_track,
        });
      }
    }
  }
  return gaps;
}
