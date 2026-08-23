# MathDigitizer — Мастер план за експертско ниво (v1, 2026-08-22)

Сеопфатен план за затворање на **сите наоди** од трите длабински анализи (12 области)
и издигнување на апликацијата на професионално/експертско ниво.
База на наодите: сесиски анализи од 22.08.2026 (агенти за extraction/kahoot/OCR,
whiteboard/student/exams/flashcards/mindmaps, factory/analytics/graphs/curriculum).

## Принципи (без компромиси)

- **PRODUCT_RULES.md** важи за секоја фаза: педагогија прво, RAG прво, доказ наместо
  погодување, вистински контролни точки, минимални повратливи едити каде што има
  неизвесност, без враќање на постоечка работа.
- **Верификација по СЕКОЈА фаза**: `npm run lint` → нови unit тестови →
  `npm run test:smoke` → e2e каде што е означено → `npm run quality:gates` →
  **локален комит, без push** (push само со експлицитна потврда).
- **Без нови зависности** освен ако е експлицитно оправдано во фазата.
- Секој AI излез што стигнува до Firestore или до UI минува валидација
  (форма + математика) — системска правила, не ad-hoc.

---

## Статус (последно ажурирано: 23.08.2026)

| Фаза | Статус | Комит |
|---|---|---|
| 0 — Темели | ✅ завршена | `5113ace` |
| 1 — Task Extraction | ✅ завршена (1.1–1.3 `3b1a509`, 1.4 `699e65c`) | |
| 2 — MathKahoot | ✅ завршена (2.1–2.3 `8443174`, 2.4/2.5 `699e65c`) | |
| 3 — Smart OCR | ✅ завршена | `8492521` |
| 4 — Виртуелна табла | ✅ завршена (вклучно 4.6 stretch) | `917a3e5` |
| 5 — Ученици/Испити/Флешкарти | ✅ завршена | `a9de057` |
| 6 — Материјали / PDF фабрика | ✅ завршена (освен batch редицата) | овој комит |
| 7 — Аналитика + БРО стандарди | ⏭️ следна | |
| 8–12 | ⬜ не е започната | |

> **Одложено од 6.1:** batch export редица (извоз на повеќе материјали наеднаш).
> Сè друго од Фаза 6 е сработено; редицата е единствената отворена ставка.

> Забелешка: mock-от во `StudentTelemetryView` (профил + историја на интервенции)
> НЕ е дел од 5.5 — тој е експлицитно ставка **7.3** и е означен со `TODO(Phase 7.3)`.

### Firestore правила — верификација

`npm run test:rules` го крева Firestore емулаторот и ги пушта правилата
(`vitest.rules.config.ts`). Вклучено и во CI (`quality-gates.yml`, со JDK 21).
25 теста, вклучно со прозорецот на испитот од 5.3 (`opens_at`/`due_at` како
**epoch millis** — правилата немаат парсер за ISO стрингови).

Сè се работи **локално, без push** (квота + Hostinger панел/git се уредно запишани).

---

## ФАЗА 0 — Темели (напречни, сите функционалности профитираат)

| # | Акција | Контролна точка |
|---|---|---|
| 0.1 | `withRetry` (429/5xx/quota/network, exp backoff, 2 обиди) вграден во `ai` proxy-то во `src/lib/ai/client.ts` — една точка, ги покрива сите `generateContent`/`embedContent` повици насекаде | client.ts |
| 0.2 | Нов `src/lib/ai/validate.ts`: `validateLatex` (katex parse по $…$ сегменти), `validateKahootQuiz` (4 опции, correctIndex 0-3, дупликати), `verifyOptionsMath` (ComputeEngine еквиваленција на нумерички опции), `normalizeLatex` (преместен од videoAgent) | нов модул |
| 0.3 | models.ts единствен извор: хардкодираните `gemini-3.1-pro-preview`/`gemini-3-flash-preview` во `SmartOCR.tsx` и `smart-ocr/OCRSettingsBar.tsx` → `PRO_MODEL`/`FAST_MODEL` константи | 2 фајлови |
| 0.4 | Тестови: `validate.test.ts` + retry тест во `client.test.ts` | vitest |

## ФАЗА 1 — Task Extraction

1.1 `extraction_confidence` (моделот веќе го враќа, се фрла) → задржи во parse,
перзистирај на task, badge во `extraction/TaskCard` + праг-филтер во UI.
1.2 `evidence_quote` во PDF/image шемите (анти-халуцинација паритет).
1.3 Дуплираниот interpretative-switch (URL + file/text гранки) → еден helper.
1.4 Unit тестови за parse/merge логиката во extraction.ts; e2e за `/extract` со
Playwright `page.route` пресретнување на Gemini/API повици (нема клуч локално).

