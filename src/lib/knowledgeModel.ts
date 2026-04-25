import { Type } from "@google/genai";
import { ai } from "./gemini";

export interface KnowledgeModelResponse {
  problem_text: string;
  tree_of_thoughts: {
    path_1: string;
    path_2: string;
    path_3: string;
    evaluation: string;
    chosen_path: string;
  };
  chain_of_thought_explanation: string;
  solution_steps: string[];
  misconceptions: { mistake: string; teacher_reaction: string }[];
  metadata: {
    tags: string[];
    difficulty: "easy" | "medium" | "hard";
    dok_level: number;
    grade_level: string;
    curriculum_topic: string;
  };
}

export async function generateHybridMathSolution(problemText: string): Promise<KnowledgeModelResponse> {
  const prompt = `Ти си Водечки Софтверски Архитект и Едукативен Технолог (EdTech Expert), со експертиза за математика на македонски јазик. Твојата мисија е да генерираш "Хибриден Модел на Знаење" базиран на "Tree-of-Thoughts" и "Chain-of-Thought" (ToT + CoT) напреден промптинг.

ЦЕЛ: Да се реши следната задача/проблем на најдобар можен педагошки начин.
ЗАДАЧА: ${problemText}

СЛЕДИ ГО ОВОЈ ПРОТОКОЛ:
1. **Tree-of-Thoughts (ToT) Системски Дизајн**: Евалуирај 3 различни патишта (paths) за решавање на овој математички проблем. Опиши ги накратко.
2. **Евалуација**: Критички спореди ги трите патишта и одбери го најдобриот баланс помеѓу педагошка јасност и математичка точност.
3. **Chain-of-Thought (CoT) Логика**: Откако ќе го избереш најдобриот пат, разбиј го процесот на решавање на микро-чекори со детално методолошко објаснување.
4. **Детекција на Анатомски Грешки (Misconception Analysis)**: Системот мора да ги предвиди 3-те најчести погрешни чекори што ги прават учениците за оваа задача и како наставникот треба да реагира на нив.
5. **Македонски Јазик & LaTeX**: Користи стручен македонски јазик и Zero-Error LaTeX стандард (inline $...$ и display $$...$$). На пример "$x^2$".

ВРАТИ ГО РЕЗУЛТАТОТ СТРОГО КАКО JSON ОБЈЕКТ кој се совпаѓа со дефинираната структура.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            problem_text: { type: Type.STRING, description: "Text of the problem" },
            tree_of_thoughts: {
              type: Type.OBJECT,
              properties: {
                path_1: { type: Type.STRING, description: "Description of the first potential solution path" },
                path_2: { type: Type.STRING, description: "Description of the second potential solution path" },
                path_3: { type: Type.STRING, description: "Description of the third potential solution path" },
                evaluation: { type: Type.STRING, description: "Evaluation and comparison of the paths" },
                chosen_path: { type: Type.STRING, description: "The final chosen path (1, 2, or 3)" }
              },
              required: ["path_1", "path_2", "path_3", "evaluation", "chosen_path"]
            },
            chain_of_thought_explanation: { type: Type.STRING, description: "Methodological explanation of the chosen path" },
            solution_steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Step-by-step mathematical solution" },
            misconceptions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  mistake: { type: Type.STRING },
                  teacher_reaction: { type: Type.STRING }
                },
                required: ["mistake", "teacher_reaction"]
              }
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                dok_level: { type: Type.NUMBER },
                grade_level: { type: Type.STRING },
                curriculum_topic: { type: Type.STRING }
              },
              required: ["tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
            }
          },
          required: ["problem_text", "tree_of_thoughts", "chain_of_thought_explanation", "solution_steps", "misconceptions", "metadata"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор од Knowledge Model.");
    return JSON.parse(response.text) as KnowledgeModelResponse;
  } catch (error) {
    console.error("Грешка во Knowledge Model:", error);
    throw error;
  }
}
