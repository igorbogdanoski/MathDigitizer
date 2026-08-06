/**
 * Extraction domain — extract math tasks from PDF/URL/images/handwriting.
 * Moved verbatim from the former gemini.ts god-object.
 */
import { ai, handleGeminiError, apiUrl } from './client';
import { parseGeminiResponse, buildCurriculumContextBlockRag } from './utils';
import { MathTask } from '../schema';
import { Type } from '@google/genai';
import { PRO_MODEL, DEFAULT_MODEL } from './models';

/**
 * Shared curriculum-alignment instruction for extraction prompts.
 * Normalizes grade_level to the valid MK curriculum grade tokens and points
 * the model at the official curriculum context injected alongside it.
 */
const CURRICULUM_PROMPT_INSTRUCTION = `ПРАВИЛА ЗА НАСТАВНА ПРОГРАМА (БРО):
- ЗАДОЛЖИТЕЛНО: Во \`grade_level\` врати ТОЧНО еден од следните валидни токени (без друг текст):
  • Основно образование (1–9 одделение): '1', '2', '3', '4', '5', '6', '7', '8', '9'
  • Општа гимназија: '1год', '2год', '3год', '4год'
  • Математичко-информатичка гимназија: '1год-миг', '2год-миг', '3год-миг', '4год-миг'
  • Средно стручно образование: '1год-струк', '2год-струк', '3год-струк', '4год-струк'
  Ако не можеш со сигурност да го одредиш нивото, процени го најблискиот токен.
- ЗАДОЛЖИТЕЛНО: Во \`curriculum_topic\` напиши ја темата усогласена со официјалната наставна програма дадена во контекстот (ако е приложена).`;

export async function extractMathTasksFromPdf(base64Pdf: string, targetLanguage: string = 'auto', enableLogicalReconstruction: boolean = true, modelName: string = PRO_MODEL): Promise<MathTask[]> {
  const curriculumCtx = await buildCurriculumContextBlockRag('математика македонски наставна програма');
  const prompt = `Ти си експерт за дигитализација на математички текстови, креатор на "Advanced Vision OCR" и Едукативен Технолог (EdTech).
${curriculumCtx ? `\n${curriculumCtx}\n` : ''}
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

${CURRICULUM_PROMPT_INSTRUCTION}

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

function formatTimeFromMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function advancedMultimodalExtraction(
  source: { type: 'url' | 'file' | 'text'; data: string; mimeType?: string },
  model: string = PRO_MODEL,
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
    let urlContext = "";

    // Ако е URL, користиме двостепен пристап како кај extractMathTasksFromUrl
    if (source.type === 'url') {
      const searchPrompt = `Ти си истражувач. Најди го деталниот транскрипт или главната содржина за следното YouTube видео / веб страна: ${source.data}.
Извлечи ги сите математички задачи и објаснувања во нивниот ОРИГИНАЛЕН јазик. Не преведувај. Користи Google Search. Врати детален извештај.`;

      if (!urlContext) {
         const isYoutube = source.data.includes('youtube.com') || source.data.includes('youtu.be');
         const isVimeo = source.data.includes('vimeo.com');
         if (isYoutube || isVimeo) {
           // Use Gemini transcript extraction for both YouTube and Vimeo
           try {
             urlContext = await fetchYoutubeTranscriptViaGemini(source.data, undefined);
           } catch (e) {
             console.warn("Gemini транскрипт не успеа за видео:", e);
           }
         } else {
           try {
             const apiEndpoint = apiUrl(`/api/scrape?url=${encodeURIComponent(source.data)}`);
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
    }

    // Curriculum context injection (RAG over official БРО program)
    const curriculumQuery =
      source.type === 'text' ? source.data.slice(0, 300)
      : source.type === 'url' ? urlContext.slice(0, 300)
      : 'математика македонски наставна програма';
    const curriculumCtx = await buildCurriculumContextBlockRag(curriculumQuery || 'математика наставна програма');

    let finalPayloadContext = prompt;
    if (curriculumCtx) finalPayloadContext += `\n\n${curriculumCtx}`;
    finalPayloadContext += `\n\n${CURRICULUM_PROMPT_INSTRUCTION}`;
    if (source.type === 'url') {
      finalPayloadContext += `\n\n================\nКОНТЕКСТ ОД ИЗВОРОТ (URL: ${source.data}):\n${urlContext}\n================`;
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

async function fetchYoutubeTranscriptViaGemini(
  url: string,
  timeRange?: { start: string; end: string }
): Promise<string> {
  const timeFilter =
    timeRange?.start || timeRange?.end
      ? `\nFocus ONLY on the segment from ${timeRange?.start ?? 'the start'} to ${timeRange?.end ?? 'the end'}.`
      : '';

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
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

export async function extractMathTasksFromUrl(url: string, model: string = PRO_MODEL, timeRange?: {start: string, end: string}, manualTranscript?: string, instructions?: string, outputLanguage?: string): Promise<MathTask[]> {
  let timeContext = "";
  if (timeRange && (timeRange.start || timeRange.end)) {
    timeContext = `\nВНИМАНИЕ: Фокусирај се ИСКЛУЧИВО на делот од видеото/содржината од ${timeRange.start || 'почеток'} до ${timeRange.end || 'крај'}. Игнорирај го останатиот дел.`;
  }

  // ЧЕКОР 1: Прибирање фактографски контекст (Транскрипт)
  let videoContext = manualTranscript || "";

  if (!videoContext) {
     const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
     const isVimeo = url.includes('vimeo.com');
     if (isYoutube || isVimeo) {
       // Transcript-first approach: pass the video URL directly to Gemini Flash.
       // Works for both YouTube and Vimeo - Gemini extracts audio/captions.
       // Faster and cheaper than backend scraping and more reliable than Gemini Search.
       try {
         videoContext = await fetchYoutubeTranscriptViaGemini(url, timeRange);
       } catch (e) {
         console.warn("Gemini транскрипт не успеа, паѓаме на Gemini Search:", e);
       }
     } else {
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
  const curriculumCtx = await buildCurriculumContextBlockRag(videoContext.slice(0, 300) || 'математика наставна програма');
  const extractionPrompt = `Ти си Врвен Светски Експерт за Дигитализација на Математичка Едукација и специјалист за OCR и анализа на транскрипти.
Твојата мисија е ПЕРФЕКТНО да ги дигитализираш СИТЕ математички содржини (И ТЕОРИЈА И ЗАДАЧИ) кои се појавуваат во овој транскрипт:

==================
ИЗВЛЕЧЕН ТРАНСКРИПТ/СОДРЖИНА ОД ИЗВОРОТ (${url}):
${videoContext}
==================
${curriculumCtx ? `\n${curriculumCtx}\n` : ''}
СТРАТЕГИЈА ЗА МАКСИМАЛНА ПРЕЦИЗНОСТ И АВТОМАТСКО ПРЕПОЗНАВАЊЕ НА ЈАЗИК (Chain-of-Thought):
1. **Автоматска Детекција на Јазик**: Детектирај го јазикот на транскриптот. Поддржани ISO кодови: 'mk' (македонски), 'en' (англиски), 'ru' (руски), 'tr' (турски), 'ar' (арапски), 'de', 'fr', 'es', 'al' (Albanian) — или кој и да е друг ISO 639-1 код. Запиши го во \`detected_language\`.
2. **Јазик на излезот (КРИТИЧНО)**: ${outputLanguage && outputLanguage !== 'auto'
  ? `Корисникот ПОБАРАЛ излез на јазик: '${outputLanguage}'. ПРЕВЕДИ го целиот \`original_text\`, \`title\`, \`solution_steps\` и \`curriculum_topic\` на тој јазик. Зачувај ги LaTeX формулите непроменети ($...$ и $$...$$). Математичкиот контекст и педагошката точност се приоритет над буквалниот превод.`
  : `Задржи го ОРИГИНАЛНИОТ детектиран јазик на видеото во \`original_text\`, \`title\` и \`solution_steps\`. НЕ ПРЕВЕДУВАЈ. Исклучок: само ако јазикот е нераспознатлив, тогаш преведи на 'mk'.`}
