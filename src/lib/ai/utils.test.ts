import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// Isolate utils.ts from the real Gemini client and from modules that touch
// Firebase (embeddings/curriculumKnowledge) so these tests stay side-effect free.
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

import { parseGeminiResponse, checkGeminiHealth, modernizeTaskContext } from './utils';
import { MathTask } from '../schema';

const baseTask: MathTask = {
  title: 'Стара задача',
  original_text: 'Реши $x+1=2$',
  solution_steps: ['$x=1$'],
  latex_formulas: ['$x+1=2$'],
  source_url: 'test',
  tags: [],
  difficulty: 'easy',
};

describe('parseGeminiResponse', () => {
  it('parses a plain JSON object', () => {
    expect(parseGeminiResponse('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses a JSON array', () => {
    expect(parseGeminiResponse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('extracts JSON from a ```json fenced block', () => {
    const text = 'Here you go:\n```json\n{"title": "Task"}\n```\nDone.';
    expect(parseGeminiResponse(text)).toEqual({ title: 'Task' });
  });

  it('extracts JSON from a bare ``` fenced block (no language tag)', () => {
    const text = '```\n{"value": 42}\n```';
    expect(parseGeminiResponse(text)).toEqual({ value: 42 });
  });

  it('parses JSON surrounded by whitespace', () => {
    expect(parseGeminiResponse('   \n{"ok": true}\n  ')).toEqual({ ok: true });
  });

  it('throws on text that is not JSON in any form', () => {
    expect(() => parseGeminiResponse('this is not json at all')).toThrow();
  });
});

describe('checkGeminiHealth', () => {
  beforeEach(() => mockGenerateContent.mockReset());

  it('returns true when the model replies with OK', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'OK' });
    await expect(checkGeminiHealth()).resolves.toBe(true);
  });

  it('returns false when the reply does not contain OK', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'sorry, no' });
    await expect(checkGeminiHealth()).resolves.toBe(false);
  });
});

describe('modernizeTaskContext', () => {
  beforeEach(() => mockGenerateContent.mockReset());

  it('merges the modernized title/text into the original task', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ title: 'Gen-Z задача', original_text: 'Реши $x+1=2$ во контекст на дронови' }),
    });

    const result = await modernizeTaskContext(baseTask);

    expect(result.title).toBe('Gen-Z задача');
    expect(result.original_text).toContain('дронови');
    // Untouched fields are preserved from the original task.
    expect(result.difficulty).toBe('easy');
    expect(result.solution_steps).toEqual(['$x=1$']);
  });

  it('propagates an error when the model returns unparseable content', async () => {
    // The mock resolves successfully; parseGeminiResponse throws inside
    // modernizeTaskContext, which rethrows — exercising the error path without
    // throwing inside the mock (which vitest reports as a test failure).
    mockGenerateContent.mockResolvedValue({ text: 'this is not json' });
    await expect(modernizeTaskContext(baseTask)).rejects.toThrow();
  });
});