## ФАЗА 2 — MathKahoot Creator

2.1 Типизиран `LiveKahootQuiz` (крај на `quiz_data: any`); `parseGeminiResponse` наместо сиров `JSON.parse` (kahoot.ts:74).
2.2 Валидациски пасус со `validateKahootQuiz` + `verifyOptionsMath`: фрлај/поправај
неважечки прашања ПРЕД Firestore и пред live игра.
2.3 Вистински AI hints (DEFAULT_MODEL, per-question, fallback на генерираните hints)
наместо fake `setTimeout` во GamePlayer.
2.4 i18n (`kahoot` ns) + aria-labels за `live/GameHost` и `live/GamePlayer`;
MathRenderer во KahootMaker preview (денес сиров `$…$` текст).
2.5 Smoke тест KahootMaker + unit тестови за валидацијата.

## ФАЗА 3 — Smart OCR

3.1 Confidence во image/PDF шемите + видлив badge; предупредување под праг.
3.2 `validateLatex` пред зачувување со inline листа на грешки.
3.3 Save формат: `original_text` = текст на задача, решението во `solution_steps`
(денес се споени); паритет со ExtractionEngine: embedding + `classifyTaskCurriculum`.
3.4 Албански излез + поправка на `sq → Турски` мапирањето во extraction.ts (image/PDF).
3.5 `visualizationMode`: жица во extraction prompt (tikz/geogebra/jsxgraph инструкции)
наместо мртва контрола.
3.6 Single-mode ги задржува СИТЕ задачи од одговорот (денес само `result[0]`).
3.7 Unit (save payload) + smoke тест SmartOCR.

## ФАЗА 4 — Виртуелна табла: професионален пен/таблет

4.1 Pointer events со `pressure`/`tilt`/`pointerType` → варијабилна дебелина на линијата;
pen/touch режим со palm rejection (кога пен е активен, touch игнориран).
4.2 `touch-action: none` + спречени browser гестови на сите три canvas контејнери.
4.3 Мазно мастило: quadratic-midpoint ресемплирање + point decimation +
velocity-based ширина (unit-тестибилни чисти функции).
4.4 Инкрементална синхронизација: стрим на точки (throttle ~60ms) + seq броеви +
dedupe; late-join snapshot (host/сервер ја праќа состојбата на новодојдени).
4.5 Undo/redo по корисник + бришач како `tool` поле (крај на color-match хеуристика).
4.6 Stretch: детерминистички „текст → геометрија" парсер за форми на таблата
(концепт од GridShapeAI, без нивни код — JSXGraph излез).
4.7 Unit тестови (smoothing/decimation/sync reducer) + e2e со синтетички pointer events.

## ФАЗА 5 — Ученици / Испити / Флешкарти

5.1 AdaptiveTest: Firestore `where` упити (difficulty/topic) наместо full-collection
scan ×2; ability-estimate (движечки просек по тема) + confidence-based стоп.
5.2 StudentSkillTree: unlock од вистински `user_mastery` + XP; мртвиот CTA →
`/adaptive-test?topic=…`.
5.3 Испити: enforce `status`/рок (client + rules), seeded shuffle прашања/опции по
ученик, мапирање поени → оценка 1–5, линк кон Gradebook.
5.4 Флешкарти FSRS-lite: learning steps (1м/10м), `lapses`, fuzz на рокови;
декови/тагови; TTS (постоечки `generateSpeech`); quiz/match резултати → SRS.
5.5 i18n чистење: StudentTelemetryView, KnowledgePath, TeacherExamsDashboard,
SummativeExam, MakedoTestGenerator (хардкодиран МК).
5.6 Unit (scheduler, shuffle) + smoke тестови.

## ФАЗА 6 — Материјали / PDF фабрика

6.1 PDF: KaTeX-aware пагинација (мерење блокови, сечење на граници, poll за
рендерирани формули наместо `setTimeout(600)`); одделен ученички/наставнички PDF
(клуч одделно); templates (училиште/име/заглавие); batch export редица.
Векторски пат: print-CSS (`window.print()` дава векторски PDF) како првокласна опција.
6.2 `responseSchema` за главниот генератор + типизирани renderers (крај на crash-ови
од невалиден JSON).
6.3 `tasks` упит со `author_uid` филтер + групирање по `curriculum_refs` (не free-text).
6.4 DOCX: LaTeX → `docx` Math runs (OMML) наместо сиров текст.
6.5 CurriculumFactory: вистинско читање на качениот фајл (детерминистичка екстракција)
или отстранување на stub-от; `handleSaveToDB` да зачувува навистина.
6.6 Unit + smoke тестови.

