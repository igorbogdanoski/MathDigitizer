# MathDigitizer Pro — Фаза 2: Комерцијализација и Локализација

**Дата:** 2026-07-21
**Статус:** Planning
**Претходна фаза:** Development Plan 2026-07-13 (100% завршено)

---

## Извршно резиме

Development Plan-от е завршен — security, bugs, testing, architecture се средени. Следната фаза е **комерцијализација**:

1. **SEO/SaaS оптимизација** — зголемување на органски трафик и конверзии
2. **Локализација (i18n)** — Албански и Англиски јазик за поширок пазар
3. **Маркетинг инфраструктура** — landing pages, email campaigns, social proof

---

## I. SEO & SaaS Оптимизација

### 1.1 Технички SEO (приоритет: висок)

| Задача | Статус | Акција |
|--------|--------|--------|
| Structured Data | ⚠️ Client-side only | SSR/SSG за JSON-LD или pre-rendering |
| Core Web Vitals | ⬜ Не мерено | Lighthouse CI + оптимизација |
| Sitemap | ✅ 5 URLs | Прошири со сите јавни рути |
| Robots.txt | ✅ | Проверка |
| Meta tags | ⚠️ Generic | Уникатни per-route |
| Open Graph | ⬜ | За social sharing |
| Canonical URLs | ⬜ | За duplicate content |
| Hreflang | ⬜ | За мултијазична поддршка |

### 1.2 Content SEO (приоритет: висок)

**Нови blog постови (MK + EN + AL):**
- "Како да дигитализирате математички задачи од PDF"
- "AI-powered grading за наставници"
- "Socratic метод во дигитална училница"
- "Бесплатни алатки за математика за македонски наставници"

**Keyword стратегија:**
- MK: "дигитализација математика", "AI оценување", "математички квиз"
- EN: "math digitizer", "AI math grading", "interactive math solver"
- AL: "digitalizim matematike", "AI vlerësim", "kuiz matematike"

### 1.3 SaaS Конверзии (приоритет: среден)

| Задача | Опис |
|--------|------|
| Stripe интеграција | Автоматски subscriptions (кога >20 корисници) |
| Email drip campaign | Trial → Pro конверзија |
| Social proof | Testimonials, case studies |
| Referral програм | Даден Pro месец за секој реферал |
| Usage-based upsell | In-app prompts кога free лимит е близу |

---

## II. Локализација (i18n)

### 2.1 Инфраструктура

**Библиотека:** `react-i18next` + `i18next`

**Структура:**
```
src/
├── locales/
│   ├── mk/
│   │   ├── common.json
│   │   ├── navigation.json
│   │   ├── pricing.json
│   │   ├── blog.json
│   │   └── ...
│   ├── en/
│   │   └── ...
│   └── al/
│       └── ...
├── i18n.ts (config)
└── hooks/useTranslation.ts
```

**Јазици:**
| Код | Јазик | Приоритет | Пазар |
|-----|-------|-----------|-------|
| `mk` | Македонски | ✅ Постои | Северна Македонија |
| `al` | Албански | 🔴 Висок | Северна Македонија (25%), Косово, Албанија |
| `en` | Англиски | 🟡 Среден | Меѓународен, дијаспора |

### 2.2 Фази на имплементација

