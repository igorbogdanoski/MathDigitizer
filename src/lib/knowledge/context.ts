/**
 * The retrieval hook: a teacher's own textbook as prompt context
 * (EXPERT_LEVEL_MASTER_PLAN, 10.1).
 *
 * Fetches, ranks and formats in one call, so a generator adds one `await` and
 * a string rather than a pipeline. Everything it needs to decide is passed in;
 * everything that could fail returns an empty string, because a textbook that
 * cannot be reached is a missing nicety and not a reason for grading to fail.
 */
import { getChapterSkills } from './store';
import { formatKnowledgeContext, rankKnowledge } from './retrieval';

/** Distilled chapters are re-fetched at most this often per session. */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { ownerId: string; at: number; skills: Awaited<ReturnType<typeof getChapterSkills>> } | null = null;

/** Drops the cache — call after importing or deleting a book. */
export function invalidateKnowledgeCache(): void {
  cache = null;
}

/**
 * Context from the teacher's distilled textbooks, or an empty string.
 *
 * Empty is the common case and the safe one: most teachers will have imported
 * nothing, and a generator must read exactly the same with or without this.
 */
export async function buildKnowledgeContextBlock(
  query: string,
  ownerId: string | undefined | null,
  outcomeCodes: readonly string[] = [],
): Promise<string> {
  if (!ownerId || (!query.trim() && outcomeCodes.length === 0)) return '';

  try {
    if (!cache || cache.ownerId !== ownerId || Date.now() - cache.at > CACHE_TTL_MS) {
      cache = { ownerId, at: Date.now(), skills: await getChapterSkills(ownerId) };
    }
    if (cache.skills.length === 0) return '';

    return formatKnowledgeContext(rankKnowledge(cache.skills, { text: query, outcomeCodes }));
  } catch (error) {
    console.warn('Knowledge retrieval failed; continuing without it:', error);
    return '';
  }
}
