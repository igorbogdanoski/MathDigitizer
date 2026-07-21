/**
 * @deprecated Import from './ai' instead. This file will be split into domain
 * modules (extraction.ts, grading.ts, generation.ts, etc.) — see src/lib/ai/index.ts
 * for the migration plan. All exports are re-exported from './ai' for backward
 * compatibility.
 */
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MathTask } from "./schema";
import { PromptStrategy, buildPromptEnvelope, buildRagTaskContext } from "./promptEngineering";
import { buildRagContextFromLibrary } from "./ragContext";
import { searchCurriculumKeyword, buildCurriculumChunkText, ALL_MK_CURRICULUM } from "./curriculumData";
import { searchCurriculum, formatCurriculumContext } from "./curriculumKnowledge";

// ─── Curriculum RAG helper (synchronous — no extra API call) ─────────────────
function buildCurriculumContextBlock(query: string, gradeHint?: string): string {
  const topics = searchCurriculumKeyword(query + (gradeHint ? ` ${gradeHint}` : ''));
  if (topics.length === 0) return '';

  const lines = [
    '╔══ ОФИЦИЈАЛНА НАСТАВНА ПРОГРАМА — БРО.ГОВ.МК ══╗',
    'Задачата МОРА да биде усогласена со следните официјални исходи:',
    '',
  ];
  topics.slice(0, 3).forEach(topic => {
    const grade = ALL_MK_CURRICULUM.find(g => g.topics.some(t => t.id === topic.id));
    if (!grade) return;
    lines.push(buildCurriculumChunkText(grade, topic));
    lines.push('');
  });
  lines.push('╚═════════════════════════════════════════════════╝');
  return lines.join('\n');
}