**Фаза A: Инфраструктура (1 недела)**
- [ ] Инсталирај `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- [ ] Креирај `src/i18n.ts` конфигурација
- [ ] Екстрахирај strings од `Layout.tsx`, `Home.tsx`, `Pricing.tsx`
- [ ] Додади language switcher во header

**Фаза B: Core компоненти (2 недели)**
- [ ] Navigation, Footer, Auth модали
- [ ] Pricing страница
- [ ] Onboarding wizard
- [ ] Dashboard, Library, Extraction

**Фаза C: AI промпти (1 недела)**
- [ ] `gemini.ts` — додади `language` параметар на сите генеративни функции
- [ ] `buildCurriculumContextBlock` — мултијазична поддршка
- [ ] Системски промпти — преведени верзии

**Фаза D: Содржина (2-3 недели)**
- [ ] Превод на сите UI strings (MK → AL, MK → EN)
- [ ] Превод на blog постови
- [ ] Превод на маркетинг материјали

### 2.3 Албански јазик — специфичности

**Пазар:**
- Северна Македонија: ~25% од населението
- Косово: ~1.8 милиони
- Албанија: ~2.8 милиони
- Дијаспора: Швајцарија, Германија, Италија

**Наставна програма:**
- Иста математичка содржина како МК (иста земја)
- Различни термини на албански
- Потребна консултација со албански наставници

**Превод на клучни термини:**
| MK | AL | EN |
|----|----|----|
| Задача | Detyrë / Problem | Task / Problem |
| Решение | Zgjidhje | Solution |
| Наставник | Mësues | Teacher |
| Ученик | Nxënës | Student |
| Оценување | Vlerësim | Grading |
| Дигитализација | Digitalizim | Digitization |

---

## III. Маркетинг инфраструктура

### 3.1 Landing Pages

| Страница | Цел | Јазици |
|----------|-----|--------|
| `/` (Home) | Генерална | MK, AL, EN |
| `/pricing` | Конверзија | MK, AL, EN |
| `/for-teachers` | Наставници | MK, AL |
| `/for-schools` | Училишта | MK, AL |
| `/features/ocr` | OCR функција | MK, EN |
| `/features/grading` | AI оценување | MK, EN |

### 3.2 Email маркетинг

**Алатка:** Mailchimp или Brevo (поранешен Sendinblue)

**Campaigns:**
1. **Welcome series** (3 email-ови)
   - Ден 1: Добредојде + onboarding
   - Ден 3: Топ 3 функции
   - Ден 7: Trial истекува → Pro понуда

2. **Trial expiration** (1 email)
   - 2 дена пред истекување
   - Попуст за годишен план

3. **Newsletter** (месечно)
   - Нови функции
   - Совети за настава
   - Case studies

### 3.3 Social Media

**Платформи:**
- Facebook (наставнички групи)
- Instagram (визуелен контент)
- LinkedIn (B2B, училишта)
- YouTube (демо видеа)

**Содржина:**
- Демо видеа (30-60 sec)
- Before/After (ракопис → дигитална задача)
- Testimonials од наставници
- Совети за настава

---

## IV. Приоритетен план

### Месец 1: Основа
| Недела | Задачи |
|--------|--------|
| 1 | i18n инфраструктура + language switcher |
| 2 | Core компоненти превод (MK → AL) |
| 3 | AI промпти мултијазични |
| 4 | SEO технички fixes (meta tags, OG, hreflang) |

### Месец 2: Содржина
| Недела | Задачи |
|--------|--------|
| 5 | Blog постови (MK + AL) |
| 6 | Landing pages за наставници/училишта |
| 7 | Email маркетинг setup |
| 8 | Social media контент |

### Месец 3: Лансирање
| Недела | Задачи |
|--------|--------|
| 9 | Англиски превод |
| 10 | Stripe интеграција |
| 11 | Beta тестирање со албански наставници |
| 12 | Јавно лансирање |

---

## V. Метрики за успех

| Метрика | Цел (3 месеци) |
|---------|----------------|
| Органски трафик | 500+ месечни посети |
| Регистрации | 100+ |
| Free → Pro конверзија | > 5% |
| Активни Pro корисници | 20+ |
| Албански корисници | 30% од вкупно |

---

## VI. Буџет (проценка)

| Ставка | Месечно |
|--------|---------|
| Превод (AL, EN) | €200-400 (аутсорс) |
| Email маркетинг | €0-30 (Brevo free tier) |
| SEO алатки | €0-50 (Ubersuggest) |
| Social media | €0 (органски) |
| **Вкупно** | **€200-480/месец** |

---

## VII. Следни чекори (оваа недела)

1. **Одлука:** Дали да се користи аутсорс превод или AI + ревизија?
2. **Инсталација:** `npm install react-i18next i18next i18next-browser-languagedetector`
3. **Контакт:** Албански наставници за консултација
4. **SEO:** Submit sitemap во Google Search Console (ако не е направено)

---

*Овој план е придружник на завршениот Development Plan 2026-07-13 и UI/UX Upgrade Plan.*
