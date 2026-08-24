/**
 * Generation domain — generate new math content.
 * Moved verbatim from the former gemini.ts god-object.
 */
import { ai, handleGeminiError } from './client';
import { parseGeminiResponse, buildCurriculumContextBlockRag } from './utils';
import { generateTaskEmbedding } from './embeddings';
import { MathTask, DifferentiationResult, DifferentiatedTask, DifferentiationConfig } from '../schema';
import { Type } from '@google/genai';
import { PRO_MODEL, DEFAULT_MODEL } from './models';
import { PromptStrategy, buildPromptEnvelope, buildRagTaskContext } from '../promptEngineering';
import { buildRagContextFromLibrary } from '../ragContext';

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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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
    return parseGeminiResponse(response.text);
  } catch (error) {
    console.error("Грешка при генерирање диференциран тест:", error);
    throw error;
  }
}

export async function generateSimilarTask(originalTask: MathTask, style: 'traditional' | 'real-world' | 'modern' = 'traditional', language: string = 'mk'): Promise<MathTask> {
  const stylePrompt =
    style === 'modern' ? 'Користи модерен Gen-Z контекст (гејминг, социјални мрежи, криптовалути).' :
    style === 'real-world' ? 'Користи контекст од реалниот свет и секојдневниот живот (бизнис, готвење, патување).' :
    'Користи традиционален, академски наставен контекст.';

  const languagePrompt = 
    language === 'en' ? 'Use English language.' :
    language === 'al' ? 'Përdor gjuhën shqipe.' :
    'Користи македонски јазик.';

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
3. ${languagePrompt}
4. Врати го резултатот СТРОГО како еден JSON објект кој ја следи истата структура како оригиналот.
5. Осигурај се дека решението е математички точно.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
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

export async function generateDifferentiatedTasks(originalTask: MathTask, style: 'traditional' | 'real-world' | 'modern' = 'traditional'): Promise<{ easy: MathTask, hard: MathTask }> {
  const stylePrompt =
    style === 'modern' ? 'Користи модерен Gen-Z контекст.' :
    style === 'real-world' ? 'Користи контекст од реалниот свет.' :
    'Користи традиционален контекст.';

  // Get curriculum context for alignment
  const curriculumQuery = [
    originalTask.curriculum_topic,
    originalTask.grade_level,
    ...(originalTask.tags ?? []),
  ].filter(Boolean).join(' ');
  const curriculumCtx = await buildCurriculumContextBlockRag(curriculumQuery, originalTask.grade_level);

  const prompt = `Врз основа на следната математичка задача, генерирај ДВЕ нови задачи за диференцирана настава: една ПОЛЕСНА (за ученици на кои им треба поддршка) и една ПОТЕШКА (за напредни ученици).
${curriculumCtx ? `\n${curriculumCtx}\n` : ''}
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
      model: DEFAULT_MODEL,
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
      model: PRO_MODEL,
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
      model: DEFAULT_MODEL,
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
    const results = parseGeminiResponse(response.text);
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
      model: DEFAULT_MODEL,
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
    const results = parseGeminiResponse(response.text);
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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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
    const parsed = parseGeminiResponse(response.text);
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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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

/**
 * Генерира диференцирани верзии на задача (support, core, extension)
 * со scaffolding, hints и success criteria.
 */
export async function generateDifferentiatedTask(
  baseTask: MathTask,
  config: DifferentiationConfig = {
    generateSupport: true,
    generateExtension: true,
    includeHints: true,
    includeScaffolding: true,
    language: 'mk',
  }
): Promise<DifferentiationResult> {
  const languagePrompt =
    config.language === 'en' ? 'Use English language.' :
    config.language === 'al' ? 'Përdor gjuhën shqipe.' :
    'Користи македонски јазик.';

  const prompt = `Ти си Експерт за Диференцирана Настава по Математика.

ЗАДАЧА:
${baseTask.original_text}

ТЕЖИНА: ${baseTask.difficulty}
DOK НИВО: ${baseTask.dok_level || 2}
ТЕМА: ${baseTask.curriculum_topic || 'Математика'}

Генерирај ТРИ диференцирани верзии на оваа задача:

1. **SUPPORT** (за ученици кои имаат потешкотии):
   - Поедноставни броеви/контекст
   - Повеќе чекори во решението
   - Визуелни помагала (ако е применливо)
   - Scaffolding: чекор-по-чекор водич
   - 3 нивоа на hints (од суптилно до речиси решение)

2. **CORE** (стандардно ниво):
   - Слична на оригиналната задача
   - Умерена помош
   - 2 нивоа на hints

3. **EXTENSION** (за напредни ученици):
   - Покомплексен контекст или дополнителни барања
   - Повисоко DOK ниво
   - Предизвик за критичко мислење
   - Минимална помош

За секоја верзија вклучи:
- task: целосната задача (title, original_text, solution_steps, difficulty)
- scaffolding: низа од чекори за помош
- hints: { level1, level2, level3 }
- successCriteria: што значи "успешно решено"
- estimatedTime: минути
- prerequisites: потребни предзнаења

${languagePrompt}

Врати СТРОГО JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            baseTask: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                original_text: { type: Type.STRING },
                difficulty: { type: Type.STRING },
              },
            },
            variants: {
              type: Type.OBJECT,
              properties: {
                support: {
                  type: Type.OBJECT,
                  properties: {
                    task: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        original_text: { type: Type.STRING },
                        solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        difficulty: { type: Type.STRING },
                      },
                    },
                    scaffolding: { type: Type.ARRAY, items: { type: Type.STRING } },
                    hints: {
                      type: Type.OBJECT,
                      properties: {
                        level1: { type: Type.STRING },
                        level2: { type: Type.STRING },
                        level3: { type: Type.STRING },
                      },
                    },
                    successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                    estimatedTime: { type: Type.NUMBER },
                    prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
                core: {
                  type: Type.OBJECT,
                  properties: {
                    task: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        original_text: { type: Type.STRING },
                        solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        difficulty: { type: Type.STRING },
                      },
                    },
                    scaffolding: { type: Type.ARRAY, items: { type: Type.STRING } },
                    hints: {
                      type: Type.OBJECT,
                      properties: {
                        level1: { type: Type.STRING },
                        level2: { type: Type.STRING },
                        level3: { type: Type.STRING },
                      },
                    },
                    successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                    estimatedTime: { type: Type.NUMBER },
                    prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
                extension: {
                  type: Type.OBJECT,
                  properties: {
                    task: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        original_text: { type: Type.STRING },
                        solution_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        difficulty: { type: Type.STRING },
                      },
                    },
                    scaffolding: { type: Type.ARRAY, items: { type: Type.STRING } },
                    hints: {
                      type: Type.OBJECT,
                      properties: {
                        level1: { type: Type.STRING },
                        level2: { type: Type.STRING },
                        level3: { type: Type.STRING },
                      },
                    },
                    successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                    estimatedTime: { type: Type.NUMBER },
                    prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
              },
            },
            pedagogicalNotes: { type: Type.STRING },
            bloomLevel: { type: Type.STRING },
            dokLevel: { type: Type.NUMBER },
          },
          required: ['variants', 'pedagogicalNotes', 'bloomLevel', 'dokLevel'],
        },
      },
    });

    if (!response.text) throw new Error('Нема одговор од AI.');
    const result = parseGeminiResponse(response.text);

    // Transform to DifferentiationResult format
    const now = new Date().toISOString();
    const createDifferentiatedTask = (
      level: 'support' | 'core' | 'extension',
      data: any
    ): DifferentiatedTask => ({
      baseTaskId: baseTask.id || '',
      baseTaskTitle: baseTask.title,
      level,
      task: {
        id: `${baseTask.id}-${level}`,
        type: 'task',
        title: data.task?.title || `${baseTask.title} (${level})`,
        original_text: data.task?.original_text || baseTask.original_text,
        solution_steps: data.task?.solution_steps || [],
        latex_formulas: baseTask.latex_formulas || [],
        difficulty: data.task?.difficulty || baseTask.difficulty,
        source_url: baseTask.source_url,
        tags: baseTask.tags || [],
        dok_level: baseTask.dok_level,
        grade_level: baseTask.grade_level,
        curriculum_topic: baseTask.curriculum_topic,
      },
      scaffolding: data.scaffolding || [],
      hints: data.hints || { level1: '', level2: '', level3: '' },
      successCriteria: data.successCriteria || [],
      estimatedTime: data.estimatedTime || 10,
      prerequisites: data.prerequisites || [],
      createdAt: now,
    });

    return {
      baseTask,
      variants: {
        support: createDifferentiatedTask('support', result.variants?.support || {}),
        core: createDifferentiatedTask('core', result.variants?.core || {}),
        extension: createDifferentiatedTask('extension', result.variants?.extension || {}),
      },
      pedagogicalNotes: result.pedagogicalNotes || '',
      bloomLevel: result.bloomLevel || 'Примена',
      dokLevel: result.dokLevel || baseTask.dok_level || 2,
    };
  } catch (error) {
    handleGeminiError(error);
  }
}
