import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@/src/lib/ai/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/ai/client')>();
  return {
    ...actual,
    ai: {
      models: { generateContent: mockGenerateContent, embedContent: vi.fn() },
      chats: { create: vi.fn() },
    },
  };
});
vi.mock('@/src/lib/ai/embeddings', () => ({ generateTaskEmbedding: vi.fn() }));
vi.mock('@/src/lib/curriculumKnowledge', () => ({
  searchCurriculum: vi.fn(),
  formatCurriculumContext: vi.fn(),
}));
vi.mock('@/src/lib/knowledge/context', () => ({
  buildKnowledgeContextBlock: vi.fn().mockResolvedValue(''),
}));

import { autoGradeSubmission } from './grading';

const question = { text: 'Реши 2x = 8', solution: 'x = 4', points: 100 };

/**
 * A grade is a claim about a person.
 *
 * This used to answer its own failure with `{ score: 0 }`, which the callers
 * consumed as a real result: the try/catch around the call never fired, so a
 * malformed response was recorded as a wrong answer. In the adaptive test that
 * fed the ability estimate, and a student's level fell because of a stray
 * markdown fence. When a grade cannot be produced, no grade is produced.
 */
describe('autoGradeSubmission', () => {
  beforeEach(() => mockGenerateContent.mockReset());

  it('returns the score the model produced', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ score: 75, feedback: 'Добра постапка.' }),
    });

    await expect(autoGradeSubmission(question, 'x = 4')).resolves.toMatchObject({
      score: 75,
      feedback: 'Добра постапка.',
    });
  });

  it('reads a response wrapped in a markdown fence', async () => {
    // The exact shape that used to produce a silent zero.
    mockGenerateContent.mockResolvedValue({
      text: '```json\n{"score": 60, "feedback": "Делумно"}\n```',
    });

    await expect(autoGradeSubmission(question, 'x = 4')).resolves.toMatchObject({ score: 60 });
  });

  it('throws rather than scoring zero when the response cannot be parsed', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Се извинувам, не можам да помогнам.' });

    await expect(autoGradeSubmission(question, 'x = 4')).rejects.toThrow();
  });

  it('throws when the response carries no score at all', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ feedback: 'Убаво' }) });

    await expect(autoGradeSubmission(question, 'x = 4')).rejects.toThrow();
  });

  it('throws when the score is not a number', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ score: 'одлично', feedback: 'Убаво' }),
    });

    await expect(autoGradeSubmission(question, 'x = 4')).rejects.toThrow();
  });

  it('throws when the model returns nothing', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    await expect(autoGradeSubmission(question, 'x = 4')).rejects.toThrow();
  });

  // Not covered here: a failure of the network call itself. An error thrown
  // from inside the spy is reported by vitest as an unhandled error regardless
  // of how the code under test catches it, so the test would describe the
  // harness rather than the behaviour. `client.test.ts` covers the retry and
  // give-up path against `withRetry` directly, where the same guarantee holds.

  it('clamps a score the model put outside the scale', async () => {
    // 140/100 is not a grade anyone can defend, and a negative one even less.
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ score: 140, feedback: 'x' }) });
    await expect(autoGradeSubmission(question, 'x')).resolves.toMatchObject({ score: 100 });

    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ score: -20, feedback: 'x' }) });
    await expect(autoGradeSubmission(question, 'x')).resolves.toMatchObject({ score: 0 });
  });

  it('accepts a numeric score the model sent as a string', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ score: '80', feedback: 'x' }) });
    await expect(autoGradeSubmission(question, 'x')).resolves.toMatchObject({ score: 80 });
  });
});
