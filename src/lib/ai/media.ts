/**
 * Media domain — generate images, speech, and mathematical graphics.
 * Moved verbatim from the former gemini.ts god-object.
 */
import { ai, handleGeminiError } from './client';
import { parseGeminiResponse } from './utils';
import { Type, Modality } from '@google/genai';
import { DEFAULT_MODEL, TTS_MODEL, IMAGE_MODEL, PRO_MODEL } from './models';

export async function generateSpeech(text: string): Promise<string> {
  // Транслитерација од кирилица во латиница за подобра поддршка од TTS моделот
  const cyrillicToLatinMap: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ѓ': 'gj', 'е': 'e', 'ж': 'zh',
    'з': 'z', 'ѕ': 'dz', 'и': 'i', 'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm',
    'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'ќ': 'kj',
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'џ': 'dzh', 'ш': 'sh',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Ѓ': 'Gj', 'Е': 'E', 'Ж': 'Zh',
    'З': 'Z', 'Ѕ': 'Dz', 'И': 'I', 'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'Lj', 'М': 'M',
    'Н': 'N', 'Њ': 'Nj', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'Ќ': 'Kj',
    'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Ch', 'Џ': 'Dzh', 'Ш': 'Sh'
  };

  const transliteratedText = text.split('').map(char => cyrillicToLatinMap[char] || char).join('');

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: transliteratedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return `data:audio/pcm;rate=24000;base64,${base64Audio}`;
    }
    throw new Error("Не е генерирано аудио.");
  } catch (error) {
    console.error("Грешка при генерирање аудио:", error);
    handleGeminiError(error);
  }
}

export async function generateMathGraphicConfig(prompt: string): Promise<string> {
  const systemInstruction = `You are an expert Math Visualization Engineer. Convert the math/geometry description into a precise JSON config for SVG rendering.

STRICT JSON FORMAT:
{
  "viewport": { "xMin": -10, "xMax": 10, "yMin": -10, "yMax": 10 },
  "grid": { "stepX": 1, "stepY": 1, "showAxes": true },
  "elements": [
    { "type": "point", "x": 2, "y": 3, "label": "A", "color": "#ef4444" },
    { "type": "segment", "x1": 0, "y1": 0, "x2": 4, "y2": 4, "color": "#3b82f6", "label": "AB" },
    { "type": "circle", "cx": 0, "cy": 0, "r": 3, "fill": "rgba(16,185,129,0.1)", "stroke": "#10b981" },
    { "type": "angle", "cx": 0, "cy": 0, "r": 1.5, "startAngle": 0, "endAngle": 60, "label": "60°", "wedge": false },
    { "type": "polygon", "points": [{"x":0,"y":0},{"x":4,"y":0},{"x":2,"y":3}], "fill": "rgba(234,179,8,0.15)", "stroke": "#eab308" },
    { "type": "function-path", "points": [{"x":-3,"y":9},{"x":-2,"y":4},{"x":-1,"y":1},{"x":0,"y":0},{"x":1,"y":1},{"x":2,"y":4},{"x":3,"y":9}], "color": "#8b5cf6" },
    { "type": "text", "x": 2, "y": 5, "text": "Label", "color": "#94a3b8" }
  ]
}

RULES:
1. For function-path: compute AT LEAST 30 evenly-spaced (x, y) points across the domain for smooth curves. Clamp y to ±2× the viewport height.
2. For lines (y=mx+b): use function-path with 2 endpoint points, or a segment from left to right viewport boundary.
3. viewport must tightly fit all elements — do not use default ±10 if elements are in ±3 range.
4. ALWAYS include at least one element. NEVER return { "elements": [] }.
5. Use bright distinct colors. Label key points.
6. Return ONLY valid JSON. No markdown code fences.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });
    
    return response.text || "{}";
  } catch (error) {
    console.error("Грешка при генерирање векторска графика:", error);
    throw error;
  }
}

/**
 * Генерира TikZ/LaTeX код за математичка визуелизација
 */

export async function generateTikZCode(description: string): Promise<string> {
  const prompt = `Ти си Експерт за LaTeX/TikZ визуелизација на математика.

Генерирај TikZ код за следниот опис:
${description}

ПРАВИЛА:
1. Користи \\begin{tikzpicture}...\\end{tikzpicture}
2. Вклучи оски, мрежа, и етикети
3. Користи бои за различни елементи
4. Додај легенда ако има повеќе елементи
5. Врати САМО валиден TikZ код, без markdown

Пример формат:
\\begin{tikzpicture}[scale=0.5]
  \\draw[->] (-5,0) -- (5,0) node[right] {$x$};
  \\draw[->] (0,-5) -- (0,5) node[above] {$y$};
  \\draw[domain=-4:4,smooth,variable=\\x,blue] plot ({\\x},{0.5*\\x*\\x});
  \\node at (2,2) {$y = \\frac{1}{2}x^2$};
\\end{tikzpicture}`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Грешка при генерирање TikZ код:", error);
    throw error;
  }
}

export async function generateImage(prompt: string, gradeLevel?: string): Promise<string> {
  try {
    const ageContext = gradeLevel ? ` Designed specifically for students in ${gradeLevel}. ` : '';
    const styleModifier = `Style: Modern, colorful, and engaging educational vector illustration. White background, crisp lines, perfect composition. No mathematical symbols or text in the image.`;
    
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            text: `Create a beautiful textbook illustration for the following: ${prompt}.${ageContext} ${styleModifier}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Не е генерирана слика.");
  } catch (error) {
    console.error("Грешка при генерирање слика:", error);
    handleGeminiError(error);
  }
}

