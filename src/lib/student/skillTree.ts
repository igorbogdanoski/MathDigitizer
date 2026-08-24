/**
 * Skill-tree unlocking from real mastery data
 * (EXPERT_LEVEL_MASTER_PLAN, 5.2).
 *
 * The tree used to unlock on XP alone, with a comment admitting the
 * dependency check was skipped — so a student who ground XP on arithmetic saw
 * "Интеграли" unlocked. Here a node opens only when its prerequisites are
 * actually mastered, judged from the same `user_mastery` records the adaptive
 * test writes.
 */

export interface MasteryRecord {
  topic: string;
  /** SM-2 interval in days; a long interval means the topic keeps being recalled. */
  interval?: number;
  ease_factor?: number;
  /** Last graded quality, 0–5. */
  last_quality?: number;
  next_review?: string;
}

export interface SkillNodeSpec {
  id: string;
  requiredXP: number;
  dependsOn: string[];
  /** Curriculum topic fragments that count as evidence for this node. */
  topicKeywords: string[];
}

/** A topic recalled at this interval (days) counts as mastered. */
export const MASTERY_INTERVAL_DAYS = 6;
/** …or a topic last answered at this quality (SM-2 scale). */
export const MASTERY_QUALITY = 4;

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

/** Mastery records whose topic mentions any of the node's keywords. */
export function matchMastery(node: SkillNodeSpec, records: readonly MasteryRecord[]): MasteryRecord[] {
  const keywords = node.topicKeywords.map(normalize).filter(Boolean);
  if (keywords.length === 0) return [];

  return records.filter(record => {
    const topic = normalize(record.topic || '');
    return topic.length > 0 && keywords.some(keyword => topic.includes(keyword));
  });
}

/** 0–1 share of this node's matched topics that reach the mastery bar. */
export function nodeMasteryLevel(node: SkillNodeSpec, records: readonly MasteryRecord[]): number {
  const matched = matchMastery(node, records);
  if (matched.length === 0) return 0;

  const mastered = matched.filter(
    record => (record.interval ?? 0) >= MASTERY_INTERVAL_DAYS || (record.last_quality ?? 0) >= MASTERY_QUALITY
  );
  return mastered.length / matched.length;
}

/** A node counts as completed once its XP bar is met and its topics are recalled reliably. */
export function isNodeCompleted(node: SkillNodeSpec, records: readonly MasteryRecord[], xp: number): boolean {
  return xp >= node.requiredXP && nodeMasteryLevel(node, records) >= 0.5;
}

/**
 * A node unlocks when the student has the XP AND every prerequisite is
 * completed — the dependency check the old implementation skipped.
 */
export function isNodeUnlocked(
  node: SkillNodeSpec,
  allNodes: readonly SkillNodeSpec[],
  records: readonly MasteryRecord[],
  xp: number
): boolean {
  if (xp < node.requiredXP) return false;

  return node.dependsOn.every(depId => {
    const dependency = allNodes.find(n => n.id === depId);
    // An unknown prerequisite must never silently unlock the node.
    if (!dependency) return false;
    return isNodeCompleted(dependency, records, xp);
  });
}

export type NodeStatus = 'locked' | 'unlocked' | 'completed';

export function nodeStatus(
  node: SkillNodeSpec,
  allNodes: readonly SkillNodeSpec[],
  records: readonly MasteryRecord[],
  xp: number
): NodeStatus {
  if (!isNodeUnlocked(node, allNodes, records, xp)) return 'locked';
  return isNodeCompleted(node, records, xp) ? 'completed' : 'unlocked';
}

/** Deep link that starts an adaptive session on this node's topic. */
export function practiceLinkFor(node: SkillNodeSpec, records: readonly MasteryRecord[] = []): string {
  // Prefer a topic the student has actually seen, so the session finds tasks.
  const matched = matchMastery(node, records);
  const topic = matched[0]?.topic ?? node.topicKeywords[0] ?? '';
  return `/adaptive-test?topic=${encodeURIComponent(topic)}`;
}
