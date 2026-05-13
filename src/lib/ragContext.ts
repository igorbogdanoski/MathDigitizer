import { MathTask } from './schema';

export interface BuildRagContextOptions {
  query: string;
  tasks: MathTask[];
  embedQuery: (text: string) => Promise<number[]>;
  maxItems?: number;
  similarityThreshold?: number;
}

export interface RagBuildResult {
  selectedTasks: MathTask[];
  retrievalMode: 'embedding' | 'keyword' | 'none';
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function keywordScore(queryTokens: Set<string>, task: MathTask): number {
  const source = [task.title, task.original_text, task.curriculum_topic, ...(task.tags || [])]
    .filter(Boolean)
    .join(' ');
  const taskTokens = new Set(tokenize(source));

  if (taskTokens.size === 0 || queryTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  queryTokens.forEach((token) => {
    if (taskTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / queryTokens.size;
}

export async function buildRagContextFromLibrary(options: BuildRagContextOptions): Promise<RagBuildResult> {
  const maxItems = options.maxItems ?? 4;
  const similarityThreshold = options.similarityThreshold ?? 0.35;
  const candidates = options.tasks.filter((task) => Boolean(task.original_text));

  if (!candidates.length) {
    return { selectedTasks: [], retrievalMode: 'none' };
  }

  try {
    const queryEmbedding = await options.embedQuery(options.query);
    const ranked = candidates
      .filter((task) => Array.isArray(task.embedding) && task.embedding.length > 0)
      .map((task) => ({ task, score: cosineSimilarity(queryEmbedding, task.embedding!) }))
      .filter((item) => item.score >= similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems)
      .map((item) => item.task);

    if (ranked.length > 0) {
      return { selectedTasks: ranked, retrievalMode: 'embedding' };
    }
  } catch (error) {
    // Fallback to keyword retrieval when embeddings are unavailable.
    console.warn('Embedding retrieval fallback to keyword mode:', error);
  }

  const queryTokens = new Set(tokenize(options.query));
  const keywordRanked = candidates
    .map((task) => ({ task, score: keywordScore(queryTokens, task) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((item) => item.task);

  if (keywordRanked.length > 0) {
    return { selectedTasks: keywordRanked, retrievalMode: 'keyword' };
  }

  return { selectedTasks: [], retrievalMode: 'none' };
}
