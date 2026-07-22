/**
 * Materials domain — generate educational materials & lesson content.
 * Moved verbatim from the former gemini.ts god-object.
 */
import { ai, handleGeminiError } from './client';
import { buildCurriculumContextBlockRag } from './utils';
import { MathTask } from '../schema';
import { Type } from '@google/genai';
import { DEFAULT_MODEL, FAST_MODEL } from './models';

export async function generateLessonArchitectScript(task: MathTask, language: string = 'mk'): Promise<import("../schema").LessonArchitectScript> {
  const languageInstruction = language === 'mk'
    ? 'Одговори на македонски јазик.'
    : `Respond in ${language}.`;

  const response = await ai.models.generateContent({
    model: FAST_MODEL,
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

export type MaterialType = 'worksheet' | 'test' | 'collection' | 'quiz' | 'presentation' | 'flashcards' | 'homework' | 'study_guide';

export async function generateLessonPlan(tasks: MathTask[], gradeLevel: string, topicName: string, language: string = 'mk') {
  const languagePrompt =
    language === 'en' ? 'Use English language and professional terminology.' :
    language === 'al' ? 'Përdor gjuhën shqipe dhe terminologji profesionale.' :
    'Користи македонски јазик, стручна терминологија и беспрекорен LaTeX за формулите.';

  // Get curriculum context for alignment
  const curriculumCtx = await buildCurriculumContextBlockRag(topicName, gradeLevel);

  const prompt = `Ти си Експерт Методичар за математика според стандардите на БРО (Биро за развој на образованието) во Македонија.
${curriculumCtx ? `\n${curriculumCtx}\n` : ''}
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
${languagePrompt}

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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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

export async function generateCurriculumModule(prompt: string): Promise<any> {
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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
