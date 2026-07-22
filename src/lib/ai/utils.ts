/**
 * Utils domain — shared AI helpers + utility functions.
 * Moved verbatim from the former gemini.ts god-object.
 *
 * Shared prompt constants/helpers (parseGeminiResponse, *_INSTRUCTION,
 * buildCurriculumContextBlockRag) live here so every domain module can import
 * them without creating circular dependencies.
 */
import { ai, handleGeminiError, buildCurriculumContextBlock } from './client';
import { generateTaskEmbedding } from './embeddings';
import { MathTask } from '../schema';
import { Type } from '@google/genai';
import { PRO_MODEL, DEFAULT_MODEL, FAST_MODEL } from './models';
import { searchCurriculum, formatCurriculumContext } from '../curriculumKnowledge';

export async function buildCurriculumContextBlockRag(query: string, gradeHint?: string): Promise<string> {
  try {
    const results = await searchCurriculum(query, {
      embedQuery: generateTaskEmbedding,
      gradeFilter: gradeHint,
      maxResults: 3,
    });
    if (results.length > 0) {
      return formatCurriculumContext(results);
    }
  } catch (e) {
    console.warn('RAG curriculum search failed, falling back to keyword search:', e);
  }
  // Fallback to static keyword search
  return buildCurriculumContextBlock(query, gradeHint);
}

// ─── Иницијализација на Gemini клиентот ──────────────────────────────────────

export const MATH_PLOT_INSTRUCTION = `
Ако има потреба визуелно да се прикаже математички концепт (график, геометриска фигура, точки, вектори, кружници, агли), можеш да вметнеш JSON блок за исцртување преку ознаката \`math-plot\`. Вметни го ова како дел од текстуалното објаснување или задачата.
ПРИМЕР:
\`\`\`math-plot
{
  "viewport": {"xMin": -5, "xMax": 5, "yMin": -5, "yMax": 5},
  "grid": {"stepX": 1, "stepY": 1, "showAxes": true},
  "elements": [
    {"type": "point", "x": 2, "y": 3, "label": "A", "color": "#ef4444"},
    {"type": "segment", "x1": 0, "y1": 0, "x2": 2, "y2": 3, "color": "#10b981"},
    {"type": "polygon", "points": [{"x":0,"y":0}, {"x":2,"y":0}, {"x":0,"y":2}], "fill": "rgba(99,102,241,0.2)"},
    {"type": "circle", "cx": 0, "cy": 0, "r": 3, "stroke": "#3b82f6", "fill": "transparent"},
    {"type": "angle", "cx": 0, "cy": 0, "r": 1, "startAngle": 0, "endAngle": 45, "label": "α", "fill": "rgba(234,179,8,0.3)"},
    {"type": "text", "x": -2, "y": -2, "text": "Теорема за централен агол"}
  ]
}
\`\`\`
Многу е важно да генерираш само валиден JSON во внатрешноста на \`math-plot\` блокот.
`;

export const ALGEBRA_TILES_INSTRUCTION = `
Ако е потребно да визуелизираш алгебарски изрази (полиноми, собирање/одземање или множење/факторизација), користи алгебарски плочки (algebra tiles) преку \`algebra-tiles\` JSON блок.
ПРИМЕР за визуелизација на изразот "x^2 - 2x + 3":
\`\`\`algebra-tiles
{
  "expression": "x^2 - 2x + 3",
  "tiles": [
    {"type": "x^2", "value": 1},
    {"type": "x", "value": -2},
    {"type": "1", "value": 3}
  ]
}
\`\`\`
Ова ќе изгенерира интерактивен визуелен приказ за ученикот. Многу е важно JSON да биде перфектен. Поддржани плочки: "x^2", "y^2", "xy", "x", "y", "1".
`;

export const JSXGRAPH_INSTRUCTION = `
За НАПРЕДНА 2D и 3D геометрија, каде аглите и пропорциите мора да се математички точни (скриптирање), користи \`jsxgraph\` блок.
ПРИМЕР:
\`\`\`jsxgraph
// JavaScript код за JSXGraph (без HTML тагови, само pure JS за мапирање на 'board' објектот)
var p1 = board.create('point', [0, 0], {name: 'A', size: 4});
var p2 = board.create('point', [3, 0], {name: 'B', size: 4});
var p3 = board.create('point', [0, 4], {name: 'C', size: 4});
var poly = board.create('polygon', [p1, p2, p3]);
var angle = board.create('angle', [p2, p1, p3], {radius: 1});
\`\`\`
Ова ќе генерира вистински, скалабилен SVG дијаграм каде пропорциите и аглите се прецизни и геометриски точни. Користи го ова за геометриски фигури.
`;

export function parseGeminiResponse(text: string) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
    const cleanText = text.trim();
    if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
      return JSON.parse(cleanText);
    }
    throw error;
  }
}

