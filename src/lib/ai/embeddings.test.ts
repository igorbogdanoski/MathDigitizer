import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEmbedContent } = vi.hoisted(() => ({
  mockEmbedContent: vi.fn(),
}));

vi.mock('@/src/lib/ai/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/ai/client')>();
  return {
    ...actual,
    ai: {
      models: { generateContent: vi.fn(), embedContent: mockEmbedContent },
      chats: { create: vi.fn() },
    },
  };
});

import { generateTaskEmbedding } from './embeddings';
import { EMBEDDING_MODEL } from './models';

describe('generateTaskEmbedding', () => {
  beforeEach(() => mockEmbedContent.mockReset());

  it('returns the vector from response.embeddings[0].values', async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [0.1, 0.2, 0.3] }] });
    await expect(generateTaskEmbedding('some text')).resolves.toEqual([0.1, 0.2, 0.3]);
  });

  it('falls back to response.embedding.values (alternate wrapper shape)', async () => {
    mockEmbedContent.mockResolvedValue({ embedding: { values: [0.9, 0.8] } });
    await expect(generateTaskEmbedding('some text')).resolves.toEqual([0.9, 0.8]);
  });

  it('sends the configured embedding model and the text', async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [1] }] });
    await generateTaskEmbedding('hello');
    expect(mockEmbedContent).toHaveBeenCalledWith({ model: EMBEDDING_MODEL, contents: 'hello' });
  });

  it('throws when the response has no usable embedding', async () => {
    mockEmbedContent.mockResolvedValue({});
    await expect(generateTaskEmbedding('some text')).rejects.toThrow();
  });
});
