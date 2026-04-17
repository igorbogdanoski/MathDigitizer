import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MathTask } from "./schema";

// Иницијализација на Gemini клиентот
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    throw error;
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

export async function extractMathTasksFromPdf(base64Pdf: string, modelName: string = 'gemini-3.1-pro-preview'): Promise<MathTask[]> {
  const prompt = `Ти си експерт за дигитализација на математички текстови (OCR) и професор по математика.
Анализирај го приложениот PDF документ кој содржи математички задачи (може да е тест, збирка или скрипта).

Твојата цел е да ги извлечеш сите математички задачи и теоретски концепти од документот.
За секоја задача, врати ги следните информации:
- type: "task" (задача) или "theory" (теорија)
- title: Краток наслов
- original_text: Целосниот текст. ЗАДОЛЖИТЕЛНО користи LaTeX форматирање за сите математички изрази (користи $...$ за inline и $$...$$ за блок формули).
- solution_steps: Низа од чекори за решавање (со LaTeX).
- latex_formulas: Низа од најважните LaTeX формули користени во задачата.
- nanobanana_prompt: Детален промпт на АНГЛИСКИ јазик за генерирање на дијаграм/график поврзан со задачата.
- tags: Низа од тагови (пр. "геометрија", "тригонометрија").
- difficulty: "easy", "medium" или "hard".
- dok_level: Depth of Knowledge ниво (1-4).
- grade_level: За кое одделение/година е наменето.
- curriculum_topic: Главна тема (пр. "Линеарни равенки").
- pedagogical_insights: Педагошки сознанија (common_pitfalls, socratic_questions, modern_context_suggestion, modeling_scenario).
  - modeling_scenario: Опиши како оваа задача може да се претвори во проект за математичко моделирање заснован на реална животна ситуација.

Осигурај се дека LaTeX кодот је валиден и користи литературен македонски јазик.`;

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
              curriculum_topic: { type: Type.STRING },
              pedagogical_insights: {
                type: Type.OBJECT,
                properties: {
                  common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
                  socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  modern_context_suggestion: { type: Type.STRING },
                  modeling_scenario: { type: Type.STRING }
                },
                required: ["common_pitfalls", "socratic_questions", "modeling_scenario"]
              }
            },
            required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "pedagogical_insights"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const parsedTasks = JSON.parse(response.text);
    return parsedTasks.map((task: any) => ({ ...task, source_url: "PDF Документ" }));
  } catch (error) {
    console.error("Грешка при екстракција од PDF:", error);
    throw error;
  }
}