export async function enrichTaskPedagogy(task: MathTask, model: string = PRO_MODEL, outputLanguageOverride?: string): Promise<any> {
  const lang = outputLanguageOverride || task.detected_language || 'mk';
  const langName: Record<string, string> = {
    mk: 'Macedonian (Кирилица — ЗАДОЛЖИТЕЛНО)',
    en: 'English',
    ru: 'Russian (Кирилица)',
    tr: 'Turkish',
    sq: 'Albanian',
    ar: 'Arabic',
  };
  const outputLang = langName[lang] || 'Macedonian';

  const prompt = `You are a world-class "Pedagogical Content Architect" specializing in mathematics education. Your mission: enrich the following math task with deep pedagogical insights that transform it into a complete teaching resource.

OUTPUT LANGUAGE: Write ALL text fields in ${outputLang}. LaTeX formulas ($...$, $$...$$) must remain unchanged.

MATH TASK:
Title: ${task.title}
Topic: ${task.curriculum_topic || 'Unknown'}
Grade: ${task.grade_level || 'Unknown'}
Difficulty: ${task.difficulty || 'medium'}
DoK Level: ${task.dok_level || 2}
Problem: ${task.original_text}
Solution Steps:
${(task.solution_steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}

YOUR 9-POINT MISSION:

1. **Misconception Guard** (≥3 items): List the most common student errors and misconceptions for this SPECIFIC problem — not generic math errors. Include WHY students make each mistake (cognitive root cause).

2. **Socratic Scaffolding** (3-4 questions): Generate powerful Socratic questions a teacher asks WITHOUT revealing the answer. Questions must be context-specific (reference actual numbers/shapes from the problem). Sequence: from observation → pattern recognition → abstraction.

3. **Teaching Strategy**: Describe the optimal instructional sequence for this specific task. Name the pedagogical method (e.g., Concrete-Representational-Abstract, Inquiry-Based, Think-Aloud). Explain HOW to introduce it step by step in a lesson.

4. **Prerequisites** (≥3): List the exact prior knowledge nodes a student must have mastered. Be specific (not "algebra" but "solving two-step linear equations with one variable").

5. **Real-World Modeling Scenario**: Write a detailed, narrative scenario from everyday life (business, engineering, biology, sports, cooking, technology) where this EXACT math concept is applied. Include specific numbers that match the problem's difficulty.

6. **Modern Gen-Z Context**: Rewrite the problem context for modern students — social media metrics, gaming, streaming, e-commerce, environmental issues. Keep the same mathematical structure, only change the narrative wrapper.

7. **Differentiated Learning**:
   - \`support\` (Tier 2/3): How to scaffold this for struggling students — simpler numbers, visual aids, broken-down sub-steps, manipulatives.
   - \`extension\` (Gifted/Advanced): How to extend this problem — generalization, proof, reverse-engineering, multi-representation.

8. **Progressive Hints** (3 hints): Write 3 hints of increasing specificity. Hint 1 is conceptual (points to the right idea), Hint 2 is procedural (gives the first move), Hint 3 is near-solution (gives most of the structure without the final answer).

9. **Quality Score** (1-100): Evaluate this task on: mathematical rigor (25pts), pedagogical clarity (25pts), cognitive challenge appropriate to grade (25pts), real-world connection (25pts). Return the SUM as quality_score.

Return STRICTLY a JSON object with all fields populated.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
            socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
            teaching_strategy: { type: Type.STRING },
            prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
            modeling_scenario: { type: Type.STRING },
            modern_context_suggestion: { type: Type.STRING },
            hints: { type: Type.ARRAY, items: { type: Type.STRING } },
            quality_score: { type: Type.NUMBER, description: "1-100 composite score across rigor, clarity, challenge, real-world connection" },
            differentiated_learning: {
              type: Type.OBJECT,
              properties: {
                support: { type: Type.STRING },
                extension: { type: Type.STRING }
              },
              required: ["support", "extension"]
            }
          },
          required: ["common_pitfalls", "socratic_questions", "teaching_strategy", "prerequisites", "modeling_scenario", "modern_context_suggestion", "hints", "quality_score", "differentiated_learning"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Грешка при педагошко збогатување:", error);
    handleGeminiError(error);
  }
}

export async function modernizeTaskContext(task: MathTask): Promise<MathTask> {
  const prompt = `Ти си Експерт за Психологија на Учење и Контекстуален Трансформатор. Твојата мисија е да ја земеш следната "досадна" или традиционална математичка задача и да ја трансформираш во модерен, ангажирачки контекст наменет за Gen-Z ученици (пр. гејминг, криптовалути, дронови, социјални медиуми, стартапи).
  
  МНОГУ ВАЖНО: Апсолутно не смееш да ги менуваш математичките вредности или логиката на равенката. Само контекстот (текстот) се менува.

  ОРИГИНАЛНА ЗАДАЧА:
  Наслов: ${task.title}
  Текст: ${task.original_text}
  Тема: ${task.curriculum_topic}
  
  Врати го резултатот како JSON објект кој ја следи истата структура како оригиналот, но со модернизиран наслов и текст.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Нов модерен наслов" },
            original_text: { type: Type.STRING, description: "Нов модерен текст со LaTeX" }
          },
          required: ["title", "original_text"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const updates = parseGeminiResponse(response.text);
    return { ...task, ...updates, title: updates.title, original_text: updates.original_text };
  } catch (error) {
    console.error("Грешка при модернизација на контекст:", error);
    throw error;
  }
}

export async function checkGeminiHealth(): Promise<boolean> {
  try {
    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: 'reply with only the word OK',
    });
    return Boolean(response.text?.includes('OK'));
  } catch {
    return false;
  }
}