export interface GraphAnalysisQuestion {
  question: string;
  dok_level: number;
  bloom_level: string;
  answer_hint: string;
}

export interface GraphAnalysis {
  graph_type: 'xy' | 'bar' | 'histogram' | 'scatter' | 'line' | 'polar' | 'unknown';
  description: string;
  x_axis_label: string;
  y_axis_label: string;
  x_range: [number, number];
  y_range: [number, number];
  detected_equation: string;
  key_points: Array<{ x: number; y: number; label: string }>;
  curriculum_topic: string;
  grade_level: string;
  generated_questions: GraphAnalysisQuestion[];
  geogebra_commands: string[];
}

export async function analyzeGraphWithAI(
  base64: string,
  mimeType: string,
  digitizedPoints?: Array<{ datasetName: string; x: number; y: number }>,
  axisConfig?: {
    x: { label: string; min: number; max: number; scale: 'linear' | 'log' };
    y: { label: string; min: number; max: number; scale: 'linear' | 'log' };
  }
): Promise<GraphAnalysis> {
  const pointsContext = digitizedPoints && digitizedPoints.length > 0
    ? `\n\nДигитализирани точки од наставникот: ${JSON.stringify(digitizedPoints.slice(0, 30))}`
    : '';
  const axisContext = axisConfig
    ? `\nОски: X (${axisConfig.x.label}, ${axisConfig.x.min}–${axisConfig.x.max}, ${axisConfig.x.scale}), Y (${axisConfig.y.label}, ${axisConfig.y.min}–${axisConfig.y.max}, ${axisConfig.y.scale})`
    : '';

  const prompt = `Ти си експерт по математичка педагогија за македонски наставници. Анализирај го графикот на сликата и врати детален педагошки извештај.${axisContext}${pointsContext}

ЗАДАЧА:
1. Идентификувај го типот на графикот (xy, bar, histogram, scatter, line, polar, unknown)
2. Опиши го графикот на МАКЕДОНСКИ јазик (2-3 реченици, корисни за наставник)
3. Детектирај ги осите, рангот и скалата
4. Ако е видлива математичка функција, врати ја во LaTeX формат (detected_equation)
5. Идентификувај клучни точки (пресечници, максимуми, минимуми, нули)
6. Поврзи со македонски наставен план (curriculum_topic, grade_level: "6"-"12" или "1год"-"4год" за средно)
7. Генерирај 4-6 педагошки прашања на МАКЕДОНСКИ со DoK нивоа и Bloom таксономија
8. Генерирај GeoGebra команди за интерактивна реконструкција

ВАЖНО: Сите прашања и описи мора да бидат на МАКЕДОНСКИ ЈАЗИК.`;

  try {
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: [prompt, { inlineData: { data: base64, mimeType } }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            graph_type: { type: Type.STRING },
            description: { type: Type.STRING },
            x_axis_label: { type: Type.STRING },
            y_axis_label: { type: Type.STRING },
            x_range: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            y_range: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            detected_equation: { type: Type.STRING },
            key_points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  label: { type: Type.STRING },
                },
                required: ['x', 'y', 'label'],
              },
            },
            curriculum_topic: { type: Type.STRING },
            grade_level: { type: Type.STRING },
            generated_questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  dok_level: { type: Type.NUMBER },
                  bloom_level: { type: Type.STRING },
                  answer_hint: { type: Type.STRING },
                },
                required: ['question', 'dok_level', 'bloom_level', 'answer_hint'],
              },
            },
            geogebra_commands: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'graph_type', 'description', 'x_axis_label', 'y_axis_label',
            'x_range', 'y_range', 'detected_equation', 'key_points',
            'curriculum_topic', 'grade_level', 'generated_questions', 'geogebra_commands',
          ],
        },
      },
    });

    if (!response.text) throw new Error('Нема одговор од AI.');
    return parseGeminiResponse(response.text) as GraphAnalysis;
  } catch (error) {
    handleGeminiError(error);
  }
}
