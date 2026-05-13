import { describe, expect, it } from 'vitest';
import { buildRagContextFromLibrary, cosineSimilarity } from './ragContext';
import { MathTask } from './schema';

const baseTasks: MathTask[] = [
  {
    id: 't1',
    title: 'Линеарна равенка',
    original_text: 'Реши $2x+3=7$',
    solution_steps: ['$2x=4$', '$x=2$'],
    latex_formulas: ['$2x+3=7$'],
    source_url: 'test',
    tags: ['алгебра'],
    difficulty: 'easy',
    embedding: [1, 0, 0]
  },
  {
    id: 't2',
    title: 'Геометрија',
    original_text: 'Пресметај плоштина на триаголник',
    solution_steps: ['$P=ab/2$'],
    latex_formulas: ['$P=ab/2$'],
    source_url: 'test',
    tags: ['геометрија'],
    difficulty: 'medium',
    embedding: [0, 1, 0]
  }
];

describe('ragContext', () => {
  it('computes cosine similarity correctly', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('retrieves by embeddings when available', async () => {
    const result = await buildRagContextFromLibrary({
      query: 'алгебра равенка',
      tasks: baseTasks,
      embedQuery: async () => [0.9, 0.1, 0],
      maxItems: 2,
      similarityThreshold: 0.2
    });

    expect(result.retrievalMode).toBe('embedding');
    expect(result.selectedTasks[0].id).toBe('t1');
  });

  it('falls back to keyword retrieval when embedding call fails', async () => {
    const result = await buildRagContextFromLibrary({
      query: 'плоштина триаголник',
      tasks: baseTasks.map((task) => ({ ...task, embedding: undefined })),
      embedQuery: async () => {
        throw new Error('Embedding unavailable');
      },
      maxItems: 2
    });

    expect(result.retrievalMode).toBe('keyword');
    expect(result.selectedTasks[0].id).toBe('t2');
  });
});
