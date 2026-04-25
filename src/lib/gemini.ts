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

export const ai: any = new Proxy({}, {
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

export async function generateTaskEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
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
4. **Визуелизација и Аналогии**: Користи аналогии од реалниот живот за да објасниш апстрактни концепти (пр. равенките се како вага, дропките се како сечење пица). ${MATH_PLOT_INSTRUCTION} ${ALGEBRA_TILES_INSTRUCTION}
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

export async function extractMathTasksFromPdf(base64Pdf: string, targetLanguage: string = 'auto', enableLogicalReconstruction: boolean = true, modelName: string = 'gemini-3.1-pro-preview'): Promise<MathTask[]> {
  const prompt = `Ти си експерт за дигитализација на математички текстови и креатор на "Advanced Vision OCR".
Анализирај го приложениот документ кој може да биде скан од стар кириличен учебник (пр. од 80-тите) со нејасен текст.

СТРАТЕГИЈА ЗА "ADVANCED VISION OCR":
${enableLogicalReconstruction 
  ? `1. **Напредно Препознавање и Логичка Реконструкција (ВКЛУЧЕНО)**: Доколку наидеш на оштетен или нејасен текст во скениран учебник, направи дедукција и логичка реконструкција врз основа на математичкиот контекст.`
  : `1. **Класично Препознавање OCR (Без Реконструкција)**: Препиши го точно тоа што е на документот. Ако нешто е целосно нечитливо, означи го со [нечитливо].`}
2. **Јазични Поставки (Мултијазичност)**: 
   - НАЈПРВО АВТОМАТСКИ ПРЕПОЗНАЈ ГО ЈАЗИКОТ на изворниот документ (најчесто Македонски, Руски, Турски или Англиски) и запиши ја кратенката ('mk', 'en', 'ru', 'tr') во \`detected_language\`.
   - ${targetLanguage === 'auto' ? `Бидејќи крајниот јазик е 'auto', целиот излез (оригинален текст, чекори, итн.) задржи го на тој препознаен јазик.` : `ВНИМАНИЕ: Без разлика на кој јазик е изворниот текст, ТИ МОРАШ ДА ГО ПРЕВЕДЕШ целиот математички текст (\`original_text\`, \`title\`), објаснувањата и чекорите за решавање СТРОГО на **${targetLanguage === 'mk' ? 'Македонски' : targetLanguage === 'en' ? 'Англиски' : targetLanguage === 'ru' ? 'Руски' : 'Турски'} јазик**.`}
3. **Зачувување на стара синтакса**: Зачувај ја структурата на старите типови на задачи користејќи прецизен LaTeX.

Твојата цел е ПЕРФЕКТНО да ги извлечеш сите математички задачи.
За секоја задача, врати:
- type: "task" (задача) или "theory" (теорија)
- detected_language: Кратенка од детектираниот јазик (mk, en, tr...)
- title: Краток наслов
- original_text: Целосниот текст со LaTeX ($...$ и $$...$$).
- solution_steps: Решение чекор-по-чекор (LaTeX).
- latex_formulas: Клучни формули.
- illustration_prompt: Промпт за дијаграм на англиски.
- tags, difficulty, dok_level, grade_level, curriculum_topic.

Осигурај се дека LaTeX кодот е валиден.`;

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
  1. Користи ${targetLanguage === 'mk' ? 'Македонски' : targetLanguage === 'en' ? 'Англиски' : targetLanguage === 'ru' ? 'Руски' : 'Турски'} јазик за сите наслови, инструкции и објаснувања. Мораш стручно да го адаптираш тонот според одделението (${targetGrade}).
  2. Користи перфектен Zero-Error LaTeX за сите формули ($...$ и $$...$$).
  3. Тагирај ги задачите во материјалот по тежина и одделение каде што е соодветно (пр. "[Лесна, VIII Одделение]").
  4. Врати СТРОГО JSON објект со соодветна структура за овој тип на материјал.
  
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

export async function autoGradeSubmission(
  question: any,
  studentAnswer: any
): Promise<{ score: number, feedback: string }> {
  try {
    const prompt = `Ти си Стручен Оценувач (Smart Grader) по математика. 
За дадена задача, нејзините можни опции (и точен одговор/својства) и одговорот на ученикот, треба да пресметаш:
1. Колку поени добива ученикот (од максималните).
2. Образложение (фидбек) за зошто добива толку поени. Пишувај на македонски, охрабрувачки.

ПОДАТОЦИ:
ЗАДАЧА: ${JSON.stringify(question, null, 2)}
УЧЕНИК ОДГОВАРА: ${JSON.stringify(studentAnswer)}
МАКСИМАЛНИ ПОЕНИ: ${question.points || 0}

ПРАВИЛА:
- Ако е 'multiple' или 'true-false', одговорот е точен или неточен (се-или-ништо).
- Ако е есеј или текст, процени колку е точен и додели парцијални поени.
- Врати строго JSON формат: { "score": <number>, "feedback": "<string>" }`;

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
    console.error("Auto grading error:", error);
    return { score: 0, feedback: "Грешка при автоматското оценување. Потребен е рачен преглед." };
  }
}

export async function advancedMultimodalExtraction(
  source: { type: 'url' | 'file' | 'text'; data: string; mimeType?: string },
  model: string = "gemini-3.1-pro-preview",
  customInstructions: string = ""
): Promise<MathTask[]> {
  const prompt = `Ти си "Extraction Architect" од светска класа и експерт за Мултијазичен OCR. Твојата мисија е ПЕРФЕКТНО извлекување на математички содржини (задачи и теорија) од дадениот извор.
  
СТРАТЕГИЈА ЗА МАКСИМАЛНА ПРЕЦИЗНОСТ И АВТОМАТСКО ПРЕПОЗНАВАЊЕ НА ЈАЗИК (Chain-of-Thought):
1. **Автоматска Детекција на Јазик**: Изворот најчесто ќе биде на: Македонски, Руски, Турски или Англиски. АВТОМАТСКИ ПРЕПОЗНАЈ ГО ЈАЗИКОТ пред да почнеш со екстракција. Запиши го кодот на јазикот ('mk', 'ru', 'tr', 'en') во \`detected_language\`.
2. **Автентична Екстракција**: ЗАДРЖИ ГО ПРЕПОЗНАЕНИОТ ЈАЗИК во целост при креирање на \`original_text\`, \`title\` и \`solution_steps\`. Не преведувај, освен ако јазикот не е од овие 4 (во тој случај преведи на 'mk'). Важно е математичкиот контекст да остане апсолутно точен на тој јазик.
3. **Теорија вс. Задачи**: Прво направи идентификација дали изворот содржи теоретски вовед, дефиниции или формули. ИЗВЛЕЧИ ЈА ТЕОРИЈАТА како посебен објект со \`type: "theory"\`. Задачите извлечи ги како \`type: "task"\`. За теорија, \`solution_steps\` нека содржи клучни поенти или изведувања.
4. **Стандарди**: Доколку извлекуваш или преведуваш на македонски, користи ДЕЦИМАЛНА ЗАПИРКА (на пр. 3,14) и соодветна терминологија. За останатите јазици користи ги нивните локални образовни стандарди.
5. **LaTeX**: Секој симбол, бројка и формула МОРА да биде во перфектен LaTeX ($...$).
6. **Визуелна Реконструкција**: ВНИМАТЕЛНО РАЗЛИКУВАЈ! Ако задачата бара илустрација на реални објекти (на пр. автомобил, јаболка), генерирај англиски промпт во \`illustration_prompt\`. АКО ПАК задачата бара математички график, функција или геометриска слика (на пр. триаголник, координатен систем, парабола), остави го \`illustration_prompt\` празно, и генерирај \`math_graphic_config\` според MathPlotConfig JSON форматот. Ако не е потребен графички приказ, остави ги двете празни.
7. **Време на видео (Timestamps)**: Доколку изворот е видео или транскрипт од видео според кој можеш да лоцираш време, или доколку се работи за повеќе-страничен документ и знаеш на која страница е, запиши го во \`source_timestamp\` (пр. "04:15" или "Page 3").
8. **Custom Instructions**: ${customInstructions || 'Нема специфични насоки.'}

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
                  source_timestamp: { type: Type.STRING, description: "Timestamp (e.g. 04:15) or Page number where this task occurs in the source media." },
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
                required: ["evidence_quote", "type", "detected_language", "title", "original_text", "solution_steps", "latex_formulas", "illustration_prompt", "tags", "difficulty", "dok_level", "bloom_taxonomy", "grade_level", "curriculum_topic"]
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

export async function extractMathTasksFromUrl(url: string, model: string = "gemini-3.1-pro-preview", timeRange?: {start: string, end: string}, manualTranscript?: string): Promise<MathTask[]> {
  let timeContext = "";
  if (timeRange && (timeRange.start || timeRange.end)) {
    timeContext = `\nВНИМАНИЕ: Фокусирај се ИСКЛУЧИВО на делот од видеото/содржината од ${timeRange.start || 'почеток'} до ${timeRange.end || 'крај'}. Игнорирај го останатиот дел.`;
  }

  // ЧЕКОР 1: Прибирање фактографски контекст (Транскрипт)
  let videoContext = manualTranscript || "";
  
  if (!videoContext && (url.includes('youtube.com') || url.includes('youtu.be'))) {
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

СТРАТЕГИЈА ЗА МАКСИМАЛНА ПРЕЦИЗНОСТ И АВТОМАТСКО ПРЕПОЗНАВАЊЕ НА ЈАЗИК (Chain-of-Thought):
1. **Автоматска Детекција на Јазик**: Изворот најчесто ќе биде на еден од 4-те јазици: Македонски, Руски, Турски или Англиски. Првиот чекор ти е да го ПРЕПОЗНАЕШ оригиналот. Запиши ја ознаката ('mk', 'ru', 'tr', 'en') во \`detected_language\`.
2. **Автентична Екстракција**: Екстракцијата во \`original_text\` и \`solution_steps\` мора да се задржи на тој идентичен детектиран јазик за автентичност со видеото (освен ако е надвор од тие 4 јазици, тогаш преведи на 'mk').
3. **Теорија вс. Задачи (КРИТИЧНО)**: Видеата често почнуваат со теоретски вовед (дефиниции, формули, правила). ИЗВЛЕЧИ ЈА ТЕОРИЈАТА како посебен објект со \`type: "theory"\`. Задачите извлечи ги како \`type: "task"\`. Ова е многу важно за градење на лекции. За теорија, во "solution_steps" напиши ги клучните поенти или изведувања.
4. **Стандарди за Форматирање**: Користи релевантни математички стандарди (пр. децимална запирка за Македонски).
5. **LaTeX Енкодинг**: Секој математички симбол, бројка или равенка МОРА да биде во перфектен LaTeX ($...$).
6. **Илустрации и Графици**: Формирај \`illustration_prompt\` за стварни/животни објекти. Формирај \`math_graphic_config\` (JSON објект) за геометрија и координатни системи.

ПРАВИЛА ЗА ЈАЗИК:
- "original_text", "title" и "solution_steps" треба да бидат на детектираниот јазик, граматички обработени за да изгледаат како професионален учебник.

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
    const parsedObj = JSON.parse(response.text);
    const tasks: MathTask[] = parsedObj.extracted_tasks || [];
    return tasks.map(t => ({ ...t, source_url: url }));
  } catch (error) {
    console.error("Грешка при екстракција од URL:", error);
    handleGeminiError(error);
  }
}

export async function generateMathGraphicConfig(prompt: string): Promise<string> {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is missing");
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `Ти си Експерт по Математички Визуелизации (GeoGebra / TikZ / JSXGraph). Твоја задача е да конвертираш математички или геометриски промпт во валидна JSON конфигурација за MathPlotConfig.
Строги правила за JSON форматот:
{
  "viewport": { "xMin": -10, "xMax": 10, "yMin": -10, "yMax": 10 },
  "grid": { "stepX": 1, "stepY": 1, "showAxes": true },
  "elements": [
    { "type": "point", "x": 0, "y": 0, "label": "A", "color": "#ef4444" },
    { "type": "segment", "x1": -5, "y1": -5, "x2": 5, "y2": 5, "color": "#3b82f6" },
    { "type": "circle", "cx": 0, "cy": 0, "r": 5, "fill": "rgba(0,0,0,0)", "stroke": "#10b981" },
    { "type": "angle", "cx": 0, "cy": 0, "r": 2, "startAngle": 0, "endAngle": 45, "label": "α" },
    { "type": "polygon", "points": [{"x":0,"y":0}, {"x":5,"y":0}, {"x":0,"y":5}], "fill": "rgba(234,179,8,0.2)" },
    { "type": "function-path", "points": [{"x":-5,"y":25}, {"x":0,"y":0}, {"x":5,"y":25}] }
  ]
}
Оптимизирај го viewport-от да ги собере сите елементи.
Фокусирај се на математичката точност и апсолутните пропорции (како AutoCAD или GeoGebra).
Врати само валиден JSON. Без \`\`\`json\`\`\` макроа.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
      model: "gemini-2.5-flash-image",
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
  const prompt = `Ти си Врвен Светски Експерт за Дигитализација на Математика и дизајнер на "Advanced Vision OCR". 
Твојата мисија е ПЕРФЕКТНО да ја анализираш сликата и да ги извлечеш задачите.

СПЕЦИФИЧНИ ИНСТРУКЦИИ ЗА "ADVANCED VISION OCR":
${enableLogicalReconstruction 
  ? `1. **Напредно Препознавање и Логичка Реконструкција (ВКЛУЧЕНО)**: Сликата може да биде нејасен ракопис или оштетен текст од стар учебник. Твоја задача е да направиш **ЛОГИЧКА РЕКОНСТРУКЦИЈА** на оштетениот дел врз основа на математичкиот контекст. Дедуцирај ги нејасните симболи од логиката на самата равенка.`
  : `1. **Класично Препознавање OCR (Без Реконструкција)**: Препиши го точно тоа што е на сликата. Ако нешто е целосно нечитливо, означи го со [нечитливо].`}
2. **Јазични Поставки (Мултијазичност)**: 
   - НАЈПРВО АВТОМАТСКИ ПРЕПОЗНАЈ ГО ЈАЗИКОТ на изворниот документ (Македонски, Англиски, Руски, Турски кон текстот). Запиши ја кратенката ('mk', 'en', 'ru', 'tr', итн.) во \`detected_language\`.
   - ${targetLanguage === 'auto' ? `Бидејќи крајниот јазик е 'auto', целиот излез (оригинален текст, чекори, итн.) задржи го на тој препознаен јазик.` : `ВНИМАНИЕ: Без разлика на кој јазик е изворниот текст, ТИ МОРАШ ДА ГО ПРЕВЕДЕШ целиот математички текст (\`original_text\`, \`title\`), објаснувањата и чекорите за решавање СТРОГО на **${targetLanguage === 'mk' ? 'Македонски' : targetLanguage === 'en' ? 'Англиски' : targetLanguage === 'ru' ? 'Руски' : 'Турски'} јазик**.`}
3. **Zero-Error LaTeX Standard**: 
   - Сите математички изрази, броеви и променливи МОРА да бидат во $inline$ LaTeX формат.
   - Сите издвоени формули и равенки МОРА да бидат во $$display$$ LaTeX формат.
   - Зачувај ја структурата на старите типови на задачи (пр. системи равенки со големи загради, комплексни дропки, лимеси).
4. **Chain-of-Thought Logic**: За секоја извлечена задача, генерирај детално, скалилесто решение.

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
              illustration_prompt: { type: Type.STRING, description: 'Prompt for NanoBanana real-world illustrations ONLY.' }, math_graphic_config: { type: Type.OBJECT, description: 'JSON for geometric or mathematical plots.' },
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
4. Користи LaTeX за сите изрази. ${MATH_PLOT_INSTRUCTION} ${ALGEBRA_TILES_INSTRUCTION}
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

export async function analyzeSolutionImage(task: MathTask, base64Image: string, mimeType: string): Promise<{
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
}> {
  const prompt = `Ти си Специјализиран AI За Оценување Математика (Math Auto-Grader). Ученикот прикачи слика од својата работа за следната задача:

ЗАДАЧА:
${task.original_text}

РЕШЕНИЕ ЗА РЕФЕРЕНЦА:
${task.solution_steps?.join('\n')}

МЕТОДОЛОГИЈА ЗА ОЦЕНУВАЊЕ (The Formative Auto-Grader Protocol):
1. **Транскрипција & Споредба:** Прочитај го ракописот. Спореди го чекор-по-чекор со референтното решение.
2. **Локализација на Грешки:** Најди ја ТОЧНАТА локација на грешката (пр. "Ученикот заборавил минус пред тројката во вториот чекор").
3. **Парцијални поени (Partial Scoring):** Додели поени од 0 до 100. Ако ученикот имал правилен концепт, но компјутациска грешка, не му давај 0.
4. **Формативна Рубрика (Rubric Breakdown):** Раздели го извештајот во 3 димензии (секоја од 0 до 100 поени):
   - Concept: Дали ученикот го разбрал методот и формулата? (Концептуално знаење)
   - Execution: Дали алгебарската и аритметичката пресметка е точна? (Процедурално знаење)
   - Presentation: Дали чекорите се запишани логично, читливо и по ред? (Комуникациски вештини)
5. **Динамична Педагошка Метрика (Cognitive Framework):** Анализирај ја природата на задачата (дали е едноставна пресметка, комплексен проблем, или доказ). Самостојно одбери го НАЈПОГОДНИОТ педагошки фајмворк за да го оцениш знаењето што го покажал ученикот:
   - 'bloom' (Блумова таксономија) - најдобра за општо когнитивно ниво (вредности: "remember", "understand", "apply", "analyze", "evaluate", "create").
   - 'dok' (Webb's Depth of Knowledge) - најдобра за мерење комплексност (вредности: "level_1", "level_2", "level_3", "level_4").
   - 'solo' (SOLO Taxonomy) - најдобра за евалуација на структура и квалитет на аргументацијата (вредности: "prestructural", "unistructural", "multistructural", "relational", "extended_abstract").
6. **Детекција на Празнини во Знаење (Knowledge Gaps):** Во полето 'identified_weaknesses' наведи 1-3 конкретни математички концепти во кои ученикот греши (на пр. "Дропки", "Редици", "Негативни броеви", "Питагорова теорема"). Ако нема грешки, врати празна листа [].
7. **Фидбек:** Напиши конструктивен формат каде ја објаснуваш грешката но и фалиш што е направено добро. Користи LaTeX.

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
            }
          },
          required: ["analysis", "errorsFound", "suggestions", "score", "pedagogical_evaluation", "rubric_breakdown"]
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
      model: "gemini-3.1-pro-preview",
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

    const text = response.text();
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
      model: "gemini-3.1-pro-preview",
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
