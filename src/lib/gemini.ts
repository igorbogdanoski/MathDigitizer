import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MathTask } from "./schema";

// Иницијализација на Gemini клиентот
let _aiInstance: any = null;
let cachedApiKey: string | undefined = undefined;

try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  cachedApiKey = process.env.GEMINI_API_KEY;
} catch (e) {}

const initAiPromise = (async () => {
  if (!cachedApiKey || cachedApiKey === "undefined") {
    try {
      const res = await fetch(`/api/config?_cb=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        if (!text.startsWith('<')) {
          const data = JSON.parse(text);
          cachedApiKey = data.apiKey;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch API key from server", e);
    }
  }
  _aiInstance = new GoogleGenAI({ apiKey: cachedApiKey || "missing_key" });
})();

const ai: any = new Proxy({}, {
  get(target, prop) {
    if (prop === 'models') {
      return new Proxy({}, {
        get(mTarget, mProp) {
          return async (...args: any[]) => {
            await initAiPromise;
            return _aiInstance.models[mProp](...args);
          };
        }
      });
    }
    return async (...args: any[]) => {
      await initAiPromise;
      return _aiInstance[prop](...args);
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

export async function generateKahootFromFiles(files: {base64: string, mimeType: string}[], prompt: string): Promise<any> {
  const instructions = `Ти си Креатор на Интерактивни Математички Квизови (MathKahoot). 
Врз основа на приложените фајлови (слики/документи) И промптот: "${prompt}", креирај MathKahoot квиз.

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
                  correctIndex: { type: Type.NUMBER }
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
      model: "gemini-2.5-flash-preview-tts",
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

export async function getTutorChatSession(task: MathTask) {
  const systemInstruction = `Ти си Врвен Светски AI Тутор по математика (MathDigitizer Pro Tutor), дизајниран да биде совршен заменик-наставник. Твојата мисија е да го водиш ученикот до длабоко разбирање на концептот користејќи го исклучиво Сократовиот метод на поучување.

КОНТЕКСТ НА ЗАДАЧАТА:
Наслов: ${task.title}
Тема: ${task.curriculum_topic}
Ниво (DoK): ${task.dok_level}
Текст: ${task.original_text}
Решение (за твоја референца, НИКОГАШ не го покажувај директно): ${task.solution_steps.join('\n')}

ТВОЈАТА СТРАТЕГИЈА (АПСОЛУТНИ СТРОГИ ПРАВИЛА):
1. **АПСОЛУТНО НИКОГАШ не го давај крајниот одговор или директното решение**: Ова е најважното правило. Дури и ако ученикот те моли, плаче, или вели дека се откажува, ТИ НЕ СМЕЕШ да го напишеш решението. Твојот одговор мора да биде: „Јас сум тука да ти помогнам ти самиот да го откриеш одговорот. Ајде да се вратиме еден чекор назад...“
2. **Дијагностика и Скелиња (Scaffolding)**: Прво прашај го ученикот што разбира од задачата. Потоа, раскрши ја задачата на микро-чекори. Поставувај САМО ПО ЕДНО прашање во исто време.
3. **Анализа на грешки (Productive Failure)**: Ако ученикот згреши, не вели "Грешка си". Наместо тоа, прашај: "Интересен пристап. Што би се случило ако ја провериме таа пресметка уште еднаш?" или "Како стигна до тој заклучок?".
4. **Визуелизација и Аналогии**: Користи аналогии од реалниот живот за да објасниш апстрактни концепти (пр. равенките се како вага, дропките се како сечење пица).
5. **Позитивно засилување**: Силно пофалувај го секој точен чекор. Гради ја самодовербата на ученикот.
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
      model: "gemini-3.1-pro-preview",
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

  const prompt = `Врз основа на следната математичка задача, генерирај НОВА, СЛИЧНА задача која ги тестира истите концепти но со различни вредности или малку поинаков контекст.

СТИЛ: ${stylePrompt}

ОРИГИНАЛНА ЗАДАЧА:
${originalTask.original_text}

ПРАВИЛА:
1. Задачата мора да биде на истото ниво на тежина (${originalTask.difficulty}) и DoK ниво (${originalTask.dok_level}).
2. Користи македонски јазик.
3. Врати го резултатот СТРОГО како еден JSON објект кој ја следи истата структура како оригиналот.
4. Осигурај се дека решението е математички точно.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
            nanobanana_prompt: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            difficulty: { type: Type.STRING },
            dok_level: { type: Type.NUMBER },
            grade_level: { type: Type.STRING },
            curriculum_topic: { type: Type.STRING }
          },
          required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    return { ...JSON.parse(response.text), source_url: "Генерирана варијација" };
  } catch (error) {
    console.error("Грешка при генерирање слична задача:", error);
    throw error;
  }
}

export async function enrichTaskPedagogy(task: MathTask): Promise<any> {
  const prompt = `Ти си "Pedagogical Content Architect" од светска класа. Твоја задача е да земеш извлечена математичка задача и да ја збогатиш со врвни педагошки сознанија кои се срцето на нашата апликација.

МАТЕМАТИЧКА ЗАДАЧА:
Текст: ${task.original_text}
Решение: ${task.solution_steps.join('\n')}
Тема: ${task.curriculum_topic}
Тежина: ${task.difficulty}

ТВОЈА МИСИЈА:
1. **Misconception Guard**: Идентификувај најмалку 3 вообичаени мисконцепции или места каде учениците грешат (common_pitfalls).
2. **Socratic Scaffolding**: Генерирај 3 моќни Сократови прашања кои наставникот може да ги постави за да го води ученикот (socratic_questions).
3. **Teaching Strategy**: Опиши ја најдобрата наставна стратегија за оваа задача (пр. визуелизација, користење на модел на плоштина, метод на замена).
4. **Prerequisites**: Наведи ги точно потребните предзнаења за оваа задача.
5. **Real-world Modeling**: Опиши детален сценарио од реалниот живот каде оваа математика се применува (modeling_scenario).
6. **Modern Context**: Предложи како задачата би се напишала во модерен Gen-Z контекст (modern_context_suggestion).

Врати СТРОГО JSON објект (PedagogicalInsight).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
            quality_score: { type: Type.NUMBER }
          },
          required: ["common_pitfalls", "socratic_questions", "teaching_strategy", "prerequisites", "modeling_scenario", "quality_score"]
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

export async function extractMathTasksFromPdf(base64Pdf: string, modelName: string = 'gemini-3.1-pro-preview'): Promise<MathTask[]> {
  const prompt = `Ти си експерт за дигитализација на математички текстови (OCR) и професор по математика.
Анализирај го приложениот PDF документ.

Твојата цел е ПЕРФЕКТНО да ги извлечеш сите математички задачи.
За секоја задача, врати:
- type: "task" (задача) или "theory" (теорија)
- title: Краток наслов
- original_text: Целосниот текст со LaTeX ($...$ и $$...$$).
- solution_steps: Решение чекор-по-чекор (LaTeX).
- latex_formulas: Клучни формули.
- nanobanana_prompt: Промпт за дијаграм на англиски.
- tags, difficulty, dok_level, grade_level, curriculum_topic.

Осигурај се дека LaTeX кодот е валиден и користи литературен македонски јазик.`;

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
              title: { type: Type.STRING },
              original_text: { type: Type.STRING },
              solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              nanobanana_prompt: { type: Type.STRING, description: "Detailed English prompt for generating an illustration or diagram if present." },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
              dok_level: { type: Type.NUMBER },
              grade_level: { type: Type.STRING },
              curriculum_topic: { type: Type.STRING }
            },
            required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const parsedTasks = JSON.parse(response.text);
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
      model: "gemini-3.1-pro-preview",
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
                nanobanana_prompt: { type: Type.STRING },
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
              required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "pedagogical_insights"]
            },
            hard: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["задача", "теорија"] },
                title: { type: Type.STRING },
                original_text: { type: Type.STRING },
                solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                nanobanana_prompt: { type: Type.STRING },
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
              required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "pedagogical_insights"]
            }
          },
          required: ["easy", "hard"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const result = JSON.parse(response.text);
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
      model: "gemini-3.1-pro-preview",
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

export async function generateEducationalMaterial(tasks: MathTask[], type: MaterialType): Promise<any> {
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

  const prompt = `Ти си Врвен Педагошки Дизајнер. Твојата цел е да ги трансформираш дадените математички задачи во висококвалитетен едукативен материјал од типот: ${type}.
  
  ИНСТРУКЦИЈА ЗА ТИПОТ: ${typePrompts[type]}
  
  ЗАДАЧИ ЗА ТРАНСФОРМАЦИЈА:
  ${JSON.stringify(tasks.map(t => ({ title: t.title, text: t.original_text, topic: t.curriculum_topic, difficulty: t.difficulty })), null, 2)}
  
  ПРАВИЛА:
  1. Користи македонски јазик.
  2. Користи перфектен LaTeX за сите формули ($...$ и $$...$$).
  3. Врати СТРОГО JSON објект со соодветна структура за овој тип на материјал.
  
  СТРУКТУРА НА ОДГОВОРОТ:
  За 'quiz': { "questions": [ { "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 } ] }
  За 'flashcards': { "cards": [ { "front": "...", "back": "..." } ] }
  За 'presentation': { "slides": [ { "title": "...", "content": "...", "type": "theory|example|task" } ] }
  За останатите: { "title": "...", "sections": [ { "heading": "...", "content": "..." } ], "answerKey": "..." }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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

export async function advancedMultimodalExtraction(
  source: { type: 'url' | 'file' | 'text'; data: string; mimeType?: string },
  model: string = "gemini-3.1-pro-preview",
  customInstructions: string = ""
): Promise<MathTask[]> {
  const prompt = `Ти си "Extraction Architect" од светска класа. Твојата мисија е ПЕРФЕКТНО извлекување на математички содржини (задачи и теорија) од дадениот извор.
  
СТРАТЕГИЈА ЗА МАКСИМАЛНА ПРЕЦИЗНОСТ (Chain-of-Thought):
1. **Транслаторски Мотор (КРИТИЧНО)**: Изворот често ќе биде на англиски јазик. Твоја задача е да функционираш како експерт-преведувач. СИТЕ ТЕКСТОВИ, ЗАДАЧИ, ТЕОРИИ И ОБЈАСНУВАЊА мора перфектно да се преведат на образовен македонски јазик во крајниот формат.
2. **Теорија вс. Задачи**: Прво направи идентификација дали изворот содржи теоретски вовед, дефиниции или формули. ИЗВЛЕЧИ ЈА ТЕОРИЈАТА како посебен објект со \`type: "theory"\`. Задачите извлечи ги како \`type: "task"\`. За теорија, \`solution_steps\` нека содржи клучни поенти или изведувања.
3. **МАКЕДОНСКИ СТАНДАРДИ**: Секогаш користи ДЕЦИМАЛНА ЗАПИРКА (на пр. 3,14). Користи го терминот "коефициент на правец" (наместо наклон). Терминологијата мора да биде локализирана за македонскиот образовен систем.
4. **LaTeX**: Секој симбол, бројка и формула МОРА да биде во перфектен LaTeX ($...$).
5. **Визуелна Реконструкција**: Ако изворот е слика или PDF, анализирај ги и ГРАФИЦИТЕ - напиши ТЕХНИЧКИ ОПИС во "nanobanana_prompt" на англиски.
6. **Custom Instructions**: ${customInstructions || 'Нема специфични насоки.'}

Врати JSON објект кој го анализира процесот и ги структурира податоците.`;

  try {
    let finalPayloadContext = prompt;
    
    // Ако е URL, користиме двостепен пристап како кај extractMathTasksFromUrl
    if (source.type === 'url') {
      const searchPrompt = `Ти си истражувач. Најди го деталниот транскрипт или главната содржина за следното YouTube видео / веб страна: ${source.data}. 
Извлечи ги сите математички задачи и објаснувања во нивниот ОРИГИНАЛЕН јазик. Не преведувај. Користи Google Search. Врати детален извештај.`;
      
      let urlContext = "";

      if (source.data.includes('youtube.com') || source.data.includes('youtu.be')) {
         try {
           const res = await fetch(`/api/youtube/transcript?url=${encodeURIComponent(source.data)}`);
           if (res.ok) {
             const text = await res.text();
             if (!text.startsWith('<')) {
               const data = JSON.parse(text);
               if (data.transcript) {
                 urlContext = data.transcript;
               }
             }
           }
         } catch (e) {
           console.warn("Локалниот Youtube Scraper не успеа во слободен режим.");
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
                  type: { type: Type.STRING, enum: ["task", "theory"] },
                  title: { type: Type.STRING },
                  original_text: { type: Type.STRING },
                  solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  nanobanana_prompt: { type: Type.STRING, description: "Detailed English prompt for generating an illustration or diagram if present." },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                  dok_level: { type: Type.NUMBER },
                  grade_level: { type: Type.STRING },
                  curriculum_topic: { type: Type.STRING }
                },
                required: ["evidence_quote", "type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
              }
            }
          },
          required: ["notebook_briefing", "extraction_confidence", "extracted_tasks"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const parsedObj = JSON.parse(response.text);
    const results = parsedObj.extracted_tasks || [];
    return results.map((t: any) => ({ ...t, source_url: source.type === 'url' ? source.data : 'Прикачена датотека' }));
  } catch (error) {
    console.error("Грешка при напредна екстракција:", error);
    handleGeminiError(error);
  }
}

export async function extractMathTasksFromUrl(url: string, model: string = "gemini-3.1-pro-preview", timeRange?: {start: string, end: string}): Promise<MathTask[]> {
  let timeContext = "";
  if (timeRange && (timeRange.start || timeRange.end)) {
    timeContext = `\nВНИМАНИЕ: Фокусирај се ИСКЛУЧИВО на делот од видеото/содржината од ${timeRange.start || 'почеток'} до ${timeRange.end || 'крај'}. Игнорирај го останатиот дел.`;
  }

  // ЧЕКОР 1: Прибирање фактографски контекст (Транскрипт)
  let videoContext = "";
  
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
     try {
       console.log("Обид за извлекување преку интерниот бесплатен Youtube Proxy API...");
       // 1. Прво пробај преку нашиот нов бесплатен Express API (youtube-transcript)
       const res = await fetch(`/api/youtube/transcript?url=${encodeURIComponent(url)}`);
       if (res.ok) {
         const text = await res.text();
         if (!text.startsWith('<')) {
           const data = JSON.parse(text);
           if (data.transcript) {
             videoContext = data.transcript;
           }
         }
       }
     } catch (e) {
       console.warn("Локалниот Youtube Scraper не успеа, паѓаме на Gemini пребарување.");
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
        throw new Error("Не може да се пристапи до точниот транскрипт. Ве молиме обезбедете PDF/Слика или копирајте го транскриптот рачно за да избегнеме халуцинации.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("NO_TRANSCRIPT")) throw err;
      console.warn("Грешка при пребарување на транскрипт преку Google Search:", err);
      throw new Error("Не може да се пристапи до точниот транскрипт. Системот за пребарување е блокиран.");
    }
  }

  // ЧЕКОР 2: Строга JSON екстракција БЕЗ алатки
  const extractionPrompt = `Ти си Врвен Светски Експерт за Дигитализација на Математичка Едукација и специјалист за OCR и анализа на транскрипти.
Твојата мисија е ПЕРФЕКТНО да ги дигитализираш СИТЕ математички содржини (И ТЕОРИЈА И ЗАДАЧИ) кои се појавуваат во овој транскрипт:

==================
ИЗВЛЕЧЕН ТРАНСКРИПТ/СОДРЖИНА ОД ИЗВОРОТ (${url}):
${videoContext}
==================

СТРАТЕГИЈА ЗА МАКСИМАЛНА ПРЕЦИЗНОСТ (Chain-of-Thought):
1. **Транслаторски Мотор (КРИТИЧНО)**: Транскриптот скоро секогаш ќе биде на англиски јазик (или друг странски). Твоја задача е да функционираш како експерт-преведувач. СИТЕ ТЕКСТОВИ, ЗАДАЧИ, ТЕОРИИ И ОБЈАСНУВАЊА мора перфектно да се преведат на образовен македонски јазик во крајниот формат. Во \`original_text\` зачувај го македонскиот превод, НЕ англискиот оригинал.
2. **Теорија вс. Задачи (КРИТИЧНО)**: Видеата често почнуваат со теоретски вовед (дефиниции, формули, правила). ИЗВЛЕЧИ ЈА ТЕОРИЈАТА како посебен објект со \`type: "theory"\`. Задачите извлечи ги како \`type: "task"\`. Ова е многу важно за градење на лекции. За теорија, во "solution_steps" напиши ги клучните поенти или изведувања (на македонски).
3. **МАКЕДОНСКИ СТАНДАРДИ**: Користи ДЕЦИМАЛНА ЗАПИРКА (на пр. 3,14), а не точка. Користи "коефициент на правец" (наместо наклон). 
4. **LaTeX Енкодинг**: Секој математички симбол, бројка или равенка МОРА да биде во LaTeX ($...$).
5. **Илустрации**: Ако е спомнат цртеж, во "nanobanana_prompt" направи ТЕХНИЧКИ ОПИС на англиски.

ПРАВИЛА ЗА ЈАЗИК:
- "original_text", "title" и "solution_steps" МОРА да се исклучиво на литературен македонски јазик. Не оставај англиски зборови освен ако не се интернационални ознаки.

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
                  title: { type: Type.STRING },
                  original_text: { type: Type.STRING },
                  solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  nanobanana_prompt: { type: Type.STRING, description: "Detailed English prompt for diagram generation." },
                  source_timestamp: { type: Type.STRING, description: "Estimate video timestamp, e.g., [12:30]" },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                  dok_level: { type: Type.NUMBER },
                  grade_level: { type: Type.STRING },
                  curriculum_topic: { type: Type.STRING },
                  hints: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["evidence_quote", "type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "hints"]
              }
            }
          },
          required: ["notebook_briefing", "extraction_confidence", "extracted_tasks"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const parsedObj = JSON.parse(response.text);
    const tasks: MathTask[] = parsedObj.extracted_tasks || [];
    return tasks.map(t => ({ ...t, source_url: url }));
  } catch (error) {
    console.error("Грешка при екстракција од URL:", error);
    handleGeminiError(error);
  }
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `Create a high-quality educational math illustration for the following concept: ${prompt}. Style: Clean, professional, 2D vector illustration, educational, vibrant colors, white background.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
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

export async function extractMathTasksFromImage(base64Image: string, mimeType: string, model: string = "gemini-3.1-pro-preview"): Promise<MathTask[]> {
  const prompt = `Ти си Врвен Светски Експерт за Дигитализација на Математика и Напреден OCR. Твојата задача е ПЕРФЕКТНО да ја анализираш сликата и да ги извлечеш задачите со 100% точност.

СПЕЦИФИЧНИ ИНСТРУКЦИИ:
1. **Zero-Error LaTeX Standard**: 
   - Сите математички изрази, броеви и променливи МОРА да бидат во $inline$ LaTeX формат.
   - Сите издвоени формули и равенки МОРА да бидат во $$display$$ LaTeX формат.
2. **Chain-of-Thought Logic**: За секоја задача, генерирај детално, скалилесто решение.
3. **Јазик**: Професионален македонски јазик.

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
              title: { type: Type.STRING },
              original_text: { type: Type.STRING },
              solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              latex_formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              nanobanana_prompt: { type: Type.STRING, description: "Detailed English prompt for generating an illustration or diagram if present." },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
              dok_level: { type: Type.NUMBER },
              grade_level: { type: Type.STRING },
              curriculum_topic: { type: Type.STRING }
            },
            required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const tasks: MathTask[] = JSON.parse(response.text);
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
  const prompt = `Ти си Стручен Socratic Tutor за Математика. Твојата задача е да го провериш последниот чекор на ученикот во решавањето на задачата.
Ако ученикот побара насока со фразата (Те молам дај ми Сократска насока), твојата примарна цел е ДА НЕ ГО ДАДЕШ РЕШЕНИЕТО, туку да поставиш провокативно Сократско прашање базирано на неговиот досегашен пробив.

КОНТЕКСТ НА ЗАДАЧАТА:
${task.original_text}

РЕШЕНИЕ (за референца):
${task.solution_steps.join('\n')}

ПРЕТХОДНИ ЧЕКОРИ НА УЧЕНИКОТ:
${previousSteps.join('\n')}

ПОСЛЕДЕН ЧЕКОР НА УЧЕНИКОТ:
${userStep}

ИНСТРУКЦИИ:
1. Провери дали последниот чекор е математички точен и логичен во однос на претходните.
2. Ако е точен, дај позитивно засилување. Ако ученикот го завршил решавањето до крај (го нашол финалниот резултат), задолжително сетирај "isFinished": true и кажи "Браво, успешно заврши!".
3. Ако е погрешен или бара насока, објасни зошто е погрешен БЕЗ да го кажеш точниот одговор. Дај суптилен hint преку Сократово прашање.
4. Користи LaTeX за сите изрази.
5. Јазик: Македонски.

Врати го одговорот во JSON формат.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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

ИНСТРУКЦИИ:
1. Дај кратко објаснување што претставува формулата.
2. Објасни ги променливите (ако ги има).
3. Дај еден краток пример за нејзина примена.
4. Користи LaTeX за сите математички изрази во објаснувањето.
5. Одговорот треба да биде краток (максимум 3-4 реченици).

Врати само текст (Markdown формат е дозволен).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
      model: "gemini-3.1-pro-preview",
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
    const updates = JSON.parse(response.text);
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
3. Користи LaTeX и македонски јазик.
4. Врати JSON низа од објекти на задачи.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
      nanobanana_prompt: "",
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
3. Користи LaTeX и македонски јазик.
4. Врати JSON низа од 3 објекти на задачи.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
      nanobanana_prompt: "",
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

export async function analyzeSolutionImage(task: MathTask, base64Image: string, mimeType: string): Promise<{
  analysis: string;
  errorsFound: string[];
  suggestions: string[];
  score: number;
  bloom_level_assessed?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
}> {
  const prompt = `Ти си Специјализиран AI За Оценување Математика (Math Auto-Grader). Ученикот прикачи слика од својата работа за следната задача:

ЗАДАЧА:
${task.original_text}

РЕШЕНИЕ ЗА РЕФЕРЕНЦА:
${task.solution_steps?.join('\n')}

МЕТОДОЛОГИЈА ЗА ОЦЕНУВАЊЕ (The AI Auto-Grader Protocol):
1. **Транскрипција & Споредба:** Прочитај го ракописот. Спореди го чекор-по-чекор со референтното решение.
2. **Локализација на Грешки:** Најди ја ТОЧНАТА локација на грешката (пр. "Ученикот заборавил минус пред тројката во вториот чекор додека решаваше квадратна равенка").
3. **Парцијални поени (Partial Scoring):** Додели поени од 0 до 100. Ако ученикот имал правилен концепт, но компјутациска грешка, не му давај 0. Вреднувај ги чекорите кои се точни пред грешката.
4. **Блумово Ниво (Bloom's Assessment):** Одреди до кое когнитивно ниво ученикот покажал разбирање. Ако направил само грешка во собирање (apply), но знаел да ја постави формулата (analyze), евалуирај го соодветно.
5. **Фидбек:** Напиши пријателски фидбек што го фали за тоа што го направил добро, и му укажува на грешката без да звучи дестимулирачки.
6. Користи LaTeX за сите формули. Јазик: Македонски.

Врати го одговорот ВО СТРОГО JSON ФОРМАТ.`;

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
            score: { type: Type.NUMBER, description: "Поени од 0 до 100 базирано на парцијално оценување." },
            bloom_level_assessed: { type: Type.STRING, enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"] }
          },
          required: ["analysis", "errorsFound", "suggestions", "score", "bloom_level_assessed"]
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
