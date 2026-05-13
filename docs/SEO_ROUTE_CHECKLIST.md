# SEO Route Checklist

> Generated: 2026-05-12 (Day 5 sprint)  
> Policy: public marketing pages → `index,follow`; all authenticated app routes → `noindex,nofollow`.

## Legend

- ✅ Configured + correct directive
- 🔒 Auth-protected (noindex by design)
- ⚠️ Needs attention

---

## Public Routes (indexable)

| Route | Title | canonical | noindex | structuredData types | Status |
|-------|-------|-----------|---------|----------------------|--------|
| `/` | MathDigitizer Pro \| Напредна едукација... | `/` | — | Organization, WebSite, SoftwareApplication | ✅ |
| `/pricing` | Pricing | `/pricing` | — | Organization, WebSite, SoftwareApplication, OfferCatalog | ✅ |

---

## Game / Exam Routes (noindex — ephemeral sessions)

| Route | Title | canonical | noindex | Status |
|-------|-------|-----------|---------|--------|
| `/play` | Live Player | `/play` | true | 🔒 |
| `/exam/:examId` | Испит | `/exam` | true | 🔒 |

---

## Protected App Routes (noindex — require authentication)

| Route | Title | canonical | noindex | Status |
|-------|-------|-----------|---------|--------|
| `/extract` | AI Екстракција | `/extract` | true | 🔒 |
| `/smart-ocr` | Smart OCR | `/smart-ocr` | true | 🔒 |
| `/smart-grader` | AI Градер | `/smart-grader` | true | 🔒 |
| `/library` | Библиотека | `/library` | true | 🔒 |
| `/factory` | Фабрика за Материјали | `/factory` | true | 🔒 |
| `/mass-factory` | Масовна Фабрика | `/mass-factory` | true | 🔒 |
| `/curriculum` | Курикулум | `/curriculum` | true | 🔒 |
| `/dashboard` | Профил и Напредок | `/dashboard` | true | 🔒 |
| `/analytics` | Аналитика | `/analytics` | true | 🔒 |
| `/ai-pedagogy` | AI Педагогија | `/ai-pedagogy` | true | 🔒 |
| `/classrooms` | Училници | `/classrooms` | true | 🔒 |
| `/classrooms/:id` | Училници (detail) | `/classrooms` | true | 🔒 |
| `/students/:studentId` | Телеметрија на Ученик | `/dashboard` | true | 🔒 |
| `/live-board` | Жива Табла | `/live-board` | true | 🔒 |
| `/live/:pin/host` | Live Host | `/live-board` | true | 🔒 |
| `/todo` | Задачи | `/todo` | true | 🔒 |
| `/flashcards` | Флешкарти | `/flashcards` | true | 🔒 |
| `/adaptive-test` | Адаптивен Тест | `/adaptive-test` | true | 🔒 |
| `/exams-grading` | Оценување на Испити | `/exams-grading` | true | 🔒 |
| `/school-inquiries` | School Inquiries | `/school-inquiries` | true | 🔒 |

---

## robots.txt notes

- `noindex` routes emit `<meta name="robots" content="noindex,nofollow,...">` via `SEO.tsx`
- No separate `robots.txt` disallow needed; meta-robots is sufficient for single-page app

## SEO infrastructure

- `src/lib/seo.ts` — central route registry (`getRouteSeo()`)
- `src/components/Layout.tsx` — calls `getRouteSeo(location.pathname)` and passes to `<SEO />`
- `src/components/SEO.tsx` — renders `<Helmet>` with title, og:*, twitter:*, canonical, robots, JSON-LD
- `src/lib/seo.test.ts` — 7 tests: public routes indexable, protected routes noindex, structured data shape

## Governance token

The governance gate (`scripts/check-governance.mjs`) verifies `SEO` import presence in Layout.  
All SEO changes must keep this gate green (`npm run quality:gates`).
