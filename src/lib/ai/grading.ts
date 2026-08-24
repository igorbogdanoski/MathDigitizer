/**
 * Grading domain — grade and analyze student work.
 * Moved verbatim from the former gemini.ts god-object.
 */
import { ai } from './client';
import { MATH_PLOT_INSTRUCTION, ALGEBRA_TILES_INSTRUCTION, parseGeminiResponse } from './utils';
import { MathTask } from '../schema';
import { Type } from '@google/genai';
import { DEFAULT_MODEL, PRO_MODEL } from './models';

/**
 * Grades one answer.
 *
 * `ownerId` opts this call into the teacher's own distilled textbooks
 * (EXPERT_LEVEL_MASTER_PLAN, 10.1). Grading is where that material is worth
 * most: a distilled chapter carries the specific wrong moves students make on
 * that content, which is the difference between telling a student they are
 * wrong and telling them why. Omitted, or with nothing imported, the prompt is
 * exactly what it was.
 */
export async function autoGradeSubmission(
  question: any,
  studentAnswer: any,
  ownerId?: string
): Promise<{ score: number, feedback: string, socratic_hint?: string, error_detected?: string }> {
  try {
    const { buildKnowledgeContextBlock } = await import('../knowledge/context');
    const knowledge = await buildKnowledgeContextBlock(
      [question?.question, question?.title, question?.curriculum_topic].filter(Boolean).join(' '),
      ownerId,
      question?.curriculum_refs?.flatMap((r: any) => r?.outcome_codes ?? []) ?? [],
    );

    const prompt = `Ти си Стручен Оценувач и Интерактивен Сократски Ментор по математика. 
За дадената задача и одговорот на ученикот, треба да пресметаш поени и да дадеш фидбек.
Ако одговорот не е целосно точен, ТИ НЕ СМЕЕШ ДА ГО ДАДЕШ ГОТОВИОТ ОДГОВОР. 
Наместо тоа, детектирај каде точно ученикот згрешил во чекорите (error_detected) и дај му Сократски хинт (socratic_hint) за да се поправи сам. 

${knowledge ? `${knowledge}
` : ''}ПОДАТОЦИ:
ЗАДАЧА: ${JSON.stringify(question, null, 2)}
УЧЕНИК ОДГОВАРА: ${JSON.stringify(studentAnswer)}
МАКСИМАЛНИ ПОЕНИ: ${question.points || 100}

ПРАВИЛА:
1. ДОДЕЛУВАЈ ПАРЦИЈАЛНИ ПОЕНИ: Ако има точни делови од постапката, дај му соодветен број поени (пр. 50/100).
2. ДЕТЕКТИРАЈ ГРЕШКА: Ако згрешил, објасни прецизно каде е грешката (пр. "Заборави да го промениш знакот при префрлање од другата страна").
3. СОКРАТСКИ ХИНТ: Постави прашање што ќе го наведе сам да ја најде грешката.
4. Ако одговорот е целосно точен (100 поени), пофали го и не мораш да даваш socratic_hint.
4а. Ако има белешки од учебникот погоре и грешката на ученикот се совпаѓа со
    типична грешка наведена таму, искористи го тоа објаснување — тоа е
    материјалот по кој наставникот предава.
5. Врати СТРОГО JSON формат: 
{ 
  "score": <број>, 
  "feedback": "<охрабрувачки осврт на трудот, македонски>", 
  "error_detected": "<опционално, специфичната грешка>", 
  "socratic_hint": "<опционално, прашање за насочување>"
}`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    if (!response.text) throw new Error("Нема одговор.");

    const parsed = parseGeminiResponse(response.text);
    const score = typeof parsed?.score === 'number' ? parsed.score : Number(parsed?.score);
    if (!Number.isFinite(score)) {
      throw new Error('Оценувачот не врати важечки број на поени.');
    }

    return { ...parsed, score: Math.min(100, Math.max(0, score)) };
  } catch (error) {
    // Deliberately rethrown rather than answered with `{ score: 0 }`.
    //
    // This used to swallow its own failure and return a zero, which the caller
    // consumed as a real result: the try/catch around the call never fired, so
    // a malformed response was recorded as a wrong answer. In AdaptiveTest that
    // fed the ability estimate, and a student's estimated level fell because of
    // a stray markdown fence. A grade is a claim about a person — when it
    // cannot be made, the honest answer is that no grade was produced.
    console.error("Auto grading error:", error);
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
      model: DEFAULT_MODEL,
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
    return parseGeminiResponse(response.text);
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
      model: DEFAULT_MODEL,
      contents: prompt,
    });

    if (!response.text) throw new Error("Нема одговор.");
    return response.text;
  } catch (error) {
    console.error("Error explaining formula:", error);
    return "Не можев да генерирам објаснување за оваа формула во моментов.";
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
      model: PRO_MODEL, // Use pro for spatial multimodal
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
    return parseGeminiResponse(response.text);
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
      model: PRO_MODEL,
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
    const parsed = parseGeminiResponse(response.text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Грешка при batch анализа на сликата:", error);
    throw error;
  }
}
