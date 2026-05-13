import { Type } from "@google/genai";
import { ai, generateTaskEmbedding } from "./gemini";
import { MathTask } from "./schema";
import { buildPromptEnvelope, buildRagTaskContext, PromptStrategy } from "./promptEngineering";
import { buildRagContextFromLibrary } from "./ragContext";

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

export interface KnowledgeModelOptions {
  strategy?: PromptStrategy;
  retrievalTasks?: MathTask[];
}

export async function generateHybridMathSolution(
  problemText: string,
  options: KnowledgeModelOptions = {}
): Promise<KnowledgeModelResponse> {
  const strategy = options.strategy ?? 'hybrid';

  let ragContext = 'RAG КОНТЕКСТ: Нема релевантни задачи од библиотеката за ова барање.';
  if (options.retrievalTasks && options.retrievalTasks.length > 0) {
    const rag = await buildRagContextFromLibrary({
      query: problemText,
      tasks: options.retrievalTasks,
      embedQuery: generateTaskEmbedding,
      maxItems: 4,
      similarityThreshold: 0.33
    });
    ragContext = `${buildRagTaskContext(rag.selectedTasks)}\nРЕЖИМ НА RETRIEVAL: ${rag.retrievalMode}`;
  }

  const prompt = buildPromptEnvelope({
    role: 'Ти си Водечки Софтверски Архитект и Едукативен Технолог (EdTech Expert), со експертиза за математика на македонски јазик.',
    mission: 'Генерирај "Хибриден Модел на Знаење" за решавање на математички проблем со силна педагогија и математичка точност.',
    strategy,
    pedagogyPriority: 'scaffolded',
    ragContext,
    userInput: problemText,
    hardRules: [
      'Евалуирај 3 различни патишта и избери најдобар според педагошка јасност и точност.',
      'Разложи го избраниот пат во микро-чекори со јасно методолошко објаснување.',
      'Детектирај најмалку 3 чести мисконцепции и предложи teacher reaction за секоја.',
      'Користи стручен македонски јазик и Zero-Error LaTeX ($...$ и $$...$$).',
      'Врати исклучиво валиден JSON без markdown блокови.'
    ],
    outputContract: `{
  "problem_text": "string",
  "tree_of_thoughts": {
    "path_1": "string",
    "path_2": "string",
    "path_3": "string",
    "evaluation": "string",
    "chosen_path": "string"
  },
  "chain_of_thought_explanation": "string",
  "solution_steps": ["string"],
  "misconceptions": [{ "mistake": "string", "teacher_reaction": "string" }],
  "metadata": {
    "tags": ["string"],
    "difficulty": "easy|medium|hard",
    "dok_level": 1,
    "grade_level": "string",
    "curriculum_topic": "string"
  }
}`
  });

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
