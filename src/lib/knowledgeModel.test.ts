import { describe, it, expect, vi } from 'vitest';
import { generateHybridMathSolution } from './knowledgeModel';
import { ai } from './gemini';

vi.mock('./gemini', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

describe('KnowledgeModel (ToT + CoT)', () => {
  it('should generate a hybrid math solution formatted correctly', async () => {
    const mockReponse = {
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

    (ai.models.generateContent as any).mockResolvedValue(mockReponse);

    const result = await generateHybridMathSolution("Пресметај ја плоштината на правоаголен триаголник со катети 3cm и 4cm.");
    
    expect(result.problem_text).toContain("3cm и 4cm");
    expect(result.tree_of_thoughts.chosen_path).toBe("Пат 1");
    expect(result.solution_steps.length).toBe(4);
    expect(result.metadata.difficulty).toBe("easy");
  });

  it('should handle API errors defensively', async () => {
    (ai.models.generateContent as any).mockRejectedValue(new Error('API Failure'));

    await expect(generateHybridMathSolution("2+2")).rejects.toThrow('API Failure');
  });
});
