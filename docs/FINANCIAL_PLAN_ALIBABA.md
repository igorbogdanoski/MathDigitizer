# MathDigitizer Pro — Investment & Partnership Proposal

## AI-Powered Mathematics Education for the Western Balkans

> **Prepared for:** Alibaba Group CSR / Education Investment Team  
> **Date:** July 2026  
> **Version:** 1.0  
> **Contact:** Igor Bogdanoski · igor.bogdanoski@mismath.net  
> **Live Platform:** https://math.mismath.net

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Opportunity](#2-market-opportunity)
3. [Product Overview](#3-product-overview)
4. [Business Model](#4-business-model)
5. [Traction & Metrics](#5-traction--metrics)
6. [Use of Funds](#6-use-of-funds)
7. [12-Month Roadmap](#7-12-month-roadmap)
8. [Revenue Projections](#8-revenue-projections)
9. [Competitive Landscape](#9-competitive-landscape)
10. [Team](#10-team)
11. [Impact](#11-impact)
12. [The Ask](#12-the-ask)

---

## 1. Executive Summary

**MathDigitizer Pro** is the first AI-powered mathematics education platform built specifically for North Macedonia's K-12 education system. It transforms analog teaching materials (handwritten notes, PDF tests, textbook photos, YouTube lectures) into structured, curriculum-aligned digital content — in under 2 minutes.

### The Problem

North Macedonia's 20,000+ math teachers spend an average of **12–15 hours per week** on manual tasks: digitizing test materials, creating differentiated worksheets, grading submissions, and tracking student progress. The national curriculum (БРО standards) spans 21 grade levels across 4 educational tracks, yet there is **no digital platform** that speaks Macedonian, aligns with local standards, or understands the pedagogical context of Balkan mathematics education.

### The Solution

MathDigitizer Pro is a **production-ready SaaS platform** — not a prototype — that provides:

- **AI Digitization** — OCR and multimodal AI extraction from any source format
- **Curriculum Alignment** — Every generated task maps to official БРО competency codes
- **Pedagogical Intelligence** — Bloom's Taxonomy and Depth of Knowledge classification
- **Trilingual Interface** — Macedonian, Albanian, and English (serving 25% Albanian minority)
- **Live Classroom Tools** — Real-time Kahoot-style quizzes, collaborative whiteboards
- **Early Warning System** — AI-driven student risk detection with intervention recommendations

### Why Now

- North Macedonia's **EU integration process** is accelerating digital education mandates
- The Ministry of Education (МОН) has launched active digitalization initiatives
- **No competitor** offers AI-powered math tools in Macedonian or Albanian
- The platform is **live, tested, and generating B2B leads** from schools

### Key Metrics

| Metric | Value |
|--------|-------|
| Production routes | 35+ |
| React components | 89 |
| AI service functions | 39+ |
| Automated tests | 109 |
| Languages | 3 (MK/EN/AL) |
| i18n namespaces | 21 |
| Curriculum levels covered | 21 (K-12 + vocational) |
| Deployment | Live at math.mismath.net |

---

## 2. Market Opportunity

### 2.1 North Macedonia (Primary Market)

| Segment | Size |
|---------|------|
| Math teachers (K-12) | ~20,000 |
| Students (K-12) | ~250,000 |
| Schools | ~1,000 |
| Albanian-speaking population | 25% (~500,000) |
| Annual education budget | ~€500M |
| Digital education spend (growing) | ~€15M/year |

**Key drivers:**
- **EU Accession (Chapter 26 — Education & Culture):** Mandates digital competency frameworks
- **МОН Digitalization Strategy 2025-2030:** Active investment in EdTech infrastructure
- **БРО Curriculum Reform:** New competency-based standards requiring digital alignment
- **Post-pandemic acceleration:** Teachers adopted digital tools; demand persists

### 2.2 Albanian Market Expansion (Secondary)

| Segment | Size |
|---------|------|
| Kosovo (Albanian-speaking students) | ~300,000 |
| Albania (K-12 students) | ~400,000 |
| Albanian diaspora (Western Europe) | ~2M |
| **Total Albanian-speaking TAM** | **~2.7M** |

The platform's **complete Albanian localization** (21 namespaces, all UI strings) positions it as the first AI math tool available in Albanian — a language underserved by global EdTech.

### 2.3 Total Addressable Market

| Scenario | Teachers | Students | Annual Revenue Potential |
|----------|----------|----------|------------------------|
| North Macedonia only | 20,000 | 250,000 | €2.4M (at 20% teacher penetration) |
| MK + Kosovo | 35,000 | 550,000 | €5.2M |
| MK + Kosovo + Albania | 55,000 | 950,000 | €9.6M |
| + Diaspora (DACH, UK) | — | 200,000+ | +€1.5M |

### 2.4 Market Timing

1. **No incumbent** — GeoGebra and Desmos are free tools, not pedagogical platforms. Neither supports Macedonian or Albanian.
2. **Government tailwinds** — МОН is actively procuring digital education solutions
3. **AI inflection point** — Gemini-class models make previously impossible features (handwriting OCR, curriculum-aligned generation) commercially viable
4. **First-mover advantage** — 12-18 month window before international competitors localize

---

## 3. Product Overview

### 3.1 Platform Capabilities

**MathDigitizer Pro is a complete pedagogical ecosystem, not a single-feature tool:**

#### For Teachers

| Feature | Description | AI-Powered |
|---------|-------------|:----------:|
| **Extraction Engine** | PDF/image/video/handwriting → structured tasks | ✅ |
| **Smart OCR** | Handwritten math recognition | ✅ |
| **Graph Digitizer** | Function plots → GeoGebra commands | ✅ |
| **Materials Factory** | Batch PDF worksheet generation | ✅ |
| **Curriculum Factory** | Standards-aligned test generation | ✅ |
| **Smart Grader** | Automated assessment with rubrics | ✅ |
| **Task Differentiation** | 3-level scaffolding (support/core/extension) | ✅ |
| **Early Warning** | Student risk detection + interventions | ✅ |
| **AI Pedagogy Critique** | Socratic questions, Bloom's analysis | ✅ |
| **Gradebook** | Full grade management (MK 1-5 system) | — |
| **Live Kahoot** | Real-time quiz sessions (PIN + QR join) | ✅ |
| **Analytics Dashboard** | DoK telemetry, knowledge gap diagnosis | ✅ |
| **Virtual Whiteboard** | Collaborative drawing (Socket.IO) | — |

#### For Students

| Feature | Description | AI-Powered |
|---------|-------------|:----------:|
| **AI Tutor Chat** | Conversational math help | ✅ |
| **Adaptive Testing** | Difficulty-adjusted assessments | ✅ |
| **Flashcards (SM-2)** | Spaced repetition review | — |
| **Interactive Solver** | Step-by-step guided solving | ✅ |
| **Student Dashboard** | Progress tracking, skill tree | — |
| **Gamification** | XP, levels, quests, streaks, badges | — |

### 3.2 Technical Excellence

| Dimension | Implementation |
|-----------|---------------|
| **Architecture** | React 19 + TypeScript 6 + Vite 8 (zero compilation errors) |
| **AI Models** | 8 Gemini models (Pro, Flash, Lite, TTS, Image, Embedding) |
| **Real-time** | Socket.IO for live sessions and collaborative canvas |
| **Offline** | PWA with Workbox service worker |
| **Testing** | 109 automated tests, CI/CD quality gates |
| **Monitoring** | Sentry error tracking, GA4 analytics |
| **Security** | Fail-closed auth, SSRF protection, API key proxy |
| **i18n** | 3 languages × 21 namespaces = 63 translation files |
| **Accessibility** | WCAG 2.1 AA, screen reader support |

### 3.3 Curriculum Coverage

The platform encodes North Macedonia's complete K-12 mathematics curriculum:

- **Primary (I–IX):** 9 grade levels
- **Gymnasium:** 4 years (general + advanced)
- **MIG (Mixed-Ability Groups):** 4 specialized tracks
- **Vocational:** 4 tracks
- **Total:** 21 educational levels with official БРО competency codes (e.g., МА.7.5.2)

---

## 4. Business Model

### 4.1 Pricing Tiers

| Tier | Price | Target | Features |
|------|-------|--------|----------|
| **Free** | 0 MKD | All teachers | 2 extractions/session, library access, basic tools |
| **Pro Teacher (Monthly)** | 490 MKD/mo (~€8) | Individual teachers | Unlimited AI, analytics, differentiation, all Pro features |
| **Pro Teacher (Annual)** | 4,900 MKD/yr (~€80) | Committed teachers | Same as monthly, ~2 months free |
| **School License** | Custom (per seat) | Schools (B2B) | Volume pricing, admin dashboard, priority support |

### 4.2 Revenue Streams

1. **Individual Pro subscriptions** — Primary revenue (B2C)
2. **School licensing** — High-value B2B contracts (10-50 seats)
3. **Ministry contracts** — National/regional licensing (aspirational)
4. **Training & onboarding** — Paid teacher workshops (future)

### 4.3 Payment Infrastructure

**Current (operational):**
- Bank transfer (NLB Bank, IBAN: MK07210501596102457)
- PayPal (manual verification)
- Admin approval workflow (receipt upload → verification → Pro activation)

**Planned (Q1 2027):**
- Stripe integration (automated billing, dunning, invoicing)
- Self-service checkout (zero manual intervention)
- School invoicing (B2B payment terms)

### 4.4 Unit Economics (Projected at Scale)

| Metric | Value |
|--------|-------|
| ARPU (Pro Teacher, monthly) | €8 |
| ARPU (School license, per seat) | €5-6 |
| CAC (organic + referral) | €2-5 |
| LTV (24-month retention) | €150-190 |
| LTV/CAC ratio | 30-95x |
| Gross margin (SaaS) | 85-90% |
| AI cost per active user/month | €0.50-1.50 |

---

## 5. Traction & Metrics

### 5.1 Platform Status: Production-Ready

| Milestone | Status |
|-----------|--------|
| Live production deployment | ✅ math.mismath.net |
| Zero TypeScript compilation errors | ✅ |
| 109 automated tests passing | ✅ |
| CI/CD pipeline (GitHub Actions) | ✅ |
| Sentry error tracking active | ✅ |
| GA4 analytics integrated | ✅ |
| PWA (offline-capable, installable) | ✅ |
| Trilingual (MK/EN/AL) complete | ✅ |
| B2B school inquiry pipeline | ✅ Active |
| Payment verification workflow | ✅ Operational |

### 5.2 Quality Infrastructure

- **3 CI/CD pipelines:** Deploy, Quality Gates, Critical File Guards
- **Bundle budget enforcement:** Automated size checks per route
- **Architecture governance:** Automated code quality rules
- **Deployment verification:** Post-deploy fingerprint matching
- **Firestore security rules:** Comprehensive field-level validation

### 5.3 B2B Pipeline

The platform includes a built-in **School Inquiries Dashboard**:
- Schools submit seat count, billing preference, and contact details
- Admin pipeline for lead tracking and follow-up
- Structured data: school name, contact person, email, seat count, plan interest

### 5.4 SEO & Content Marketing

- 3 published blog posts (OCR math, LaTeX extraction, Live MathKahoot)
- Open Graph image generation (automated)
- Sitemap generation (automated)
- Structured data and meta tags per route

---

## 6. Use of Funds

### 6.1 Monthly Budget Breakdown

| Category | Monthly Cost | Annual Cost | Details |
|----------|:------------:|:-----------:|---------|
| **Development** (1-2 engineers) | €2,000–3,000 | €24,000–36,000 | Feature development, maintenance, AI integration |
| **Design** (part-time) | €500–800 | €6,000–9,600 | UI/UX, mobile optimization, brand |
| **Translation** (AL/EN) | €200–400 | €2,400–4,800 | Ongoing localization, new features |
| **Marketing** | €300–500 | €3,600–6,000 | Teacher outreach, social media, conferences |
| **Infrastructure** | €200–500 | €2,400–6,000 | Firebase, Vercel, Gemini API, Sentry, domain |
| **Total** | **€3,200–5,300** | **€38,400–63,600** | |

### 6.2 Infrastructure Cost Detail

| Service | Monthly Cost | Purpose |
|---------|:------------:|---------|
| Firebase (Auth + Firestore + Storage) | €50–150 | Authentication, database, file storage |
| Google Gemini API | €100–300 | AI generation, embeddings, TTS, images |
| Vercel / Hostinger | €20–50 | Hosting, CDN, SSL |
| Sentry | €0–26 | Error tracking (free tier → team) |
| Domain + Email | €10–20 | mismath.net, business email |

### 6.3 Funding Allocation by Quarter

| Quarter | Focus | Budget |
|---------|-------|:------:|
| Q3 2026 | i18n completion, Gradebook, Early Warning | €12,000–16,000 |
| Q4 2026 | Parent portal, LMS integration, PWA | €12,000–16,000 |
| Q1 2027 | AI Tutor 2.0, Stripe billing, referrals | €12,000–16,000 |
| Q2 2027 | Regional expansion (Kosovo, Albania) | €12,000–16,000 |

---

## 7. 12-Month Roadmap

### Q3 2026 (July–September): Foundation & Polish

| Deliverable | Impact |
|-------------|--------|
| Complete Albanian localization QA | Unlock 25% of MK market |
| Gradebook enhancement (weighted categories, export) | Teacher retention |
| Early Warning System improvements | Student outcomes |
| Mobile PWA optimization | Rural school access |
| Onboarding wizard refinement | Reduce churn |

### Q4 2026 (October–December): Growth Features

| Deliverable | Impact |
|-------------|--------|
| Parent portal (read-only progress view) | Family engagement |
| LMS integration (Moodle plugin) | School adoption |
| Mobile PWA: offline extraction queue | Unreliable connectivity |
| Teacher referral program (beta) | Organic growth |
| School licensing workflow (B2B) | Revenue diversification |

### Q1 2027 (January–March): Monetization & Scale

| Deliverable | Impact |
|-------------|--------|
| AI Tutor 2.0 (voice input, multimodal) | Student engagement |
| Stripe automated billing | Self-service conversion |
| Referral system (teacher → teacher) | CAC reduction |
| Advanced analytics (cohort comparison) | School value proposition |
| API for third-party integrations | Ecosystem play |

### Q2 2027 (April–June): Regional Expansion

| Deliverable | Impact |
|-------------|--------|
| Kosovo curriculum adaptation | New market (300K students) |
| Albania curriculum mapping | New market (400K students) |
| Multi-tenant school administration | B2B scale |
| Partnership with regional education ministries | Institutional credibility |
| Teacher training program (certified) | Adoption acceleration |

---

## 8. Revenue Projections

### 8.1 Assumptions

- Free-to-Pro conversion rate: 5-8% (EdTech industry benchmark)
- Monthly churn (Pro): 4-6%
- School license average: 20 seats × €5/seat = €100/month
- Annual plan adoption: 40% of Pro users
- Organic growth: 15-25% MoM (teacher word-of-mouth + referrals)

### 8.2 Three Scenarios (12-Month)

#### Conservative (€38K investment, minimal marketing)

| Month | Free Users | Pro Users | Schools | MRR |
|-------|:----------:|:---------:|:-------:|:---:|
| 3 | 200 | 10 | 0 | €80 |
| 6 | 500 | 30 | 2 | €440 |
| 9 | 900 | 55 | 5 | €940 |
| 12 | 1,400 | 85 | 8 | €1,480 |
| **Year 1 Total** | | | | **€12,500** |

#### Moderate (€50K investment, active marketing)

| Month | Free Users | Pro Users | Schools | MRR |
|-------|:----------:|:---------:|:-------:|:---:|
| 3 | 400 | 25 | 1 | €300 |
| 6 | 1,200 | 80 | 5 | €1,140 |
| 9 | 2,500 | 160 | 12 | €2,480 |
| 12 | 4,000 | 280 | 20 | €4,240 |
| **Year 1 Total** | | | | **€35,000** |

#### Optimistic (€65K investment, ministry partnership)

| Month | Free Users | Pro Users | Schools | MRR |
|-------|:----------:|:---------:|:-------:|:---:|
| 3 | 600 | 40 | 2 | €520 |
| 6 | 2,000 | 150 | 10 | €2,200 |
| 9 | 5,000 | 350 | 25 | €5,300 |
| 12 | 8,000 | 600 | 40 | €8,800 |
| **Year 1 Total** | | | | **€72,000** |

### 8.3 Path to Profitability

| Scenario | Break-even Month | Year 2 ARR |
|----------|:----------------:|:----------:|
| Conservative | Month 18 | €25K |
| Moderate | Month 12 | €65K |
| Optimistic | Month 9 | €130K |

### 8.4 Long-Term Vision (3-Year)

With regional expansion (Kosovo + Albania) and ministry partnerships:
- **Year 2:** €150K–300K ARR (3 markets, 500+ Pro users)
- **Year 3:** €500K–1M ARR (national licenses, 2,000+ Pro users)
- **Exit potential:** Regional EdTech acquisition (Balkan market consolidation)

---

## 9. Competitive Landscape

### 9.1 Direct Competitors

| Competitor | Strengths | Weaknesses vs. MathDigitizer Pro |
|-----------|-----------|----------------------------------|
| **GeoGebra** | Free, massive user base, excellent graphing | No AI, no pedagogy, no MK curriculum, no grading, no classroom management |
| **Desmos** | Free, beautiful UI, activity builder | No AI, no OCR, no MK/AL language, no curriculum alignment |
| **Photomath** | Consumer OCR, step-by-step | Student-only, no teacher tools, no curriculum, no MK language |
| **Khan Academy** | Free, comprehensive content | English-only, no local curriculum, no teacher digitization tools |
| **Local LMS (Moodle)** | School adoption | No AI, no math-specific tools, poor UX |

### 9.2 Competitive Moat

1. **Language** — Only AI math platform in Macedonian and Albanian
2. **Curriculum** — Deep БРО standard integration (21 grade levels, competency codes)
3. **Pedagogy** — Bloom's/DoK classification, Socratic questioning, differentiated instruction
4. **Full workflow** — From digitization → generation → delivery → grading → analytics
5. **Local trust** — Built by a Macedonian math teacher, for Macedonian math teachers
6. **Switching costs** — Task libraries, gradebooks, student data accumulate over time

### 9.3 Why Global Competitors Won't Localize

- Market size (2M speakers) doesn't justify R&D investment for global players
- Curriculum alignment requires deep local knowledge (БРО standards, MK grading 1-5)
- Payment infrastructure (bank transfer, local invoicing) requires local presence
- Government procurement requires local entity and relationships

---

## 10. Team

### 10.1 Core Team

| Role | Person | Background |
|------|--------|------------|
| **Founder & Lead Developer** | Igor Bogdanoski | Math teacher + full-stack developer. Built the entire platform solo with AI-assisted development. Deep domain expertise in both MK mathematics pedagogy and modern web engineering. |

### 10.2 AI-Assisted Development Model

The platform was built using an innovative **AI-augmented solo development** approach:
- 130+ TypeScript files, 89 components, 109 tests — built by one developer
- AI pair programming for code generation, testing, and architecture decisions
- This model demonstrates **10x developer productivity** — a key cost advantage
- Investment in 1-2 additional developers would accelerate the roadmap 3-4x

### 10.3 Planned Team Expansion (Post-Funding)

| Role | Timing | Cost |
|------|--------|:----:|
| Full-stack developer | Immediate | €2,000-2,500/mo |
| Part-time UI/UX designer | Q3 2026 | €500-800/mo |
| Albanian localization specialist | Q4 2026 | €200-400/mo |
| Marketing/growth (part-time) | Q1 2027 | €300-500/mo |

### 10.4 Advisory Needs

Seeking advisors with experience in:
- EdTech go-to-market in emerging markets
- Government education procurement (Balkan region)
- SaaS scaling and unit economics
- Alibaba ecosystem partnerships (DingTalk education, AliCloud)

---

## 11. Impact

### 11.1 Educational Outcomes

| Impact Area | Mechanism | Expected Outcome |
|-------------|-----------|------------------|
| **Teacher efficiency** | AI digitization (2 min vs. 45 min per task) | 10+ hours/week saved |
| **Student engagement** | Gamification, live quizzes, adaptive difficulty | 30%+ increase in practice volume |
| **Equity** | Albanian language, offline PWA, free tier | Rural + minority access |
| **Early intervention** | AI risk detection + recommended actions | Reduce dropout by 15-20% |
| **Pedagogical quality** | Bloom's/DoK classification, Socratic prompts | Higher-order thinking skills |
| **Differentiation** | 3-level task variants (support/core/extension) | Inclusive education |

### 11.2 Social Impact Metrics (Projected, Year 1)

| Metric | Target |
|--------|:------:|
| Teachers onboarded | 500-1,000 |
| Students reached | 10,000-25,000 |
| Albanian-speaking students served | 2,500-6,000 |
| Rural schools with offline access | 50-100 |
| Teacher hours saved (collective) | 50,000-100,000 |
| Tasks digitized | 20,000-50,000 |

### 11.3 Alignment with UN SDGs

| SDG | Relevance |
|-----|-----------|
| **SDG 4** — Quality Education | AI-powered personalized learning, teacher empowerment |
| **SDG 5** — Gender Equality | Equal access regardless of gender (free tier) |
| **SDG 10** — Reduced Inequalities | Albanian minority inclusion, rural access |
| **SDG 17** — Partnerships | Cross-border education (MK-Kosovo-Albania) |

### 11.4 Alignment with Alibaba's Education Mission

- **"Education for All"** — Free tier ensures no teacher is excluded
- **AI for Social Good** — Gemini AI applied to underserved education markets
- **Rural Empowerment** — Offline PWA reaches schools without reliable internet
- **Minority Inclusion** — First AI math tool in Albanian (2M+ speakers)
- **Teacher-First Design** — Empowers educators rather than replacing them

---

## 12. The Ask

### 12.1 Funding Request

We seek **€50,000–65,000** in seed funding / grant to execute the 12-month roadmap:

| Tranche | Amount | Timing | Milestones |
|---------|:------:|--------|------------|
| **Tranche 1** | €20,000 | Immediate | Hire developer, complete AL QA, Gradebook v2, Early Warning v2 |
| **Tranche 2** | €15,000 | Month 4 | Parent portal, LMS integration, PWA optimization, B2B pipeline |
| **Tranche 3** | €15,000 | Month 8 | Stripe billing, AI Tutor 2.0, referral system, Kosovo prep |
| **Tranche 4** | €15,000 | Month 11 | Regional launch (Kosovo + Albania), ministry partnerships |

### 12.2 Milestones & Accountability

| Milestone | Deadline | Verification |
|-----------|----------|--------------|
| 500 registered teachers | Month 6 | GA4 dashboard |
| 50 Pro subscribers | Month 6 | Billing records |
| 5 school licenses | Month 9 | Contracts |
| Albanian market launch | Month 9 | Live deployment |
| 1,000 registered teachers | Month 12 | GA4 dashboard |
| €2,000 MRR | Month 12 | Revenue reports |
| Kosovo/Albania expansion | Month 12 | Live deployment |

### 12.3 What Makes This Different

1. **Not a pitch deck — a live product.** MathDigitizer Pro is production-ready, serving real users today.
2. **Not a copy — a first.** No AI math platform exists in Macedonian or Albanian.
3. **Not a team of MBAs — a teacher who codes.** Domain expertise is the moat.
4. **Not burning cash — building sustainably.** €50K funds 12 months of full-time development.
5. **Not a black box — open to diligence.** 109 tests, CI/CD, Sentry monitoring, full codebase review welcome.

### 12.4 Partnership Beyond Funding

We welcome Alibaba's support in:

- **AliCloud** — Infrastructure credits for scaling (Firebase → multi-cloud)
- **DingTalk Education** — Integration for school communication
- **Alibaba DAMO Academy** — AI model optimization for low-resource languages
- **Mentorship** — EdTech go-to-market, SaaS scaling, government sales
- **Network** — Introductions to regional education ministries

---

## Appendix A: Technical Architecture Summary

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4 |
| Backend | Express 5, Socket.IO 4 |
| Database | Cloud Firestore (18+ collections) |
| AI | Google Gemini (8 models: Pro, Flash, Lite, TTS, Image, Embedding) |
| Auth | Firebase Auth (Google OAuth) |
| Hosting | Hostinger (production), Vercel (preview) |
| CI/CD | GitHub Actions (3 pipelines) |
| Monitoring | Sentry, GA4 |
| PWA | Workbox (offline, installable) |
| Testing | Vitest (109 tests), Playwright |

## Appendix B: Pricing in Context

| Comparison | Monthly Cost |
|-----------|:------------:|
| MathDigitizer Pro Teacher | €8/month |
| Average MK teacher salary | €450/month |
| **Pro as % of salary** | **1.8%** |
| GeoGebra (free, no AI/pedagogy) | €0 |
| Desmos (free, no MK curriculum) | €0 |
| Photomath Plus (student-only) | €7/month |
| Khan Academy (no local content) | €0 |
| Private math tutor (1 hour) | €10-15 |

**Value proposition:** For less than 2% of monthly salary, a teacher gets unlimited AI assistance that saves 10+ hours/week — an effective hourly rate of €0.80 for AI-powered pedagogical support.

## Appendix C: Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Low teacher adoption | Free tier, referral program, ministry endorsement |
| AI cost overrun | Model tiering (Lite for batch, Flash for default, Pro for premium) |
| Competition entry | 12-18 month head start, curriculum depth, language moat |
| Regulatory change | Modular architecture, curriculum data externalized |
| Solo-developer risk | Documentation, 109 tests, CI/CD, hiring plan |
| Payment friction | Multiple channels (bank, PayPal, Stripe planned) |

---

*MathDigitizer Pro — Empowering every math teacher in the Western Balkans with AI.*

**Contact:** Igor Bogdanoski · igor.bogdanoski@mismath.net · https://math.mismath.net

---

*This proposal contains forward-looking projections based on EdTech industry benchmarks and the platform's current traction. All financial figures are estimates and subject to market conditions.*
