import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKahootFromTasks } from './kahoot';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@/src/lib/ai/client', () => ({
  ai: { models: { generateContent: (...args: unknown[]) => mockGenerateContent(...args) } },
  handleGeminiError: (e: unknown) => {
    throw e;
  },
}));

const baseTask = {
  title: 'Task',
  original_text: '1+1',
  solution_steps: ['2'],
  latex_formulas: [],
  source_url: 'x',
  tags: [],
  difficulty: 'easy' as const,
};

function respondWith(payload: unknown) {
  mockGenerateContent.mockResolvedValue({ text: JSON.stringify(payload) });
}

describe('generateKahootFromTasks validation gate', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('drops malformed questions and keeps hints aligned to kept ones', async () => {
    respondWith({
      title: 'Quiz',
      questions: [
        { question: 'Колку е $2+2$?', options: ['$4$', '$5$', '$6$', '$7$'], correctIndex: 0, timeLimit: 30 },
        { question: 'Невалидна', options: ['$1$', '$2$'], correctIndex: 0 },
        { question: 'Со еквивалентен дистрактор', options: ['$x/2$', '$0.5x$', '$9$', '$10$'], correctIndex: 0 },
      ],
      hints: ['прв hint', 'втор hint', 'трет hint'],
    });

    const quiz = await generateKahootFromTasks([baseTask]);
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0].question).toContain('2+2');
    expect(quiz.hints).toEqual(['прв hint']);
  });

  it('throws a friendly error when nothing valid survives', async () => {
    respondWith({
      title: 'Quiz',
      questions: [{ question: 'x', options: ['$1$'], correctIndex: 5 }],
      hints: [],
    });

    await expect(generateKahootFromTasks([baseTask])).rejects.toThrow(/валидно прашање/);
  });

  it('falls back to the default title when the model omits one', async () => {
    respondWith({
      questions: [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 1 }],
      hints: [],
    });

    const quiz = await generateKahootFromTasks([baseTask]);
    expect(quiz.title).toBe('MathKahoot');
  });
});
