import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure the mock is available when the factory runs
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// `knowledgeModel` imports `ai` from the deprecated `./gemini` barrel, which
// re-exports it from `./ai/client`. Mocking the barrel replaced the re-export
// but not the module the barrel reads from, so the real client was still the
// one called — which is why this suite sat on `describe.skip` with a note
// blaming a Windows drive-letter bug. Mocking the client itself, the way the
// other AI suites do, is what makes it work.
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
vi.mock('@/src/lib/ai/embeddings', () => ({
  generateTaskEmbedding: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/src/lib/ragContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/ragContext')>();
  return { ...actual, buildRagContextFromLibrary: vi.fn().mockResolvedValue('') };
});

import { generateHybridMathSolution } from './knowledgeModel';

describe('KnowledgeModel (ToT + CoT)', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('should generate a hybrid math solution formatted correctly', async () => {
    const mockResponse = {
      text: JSON.stringify({
        problem_text: "Пресметај ја плоштината на правоаголен триаголник со катети 3cm и 4cm.",
        tree_of_thoughts: {
          path_1: "Користење на формулата P = (a*b)/2",
          path_2: "Наоѓање на хипотенузата преку Питагорова теорема па користење Херонова формула",
          path_3: "Користење на тригонометрија (синус од аголот меѓу катетите)",
          evaluation: "Пат 1 е најдиректен, Пат 2 е премногу комплициран, Пат 3 е за непотребно напредно ниво.",
          chosen_path: "Пат 1"
        },
        chain_of_thought_explanation: "Бидејќи имаме правоаголен триаголник, најлесно е...",
        solution_steps: [
          "a = 3cm, b = 4cm",
          "$P = \\frac{a \\cdot b}{2}$",
          "$P = \\frac{3 \\cdot 4}{2}$",
          "$P = 6 cm^2$"
        ],
        metadata: {
          tags: ["геометрија", "триаголник"],
          difficulty: "easy",
          dok_level: 2,
          grade_level: "VI одделение",
          curriculum_topic: "Плоштина"
        }
      })
    };

    mockGenerateContent.mockResolvedValue(mockResponse);

    const result = await generateHybridMathSolution("Пресметај ја плоштината на правоаголен триаголник со катети 3cm и 4cm.");

    expect(result.problem_text).toContain("3cm и 4cm");
    expect(result.tree_of_thoughts.chosen_path).toBe("Пат 1");
    expect(result.solution_steps.length).toBe(4);
    expect(result.metadata.difficulty).toBe("easy");
  }, 10000);

  it('should handle API errors defensively', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API Failure'));

    await expect(generateHybridMathSolution("2+2")).rejects.toThrow('API Failure');
  }, 10000);
});