// ─── RAG-based Curriculum Context (async, uses embeddings) ───────────────────
// Preferred over buildCurriculumContextBlock when Firestore curriculum_knowledge
// collection is populated. Falls back to static keyword search if no chunks found.
async function buildCurriculumContextBlockRag(query: string, gradeHint?: string): Promise<string> {
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
let _aiInstance: any = null;
let cachedApiKey: string | undefined = undefined;

// The static site (math.mismath.net, Hostinger) has no backend of its own —
// these /api/* routes are served from a separate Vercel deployment, so
// relative paths won't resolve in production. VITE_API_BASE_URL points at
// that deployment; falls back to same-origin relative paths for local dev
// (where `npm run dev`'s Express server does serve /api/* itself).
function getApiBaseUrl(): string {
  const base = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  return base ? base.replace(/\/$/, '') : '';
}

function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

// Get Firebase ID token for authenticated API requests
async function getAuthToken(): Promise<string | null> {
  try {
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (e) {
    console.warn('Failed to get auth token:', e);
  }
  return null;
}

async function postJson(url: string, payload: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Add auth token for /api/ai/* routes
  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(url), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {})
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Proxy call failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

function createBrowserProxyClient() {
  return {
    models: {
      generateContent: (payload: any) => postJson('/api/ai/generate-content', payload),
      embedContent: (payload: any) => postJson('/api/ai/embed-content', payload),
    },
    chats: {
      create: async (payload: any) => {
        const { chatId } = await postJson('/api/ai/chats/create', payload);
        return {
          sendMessage: (messagePayload: any) =>
            postJson(`/api/ai/chats/${encodeURIComponent(chatId)}/send-message`, messagePayload)
        };
      }
    }
  };
}

try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  cachedApiKey = process.env.GEMINI_API_KEY ?? import.meta.env?.VITE_GEMINI_API_KEY;
} catch (e) {}

const initAiPromise = (async () => {
  if (!cachedApiKey || cachedApiKey === "undefined") {
    try {
      const hasHttpOrigin =
        typeof window !== 'undefined' &&
        typeof window.location?.origin === 'string' &&
        /^https?:\/\//i.test(window.location.origin);
      const isTestRuntime = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

      if (hasHttpOrigin && !isTestRuntime) {
        const configUrl = new URL(`/api/config?_cb=${Date.now()}`, window.location.origin).toString();
        const res = await fetch(configUrl);
        if (res.ok) {
          const text = await res.text();
          if (!text.startsWith('<')) {
            const data = JSON.parse(text);
            cachedApiKey = data.apiKey;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch API key from server", e);
    }
  }

  if (cachedApiKey && cachedApiKey !== "undefined") {
    _aiInstance = new GoogleGenAI({ apiKey: cachedApiKey });
    return;
  }

  if (typeof window !== 'undefined') {
    _aiInstance = createBrowserProxyClient();
    return;
  }

  _aiInstance = new GoogleGenAI({ apiKey: "missing_key" });
})();

export const ai: any = new Proxy({}, {
  get(target, prop) {
    if (prop === 'models' || prop === 'chats') {
      return new Proxy({}, {
        get(mTarget, mProp) {
          return async (...args: any[]) => {
            await initAiPromise;
            return _aiInstance[prop][mProp].apply(_aiInstance[prop], args);
          };
        }
      });
    }
    return async (...args: any[]) => {
      await initAiPromise;
      if (typeof _aiInstance[prop] === 'function') {
        return _aiInstance[prop].apply(_aiInstance, args);
      }
      return _aiInstance[prop];
    };
  }
});

function handleGeminiError(error: any): never {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("Надминат е лимитот кон серверите на Gemini AI (Quota/Rate Limit Exceeded). Обидете се повторно за неколку минути или изберете го побрзиот модел 'Gemini 3 Flash' од напредните опции.");
  }
  throw new Error(msg);
}

export async function generateTaskEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: text
    });
    
    if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
      return response.embeddings[0].values;
    }
    
    // In @google/genai, embedding output format depends on the wrapper version. Try alternate path:
    if (response.embedding && response.embedding.values) {
       return response.embedding.values;
    }

    throw new Error("Неуспешно генерирање на embedding.");
  } catch (error) {
    console.error("Embedding Error:", error);
    throw error;
  }
}

const MATH_PLOT_INSTRUCTION = `
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

const ALGEBRA_TILES_INSTRUCTION = `
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

const JSXGRAPH_INSTRUCTION = `
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

function parseGeminiResponse(text: string) {
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

export interface GenerationOrchestrationOptions {
  strategy?: PromptStrategy;
  retrievalTasks?: MathTask[];
}

async function buildGenerationRagContext(query: string, retrievalTasks?: MathTask[]): Promise<string> {
  if (!retrievalTasks || retrievalTasks.length === 0) {
    return 'RAG КОНТЕКСТ: Нема релевантни задачи од библиотеката за ова барање.';
  }

  const rag = await buildRagContextFromLibrary({
    query,
    tasks: retrievalTasks,
    embedQuery: generateTaskEmbedding,
    maxItems: 4,
    similarityThreshold: 0.33
  });

  return `${buildRagTaskContext(rag.selectedTasks)}\nРЕЖИМ НА RETRIEVAL: ${rag.retrievalMode}`;
}

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
      model: "gemini-3.1-pro-preview",
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash-preview-tts",
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

export async function generateInterventionTasks(
  topic: string,
  struggleDetails: string,
  options: GenerationOrchestrationOptions = {}
): Promise<MathTask[]> {
  const ragContext = await buildGenerationRagContext(`${topic}\n${struggleDetails}`, options.retrievalTasks);
  const prompt = buildPromptEnvelope({
    role: 'Ти си Експерт Креатор на Педагошки Материјали.',
    mission: 'Генерирај интервентен сет што го враќа ученикот кон базичните концепти со scaffolded задачи.',
    strategy: options.strategy ?? 'sos',
    ragContext,
    userInput: `ТЕМА: ${topic}\nДЕТАЛИ ЗА ПОТЕШКОТИЈА: ${struggleDetails}`,
    hardRules: [
      'Врати точно 3 задачи.',
      'Сите задачи мора да бидат easy и DoK 1 или 2.',
      `Полето curriculum_topic нека биде "${topic} - Основни Концепти".`,
      'Додај најмалку 2 hints по задача со Сократски стил.',
      'Врати исклучиво валиден JSON без markdown блокови.'
    ],
    outputContract: `{
  "tasks": [
    {
      "title": "string",
      "original_text": "string",
      "type": "task",
      "difficulty": "easy",
      "dok_level": 1,
      "curriculum_topic": "string",
      "tags": ["string"],
      "solution_steps": ["string"],
      "latex_formulas": ["string"],
      "hints": ["string"],
      "source_url": "intervention_generator"
    }
  ]
}`
  });

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.text;
    if (!responseText) throw new Error("No response from AI");
    
    // Clean potential markdown blocks
    const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);
    return data.tasks || [];
  } catch (error) {
    console.error("Грешка при генерирање интервенција:", error);
    throw error;
  }
}

export async function getTutorChatSession(task: MathTask, relatedTasks?: MathTask[]) {
    let ragContext = "";
    if (relatedTasks && relatedTasks.length > 0) {
      ragContext = `
      ПОВРЗАНИ ЗАДАЧИ ОД БИБЛИОТЕКАТА (RAG КОНТЕКСТ):
      Ученикот во системот ги има следните слични задачи со решенија. Можеш индиректно да се повикаш на "задачата која ја имаш во библиотеката..." за да му дадеш помош како аналогија, но ако тоа има смисла:
      ${relatedTasks.map(t => `- Наслов: ${t.title}, Концепт: ${t.curriculum_topic || 'Математика'}, Дел од текст: ${t.original_text.substring(0, 100)}...`).join('\n')}
      `;
    }

    const systemInstruction = `Ти си Врвен Светски AI Тутор по математика (MathDigitizer Pro Tutor), специјалист за ZPD (Зона на проксимален развој) и Сократов дијалог. Твојата мисија е да го водиш ученикот до длабоко разбирање на концептот без никогаш да му го дадеш решението на готово.
    
    КОНТЕКСТ НА ЗАДАЧАТА:
    Наслов: ${task.title}
    Тема: ${task.curriculum_topic}
    Ниво (DoK): ${task.dok_level}
    Текст: ${task.original_text}
    Решение (за твоја референца, НИКОГАШ не го покажувај директно): ${task.solution_steps.join('\n')}
    ${ragContext}
    
    ТВОЈАТА СТРАТЕГИЈА (АПСОЛУТНИ СТРОГИ ПРАВИЛА):
    1. **АПСОЛУТНО НИКОГАШ не го давај крајниот одговор или директното решение**: Ова е најважното правило. Дури и ако ученикот те моли, плаче, или вели дека се откажува, ТИ НЕ СМЕЕШ да го напишеш решението. Твојот одговор мора да биде: „Јас сум тука да ти помогнам ти самиот да го откриеш одговорот. Ајде да се вратиме еден чекор назад...“
    2. **Дијагностика и Скелиња (Scaffolding)**: Прво прашај го ученикот што разбира од задачата. Потоа, раскрши ја задачата на микро-чекори. Поставувај САМО ПО ЕДНО прашање во исто време. Пронајди ја границата помеѓу она што ученикот го знае и она што не го знае (његовата Зона на проксимален развој - ZPD).
    3. **Анализа на грешки преку Сократов Дијалог (Productive Failure)**: Ако ученикот згреши, СТРОГО Е ЗАБРАНЕТО да кажеш "Грешка" или "Ова е неточно" и да го дадеш точниот чекор. Наместо тоа, искористи ја грешката како можност. На пр. ако добие негативен корен: "Гледам дека доби негативен корен. Што знаеме за квадратот на кој било реален број?". Натерај го самиот да ја увиди контрадикцијата!
    4. **Визуелизација и Аналогии**: Користи аналогии од реалниот живот за да објасниш апстрактни концепти (пр. равенките се како вага, дропките се како сечење пица). ${MATH_PLOT_INSTRUCTION} ${ALGEBRA_TILES_INSTRUCTION} ${JSXGRAPH_INSTRUCTION}
    5. **Позитивно засилување**: Силно пофалувај го секој точен чекор и самостоен заклучок. Гради ја самодовербата на ученикот.
    6. **LaTeX Форматирање**: Задолжително користи LaTeX за секој математички израз ($...$ за inline, $$...$$ за блок).
    
    ЗАПАМЕТИ: Твојата единствена цел е ученикот да доживее "Аха!" момент и сам да го изговори решението. Ти си водич, а не калкулатор.
    
    ЈАЗИК: Професионален, но топол и охрабрувачки македонски јазик.`;

  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.2, // Very low temperature to strictly adhere to the Socratic rules
    }
  });

  return chat;
}

export async function generateLessonArchitectScript(task: MathTask, language: string = 'mk'): Promise<import("./schema").LessonArchitectScript> {
  const languageInstruction = language === 'mk'
    ? 'Одговори на македонски јазик.'
    : `Respond in ${language}.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Ти си експерт за методика на настава по математика. За следнава задача, состави краток методолошки скрипт за час:

Наслов: ${task.title}
Тема: ${task.curriculum_topic || 'Математика'}
Текст: ${task.original_text}
Чести грешки: ${(task.pedagogical_insights?.common_pitfalls || []).join(', ') || 'Непознато'}

Врати:
1. socratic_hook — едно отворено прашање/провокација (конкретно за оваа задача, НЕ генеричко) со кое наставникот го отвора часот.
2. metaphoric_bridge — една аналогија од реалниот живот што го поврзува апстрактниот концепт од задачата со нешто познато.
3. instructional_sequence — низа од 3 чекори (секој со "time" опсег во минути, "title" и краток "desc") за тоа како да се води часот од воведување до совладување на концептот.

${languageInstruction}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          socratic_hook: { type: Type.STRING },
          metaphoric_bridge: { type: Type.STRING },
          instructional_sequence: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                title: { type: Type.STRING },
                desc: { type: Type.STRING }
              },
              required: ['time', 'title', 'desc']
            }
          }
        },
        required: ['socratic_hook', 'metaphoric_bridge', 'instructional_sequence']
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

const SOCRATIC_SIM_PERSONAS: Record<string, string> = {
  struggling_abstraction: 'Се бориш со апстракција — броевите и променливите ти имаат смисла посебно, но не разбираш зошто истата буква ("x") се повторува на повеќе места во иста равенка. Прашуваш "наивни" но искрени прашања за да разбереш зошто чекорите функционираат, не само како да ги извршиш.',
  quick_careless: 'Брз си и самоуверен, но невнимателен — прескокнуваш чекори, ги мешаш знаците (+ / -) и ги заборавaш условите (пр. домен на дефинираност). Кога наставникот ќе те праша да провериш, првично одбиваш велејќи "сигурен сум", но ако те насочи со прашање, ја наоѓаш сопствената грешка.',
  math_anxious: 'Имаш математичка анксиозност — брзо кажуваш "не ми оди математиката" или "јас никогаш нема да го разберам ова" пред воопшто да пробаш. Треба нежно охрабрување и мали чекори за да се впуштиш во задачата.',
};

export async function getSocraticSimulationSession(task: MathTask, persona: string, language: string = 'mk') {
  const personaDescription = SOCRATIC_SIM_PERSONAS[persona] || SOCRATIC_SIM_PERSONAS.struggling_abstraction;
  const languageInstruction = language === 'mk' ? 'македонски јазик' : language;

  const systemInstruction = `Ти симулираш ученик кој вежба со наставник (кој те тренира преку Сократов дијалог). НЕ си асистент — ти си ученик. Твојата улога е да останеш во карактер during целиот разговор.

ЗАДАЧА КОЈА ЈА РЕШАВАШ:
Наслов: ${task.title}
Текст: ${task.original_text}
Решение (само за твоја референца — НЕ смееш само да го кажеш, мора да „стигнеш“ до него преку разговорот со наставникот): ${task.solution_steps.join(' ')}

ТВОЈАТА ПЕРСОНА: ${personaDescription}

ПРАВИЛА:
1. Секогаш одговарај ВО КАРАКТЕР, како ученик, никогаш како AI асистент.
2. Никогаш сам не го реши целото прашање одеднаш — реагирај чекор по чекор на она што наставникот го кажува.
3. Ако наставникот ти постави добро насочувачко прашање, покажи реален напредок во разбирањето (мал "Аха!" момент), но не премногу брзо — реалистичен ученик напредува постепено.
4. Ако наставникот директно ти го даде одговорот наместо да те праша, реагирај реалистично на пример: збунето прифати го одговорот без вистинско разбирање, или прашај "зошто", покажувајќи дека сепак не разбираш ("Ок... ама не сфаќам зошто.").
5. Користи LaTeX ($...$) кога споменуваш математички изрази.
6. Јазик: ${languageInstruction}.

Отвори го разговорот со ЕДНО кратко прашање/забуна за задачата (не поздрав, право на суштината), консистентно со твојата персона.`;

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction,
      temperature: 0.8,
    }
  });

  return chat;
}

export async function generateDifferentiatedTest(tasks: MathTask[]): Promise<{groupA: MathTask[], groupB: MathTask[], groupC: MathTask[]}> {
  const prompt = `Ти си експерт за диференцирана настава по математика. 
Дадена ти е листа на оригинални математички задачи. Твојата цел е да креираш 3 различни верзии (групи) од овие задачи:
- Група А (Основни): Полесни вредности, подиректни прашања, наменети за ученици на кои им треба повеќе поддршка.
- Група Б (Стандардни): Слични на оригиналните задачи, стандардно ниво.
- Група В (Напредни): Покомплексни вредности, бараат подлабоко критичко размислување, наменети за напредни ученици.

ОРИГИНАЛНИ ЗАДАЧИ:
${JSON.stringify(tasks.map(t => ({ title: t.title, text: t.original_text, topic: t.curriculum_topic })), null, 2)}

Врати СТРОГО JSON објект со следната структура:
{
  "groupA": [ { "title": "...", "original_text": "...", "difficulty": "easy", "solution_steps": ["..."] } ],
  "groupB": [ { "title": "...", "original_text": "...", "difficulty": "medium", "solution_steps": ["..."] } ],
  "groupC": [ { "title": "...", "original_text": "...", "difficulty": "hard", "solution_steps": ["..."] } ]
}

ЗАДОЛЖИТЕЛНО користи LaTeX форматирање за сите математички изрази ($...$ и $$...$$). Користи македонски јазик.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            groupA: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, original_text: { type: Type.STRING }, difficulty: { type: Type.STRING }, solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
            groupB: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, original_text: { type: Type.STRING }, difficulty: { type: Type.STRING }, solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
            groupC: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, original_text: { type: Type.STRING }, difficulty: { type: Type.STRING }, solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } } } } }
          },
          required: ["groupA", "groupB", "groupC"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Грешка при генерирање диференциран тест:", error);
    throw error;
  }
}

export async function generateSimilarTask(originalTask: MathTask, style: 'traditional' | 'real-world' | 'modern' = 'traditional'): Promise<MathTask> {
  const stylePrompt =
    style === 'modern' ? 'Користи модерен Gen-Z контекст (гејминг, социјални мрежи, криптовалути).' :
    style === 'real-world' ? 'Користи контекст од реалниот свет и секојдневниот живот (бизнис, готвење, патување).' :
    'Користи традиционален, академски наставен контекст.';

  const curriculumQuery = [
    originalTask.curriculum_topic,
    originalTask.grade_level,
    ...(originalTask.tags ?? []),
  ].filter(Boolean).join(' ');
  const curriculumCtx = await buildCurriculumContextBlockRag(curriculumQuery, originalTask.grade_level);

  const prompt = `Врз основа на следната математичка задача, генерирај НОВА, СЛИЧНА задача која ги тестира истите концепти но со различни вредности или малку поинаков контекст.
${curriculumCtx ? `\n${curriculumCtx}\n` : ''}
СТИЛ: ${stylePrompt}

ОРИГИНАЛНА ЗАДАЧА:
${originalTask.original_text}

ПРАВИЛА:
1. Задачата мора да биде на истото ниво на тежина (${originalTask.difficulty}) и DoK ниво (${originalTask.dok_level}).
2. Задачата МОРА да биде усогласена со официјалните исходи на БРО наведени погоре.
3. Користи македонски јазик.
4. Врати го резултатот СТРОГО како еден JSON објект кој ја следи истата структура како оригиналот.
5. Осигурај се дека решението е математички точно.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            title: { type: Type.STRING },
            original_text: { type: Type.STRING },
            solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
            illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' }, math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            difficulty: { type: Type.STRING },
            dok_level: { type: Type.NUMBER },
            grade_level: { type: Type.STRING },
            curriculum_topic: { type: Type.STRING }
          },
          required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return { ...parseGeminiResponse(response.text), source_url: "Генерирана варијација" };
  } catch (error) {
    console.error("Грешка при генерирање слична задача:", error);
    throw error;
  }
}

export async function enrichTaskPedagogy(task: MathTask, model: string = "gemini-3.1-pro-preview", outputLanguageOverride?: string): Promise<any> {
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

export async function extractMathTasksFromPdf(base64Pdf: string, targetLanguage: string = 'auto', enableLogicalReconstruction: boolean = true, modelName: string = 'gemini-3.1-pro-preview'): Promise<MathTask[]> {
  const prompt = `Ти си експерт за дигитализација на математички текстови, креатор на "Advanced Vision OCR" и Едукативен Технолог (EdTech).
Анализирај го приложениот документ кој може да биде скан од стар учебник, испит, документ со графици или документ со комплексен табеларен распоред.

СТРАТЕГИЈА ЗА "ADVANCED VISION OCR":
${enableLogicalReconstruction 
  ? `1. **Напредно Препознавање и Логичка Реконструкција (ВКЛУЧЕНО)**: Доколку наидеш на оштетен, нејасен текст, табели или комплексен распоред во скениран учебник, направи дедукција и логичка реконструкција врз основа на математичкиот контекст.`
  : `1. **Класично Препознавање OCR (Без Реконструкција)**: Препиши го точно тоа што е на документот.`}
2. **Јазични Поставки (Мултијазичност)**: 
   - НАЈПРВО АВТОМАТСКИ ПРЕПОЗНАЈ ГО ЈАЗИКОТ на изворниот документ и запиши ја кратенката ('mk', 'en', 'ru', 'tr') во \`detected_language\`.
   - ${targetLanguage === 'auto' ? `Бидејќи крајниот јазик е 'auto', целиот излез задржи го на тој препознаен јазик.` : `ВНИМАНИЕ: Без разлика на кој јазик е изворниот текст, ТИ МОРАШ ДА ГО ПРЕВЕДЕШ целиот математички текст СТРОГО на **${targetLanguage === 'mk' ? 'Македонски (СТРОГО МАКЕДОНСКА КИРИЛИЦА)' : targetLanguage === 'en' ? 'Англиски' : targetLanguage === 'ru' ? 'Руски' : 'Турски'} јазик**.`}
3. **ZERO-ERROR LaTeX**: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ! Користи $...$ за inline и $$...$$ за математика во нов ред.
4. **Комплексни Распореди и Табели**: Ако задачата содржи табела, конвертирај ја табелата во Markdown.
5. **Геометрија и Графици**: Ако документот содржи график или геометриска слика, генерирај \`geogebra_commands\` низа од команди.
6. **Педагошко подобрување и Chain-of-Thought**: За секоја извлечена задача, генерирај детално, скалилесто решение во \`solution_steps\`. Решението МОРА да содржи обрамотување на теоретската основа и педагошко појаснување (зошто се користи овој чекор) според најстрогите педагошки стандарди.

Твојата цел е ПЕРФЕКТНО да ги извлечеш сите математички задачи.
За секоја задача, врати:
- type: "task" (задача) или "theory" (теорија)
- detected_language: Кратенка од детектираниот јазик (mk, en, tr...)
- title: Краток наслов
- original_text: Целосниот текст со LaTeX ($...$ и $$...$$) и Markdown Табели.
- solution_steps: Решение чекор-по-чекор (LaTeX).
- latex_formulas: Клучни формули.
- illustration_prompt: Промпт за визуелизација на англиски (за реални објекти/пејзажи).
- geogebra_commands: Низа од стрингови со точни команди (доколку има математички графици или геометрија).
- tags, difficulty, dok_level, grade_level, curriculum_topic.

Осигурај се дека LaTeX кодот е валиден и табелите се читливо презентирани во original_text.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        { text: prompt },
        { inlineData: { data: base64Pdf, mimeType: "application/pdf" } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["task", "theory"] },
              detected_language: { type: Type.STRING, description: "Auto-detected language code: mk, en, tr, al, etc." },
              title: { type: Type.STRING },
              original_text: { type: Type.STRING },
              solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' }, math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
              dok_level: { type: Type.NUMBER, description: "Depth of Knowledge (1-4)" },
              bloom_taxonomy: { type: Type.STRING, enum: ["Помнење", "Разбирање", "Примена", "Анализа", "Евалуација", "Креирање"], description: "Bloom's Taxonomy classification (Macedonian terms)" },
              grade_level: { type: Type.STRING },
              curriculum_topic: { type: Type.STRING }
            },
            required: ["type", "detected_language", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "bloom_taxonomy", "grade_level", "curriculum_topic"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const parsedTasks = parseGeminiResponse(response.text);
    return parsedTasks.map((task: any) => ({ ...task, source_url: "PDF Документ" }));
  } catch (error) {
    console.error("Грешка при екстракција од PDF:", error);
    handleGeminiError(error);
  }
}

export async function generateDifferentiatedTasks(originalTask: MathTask, style: 'traditional' | 'real-world' | 'modern' = 'traditional'): Promise<{ easy: MathTask, hard: MathTask }> {
  const stylePrompt = 
    style === 'modern' ? 'Користи модерен Gen-Z контекст.' :
    style === 'real-world' ? 'Користи контекст од реалниот свет.' :
    'Користи традиционален контекст.';

  const prompt = `Врз основа на следната математичка задача, генерирај ДВЕ нови задачи за диференцирана настава: една ПОЛЕСНА (за ученици на кои им треба поддршка) и една ПОТЕШКА (за напредни ученици).

СТИЛ: ${stylePrompt}

ОРИГИНАЛНА ЗАДАЧА:
${originalTask.original_text}
Тежина: ${originalTask.difficulty}
Тема: ${originalTask.curriculum_topic}

ПРАВИЛА ЗА ПОЛЕСНАТА ЗАДАЧА:
1. Намали ја когнитивната сложеност (пониско DoK ниво).
2. Користи поедноставни броеви.
3. Разложи го проблемот на поексплицитни чекори ако е потребно.

ПРАВИЛА ЗА ПОТЕШКАТА ЗАДАЧА:
1. Зголеми ја когнитивната сложеност (повисоко DoK ниво).
2. Додај дополнителен чекор, апстракција или примена во реален контекст.

Врати го резултатот како JSON објект со две својства: "easy" и "hard", каде секое е целосен објект на задача кој ја следи истата структура како оригиналот.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            easy: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["задача", "теорија"] },
                title: { type: Type.STRING },
                original_text: { type: Type.STRING },
                solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' }, math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                difficulty: { type: Type.STRING, enum: ["лесно", "средно", "тешко"] },
                dok_level: { type: Type.NUMBER },
                grade_level: { type: Type.STRING },
                curriculum_topic: { type: Type.STRING },
                pedagogical_insights: {
                  type: Type.OBJECT,
                  properties: {
                    common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
                    socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    modeling_scenario: { type: Type.STRING }
                  },
                  required: ["common_pitfalls", "socratic_questions", "modeling_scenario"]
                }
              },
              required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "pedagogical_insights"]
            },
            hard: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["задача", "теорија"] },
                title: { type: Type.STRING },
                original_text: { type: Type.STRING },
                solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' }, math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                difficulty: { type: Type.STRING, enum: ["лесно", "средно", "тешко"] },
                dok_level: { type: Type.NUMBER },
                grade_level: { type: Type.STRING },
                curriculum_topic: { type: Type.STRING },
                pedagogical_insights: {
                  type: Type.OBJECT,
                  properties: {
                    common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
                    socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    modeling_scenario: { type: Type.STRING }
                  },
                  required: ["common_pitfalls", "socratic_questions", "modeling_scenario"]
                }
              },
              required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "pedagogical_insights"]
            }
          },
          required: ["easy", "hard"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const result = parseGeminiResponse(response.text);
    return {
      easy: { ...result.easy, source_url: "Генерирана варијација (Лесна)" },
      hard: { ...result.hard, source_url: "Генерирана варијација (Тешка)" }
    };
  } catch (error) {
    console.error("Error generating differentiated tasks:", error);
    throw error;
  }
}

export type MaterialType = 'worksheet' | 'test' | 'collection' | 'quiz' | 'presentation' | 'flashcards' | 'homework' | 'study_guide';

export async function generateLessonPlan(tasks: MathTask[], gradeLevel: string, topicName: string) {
  const prompt = `Ти си Експерт Методичар за математика според стандардите на БРО (Биро за развој на образованието) во Македонија.
Корисникот сака да генерира формална "Дневна подготовка за час" базирана на овие избрани задачи:

ЗАДАЧИ ЗА ЧАСОТ:
${JSON.stringify(tasks.map(t => ({ title: t.title, text: t.original_text, tags: t.tags })), null, 2)}

ОДДЕЛЕНИЕ: ${gradeLevel}
ТЕМА: ${topicName}

Генерирај детална дневна подготовка која содржи:
1. Запознавање (Цели на часот, Очекувани исходи)
2. Тек на часот:
   - Воведен дел (5-10 мин) - како да се мотивираат учениците и да се поврзе со претходното знаење.
   - Главен дел (25-30 мин) - каде се решаваат дадените задачи, како се најавуваат, интеракција со ученици.
   - Завршен дел (5-10 мин) - сумирање, домашна работа.
3. Формативно оценување: Инструменти и прашања за проверка на разбирањето.

Врати го одговорот ВО СТРОГО JSON ФОРМАТ. 
Користи македонски јазик, стручна терминологија и беспрекорен LaTeX за формулите.

СТРУКТУРА НА ОДГОВОРОТ (JSON):
{
  "topic": "${topicName}",
  "grade": "${gradeLevel}",
  "objectives": ["Цел 1...", "Цел 2..."],
  "outcomes": ["Исход 1...", "Исход 2..."],
  "intro": "Текст за воведен дел...",
  "main": "Текст за главен дел...",
  "outro": "Текст за завршен дел...",
  "assessment": "Текст за формативно оценување..."
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    throw error;
  }
}

export async function generateEducationalMaterial(tasks: MathTask[], type: MaterialType, targetGrade: string = 'Непознато', targetLanguage: string = 'mk'): Promise<any> {
  const typePrompts: Record<MaterialType, string> = {
    'worksheet': 'Креирај структуриран работен лист со простор за работа. Вклучи кратки насоки.',
    'test': 'Креирај тест со бодови за секоја задача, две верзии (Група А и Б) и клуч со решенија за наставникот.',
    'collection': 'Креирај збирка задачи организирана по тежина (Лесни, Средни, Тешки). Додај вовед за секоја тежина.',
    'quiz': 'Претвори ги задачите во прашања со повеќекратен избор (Multiple Choice) со по 4 опции, од кои само една е точна.',
    'presentation': 'Креирај структура за презентација (слајдови). Секој слајд треба да има наслов, клучна теорија, пример и задача за решавање.',
    'flashcards': 'Креирај флешкарти. На предната страна стави го прашањето или концептот, а на задната кратко решение или дефиниција.',
    'homework': 'Креирај домашна работа која вклучува скалилести помоши (hints) за секоја задача.',
    'study_guide': 'Креирај водич за учење кој ги сумира сите формули од задачите, содржи објаснети примери и стратегии за решавање.'
  };

  const prompt = `Ти си Врвен Педагошки Дизајнер и креатор на "Educational Material Factory". 
  Твојата цел е да ги трансформираш дадените математички задачи во висококвалитетен едукативен материјал од типот: ${type}.
  
  ЦЕЛНА ГРУПА (ОДДЕЛЕНИЕ / ГОДИНА): ${targetGrade}
  
  ИНСТРУКЦИЈА ЗА ТИПОТ: ${typePrompts[type]}
  
  ЗАДАЧИ ЗА ТРАНСФОРМАЦИЈА:
  ${JSON.stringify(tasks.map(t => ({ title: t.title, text: t.original_text, topic: t.curriculum_topic, difficulty: t.difficulty, grade: t.grade_level })), null, 2)}
  
  ПРАВИЛА:
  1. Користи ${targetLanguage === 'mk' ? 'Македонски (СТРОГО МАКЕДОНСКА КИРИЛИЦА)' : targetLanguage === 'en' ? 'Англиски' : targetLanguage === 'ru' ? 'Руски' : 'Турски'} јазик за сите наслови, инструкции и објаснувања. Мораш стручно да го адаптираш тонот според одделението (${targetGrade}).
  2. ZERO-ERROR LaTeX: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ, РАВЕНКИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ. Користи $...$ за inline математика (пр. Нека е $x=5$) и $$...$$ за математика во нов ред. ОВА Е НАЈСТРОГОТО ПРАВИЛО!
  3. Тагирај ги задачите во материјалот по тежина и одделение каде што е соодветно (пр. "[Лесна, VIII Одделение]").
  4. Врати СТРОГО JSON објект со соодветна структура за овој тип на материјал.
  
  СТРУКТУРА НА ОДГОВОРОТ:
  За 'quiz': { "questions": [ { "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 } ] }
  За 'flashcards': { "cards": [ { "front": "...", "back": "..." } ] }
  За 'presentation': { "slides": [ { "title": "...", "content": "...", "type": "theory|example|task" } ] }
  За останатите: { "title": "...", "sections": [ { "heading": "...", "content": "..." } ], "answerKey": "..." }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error(`Error generating ${type}:`, error);
    handleGeminiError(error);
  }
}

export async function autoGradeSubmission(
  question: any,
  studentAnswer: any
): Promise<{ score: number, feedback: string, socratic_hint?: string, error_detected?: string }> {
  try {
    const prompt = `Ти си Стручен Оценувач и Интерактивен Сократски Ментор по математика. 
За дадената задача и одговорот на ученикот, треба да пресметаш поени и да дадеш фидбек.
Ако одговорот не е целосно точен, ТИ НЕ СМЕЕШ ДА ГО ДАДЕШ ГОТОВИОТ ОДГОВОР. 
Наместо тоа, детектирај каде точно ученикот згрешил во чекорите (error_detected) и дај му Сократски хинт (socratic_hint) за да се поправи сам. 

ПОДАТОЦИ:
ЗАДАЧА: ${JSON.stringify(question, null, 2)}
УЧЕНИК ОДГОВАРА: ${JSON.stringify(studentAnswer)}
МАКСИМАЛНИ ПОЕНИ: ${question.points || 100}

ПРАВИЛА:
1. ДОДЕЛУВАЈ ПАРЦИЈАЛНИ ПОЕНИ: Ако има точни делови од постапката, дај му соодветен број поени (пр. 50/100).
2. ДЕТЕКТИРАЈ ГРЕШКА: Ако згрешил, објасни прецизно каде е грешката (пр. "Заборави да го промениш знакот при префрлање од другата страна").
3. СОКРАТСКИ ХИНТ: Постави прашање што ќе го наведе сам да ја најде грешката.
4. Ако одговорот е целосно точен (100 поени), пофали го и не мораш да даваш socratic_hint.
5. Врати СТРОГО JSON формат: 
{ 
  "score": <број>, 
  "feedback": "<охрабрувачки осврт на трудот, македонски>", 
  "error_detected": "<опционално, специфичната грешка>", 
  "socratic_hint": "<опционално, прашање за насочување>"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Auto grading error:", error);
    return { score: 0, feedback: "Грешка при автоматското оценување. Потребен е рачен преглед." };
  }
}

function formatTimeFromMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function advancedMultimodalExtraction(
  source: { type: 'url' | 'file' | 'text'; data: string; mimeType?: string },
  model: string = "gemini-3.1-pro-preview",
  customInstructions: string = ""
): Promise<MathTask[]> {
  const prompt = `Ти си "Extraction Architect" од светска класа и експерт за Мултијазичен OCR. Твојата мисија е ПЕРФЕКТНО извлекување на математички содржини (задачи и теорија) од дадениот извор.
  
СТРАТЕГИЈА ЗА МАКСИМАЛНА ПРЕЦИЗНОСТ И АВТОМАТСКО ПРЕПОЗНАВАЊЕ НА ЈАЗИК (Chain-of-Thought):
1. **Автоматска Детекција на Јазик**: Изворот најчесто ќе биде на: Македонски, Руски, Турски или Англиски. АВТОМАТСКИ ПРЕПОЗНАЈ ГО ЈАЗИКОТ пред да почнеш со екстракција. Запиши го кодот на јазикот ('mk', 'ru', 'tr', 'en') во \`detected_language\`.
2. **Автентична Екстракција**: ЗАДРЖИ ГО ПРЕПОЗНАЕНИОТ ЈАЗИК во целост. Важно е математичкиот контекст да остане апсолутно точен.
3. **Теорија вс. Задачи**: Прво направи идентификација дали изворот содржи теоретски вовед, дефиниции или формули.
4. **Стандарди**: Доколку извлекуваш или преведуваш на македонски, користи ДЕЦИМАЛНА ЗАПИРКА (на пр. 3,14) и соодветна терминологија.
5. **ZERO-ERROR LaTeX**: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ, РАВЕНКИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ ВО original_text И ВО solution_steps! Користи $...$ за inline математика (пр. Нека е $x=5$) и $$...$$ за математика во нов ред. ОВА Е НАЈСТРОГОТО ПРАВИЛО!
6. **Напредно OCR и Ракопис**: Доколку документот е слика или PDF со РАКОПИС, потруди се да ги разбереш сите прешкртани зборови и лошо напишани променливи. ДОКОЛКУ ИМА ТАБЕЛА или СЛОЖЕН РАСПОРЕД (complex layout), реконструирај ги податоците од табелата во Markdown формат или јасно објасни ја нивната поврзаност во наративот.
7. **Визуелна Реконструкција**: ВНИМАТЕЛНО РАЗЛИКУВАЈ! Ако задачата бара математички график, функција или геометриска слика, остави го \`illustration_prompt\` празно, и генерирај \`geogebra_commands\` каде што секоја команда ќе биде валидна GeoGebra команда (пр. "A = (2, 3)", "f(x) = x^2", "Polygon(A, B, C)"). Доколку е реален објект, пополни \`illustration_prompt\`.
8. **Време на видео (Timestamps)**: Доколку изворот е видео или транскрипт од видео според кој можеш да лоцираш време, или доколку се работи за повеќе-страничен документ, запиши го во \`source_timestamp\`.
9. **Custom Instructions**: ${customInstructions || 'Нема специфични насоки.'}

Врати JSON објект кој го анализира процесот и ги структурира податоците.`;

  try {
    let finalPayloadContext = prompt;
    
    // Ако е URL, користиме двостепен пристап како кај extractMathTasksFromUrl
    if (source.type === 'url') {
      const searchPrompt = `Ти си истражувач. Најди го деталниот транскрипт или главната содржина за следното YouTube видео / веб страна: ${source.data}. 
Извлечи ги сите математички задачи и објаснувања во нивниот ОРИГИНАЛЕН јазик. Не преведувај. Користи Google Search. Врати детален извештај.`;
      
      let urlContext = "";

      if (!urlContext) {
         const isYoutube = source.data.includes('youtube.com') || source.data.includes('youtu.be');
         const isVimeo = source.data.includes('vimeo.com');
         if (!isVimeo) {
           try {
             const apiEndpoint = apiUrl(isYoutube ? `/api/youtube/transcript?url=${encodeURIComponent(source.data)}` : `/api/scrape?url=${encodeURIComponent(source.data)}`);
             const res = await fetch(apiEndpoint);
             if (res.ok) {
               const text = await res.text();
               if (!text.startsWith('<')) {
                 const data = JSON.parse(text);
                 if (data.fragments && data.fragments.length > 0) {
                   urlContext = data.fragments.map((f: any) => `[${formatTimeFromMs(f.offset)}] ${f.text}`).join("\n");
                 } else if (data.transcript) {
                   urlContext = data.transcript;
                 } else if (data.content) {
                   urlContext = data.title + "\n\n" + data.content;
                 }
               }
             }
           } catch (e) {
             console.warn("Локалниот API Scraper не успеа во слободен режим.");
           }
         }
      }

      if (!urlContext) {
        try {
          const searchResponse = await ai.models.generateContent({
            model: model, // Use the user-selected model (e.g. Flash) instead of hardcoding PRO
            contents: searchPrompt,
            config: { tools: [{ googleSearch: {} }] }
          });
          urlContext = searchResponse.text || "Нема податоци.";
        } catch (err) {
          console.warn("Google Search failed for advanced mode:", err);
          urlContext = "Нема податоци (серверска грешка).";
        }
      }
      finalPayloadContext = `${prompt}\n\n================\nКОНТЕКСТ ОД ИЗВОРОТ (URL: ${source.data}):\n${urlContext}\n================`;
    }

    const contents: any[] = [{ text: finalPayloadContext }];
    
    if (source.type === 'file' && source.mimeType) {
      contents.push({ inlineData: { data: source.data, mimeType: source.mimeType } });
    } else if (source.type === 'text') {
      contents.push({ text: `ТЕКСТУАЛНА СОДРЖИНА: ${source.data}` });
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notebook_briefing: { type: Type.STRING, description: "Generate a NotebookLM-style comprehensive summary of the ENTIRE source first before extracting specific tasks. Map out the mental model, key concepts, and logical flow." },
            extraction_confidence: { type: Type.NUMBER, description: "1-100 indicating how clear the math problems are in the source text." },
            extracted_tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  evidence_quote: { type: Type.STRING, description: "ANTI-HALLUCINATION: Quote the exact sentence or math expression from the source where this task was found. If you cannot extract it, do not generate the task." },
                  source_timestamp: { type: Type.STRING, description: "Timestamp (e.g. 04:15) or Page number where this task occurs in the source media." },
                  type: { type: Type.STRING, enum: ["task", "theory"] },
                  detected_language: { type: Type.STRING, description: "Auto-detected language code: mk, en, tr, al, etc." },
                  title: { type: Type.STRING },
                  original_text: { type: Type.STRING },
                  solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' },
                  geogebra_commands: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'GeoGebra exact string commands to plot shapes or graphs (e.g. "f(x)=x^2", "A=(1,2)"). Leave empty if no graph needed.' },
                  math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                  dok_level: { type: Type.NUMBER, description: "Depth of Knowledge (1-4)" },
                  bloom_taxonomy: { type: Type.STRING, enum: ["Помнење", "Разбирање", "Примена", "Анализа", "Евалуација", "Креирање"], description: "Bloom's Taxonomy classification (Macedonian terms)" },
                  grade_level: { type: Type.STRING },
                  curriculum_topic: { type: Type.STRING }
                },
                required: ["evidence_quote", "type", "detected_language", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "bloom_taxonomy", "grade_level", "curriculum_topic"]
              }
            }
          },
          required: ["notebook_briefing", "extraction_confidence", "extracted_tasks"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const parsedObj = parseGeminiResponse(response.text);
    const results = parsedObj.extracted_tasks || [];
    return results.map((t: any) => ({ ...t, source_url: source.type === 'url' ? source.data : 'Прикачена датотека' }));
  } catch (error) {
    console.error("Грешка при напредна екстракција:", error);
    handleGeminiError(error);
  }
}

export async function generateCurriculumTasks(
  prompt: string,
  options: GenerationOrchestrationOptions = {}
): Promise<MathTask[]> {
  try {
    const ragContext = await buildGenerationRagContext(prompt, options.retrievalTasks);
    const orchestratedPrompt = buildPromptEnvelope({
      role: 'Ти си Експерт по Математика и Креатор на Наставни Материјали.',
      mission: 'Генерирај задачи строго усогласени со национални наставни програми (пр. БРО).',
      strategy: options.strategy ?? 'tot',
      ragContext,
      userInput: prompt,
      hardRules: [
        'Врати исклучиво JSON формат со клуч tasks.',
        'Секоја задача мора да има математички точни solution_steps.',
        'ZERO-ERROR LaTeX во original_text и solution_steps ($...$ и $$...$$).',
        'Избегнувај markdown блокови во одговорот.'
      ],
      outputContract: `{
  "tasks": [
    {
      "original_text": "string",
      "solution_steps": ["string"],
      "difficulty": "easy|medium|hard",
      "tags": ["string"],
      "hint": "string",
      "answer": "string"
    }
  ]
}`
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: orchestratedPrompt,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    if (!response.text) throw new Error("Нема одговор од AI.");
    let output = response.text;
    output = output.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let result;
    try {
      result = JSON.parse(output);
      return result.tasks || [];
    } catch (e) {
      console.error("Failed to parse curriculum tasks JSON:", output);
      return [];
    }
  } catch (error) {
    console.error("Error generating curriculum tasks:", error);
    return [];
  }
}


// Transcript-first pipeline: Gemini Flash reads the YouTube URL directly as a video file.
// This is cheaper than visual frame analysis and works for long videos because the model
// extracts audio/captions rather than sampling frames.
async function fetchYoutubeTranscriptViaGemini(
  url: string,
  timeRange?: { start: string; end: string }
): Promise<string> {
  const timeFilter =
    timeRange?.start || timeRange?.end
      ? `\nFocus ONLY on the segment from ${timeRange?.start ?? 'the start'} to ${timeRange?.end ?? 'the end'}.`
      : '';

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [
      { fileData: { fileUri: url } },
      {
        text: `Extract the COMPLETE verbatim transcript of this YouTube video with timestamps in [MM:SS] format before each spoken segment.${timeFilter}
Rules:
- PRESERVE the EXACT original spoken language of the video. If it is English → return English. Turkish → Turkish. Russian → Russian. Arabic → Arabic. Do NOT translate under any circumstances.
- Include ALL spoken words, including mathematical terms, formulas, and numbers exactly as spoken.
- Return ONLY the raw transcript text. No commentary, no headers, no JSON. Start directly with the first timestamp.`,
      },
    ],
  });

  const transcript = response.text?.trim() ?? '';
  if (transcript.length < 50) throw new Error('Empty or missing transcript');
  return transcript;
}

export async function extractMathTasksFromUrl(url: string, model: string = "gemini-3.1-pro-preview", timeRange?: {start: string, end: string}, manualTranscript?: string, instructions?: string, outputLanguage?: string): Promise<MathTask[]> {
  let timeContext = "";
  if (timeRange && (timeRange.start || timeRange.end)) {
    timeContext = `\nВНИМАНИЕ: Фокусирај се ИСКЛУЧИВО на делот од видеото/содржината од ${timeRange.start || 'почеток'} до ${timeRange.end || 'крај'}. Игнорирај го останатиот дел.`;
  }

  // ЧЕКОР 1: Прибирање фактографски контекст (Транскрипт)
  let videoContext = manualTranscript || "";

  if (!videoContext) {
     const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
     const isVimeo = url.includes('vimeo.com');
     if (isYoutube) {
       // Transcript-first approach: pass the YouTube URL directly to Gemini Flash.
       // Faster and cheaper than the /api/youtube/transcript backend endpoint (unavailable
       // on static hosting) and more reliable than Gemini Search for long or unlisted videos.
       try {
         videoContext = await fetchYoutubeTranscriptViaGemini(url, timeRange);
       } catch (e) {
         console.warn("Gemini транскрипт не успеа, паѓаме на Gemini Search:", e);
       }
     } else if (!isVimeo) {
       try {
         const apiEndpoint = apiUrl(`/api/scrape?url=${encodeURIComponent(url)}`);
         const res = await fetch(apiEndpoint);
         if (res.ok) {
           const text = await res.text();
           if (!text.startsWith('<')) {
             const data = JSON.parse(text);
             if (data.fragments && data.fragments.length > 0) {
               videoContext = data.fragments.map((f: any) => `[${formatTimeFromMs(f.offset)}] ${f.text}`).join("\n");
             } else if (data.transcript) {
               videoContext = data.transcript;
             } else if (data.content) {
               videoContext = data.title + "\n\n" + data.content;
             }
           }
         }
       } catch (e) {
         console.warn("Локалниот Scraper не успеа, паѓаме на Gemini пребарување.");
       }
     }
  }

  // Доколку немаме добиено videoContext преку бесплатното API, продолжуваме преку Gemini Search
  if (!videoContext) {
    const searchPrompt = `Ти си строг дигитален истражувач. Твојата ЕДИНСТВЕНА мисија е да го најдеш ТОЧНИОТ транскрипт за ОВА конкретно YouTube видео / веб страна: ${url}. 
${timeContext}
ПРАВИЛА ПРОТИВ ХАЛУЦИНИРАЊЕ:
1. Задолжително користи Google Search за да го пребараш овој линк: ${url}.
2. АКО НЕ МОЖЕШ ДА ГО НАЈДЕШ ВИСТИНСКИОТ И ТОЧЕН ТРАНСКРИПТ ЗА ОВА ВИДЕО, СТРОГО Е ЗАБРАНЕТО да измислуваш содржина врз основа на линкот или да користиш генеричко математичко знаење.
3. Доколку го најдеш точниот транскрипт, врати го прецизно, во неговиот ОРИГИНАЛЕН јазик (пример: англиски). Не го преведувај тука. Само дај ми го изворниот текст.
4. Доколку транскриптот не е достапен, само врати го текстот: "NO_TRANSCRIPT_FOUND" и ништо друго.`;

    try {
      const searchResponse = await ai.models.generateContent({
        model: model, 
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }] 
        }
      });
      videoContext = searchResponse.text || "NO_TRANSCRIPT_FOUND";
      
      if (videoContext.includes("NO_TRANSCRIPT_FOUND")) {
        throw new Error("Не можевме да го пронајдеме транскриптот за ова видео. Видеото можеби нема превод (CC) или е ограничено. Ве молиме изберете друго видео или прикачете слика/PDF од задачите.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Не можевме да го пронајдеме транскриптот")) throw err;
      console.warn("Грешка при пребарување на транскрипт преку Google Search:", err);
      throw new Error("Не може да се пристапи до точниот транскрипт. Системот за пребарување е блокиран или видеото е недостапно.");
    }
  }

  // ЧЕКОР 2: Строга JSON екстракција БЕЗ алатки
  const extractionPrompt = `Ти си Врвен Светски Експерт за Дигитализација на Математичка Едукација и специјалист за OCR и анализа на транскрипти.
Твојата мисија е ПЕРФЕКТНО да ги дигитализираш СИТЕ математички содржини (И ТЕОРИЈА И ЗАДАЧИ) кои се појавуваат во овој транскрипт:

==================
ИЗВЛЕЧЕН ТРАНСКРИПТ/СОДРЖИНА ОД ИЗВОРОТ (${url}):
${videoContext}
==================

СТРАТЕГИЈА ЗА МАКСИМАЛНА ПРЕЦИЗНОСТ И АВТОМАТСКО ПРЕПОЗНАВАЊЕ НА ЈАЗИК (Chain-of-Thought):
1. **Автоматска Детекција на Јазик**: Детектирај го јазикот на транскриптот. Поддржани ISO кодови: 'mk' (македонски), 'en' (англиски), 'ru' (руски), 'tr' (турски), 'ar' (арапски), 'de', 'fr', 'es', 'al' (Albanian) — или кој и да е друг ISO 639-1 код. Запиши го во \`detected_language\`.
2. **Јазик на излезот (КРИТИЧНО)**: ${outputLanguage && outputLanguage !== 'auto'
  ? `Корисникот ПОБАРАЛ излез на јазик: '${outputLanguage}'. ПРЕВЕДИ го целиот \`original_text\`, \`title\`, \`solution_steps\` и \`curriculum_topic\` на тој јазик. Зачувај ги LaTeX формулите непроменети ($...$ и $$...$$). Математичкиот контекст и педагошката точност се приоритет над буквалниот превод.`
  : `Задржи го ОРИГИНАЛНИОТ детектиран јазик на видеото во \`original_text\`, \`title\` и \`solution_steps\`. НЕ ПРЕВЕДУВАЈ. Исклучок: само ако јазикот е нераспознатлив, тогаш преведи на 'mk'.`}
3. **Теорија вс. Задачи (КРИТИЧНО)**: Видеата често почнуваат со теоретски вовед (дефиниции, формули, правила). ИЗВЛЕЧИ ЈА ТЕОРИЈАТА како посебен објект со \`type: "theory"\`. Задачите извлечи ги како \`type: "task"\`. Ова е многу важно за градење на лекции. За теорија, во "solution_steps" напиши ги клучните поенти или изведувања.
4. **Стандарди за Форматирање**: Користи релевантни математички стандарди за детектираниот јазик (пр. децимална запирка за македонски/руски, децимална точка за англиски).
5. **ZERO-ERROR LaTeX**: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ, РАВЕНКИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ ВО original_text И ВО solution_steps! Користи $...$ за inline математика (пр. Let $x=5$) и $$...$$ за математика во нов ред. ОВА Е НАЈСТРОГОТО ПРАВИЛО!
6. **Илустрации и Графици**: Формирај \`illustration_prompt\` за стварни/животни објекти. Формирај \`math_graphic_config\` (JSON објект) за геометрија и координатни системи.

ПРАВИЛА ЗА НАСТАВНА ПРОГРАМА:
- ЗАДОЛЖИТЕЛНО: Во \`grade_level\` одреди го нивото кориснтејќи ја нотацијата на земјата/јазикот: за 'mk' → "7-мо одделение"; за 'en' → "Grade 7" / "Year 9" / "AP Calculus"; за 'ru' → "7-й класс"; за 'tr' → "7. sınıf". Ако не можеш точно — напиши ниво (пр. "Middle School", "High School").
- ЗАДОЛЖИТЕЛНО: Во \`curriculum_topic\` смести ја темата на ИЗЛЕЗНИОТ јазик (оној бараниот од корисникот, наведен погоре). Ако корисникот бара македонски → "Линеарни равенки", за англиски → "Linear Equations", за турски → "Doğrusal Denklemler".

${instructions ? `\nСПЕЦИФИЧНИ ИНСТРУКЦИИ ЗА ИЗВЛЕКУВАЊЕ:\n${instructions}\n` : ""}
Врати JSON објект со следната структура која симулира NotebookLM (прво длабинска анализа, па потоа теорија и задачи).`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: extractionPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notebook_briefing: { type: Type.STRING, description: "Generate a NotebookLM-style comprehensive summary of the ENTIRE transcript first before extracting specific tasks. Map out the mental model of the video, key concepts, and timelines." },
            extraction_confidence: { type: Type.NUMBER, description: "1-100 indicating how clear the math problems are in the source text." },
            extracted_tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  evidence_quote: { type: Type.STRING, description: "ANTI-HALLUCINATION: Quote the exact sentence from the transcript where this task begins." },
                  type: { type: Type.STRING, enum: ["task", "theory"] },
                  detected_language: { type: Type.STRING, description: "Auto-detected language code: mk, en, tr, al, etc." },
                  title: { type: Type.STRING },
                  original_text: { type: Type.STRING },
                  solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' }, math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
                  source_timestamp: { type: Type.STRING, description: "Estimate video timestamp, e.g., [12:30]" },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                  dok_level: { type: Type.NUMBER, description: "Depth of Knowledge (1-4)" },
                  bloom_taxonomy: { type: Type.STRING, enum: ["Помнење", "Разбирање", "Примена", "Анализа", "Евалуација", "Креирање"], description: "Bloom's Taxonomy classification (Macedonian terms)" },
                  grade_level: { type: Type.STRING },
                  curriculum_topic: { type: Type.STRING },
                  hints: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["evidence_quote", "type", "detected_language", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "bloom_taxonomy", "grade_level", "curriculum_topic", "hints"]
              }
            }
          },
          required: ["notebook_briefing", "extraction_confidence", "extracted_tasks"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const parsedObj = parseGeminiResponse(response.text);
    const tasks: MathTask[] = parsedObj.extracted_tasks || [];
    return tasks.map(t => ({ ...t, source_url: url }));
  } catch (error) {
    console.error("Грешка при екстракција од URL:", error);
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
      model: "gemini-3.5-flash",
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

export async function generateImage(prompt: string, gradeLevel?: string): Promise<string> {
  try {
    const ageContext = gradeLevel ? ` Designed specifically for students in ${gradeLevel}. ` : '';
    const styleModifier = `Style: Modern, colorful, and engaging educational vector illustration. White background, crisp lines, perfect composition. No mathematical symbols or text in the image.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-image",
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

export async function extractMathTasksFromImage(base64Image: string, mimeType: string, targetLanguage: string = 'auto', enableLogicalReconstruction: boolean = true, model: string = "gemini-3.1-pro-preview"): Promise<MathTask[]> {
  const curriculumCtx = await buildCurriculumContextBlockRag('математика македонски наставна програма');
  const prompt = `Ти си Врвен Светски Експерт за Дигитализација на Математика, "Advanced Vision OCR" и Едукативен Технолог (EdTech).
${curriculumCtx ? `\n${curriculumCtx}\n` : ''}
Твојата мисија е ПЕРФЕКТНО да ја анализираш сликата/документот и да ги извлечеш задачите, вклучувајќи ги и оние од ракописи или стари документи.

СПЕЦИФИЧНИ ИНСТРУКЦИИ ЗА "ADVANCED VISION OCR":
${enableLogicalReconstruction 
  ? `1. **Напредно Препознавање, Ракопис и Логичка Реконструкција (ВКЛУЧЕНО)**: Направи **ЛОГИЧКА РЕКОНСТРУКЦИЈА** на можните оштетувања. Поправи ги текстуалните или нотациски грешки водејќи се строго според меѓународни математички стандарди.`
  : `1. **Класично Препознавање OCR (Без Реконструкција)**: Препиши го точно тоа што е на сликата.`}
2. **Јазични Поставки (Мултијазичност)**: 
   - НАЈПРВО АВТОМАТСКИ ПРЕПОЗНАЈ ГО ЈАЗИКОТ на изворот. Запиши ја кратенката во \`detected_language\`.
   - ${targetLanguage === 'auto' ? `Бидејќи крајниот јазик е 'auto', целиот излез задржи го на тој препознаен јазик.` : `ВНИМАНИЕ: Без разлика на изворот, ТИ МОРАШ ДА ГО ПРЕВЕДЕШ целиот излез СТРОГО на **${targetLanguage === 'mk' ? 'Македонски (СТРОГО МАКЕДОНСКА КИРИЛИЦА)' : targetLanguage === 'en' ? 'Англиски' : targetLanguage === 'ru' ? 'Руски' : 'Турски'} јазик**.`}
3. **ZERO-ERROR LaTeX**: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ! Користи $...$ за inline и $$...$$ за блок математика.
4. **Визуелна Реконструкција**: Конвертирај табели во Markdown, а графици во \`geogebra_commands\`.
5. **Педагошко подобрување и Chain-of-Thought**: За секоја извлечена задача, генерирај детално, скалилесто решение во \`solution_steps\`. Решението МОРА да содржи обрамотување на теоретската основа и педагошко појаснување (зошто се користи овој чекор) според најстрогите педагошки стандарди, за ученикот подобро да го разбере концептот логички, а не само механички решено.

Врати ги податоците СТРОГО во JSON формат (низа од објекти).`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        { text: prompt },
        { inlineData: { data: base64Image, mimeType: mimeType } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["task", "theory"] },
              detected_language: { type: Type.STRING, description: "Auto-detected language code: mk, en, tr, ru, etc." },
              title: { type: Type.STRING },
              original_text: { type: Type.STRING },
              solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' }, 
              geogebra_commands: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'GeoGebra exact string commands to plot shapes or graphs (e.g. "f(x)=x^2", "A=(1,2)"). Leave empty if no graph needed.' },
              math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
              dok_level: { type: Type.NUMBER },
              grade_level: { type: Type.STRING },
              curriculum_topic: { type: Type.STRING }
            },
            required: ["type", "detected_language", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const tasks: MathTask[] = parseGeminiResponse(response.text);
    return tasks.map(t => ({ ...t, source_url: "Слика (Напреден OCR)" }));
  } catch (error) {
    console.error("Грешка при екстракција од слика:", error);
    handleGeminiError(error);
  }
}

export async function verifyUserStep(task: MathTask, previousSteps: string[], userStep: string): Promise<{
  isCorrect: boolean;
  feedback: string;
  hint?: string;
  nextStepSuggestion?: string;
  isFinished?: boolean;
}> {
  const prompt = `Ти си Стручен Математички Едукатор-Архитект специјалист за ZPD (Zone of Proximal Development) и Сократов дијалог. Твојата задача е да го провериш последниот чекор на ученикот.
Ако ученикот побара помош или погреши, твојата примарна цел е СТРОГО ДА НЕ ГО ДАДЕШ РЕШЕНИЕТО ИЛИ ТОЧНАТА ФОРМУЛА, туку да поставиш провокативно Сократско прашање кое ќе му помогне самиот да го доживее својот "Аха!" момент.

КОНТЕКСТ НА ЗАДАЧАТА:
${task.original_text}

РЕШЕНИЕ (за твоја референца - АПСОЛУТНО ЗАБРАНЕТО ЗА ДИРЕКТНО СПОДЕЛУВАЊЕ):
${task.solution_steps.join('\n')}

ПРЕТХОДНИ ЧЕКОРИ НА УЧЕНИКОТ:
${previousSteps.join('\n')}

ПОСЛЕДЕН ЧЕКОР НА УЧЕНИКОТ:
${userStep}

ИНСТРУКЦИИ:
1. Провери дали последниот чекор е математички точен и логичен.
2. Ако е точен, дај позитивно засилување. Ако ученикот решил сé до крај, врати "isFinished": true и дај честитки.
3. Ако е погрешен или ученикот вели "Не знам":
   - **НИКОГАШ** не го откривај следниот точен чекор директно!
   - Анализирај што ученикот знае и што му недостига (ZPD).
   - "feedback" полето мора да содржи **топло Сократско прашање**. На пр., ако добил негативен број под квадратен корен во реално множење, прашај го: "Гледам дека доби негативна вредност. Што знаеме за знаците на броевите кога се множат самите со себе?".
   - Натерај го да размисли кон каде води неговата грешка или кое клучно својство го заборавил.
4. **ИНТЕРАКТИВНОСТ (GeoGebra):** Ако има "GeoGebra Hidden Context", прочитај ги живите координати. Охрабри го ученикот: "Обиди се да го поместиш темето / точката... Што забележуваш за дијагоналите/аглите?". Доколку веќе поместил точка, осврни се на неа: "Гледам дека ја помести точката, што можеш да заклучиш сега?".
5. Во "hint" полето врати СУПТИЛНА аналогија или помош (пр. "Сјети се на правилото за...") која НЕ ГО СОДРЖИ решението.
6. Користи LaTeX за сите изрази. ${MATH_PLOT_INSTRUCTION} ${ALGEBRA_TILES_INSTRUCTION}
7. Јазик: Македонски.

Врати го одговорот во JSON формат.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            hint: { type: Type.STRING },
            nextStepSuggestion: { type: Type.STRING },
            isFinished: { type: Type.BOOLEAN }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error verifying step:", error);
    throw error;
  }
}

export async function explainFormula(formula: string): Promise<string> {
  const prompt = `Ти си Експерт по Математика. Објасни ја следната математичка формула или израз на едноставен и разбирлив македонски јазик.
  
ФОРМУЛА:
${formula}

Можеш слободно да користиш визуелизации за да ја објасниш формулата:
${MATH_PLOT_INSTRUCTION}
${ALGEBRA_TILES_INSTRUCTION}

ИНСТРУКЦИИ:
1. Дај кратко објаснување што претставува формулата.
2. Објасни ги променливите (ако ги има).
3. Дај еден краток пример за нејзина примена.
4. Користи LaTeX за сите математички изрази во објаснувањето.
5. Одговорот треба да биде краток (максимум 3-4 реченици).

Врати само текст (Markdown формат е дозволен).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    if (!response.text) throw new Error("Нема одговор.");
    return response.text;
  } catch (error) {
    console.error("Error explaining formula:", error);
    return "Не можев да генерирам објаснување за оваа формула во моментов.";
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
      model: "gemini-3.5-flash",
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

export async function generateConsistencyTasks(task: MathTask, count: number = 3, style: 'traditional' | 'real-world' | 'modern' = 'traditional'): Promise<MathTask[]> {
  const stylePrompt = 
    style === 'modern' ? 'Користи модерен Gen-Z контекст.' :
    style === 'real-world' ? 'Користи контекст од реалниот свет.' :
    'Користи традиционален контекст.';

  const prompt = `Ти си Методолошки Архитект. Врз основа на следната задача и специфичната наставна стратегија користена во неа, генерирај ${count} нови задачи кои МОРА да се решат користејќи ја ИСТАТА методологија за да се задржи конзистентноста во учењето.

СТИЛ: ${stylePrompt}

ОРИГИНАЛНА ЗАДАЧА:
${task.original_text}

НАСТАВНА СТРАТЕГИЈА:
${task.pedagogical_insights?.teaching_strategy}

ПРАВИЛА:
1. Новите задачи мора да бидат математички различни, но методолошки идентични.
2. Нагласи во делот на решението како се користи наведената стратегија.
3. ZERO-ERROR LaTeX: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ, РАВЕНКИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ. Користи $...$ за inline математика (пр. Нека е $x=5$) и $$...$$ за математика во нов ред. ОВА Е НАЈСТРОГОТО ПРАВИЛО! Користи македонски јазик.
4. Врати JSON низа од објекти на задачи.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              original_text: { type: Type.STRING },
              solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["лесно", "средно", "тешко"] },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "original_text", "solution_steps", "difficulty", "tags"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const results = JSON.parse(response.text);
    return results.map((t: any) => ({
      ...t,
      type: "задача",
      latex_formulas: [],
      illustration_prompt: "",
      grade_level: task.grade_level,
      curriculum_topic: task.curriculum_topic,
      source_url: `Методолошки клон (${task.pedagogical_insights?.teaching_strategy})`
    }));
  } catch (error) {
    console.error("Грешка при генерирање конзистентни задачи:", error);
    throw error;
  }
}

export async function generatePrerequisiteTest(task: MathTask, style: 'traditional' | 'real-world' | 'modern' = 'traditional'): Promise<MathTask[]> {
  const stylePrompt = 
    style === 'modern' ? 'Користи модерен Gen-Z контекст.' :
    style === 'real-world' ? 'Користи контекст од реалниот свет.' :
    'Користи традиционален контекст.';

  const prompt = `Ти си Експерт за Дијагностичко Тестирање. Врз основа на следната задача и нејзините потребни предзнаења (prerequisites), генерирај краток дијагностички тест од 3 задачи кој ќе утврди дали ученикот е подготвен за оваа лекција.

СТИЛ: ${stylePrompt}

ОРИГИНАЛНА ЗАДАЧА:
${task.original_text}

ПОТРЕБНИ ПРЕДЗНАЕЊА:
${task.pedagogical_insights?.prerequisites?.join(', ')}

ПРАВИЛА:
1. Секоја од трите задачи треба да тестира различен аспект од предзнаењата.
2. Задачите треба да бидат на ниво веднаш под нивото на оригиналната задача.
3. ZERO-ERROR LaTeX: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ, РАВЕНКИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ. Користи $...$ за inline математика (пр. Нека е $x=5$) и $$...$$ за математика во нов ред. ОВА Е НАЈСТРОГОТО ПРАВИЛО! Користи македонски јазик.
4. Врати JSON низа од 3 објекти на задачи.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              original_text: { type: Type.STRING },
              solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["лесно", "средно", "тешко"] }
            },
            required: ["title", "original_text", "solution_steps", "difficulty"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const results = JSON.parse(response.text);
    return results.map((t: any) => ({
      ...t,
      type: "задача",
      latex_formulas: [],
      illustration_prompt: "",
      tags: ["дијагностички-тест", ...task.pedagogical_insights?.prerequisites || []],
      grade_level: task.grade_level,
      curriculum_topic: `Пред-тест за: ${task.title}`,
      source_url: `Дијагностички тест (Prerequisite Mapper)`
    }));
  } catch (error) {
    console.error("Грешка при генерирање пред-тест:", error);
    throw error;
  }
}

export async function analyzeSolutionImage(task: MathTask, base64Image: string, mimeType: string, studentHistory?: string): Promise<{
  analysis: string;
  errorsFound: string[];
  suggestions: string[];
  score: number;
  bloom_level_assessed?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  pedagogical_evaluation?: {
    framework: 'bloom' | 'dok' | 'solo';
    level: string;
    reason: string;
  };
  identified_weaknesses?: string[]; // Specific mathematical concepts the student struggled with
  rubric_breakdown: {
    concept: { score: number, comment: string };
    execution: { score: number, comment: string };
    presentation: { score: number, comment: string };
  };
  good_sides?: string[];
  bad_sides?: string[];
}> {
  const prompt = `Ти си Високо Платен и Најпознат AI Специјализиран Тутор по Математика (AI Tutor & Grader). Ученикот прикачи слика од својата работа за следната задача. Аналогна си на највисоките светски едукативни стандарди каде "само небото е граница" во учењето.

ЗАДАЧА:
${task.original_text}

РЕШЕНИЕ ЗА РЕФЕРЕНЦА:
${task.solution_steps?.join('\n')}

${studentHistory ? `ИСТОРИЈА И АНАЛИТИКА НА УЧЕНИКОТ (Многу Важно!):\n${studentHistory}\n(Доколку забележиш дека ученикот ги повторува истите грешки што веќе ги правел во минатото, ЕКСПЛИЦИТНО потенцирај го тоа во твојата анализа и препораки. На пример 'Овој ученик повторно ја прави истата грешка со...'.)\n` : ''}
МЕТОДОЛОГИЈА ЗА ОЦЕНУВАЊЕ (The Master Tutor Protocol):
1. **Транскрипција, OCR & Споредба:** Детално прочитај го ракописот. Идентификувај ги сите специфични математички нотации и текстуални грешки во формулацијата на ученикот. Спореди го чекор-по-чекор со референтното решение.
2. **Локализација на Грешки & Нотација:** Најди ја ТОЧНАТА локација на грешката. Строго посочи доколку ученикот користи неправилна математичка нотација (на пр. заборавени загради, лоша нотација за дропки, погрешен запис на вектори/агли) или ако има текстуална неконзистентност.
3. **Парцијални поени (Partial Scoring):** Додели поени од 0 до 100. Ако концептот е правилен, но има пресметковна грешка или лоша нотација, бодувај праведно и охрабрувачки, но потенцирај ја нотацијата.
4. **Добри и Лоши Страни:** Експлицитно извлечи ги ДОБРИТЕ страни (она што ученикот одлично го совладал или паметно го извел) и ЛОШИТЕ страни (каде алгоритмот се крши, вклучувајќи нотациски грешки).
5. **Автоматско Графичко Реконструирање (Кога е применливо):** Доколку грешката е од геометриска или визуелна природа (на пр. погрешен агол, функција, плоштина), во рамки на полето 'analysis' вметни markdown блок за JSXGraph (\`\`\`jsxgraph\n// JS code\n\`\`\`) што визуелно ќе ја реконструира грешката и точното решение. Користи board.create() за точки, линии и полигони. Нека биде кратко и фокусирано.
5. **Формативна Рубрика:** Раздели го извештајот во 3 димензии (секоја од 0 до 100 поени):
   - Concept: Дали ученикот го разбрал типот на задачата и концептот?
   - Execution: Дали алгебарската/математичката манипулација е точна?
   - Presentation: Дали чекорите се уредни и логично подредени?
6. **Педагошка Евалуација:** Во \`pedagogical_evaluation\` дај јасна проценка според Bloom.

СИТЕ МАТЕМАТИЧКИ СИМБОЛИ ПРОДОЛЖИ ДА ГИ ПИШУВАШ ВО ПЕРФЕКТЕН LaTeX ($...$).
ВРАТИ СТРИКТЕН JSON СО СЛЕДНИТЕ КЛУЧЕВИ:
- "analysis" (Генерален инспиративен и туторски фидбек на македонски, како врвен ментор кој гради самодоверба)
- "errorsFound" (Листа на конкретни грешки. Празна листа ако нема)
- "suggestions" (Препораки за следниот пат / Како "врвен совет од менторот")
- "good_sides" (Што е одлично направено во решавањето, листа од стрингови)
- "bad_sides" (Кои се критичните слаби точки, листа од стрингови)
- "identified_weaknesses" (Листа од 1-3 кратки фрази, пр. "Квадрирање бином", "Правила за знаци" - за да знаеме кои понатамошни задачи да ги генерираме)
- "score" (број 0-100)
- "pedagogical_evaluation" (Објект со: 'framework': 'bloom', 'level': 'apply'/'analyze' итн., и 'reason' зошто)
- "rubric_breakdown" (Објект со 3 клучеви: concept, execution, presentation. Секој е објект со 'score' (број 0-10) и 'comment' (стринг фидбек))`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview", // Use pro for spatial multimodal
      contents: [
        { text: prompt },
        { inlineData: { data: base64Image, mimeType: mimeType } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            errorsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            score: { type: Type.NUMBER, description: "Генерални поени (0-100)." },
            pedagogical_evaluation: {
              type: Type.OBJECT,
              properties: {
                framework: { type: Type.STRING, enum: ["bloom", "dok", "solo"] },
                level: { type: Type.STRING, description: "На пр. 'apply' за bloom, 'level_3' за dok, 'relational' за solo." },
                reason: { type: Type.STRING, description: "Кратко објаснување зошто е избрана токму оваа метрика за оваа задача." }
              },
              required: ["framework", "level", "reason"]
            },
            identified_weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific mathematical concepts missed, e.g. ['Fractions', 'Negative Numbers'] or in Macedonian ['Дропки', 'Негативни броеви']" },
            rubric_breakdown: {
              type: Type.OBJECT,
              properties: {
                concept: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } }, required: ["score", "comment"] },
                execution: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } }, required: ["score", "comment"] },
                presentation: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, comment: { type: Type.STRING } }, required: ["score", "comment"] }
              },
              required: ["concept", "execution", "presentation"]
            },
            good_sides: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Што е одлично направено во решавањето" },
            bad_sides: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Критични слаби точки во решавањето" }
          },
          required: ["analysis", "errorsFound", "suggestions", "good_sides", "bad_sides", "score", "pedagogical_evaluation", "rubric_breakdown"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error analyzing solution image:", error);
    throw error;
  }
}

export async function analyzeBatchTestImage(base64Image: string, mimeType: string, studentHistory?: string): Promise<Array<{
  extracted_task_text: string;
  analysis: string;
  errorsFound: string[];
  suggestions: string[];
  score: number;
  bloom_level_assessed?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  pedagogical_evaluation?: {
    framework: 'bloom' | 'dok' | 'solo';
    level: string;
    reason: string;
  };
  identified_weaknesses?: string[];
  rubric_breakdown: {
    concept: { score: number, comment: string };
    execution: { score: number, comment: string };
    presentation: { score: number, comment: string };
  };
  good_sides?: string[];
  bad_sides?: string[];
}>> {
  const prompt = `Ти си Високо Платен и Најпознат AI Специјализиран Тутор по Математика (AI Tutor & Grader). 
Професорот прикачи слика од цела страница тест или зададени задачи на еден ученик. На сликата има неколку различни решени задачи.

ТВОЈА МИСИЈА: 
1. Сегментирај ја сликата на одделни задачи. Препознај каде почнува и завршува секоја.
2. За секоја задача, извлечи го текстот на самата задача (ако постои), и целосното решение на ученикот.
3. Оцени ја секоја задача одделно според следниот Master Tutor Protocol.
${studentHistory ? `\nИСТОРИЈА И АНАЛИТИКА НА УЧЕНИКОТ (Многу Важно!):\n${studentHistory}\n(Доколку забележиш дека ученикот ги повторува истите грешки што веќе ги правел во минатото во некоја од задачите од тестот, ЕКСПЛИЦИТНО потенцирај го тоа. На пример 'Овој ученик повторно ја прави истата грешка со...'.)\n` : ''}
МЕТОДОЛОГИЈА ЗА ОЦЕНУВАЊЕ (за секоја задача):
1. **Транскрипција, OCR & Споредба:** Детално прочитај го ракописот. Идентификувај ги сите специфични математички нотации и текстуални грешки.
2. **Локализација на Грешки & Нотација:** Најди ја ТОЧНАТА локација на грешката. 
3. **Парцијални поени:** Додели поени од 0 до 100 за таа конкретна задача.
4. **Добри и Лоши Страни:** Експлицитно извлечи ги ДОБРИТЕ страни и ЛОШИТЕ страни.
5. **Автоматско Графичко Реконструирање (Кога е применливо):** Доколку грешката е од геометриска или визуелна природа во задачата, во рамки на полето 'analysis' вметни markdown блок за JSXGraph (\`\`\`jsxgraph\n// JS code\n\`\`\`) што визуелно ќе ја реконструира грешката и точното решение. Користи board.create() за точки, линии и полигони.
6. **Формативна Рубрика:** Раздели го извештајот во 3 димензии (секоја од 0 до 100 поени): Concept, Execution, Presentation.
7. **Педагошка Евалуација:** Во \`pedagogical_evaluation\` дај јасна проценка според Bloom.

СИТЕ МАТЕМАТИЧКИ СИМБОЛИ ПРОДОЛЖИ ДА ГИ ПИШУВАШ ВО ПЕРФЕКТЕН LaTeX ($...$).
ВРАТИ СТРИКТЕН JSON КОЈ Е НИЗА (ARRAY) ОД ОБЈЕКТИ, КАДЕ СЕКОЈ ОБЈЕКТ ПРЕТСТАВУВА 1 ОЦЕНЕТА ЗАДАЧА, СО СЛЕДНИТЕ КЛУЧЕВИ:
- "extracted_task_text" (текстот на задачата и краток опис на чекорите на ученикот)
- "analysis" (Генерален фидбек на македонски)
- "errorsFound" (Листа на конкретни грешки)
- "suggestions" (Препораки)
- "good_sides" (Што е одлично направено)
- "bad_sides" (Слаби точки)
- "identified_weaknesses" (Листа од 1-3 кратки фрази)
- "score" (број 0-100)
- "pedagogical_evaluation" (Објект со framework, level, reason)
- "rubric_breakdown" (Објект со 3 клучеви: concept, execution, presentation - секој со score (број 0-100) и comment).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        { text: prompt },
        { inlineData: { data: base64Image, mimeType: mimeType } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              extracted_task_text: { type: Type.STRING },
              analysis: { type: Type.STRING },
              errorsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              good_sides: { type: Type.ARRAY, items: { type: Type.STRING } },
              bad_sides: { type: Type.ARRAY, items: { type: Type.STRING } },
              identified_weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              score: { type: Type.INTEGER },
              bloom_level_assessed: { type: Type.STRING },
              pedagogical_evaluation: {
                type: Type.OBJECT,
                properties: {
                  framework: { type: Type.STRING, enum: ["bloom", "dok", "solo"] },
                  level: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["framework", "level", "reason"]
              },
              rubric_breakdown: {
                type: Type.OBJECT,
                properties: {
                   concept: { type: Type.OBJECT, properties: { score: { type: Type.INTEGER }, comment: { type: Type.STRING } }, required: ["score", "comment"] },
                   execution: { type: Type.OBJECT, properties: { score: { type: Type.INTEGER }, comment: { type: Type.STRING } }, required: ["score", "comment"] },
                   presentation: { type: Type.OBJECT, properties: { score: { type: Type.INTEGER }, comment: { type: Type.STRING } }, required: ["score", "comment"] }
                },
                required: ["concept", "execution", "presentation"]
              }
            },
            required: ["extracted_task_text", "analysis", "errorsFound", "suggestions", "score", "rubric_breakdown"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор на сликата.");
    const parsed = JSON.parse(response.text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Грешка при batch анализа на сликата:", error);
    throw error;
  }
}

export async function generateTargetedPracticeTasks(weaknesses: string[], originalTask: MathTask, count: number = 3): Promise<MathTask[]> {
  const prompt = `Ти си Експерт по Математика и Специјалист за Индивидуална Настава.
Ученикот решаваше задача и покажа слабости во следниве области:
${weaknesses.join(', ')}

Оригинална Задача која не успеа да ја реши:
${originalTask.original_text}

Твоја цел е да креираш ${count} нови задачи кои ќе ги ТАРГЕТИРААТ специфично овие слабости за да му помогнат на ученикот да ги совлада. 
Започни со наједноставна задача поврзана само со слабоста, а потоа постепено зголемувај ја комплексноста додека не стигнеш до нивото на оригиналната задача.

Врати листа од ${count} објекти во СТРОГО JSON формат кои го следат следниот интерфејс.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["task"] },
              title: { type: Type.STRING },
              original_text: { type: Type.STRING },
              solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              illustration_prompt: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
              dok_level: { type: Type.STRING },
              grade_level: { type: Type.STRING },
              curriculum_topic: { type: Type.STRING }
            },
            required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    return JSON.parse(text) as MathTask[];
  } catch (error) {
    console.error("Грешка при генерирање таргетни задачи:", error);
    throw error;
  }
}

export async function generateMakedoTestFromTasks(tasks: MathTask[], testInstructions: string): Promise<any> {
  const prompt = `Ти си Експерт по Дизајн на Образование и СТЕМ методики. Твоја задача е да креираш висококвалитетен тест - "МакедоТест Про v6.0" базирано на следните извлечени математички задачи и инструкции.

ИНСТРУКЦИИ ОД НАСТАВНИКОТ:
${testInstructions}

ИЗВОРНИ ЗАДАЧИ ЗА ТЕСТОТ:
${tasks.map((t, idx) => `[Задача ${idx+1}]\nНаслов: ${t.title}\nТекст: ${t.original_text}\nРешение: ${t.solution_steps?.join(' ')}`).join('\n\n')}

**МЕТОДОЛОГИЈА (CoT & ToT):**
Најпрво одреди кои формати најдобро одговараат за овие задачи (на пр. некои нека бидат multiple choice, некои short-answer, некои fill-blanks). Избери ги најсоодветните типови на прашања според Блумовата таксономија.

**ТЕХНИЧКИ ПРАВИЛА ЗА МАКЕДОТЕСТ ПРО v6.0:**
1. **Јазик:** Чист македонски литературен јазик.
2. **LaTeX Форматирање:** За математички формули ЗАДОЛЖИТЕЛНО користи LaTeX во \`$\`. Бидејќи излезот е JSON, сите бекслеш карактери во LaTeX командите МОРА да бидат ескејпирани со ДВОЕН бекслеш (пр. \`$\\\\frac{1}{2}$\`, \`$\\\\sqrt{x^2}$\`).
3. Структура на излезот: Финалниот JSON МОРА да биде валиден JSON објект со title, grade_level, subject, и questions (array).

**ДОЗВОЛЕНИ ТИПОВИ (JSON СТРУКТУРИ за questions):**
Можеш да комбинираш од следниве 16 формати, избирајќи го најсоодветниот за секоја задача:
1. \`multiple\`: { "type": "multiple", "text": "...", "options": ["A", "B", "C"], "correct": 0 }
2. \`true-false\`: { "type": "true-false", "text": "...", "correct": 0 } (0=Точно, 1=Неточно)
3. \`fill-blanks\`: { "type": "fill-blanks", "text": "Текст со [празнина]." }
4. \`matching\`: { "type": "matching", "text": "...", "pairs": [{"left": "А", "right": "1"}] }
5. \`list\`: { "type": "list", "text": "Наброј...", "items": ["", "", ""] }
6. \`short-answer\`: { "type": "short-answer", "text": "..." }
7. \`checklist\`: { "type": "checklist", "text": "...", "options": ["A", "B"], "corrects": [0, 1] }
8. \`table\`: { "type": "table", "text": "...", "tableData": {"rows": 3, "cols": 2, "data": {"0-0": {"val": "X", "isAns": true}}} }
9. \`multi-part\`: { "type": "multi-part", "text": "...", "parts": ["а) ...", "б) ..."] }
10. \`ordering\`: { "type": "ordering", "text": "Подреди...", "items": ["Прво", "Второ"] }
11. \`essay\`: { "type": "essay", "text": "..." }
12. \`diagram\`: { "type": "diagram", "text": "Означи...", "imageUrl": "..." }
13. \`statements\`: { "type": "statements", "text": "...", "items": [{"s": "Изјава", "correct": 0}] }
14. \`selection\`: { "type": "selection", "text": "Реченица со {точен|грешен} избор." }
15. \`multi-match\`: { "type": "multi-match", "text": "...", "matches": [{"s": "Изјава", "a": "Одговор"}] }
16. \`section\`: { "type": "section", "text": "НАСЛОВ НА ДЕЛ" }

Врати го резултатот како JSON објект со следните својства:
{
  "title": "Наслов на тестот",
  "grade_level": "Одделение (пр. 6то одд.)",
  "subject": "Предмет",
  "questions": [ ... array од question објекти ... ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating MakedoTest:", error);
    throw error;
  }
}

export async function generateFlashcards(topic: string, count: number = 5): Promise<{front: string, back: string}[]> {
  const prompt = `Ти си експерт за креирање на едукативни картички (flashcards) по математика. 
Креирај точно ${count} картички за следната тема: "${topic}".
Секоја картичка треба да има прашање/термин на предната страна ("front") и прецизен, краток одговор/дефиниција на задната страна ("back").
Користи Markdown и KaTeX (пр. $x^2 + y^2 = r^2$) за математичките формули ако е потребно.

ВРАТИ ИСКЛУЧИВО JSON ОБЈЕКТ СО СЛЕДНИОТ ФОРМАТ:
{
  "flashcards": [
    {
      "front": "Прашање или термин...",
      "back": "Одговор или дефиниција..."
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: { type: Type.STRING },
                  back: { type: Type.STRING }
                },
                required: ["front", "back"]
              }
            }
          },
          required: ["flashcards"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор од Gemini API.");
    const parsed = JSON.parse(response.text);
    return parsed.flashcards;
  } catch (error) {
    console.error("Error generating flashcards:", error);
    handleGeminiError(error);
  }
}

export async function generateFlawedMathProblem(topic: string, difficulty: string): Promise<any> {
  const prompt = `Ти си Едукативен Технолог инспириран од "AI Pedagogy Project" (aipedagogy.org). Твојата задача е да креираш вежба "Find the Bug in AI" за математичката тема: ${topic} со тежина: ${difficulty}.
Поента: Треба да генерираш математичка задача и решение кое навидум изгледа точно, но содржи една прецизна, честа логичка или пресметковна грешка што јазичните модели (или студентите) често ја прават.

Врати JSON објект со следнава структура:
{
  "question": "Текстот на задачата (во LaTeX)",
  "flawed_solution": "Чекори за решение кои звучат убедливо но содржат грешка. Напиши ги чекор по чекор.",
  "correct_solution": "Точното решение чекор по чекор.",
  "error_explanation": "Објаснување каде точно е грешката (во кој чекор) и зошто е направена (како недоразбирање на концептот)."
}
СИТЕ математички изрази МОРА да бидат во $...$ или $$...$$. Биди строго на Македонски јазик.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response generated.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating flawed math problem:", error);
    throw error;
  }
}

export async function generateTwoCritiques(topic: string): Promise<any> {
  const prompt = `Ти си Едукативен Технолог инспириран од "AI Pedagogy Project" (aipedagogy.org). Твојата задача е да креираш вежба "A Tale of Two Critiques" (Спротиставени објаснувања) за математичкиот концепт: ${topic}.
Создади ДВЕ СОВРАШЕНО РАЗЛИЧНИ ОБЈАСНУВАЊА за овој концепт.
Првото објаснување треба да биде од "Строг Академик" кој користи строга дефиниција, аксиоми и формален јазик.
Второто објаснување треба да биде од "Пријателски Врсник" (или Ентузијаст) кој користи интуиција, метафори од реалниот свет и едноставен јазик.

Врати JSON објект со следнава структура:
{
  "concept_name": "Насловот на концептот",
  "explanation_academic": "Строго формално академско објаснување. Користи $...$ за LaTeX.",
  "explanation_intuitive": "Интуитивно пријателско објаснување со метафора. Користи $...$ за LaTeX.",
  "pedagogical_goal": "Кое објаснување е подобро за кој тип на ученик и зошто е важно студентите да ги споредат?"
}
Биди строго на Македонски јазик.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response generated.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating two critiques:", error);
    throw error;
  }
}

export async function generateHoaxProof(): Promise<any> {
  const prompt = `Ти си Едукативен Технолог инспириран од "AI Pedagogy Project" (aipedagogy.org). Твојата задача е да креираш вежба "Illustrate a Hoax" (Математички Апсурд).
Треба да креираш познат или нов математички апсурден доказ (на пример, доказ дека 1 = 2, или 0 = 1, или дека секој триаголник е рамнокрак), кој содржи скриена, суптилна нелогичност или забранета операција (на пр. делење со нула, погрешен корен).

Врати JSON објект со следнава структура:
{
  "hoax_title": "Наслов на апсурдниот доказ",
  "hoax_steps": [
    "Чекор 1: ...",
    "Чекор 2: ..."
  ],
  "flawed_step_index": Број (индекс од 0) на чекорот каде што се случува илегалната операција,
  "hidden_fallacy": "Точното објаснување каде лежи математичката измама (the hoax) и која операција е невалидна.",
  "pedagogical_goal": "Зошто ваквите измами се корисни за развој на критичкото размислување кај учениците."
}
Биди строго на Македонски јазик.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.8,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response generated.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating hoax proof:", error);
    throw error;
  }
}

// ===== Named domain wrappers — replaces direct ai.* access in components =====

export async function generateInterventionPlan(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Ти си врвен македонски методолог и дидактичар по математика, експерт во теоријата на Свелер за когнитивно оптоварување и рамката на Килпатрик.',
        temperature: 0.7,
      },
    });
    return response.text || 'Не успеав да генерирам план.';
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function generateCurriculumModule(prompt: string): Promise<any> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            module_title: { type: Type.STRING },
            lessons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  theory_summary: { type: Type.STRING },
                  class_tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                  homework_tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                  exit_ticket: { type: Type.STRING },
                },
                required: ['title', 'theory_summary', 'class_tasks', 'homework_tasks', 'exit_ticket'],
              },
            },
          },
          required: ['module_title', 'lessons'],
        },
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    handleGeminiError(error);
  }
}

export interface PedagogueEnhancement {
  new_text?: string;
  socratic_questions?: string[];
  modeling_scenario?: string;
  dok_suggestion?: number;
  teaching_strategy?: string;
}

export async function enhancePedagogueTask(prompt: string, language: string = 'mk'): Promise<PedagogueEnhancement> {
  const langNames: Record<string, string> = { mk: 'Macedonian (Кирилица)', en: 'English', ru: 'Russian', tr: 'Turkish', sq: 'Albanian' };
  const fullPrompt = `${prompt}\n\nIMPORTANT: Write ALL output text in ${langNames[language] || 'Macedonian'}. Keep LaTeX formulas ($...$, $$...$$) unchanged.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            new_text: { type: Type.STRING },
            socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
            modeling_scenario: { type: Type.STRING },
            dok_suggestion: { type: Type.NUMBER },
            teaching_strategy: { type: Type.STRING },
          },
        },
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function recognizeHandwrittenMath(base64Png: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        'Tease out ONLY the LaTeX formula from the handwriting on this whiteboard image. Do NOT include markdown backticks like ```latex . Return just the plain string.',
        { inlineData: { data: base64Png, mimeType: 'image/png' } },
      ],
    });
    return response.text?.trim() || '';
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function checkGeminiHealth(): Promise<boolean> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'reply with only the word OK',
    });
    return Boolean(response.text?.includes('OK'));
  } catch {
    return false;
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
      model: 'gemini-3.1-pro-preview',
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