3. **Теорија вс. Задачи (КРИТИЧНО)**: Видеата често почнуваат со теоретски вовед (дефиниции, формули, правила). ИЗВЛЕЧИ ЈА ТЕОРИЈАТА како посебен објект со \`type: "theory"\`. Задачите извлечи ги како \`type: "task"\`. Ова е многу важно за градење на лекции. За теорија, во "solution_steps" напиши ги клучните поенти или изведувања.
4. **Стандарди за Форматирање**: Користи релевантни математички стандарди за детектираниот јазик (пр. децимална запирка за македонски/руски, децимална точка за англиски).
5. **ZERO-ERROR LaTeX**: СИТЕ МАТЕМАТИЧКИ СИМБОЛИ, БРОЕВИ, РАВЕНКИ И ФОРМУЛИ МОРА ДА БИДАТ СТРОГО ВО LaTeX ФОРМАТ ВО original_text И ВО solution_steps! Користи $...$ за inline математика (пр. Let $x=5$) и $$...$$ за математика во нов ред. ОВА Е НАЈСТРОГОТО ПРАВИЛО!
6. **Илустрации и Графици**: Формирај \`illustration_prompt\` за стварни/животни објекти. Формирај \`math_graphic_config\` (JSON објект) за геометрија и координатни системи.

${CURRICULUM_PROMPT_INSTRUCTION}
- Во \`curriculum_topic\` смести ја темата на ИЗЛЕЗНИОТ јазик (оној бараниот од корисникот, наведен погоре). Ако корисникот бара македонски → "Линеарни равенки", за англиски → "Linear Equations", за турски → "Doğrusal Denklemler".

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

export async function extractMathTasksFromImage(base64Image: string, mimeType: string, targetLanguage: string = 'auto', enableLogicalReconstruction: boolean = true, model: string = PRO_MODEL): Promise<MathTask[]> {
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

export async function recognizeHandwrittenMath(base64Png: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
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
