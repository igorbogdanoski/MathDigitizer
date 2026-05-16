# MathDigitizer Pro — SaaS & SEO Action Plan

**Домен:** https://math.mismath.net  
**Статус:** Stage C — Public Production (активно деплојирано 2026-05-16)  
**Последно ажурирање:** 2026-05-16

---

## ФАЗА 1 — Основа ✅ ЦЕЛОСНО ЗАВРШЕНА

### 1.1 Google Search Console ✅
- Верификација на `math.mismath.net` преку HTML meta tag
- `sitemap.xml` генериран (5 URLs: `/`, `/pricing`, 3 blog posts)
- **Мануелно (Igor):** Submit `https://math.mismath.net/sitemap.xml` во Search Console → Request indexing на `/` и `/pricing`

### 1.2 Email потврди за receipts ✅
- Firebase Extension: Trigger Email (Firestore → Gmail)

### 1.3 Google Analytics 4 ✅
- GA4 + SaaS конверзиски funnel events

---

## ФАЗА 2 — SaaS Конверзии ✅ ЦЕЛОСНО ЗАВРШЕНА

### 2.1 PayPal / IBAN плаќање ✅
### 2.2 Onboarding wizard (3 чекори) ✅
### 2.3 7-дневен Pro Trial ✅

---

## ФАЗА 3 — Перформанси & SEO Техника

### 3.1 Bundle намалување ✅ (PR #13)
- Lazy load: `@google/genai`, `d3`, `KaTeX` извлечени од always-on компоненти
- Code split по рути (React.lazy во App.tsx)
- **Следно:** Провери со `npm run build` дали chunk-овите се под 500KB

### 3.2 Google Search Console — прв извештај ⬜
- По 2 недели од submission: провери Coverage, Core Web Vitals, Search Performance
- Фиксирај crawl грешки ако има

### 3.3 Structured Data валидација ✅ (PR #14)
- SoftwareApplication, Organization, OfferCatalog, WebSite, Article JSON-LD
- **Мануелно (Igor):** Тест на https://search.google.com/test/rich-results

---

## ФАЗА 4 — Content SEO

### 4.1 Јавни содржински Blog постови ✅ (PR #15, #16)
- `/blog/ocr-matematika` — "OCR математика"
- `/blog/latex-ekstrakcija` — "LaTeX екстракција YouTube"
- `/blog/live-mathkahoot` — "математички квиз live"

### 4.2 Поврзување со mismath.net ⬜
- **Мануелно (Igor):** Додај линк на `mismath.net` главна страница → `math.mismath.net`
- Ефект: Domain authority pass, backlink

### 4.3 Локален SEO — Macedonia ⬜
- **Мануелно (Igor):** Споделување blog постови во МК наставнички Facebook групи
- Потребен е текст за post — може да помогнам

---

## ФАЗА 5 — Security & Scale

### 5.1 Stripe автоматски subscriptions ⬜
- Потребно пред: > 20 активни корисници

### 5.2 School Licensing автоматизација ⬜
- Потребно пред: прв school deal

### 5.3 Firestore Security — summative_attempts + task_attempts ✅ (PR #17)
- Заменет localStorage guest UID со Firebase anonymous auth
- Правилата scoped по `request.auth.uid`

### 5.4 Gemini Direct Imports Cleanup ✅ (PR #18)
- Сите 5 компоненти сега користат named functions од `gemini.ts`

---

## Екстра — надвор од оригиналниот план (завршено)

### YouTube Transcript-First Pipeline ✅ (PR #19)
- Gemini Flash директно чита YouTube видео (`fileData`) наместо сломениот `/api/youtube/transcript`
- Работи на static hosting, без backend

### Multilingual Extraction + Rules Cleanup ✅ (PR #20, #21)
- Транскриптот се чува на оригиналниот јазик (EN/TR/RU/AR)
- ISO 639-1 auto-detect; `grade_level` и `curriculum_topic` на јазикот на видеото
- Firestore: отстранети `isOwner`, `hasRequiredFields` (dead code); `isValidUserProfile` и `canTeacherActivateProOnUser` вжичени во `/users/{userId}`
- **Деплојирано во production**

---

## Метрики за Stage C

| Метрика | Цел | Тековно |
|---|---|---|
| Error rate (critical flows) | < 1% за 7 дена | Не мерено (нема трафик) |
| Google индексирање | `/` и `/pricing` | Треба manual submit |
| Конверзија visitor → Pro | > 2% | 0 (beta) |
| Активни Pro корисници | 10+ | 0 (beta) |

---

## Следни чекори (приоритетен редослед)

```
ДЕНЕС:    npm run build → upload dist/ на cPanel
ДЕНЕС:    Search Console → submit sitemap → request indexing
ОВАА НЕДЕЛА:  4.2 mismath.net backlink (Igor, 5 min)
ОВАА НЕДЕЛА:  4.3 Facebook групи — Igor споделува, Claude пишува текст
МЕСЕЦ 2:  3.2 SC извештај (само чека 2 недели)
МЕСЕЦ 3+: 5.1 Stripe (кога >20 корисници)
МЕСЕЦ 3+: 5.2 School Licensing (кога прв school deal)
```
