/**
 * Kahoot domain — Kahoot-style quiz generation.
 * Moved verbatim from the former gemini.ts god-object.
 */
import { ai, handleGeminiError } from './client';
import { MATH_PLOT_INSTRUCTION, parseGeminiResponse } from './utils';
import { MathTask } from '../schema';
import { Type } from '@google/genai';
import { PRO_MODEL, DEFAULT_MODEL } from './models';

export async function generateKahootFromFiles(files: {base64: string, mimeType: string}[], prompt: string): Promise<any> {
  const instructions = `Ти си Креатор на Интерактивни Математички Квизови (MathKahoot). 
Врз основа на приложените фајлови (слики/документи) И промптот: "${prompt}", креирај MathKahoot квиз.
${MATH_PLOT_INSTRUCTION}

СТРИКТНИ ПРАВИЛА:
1. Секое прашање мора да има математичка формула користејќи LaTeX (на пр. $x^2 + y^2 = r^2$).
2. Врати СТРОГО JSON објект кој ја следи структурата.
3. Додај "hints" (помош) за секое прашање. Ова ќе се користи ако ученикот побара АИ Помош за време на играта.
4. Опциите мора да се 4 (A, B, C, D формат).
5. correctIndex е индекс на точниот одговор (0, 1, 2, или 3).
6. Јазик: Македонски.

ВРАТИ ЈА СЛЕДНАВА СТРУКТУРА:
{
  "title": "Наслов на квизот",
  "questions": [
    {
      "question": "Текст на прашањето со LaTeX...",
      "options": ["Опција 0", "Опција 1", "Опција 2", "Опција 3"],
      "correctIndex": 1
    }
  ],
  "hints": ["Најди го најмалиот заеднички содржател...", "hint за Q2", "hint за Q3..."]
}
`;

  try {
    const contents: any[] = [instructions];
    files.forEach(f => {
      contents.push({ inlineData: { data: f.base64, mimeType: f.mimeType } });
    });

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.NUMBER },
                  timeLimit: { type: Type.NUMBER, description: "Time limit in seconds (e.g. 30, 60, 90)" }
                },
                required: ["question", "options", "correctIndex"]
              }
            },
            hints: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "questions", "hints"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Грешка при креирање Kahoot квиз:", error);
    throw error;
  }
}

export async function generateKahootFromTasks(tasks: MathTask[]): Promise<any> {
  const instructions = `Ти си Креатор на Интерактивни Математички Квизови (MathKahoot). 
Врз основа на следниве веќе извлечени задачи, креирај MathKahoot квиз. Секоја задача станува 1 прашање.
Опциите мора да се 4. Едната е точната (добиена од решението), а другите 3 мора да бидат многу паметни дистрактори базирани на вообичаени ученички грешки.
Секое прашање мора да има timeLimit (на пр. 30 секунди за лесни, 60 за средни, 120 за исклучително тешки).

ЗАДАЧИ:
${tasks.map((t, i) => `Задача ${i+1}:\nТекст: ${t.original_text}\nРешение: ${t.solution_steps.join('\n')}\n`).join('\n')}

ВРАТИ ЈА СЛЕДНАВА СТРУКТУРА:
{
  "title": "Интерактивен Квиз / Жива Училница",
  "questions": [
    {
      "question": "Текст на прашањето со LaTeX...",
      "options": ["Опција 0", "Опција 1", "Опција 2", "Опција 3"],
      "correctIndex": 1,
      "timeLimit": 60
    }
  ],
  "hints": ["hint за Q1", "hint за Q2..."]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: instructions,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.NUMBER },
                  timeLimit: { type: Type.NUMBER }
                },
                required: ["question", "options", "correctIndex", "timeLimit"]
              }
            },
            hints: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "questions", "hints"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор од AI.");
    return parseGeminiResponse(response.text);
  } catch (error) {
    console.error("Грешка при генерирање Kahoot од задачи:", error);
    handleGeminiError(error);
  }
}