## ФАЗА 7 — Аналитика + БРО стандарди (затворање на контрактот)

7.1 `curriculum_refs`/outcome кодови на `graded_submissions` и `task_attempts`
(писатели: SmartGrader, InteractiveSolver, GameHost).
7.2 Per-БРО-code mastery rollup → Analytics панел „слабости по код"; симулираните
Kilpatrick strands експлицитно означени како проценки додека нема мерени податоци.
7.3 StudentTelemetryView: вистински профил од `users` наместо mock; перзистентни
интервенциски планови.
7.4 Експорт CSV/PDF на аналитика.
7.5 Пагинација/датумски филтер за `graded_submissions`.
7.6 Unit + smoke тестови.

## ФАЗА 8 — GraphDigitizer

8.1 Валидација: `validateLatex` на `detected_equation` + residual fit (CE евалуација на
дигитизираните x-точки, RMS праг) + приказ на резидуал во UI.
8.2 Калибрација: guard за совпаднати точки; 3+ точки least-squares опција.
8.3 Детерминистичка регресија (линеарна/квадратна/експ) од точките како предлог.
8.4 JSXGraph re-plot на извлечената функција на вистински оски + SVG/PNG експорт.
8.5 `classifyTaskCurriculum` при зачувување (graph-задачи денес немаат `curriculum_refs`).
8.6 Unit тестови (pixelToReal, fit, residual).

## ФАЗА 9 — БРО курикулум: комплетност и контракт

9.1 Чистење: mojibake/дуплирани клучеви (`3год-струк`), `III-A.*` стандарди во
одделно поле (контракт §7 ги исклучува од outcomes).
9.2 Оперативен курикулум за недостасуваачките одделенија (почеток: 8 + гим1),
со teacher review редица во CurriculumAdmin.
9.3 Ре-синхронизација на SHARED_CURRICULUM_CONTRACT.md (статус табела, 1542 кодови)
+ provenance метаподатоци по код.
9.4 RAG (`curriculumKnowledge`) вклучен во генераторите (денес само класификација).
9.5 UI разлика „AI предлог" vs „потврдено" за `source:'ai'` рефови (контракт §3).

## ФАЗА 10 — Учебник → Знаење (book-to-skill архитектура, MIT)

10.1 TS порта: pdfjs-dist/mammoth детерминистичка екстракција → поглавја →
Flash-3.7 дестилација (јадрен индекс + glossary + patterns) → Firestore
`knowledge_skills` → retrieval hook во extraction/grading/chat.
10.2 Token-буџет метрика (бенчмарк алатка како `discovery_tax.py`).
10.3 Copyright guardrail: наставникот потврдува право на користење пред дестилација.

## ФАЗА 11 — Mind maps (нова функционалност)

11.1 Уредувачка концепт-мапа врз d3 force основата од KnowledgeMapTab:
node/edge CRUD, перзистенција, врска со `related_task_ids`/`curriculum_refs`, PNG експорт.

## ФАЗА 12 — Напречно зацврстување (континуирано во секоја фаза + финален премин)

- aria/ролови ревизија (tablist, progress bars, canvas), e2e проширување
(`/extract`, `/factory`, `/analytics`, `/exam`), Lighthouse + WCAG 2.1 премин,
i18n 100% за сите touch-точки што ги менуваат фазите.

---

## Редослед и ризици

- Фази 0–3: брзи, високо-прецизни добивки (точност на AI излезите).
- Фаза 4: експлицитна желба на корисникот (пен/таблет) — среден напор, голема видливост.
- Фази 5–9: структурни (scalability + стандарди) — го затвораат БРО контрактот.
- Фази 10–11: нови продукти — најголем напор, најголема диференцијација.
- Ризик: Gemini quota при агентски режими → 0.1 retry + кеш (постоечки) + LOW резолуција.
- Ризик: Firestore шема-мигранции → секоја фаза додава полиња НЕДЕСТРУКТИВНО
  (опционални полиња, без breaking reads).

## Дефиниција на готово (по фаза)

Lint 0 грешки · сите unit/smoke тестови зелени · quality gates зелени ·
e2e каде што е означено · локален комит · меморија ажурирана.