export async function extractTaskFromImage(base64Image: string, mimeType: string): Promise<Partial<MathTask>> {
  const prompt = `Ти си експерт за дигитализација на математички текстови (OCR) и професор по математика.
Анализирај ја сликата која содржи математичка задача (може да е од стар учебник, ракопис или фотографија од табла).

Врати JSON објект со следната структура:
{
  "title": "Краток и јасен наслов на задачата",
  "original_text": "Целосниот текст на задачата. ЗАДОЛЖИТЕЛНО користи LaTeX форматирање за сите математички изрази, броеви и променливи (користи $...$ за inline и $$...$$ за блок формули).",
  "difficulty": "easy", "medium" или "hard",
  "grade_level": "пр. 8-мо одделение, 1-ва година средно...",
  "curriculum_topic": "пр. Алгебра, Геометрија, Дропки, Функции...",
  "dok_level": 1, 2, 3 или 4 (Depth of Knowledge),
  "solution_steps": ["Чекор 1...", "Чекор 2..."],
  "pedagogical_insights": {
    "common_pitfalls": ["Внимавајте на...", "Честа грешка во чекор X е..."],
    "socratic_questions": ["Како би можеле да го претставиме ова...?", "Што се случува ако...?"],
    "modeling_scenario": "Опис на реална животна ситуација за математичко моделирање..."
  }
}

Осигурај се дека LaTeX кодот е валиден и користи литературен македонски јазик.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        { text: prompt },
        { inlineData: { data: base64Image, mimeType } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            original_text: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            grade_level: { type: Type.STRING },
            curriculum_topic: { type: Type.STRING },
            dok_level: { type: Type.NUMBER },
            solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            pedagogical_insights: {
              type: Type.OBJECT,
              properties: {
                common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
                socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                modern_context_suggestion: { type: Type.STRING },
                modeling_scenario: { type: Type.STRING }
              },
              required: ["common_pitfalls", "socratic_questions", "modeling_scenario"]
            }
          },
          required: ["title", "original_text", "difficulty", "grade_level", "curriculum_topic", "dok_level", "solution_steps", "pedagogical_insights"]
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор од моделот.");
    const result = JSON.parse(response.text);
    
    return {
      ...result,
      type: "задача",
      latex_formulas: [],
      nanobanana_prompt: "",
      tags: [result.curriculum_topic]
    };
  } catch (error) {
    console.error("Грешка при OCR екстракција:", error);
    throw error;
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

export async function extractMathTasksFromUrl(url: string, model: string = "gemini-3.1-pro-preview", timeRange?: {start: string, end: string}): Promise<MathTask[]> {
  let timeContext = "";
  if (timeRange && (timeRange.start || timeRange.end)) {
    timeContext = `\nВНИМАНИЕ: Фокусирај се ИСКЛУЧИВО на делот од видеото/содржината од ${timeRange.start || 'почеток'} до ${timeRange.end || 'крај'}. Игнорирај го останатиот дел.`;
  }

  const prompt = `Ти си Врвен Светски Експерт за Дигитализација на Математичка Едукација и Методолошки Архитект. Твојата мисија е да ја анализираш содржината од дадениот URL и да ги извлечеш сите математички задачи, теоретски концепти и МЕТОДОЛОГИЈАТА на поучување.${timeContext}

ИСТРАЖУВАЊЕ НА МЕТОДОЛОГИЈА (Methodological Cloning):
1. **Наставна Стратегија (Teaching Strategy)**: Утврди го специфичниот пристап на професорот/авторот. Дали користи визуелен модел (пр. модел на плоштина)? Дали користи специфичен метод како "спотивни коефициенти" наместо "замена"? Опиши ја оваа стратегија прецизно.
2. **Празнини во Знаењето (Prerequisite Mapper)**: Идентификувај кои точно предзнаења се неопходни за ученикот да го разбере ова видео/материјал (пр. "Множење полиноми", "Работа со загради").

ОПШТИ ИНСТРУКЦИИ:
1. **Прецизност**: Секоја формула мора да биде во совршен LaTeX формат.
2. **Контекст**: Извлечи ги сите чекори на решението што се прикажани во содржината.
3. **Педагогија (Insights)**: Генерирај 3 скалилести помоши (hints), идентификувај најчести мисконцепции, Сократови прашања и задолжително МАТЕМАТИЧКО МОДЕЛИРАЊЕ поврзано со реалниот живот.
4. **Јазик**: Македонски.

Врати ги податоците СТРОГО во JSON формат (низа од објекти).`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: `${prompt}\n\nURL ЗА АНАЛИЗА: ${url}`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
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
              hints: { type: Type.ARRAY, items: { type: Type.STRING } },
              pedagogical_insights: {
                type: Type.OBJECT,
                properties: {
                  common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
                  socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  modern_context_suggestion: { type: Type.STRING },
                  modeling_scenario: { type: Type.STRING },
                  teaching_strategy: { type: Type.STRING, description: "Detailed description of the teaching method used in the video." },
                  prerequisites: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Topics/skills needed before watching this." }
                },
                required: ["common_pitfalls", "socratic_questions", "modeling_scenario", "teaching_strategy", "prerequisites"]
              }
            },
            required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "hints", "pedagogical_insights"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const tasks: MathTask[] = JSON.parse(response.text);
    return tasks.map(t => ({ ...t, source_url: url }));
  } catch (error) {
    console.error("Грешка при екстракција од URL:", error);
    throw error;
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
    throw error;
  }
}

export async function extractMathTasksFromImage(base64Image: string, mimeType: string, model: string = "gemini-3.1-pro-preview"): Promise<MathTask[]> {
  const prompt = `Ти си Врвен Светски Експерт за Дигитализација на Математика и Напреден OCR (Optical Character Recognition). Твојата задача е да ја анализираш сликата и да извлечеш едукативни материјали со 100% точност. 
Ова е "Module B: Advanced Vision OCR" од проектот MathDigitizer Pro.

СПЕЦИФИЧНИ ИНСТРУКЦИИ ЗА ВРВНА ЕКСТРАКЦИЈА:
1. **Ракопис и Стари Книги**: Ако текстот е ракописен или од стара кирилична книга (избледен, оштетен), користи го целиот свој капацитет за препознавање на нејасни карактери. Користи логичка математичка реконструкција за да ги пополниш празнините ако нешто е нечитливо.
2. **Zero-Error LaTeX Standard**: 
   - Сите математички изрази, броеви и променливи во текстот МОРА да бидат во $inline$ LaTeX формат (пр. Нека $x = 5$).
   - Сите издвоени формули и равенки МОРА да бидат во $$display$$ LaTeX формат во посебен ред.
   - Користи исклучиво KaTeX-компатибилна синтакса.
3. **Chain-of-Thought (CoT) Logic**: За секоја задача, генерирај детално, скалилесто решение (solution_steps) каде секој чекор е логично објаснет.
4. **Структура**: Препознај дали се работи за теорија или задача. Ако е задача, извлечи го текстот, генерирај решение, тагови, тежина и DoK ниво.
5. **Јазик**: Професионален македонски јазик.

Врати ги податоците СТРОГО во JSON формат (низа од објекти) кој ја следи оваа структура:
[
  {
    "type": "task" или "theory",
    "title": "Краток наслов",
    "original_text": "Целосниот текст со $inline$ LaTeX",
    "solution_steps": ["Чекор 1...", "Чекор 2..."],
    "latex_formulas": ["Формула 1", "Формула 2"],
    "nanobanana_prompt": "Англиски промпт за генерирање дијаграм (ако е потребно, инаку празен стринг)",
    "tags": ["Таг1", "Таг2"],
    "difficulty": "лесно", "средно" или "тешко",
    "dok_level": 1, 2, 3 или 4,
    "grade_level": "пр. 8мо одделение",
    "curriculum_topic": "пр. Алгебра",
    "pedagogical_insights": {
      "common_pitfalls": ["Внимавајте на...", "Честа грешка во чекор X е..."],
      "socratic_questions": ["Како би можеле да го претставиме ова...?", "Што се случува ако...?"],
      "modeling_scenario": "Ситуација од реалниот живот за моделирање..."
    }
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        prompt,
        { inlineData: { data: base64Image, mimeType: mimeType } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
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
              curriculum_topic: { type: Type.STRING },
              pedagogical_insights: {
                type: Type.OBJECT,
                properties: {
                  common_pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
                  socratic_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  modern_context_suggestion: { type: Type.STRING },
                  modeling_scenario: { type: Type.STRING }
                },
                required: ["common_pitfalls", "socratic_questions", "modeling_scenario"]
              }
            },
            required: ["type", "title", "original_text", "solution_steps", "latex_formulas", "nanobanana_prompt", "tags", "difficulty", "dok_level", "grade_level", "curriculum_topic", "pedagogical_insights"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Нема одговор.");
    const tasks: MathTask[] = JSON.parse(response.text);
    return tasks.map(t => ({ ...t, source_url: "Слика (Напреден OCR)" }));
  } catch (error) {
    console.error("Грешка при екстракција од слика:", error);
    throw error;
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
}> {
  const prompt = `Ти си Експерт за Анализа на Ракописни Математички Решенија. Ученикот прикачи слика од својата работа за следната задача:

ЗАДАЧА:
${task.original_text}

ТВОЈА ЗАДАЧА:
1. Анализирај го ракописот на сликата.
2. Спореди го со точното решение.
3. Идентификувај каде ученикот згрешил (ако згрешил).
4. Дај конструктивен фидбек и насоки за подобрување.
5. Користи LaTeX за формули.
6. Јазик: Македонски.

Врати го одговорот во JSON формат.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        prompt,
        { inlineData: { data: base64Image, mimeType: mimeType } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            errorsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["analysis", "errorsFound", "suggestions"]
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
