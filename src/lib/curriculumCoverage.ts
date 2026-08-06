/**
 * Curriculum coverage analytics — shared by CurriculumAdmin.tsx and the
 * AnalyticsDashboard coverage panel.
 *
 * A single client-side snapshot of the `tasks` collection is fetched and
 * matched against ALL_MK_CURRICULUM topics:
 *   1. Primary match: task.curriculum_refs[].topic_id
 *   2. Fallback match: task.curriculum_topic string equals a topic name
 *      (only for tasks that have no curriculum_refs)
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { CurriculumRef, MathTask } from './schema';
import { ALL_MK_CURRICULUM } from './curriculumData';

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
  pct: number; // % of topics with >= 1 mapped task
}

export interface TrackCoverage {
  track: string;
  totalTopics: number;
  coveredTopics: number;
  pct: number;
  mappedTasks: number; // tasks whose best curriculum_ref points into this track
}

export interface CoverageSnapshot {
  totalTasks: number;
  mappedTasks: number;
  unmappedTasks: number;
  mappingPct: number;
  lowConfidenceCount: number; // mapped but best confidence < 0.5
  topicCounts: Map<string, number>; // topic_id -> task count (incl. fallback)
  gradeCoverage: GradeCoverage[];
  trackCoverage: TrackCoverage[];
  /** Tasks without any curriculum mapping. */
  unmappedList: CoverageTaskEntry[];
  /** Mapped tasks whose best confidence is < 0.5. */
  lowConfidenceList: (CoverageTaskEntry & { bestConfidence: number })[];
}

const normalize = (s: string) => s.trim().toLowerCase();

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
  // Index 2: normalized topic name -> tasks WITHOUT refs (fallback match)
  const nameIndex = new Map<string, Set<string>>();

  let mappedTasks = 0;
  const unmappedList: CoverageTaskEntry[] = [];
  const lowConfidenceList: (CoverageTaskEntry & { bestConfidence: number })[] = [];

  for (const task of tasks) {
    const refs = task.curriculum_refs ?? [];
    if (refs.length > 0) {
      mappedTasks++;
      const seen = new Set<string>();
      for (const ref of refs) {
        if (!ref?.topic_id || seen.has(ref.topic_id)) continue;
        seen.add(ref.topic_id);
        if (!refIndex.has(ref.topic_id)) refIndex.set(ref.topic_id, new Set());
        refIndex.get(ref.topic_id)!.add(task.id);
      }
      const bestConfidence = Math.max(...refs.map(r => r.confidence ?? 0));
      if (bestConfidence < 0.5) {
        lowConfidenceList.push({ ...task, bestConfidence });
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
  const gradeCoverage: GradeCoverage[] = [];
  const trackAgg = new Map<string, { totalTopics: number; coveredTopics: number; mappedTasks: number }>();

  for (const grade of ALL_MK_CURRICULUM) {
    let covered = 0;
    for (const topic of grade.topics) {
      const refSet = refIndex.get(topic.id);
      const fallbackSet = nameIndex.get(normalize(topic.name));
      const count = (refSet?.size ?? 0) + (fallbackSet?.size ?? 0);
      topicCounts.set(topic.id, count);
      if (count > 0) covered++;

      const agg = trackAgg.get(grade.education_track) ?? { totalTopics: 0, coveredTopics: 0, mappedTasks: 0 };
      agg.totalTopics++;
      if (count > 0) agg.coveredTopics++;
      trackAgg.set(grade.education_track, agg);
    }
    gradeCoverage.push({
      grade: grade.grade,
      level_label: grade.level_label,
      track: grade.education_track,
      totalTopics: grade.topics.length,
      coveredTopics: covered,
      pct: grade.topics.length > 0 ? Math.round((covered / grade.topics.length) * 100) : 0,
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
  }));

  const totalTasks = tasks.length;
  const unmappedTasks = totalTasks - mappedTasks;

  return {
    totalTasks,
    mappedTasks,
    unmappedTasks,
    mappingPct: totalTasks > 0 ? Math.round((mappedTasks / totalTasks) * 100) : 0,
    lowConfidenceCount: lowConfidenceList.length,
    topicCounts,
    gradeCoverage,
    trackCoverage,
    unmappedList,
    lowConfidenceList,
  };
}

/** All topics that have zero mapped tasks (coverage gaps). */
export function getZeroTaskTopics(snapshot: CoverageSnapshot) {
  const gaps: { topic_id: string; name: string; grade: string; level_label: string; track: string }[] = [];
  for (const grade of ALL_MK_CURRICULUM) {
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
