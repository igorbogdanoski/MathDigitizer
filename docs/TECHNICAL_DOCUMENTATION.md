# MathDigitizer Pro — Technical Documentation

> **Version:** 2.0 · July 2026  
> **Production URL:** https://math.mismath.net  
> **Stack:** React 19 + TypeScript 6 + Vite 8 + Firebase 12 + Gemini AI

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [AI Integration](#3-ai-integration)
4. [State Management](#4-state-management)
5. [i18n Architecture](#5-i18n-architecture)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Database Schema](#7-database-schema)
8. [Deployment](#8-deployment)
9. [Testing](#9-testing)
10. [Security](#10-security)
11. [Performance](#11-performance)

---

## 1. Architecture Overview

MathDigitizer Pro is a full-stack AI-powered EdTech SaaS platform for mathematics education in North Macedonia. The architecture follows a modern SPA pattern with a server-side AI proxy.

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | ^19.2.5 |
| Language | TypeScript | ~6.0.3 |
| Build Tool | Vite (Rolldown) | ^8.0.10 |
| Styling | Tailwind CSS | ^4.2.4 |
| Backend Proxy | Express + Socket.IO | ^5.2.1 / ^4.8.3 |
| Database | Cloud Firestore | firebase ^12.12.1 |
| Authentication | Firebase Auth (Google OAuth) | firebase ^12.12.1 |
| AI Engine | Google Gemini API | @google/genai ^1.50.1 |
| State Management | Zustand | ^5.0.12 |
| Routing | React Router DOM | ^7.14.2 |
| i18n | react-i18next | ^17.0.10 |
| Math Rendering | KaTeX + MathLive | ^0.16.45 / ^0.109.2 |
| Charts | Recharts + D3 | ^3.8.1 / ^7.9.0 |
| Error Tracking | Sentry | ^10.56.0 |
| PWA | vite-plugin-pwa (Workbox) | ^1.3.0 |
| Testing | Vitest + Testing Library | ^4.1.10 |

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ React 19 │  │ Zustand  │  │ i18next  │  │ PWA/Workbox   │  │
│  │ + Router │  │  Store   │  │  (3 lng) │  │ (Offline)     │  │
│  └────┬─────┘  └──────────┘  └──────────┘  └───────────────┘  │
│       │                                                         │
│  ┌────┴─────────────────────────────────────────────────────┐   │
│  │              Firebase Client SDK                          │   │
│  │   Auth (Google OAuth)  │  Firestore  │  Storage          │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────┴─────────────────────────────────┐
│                    SERVER (Express + Socket.IO)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ /api/ai/*    │  │ /api/billing │  │ /api/scrape          │  │
│  │ (Gemini      │  │ (Payment     │  │ /api/youtube/*       │  │
│  │  Proxy)      │  │  Verify)     │  │ (Web Scraping)       │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘  │
│         │                                                       │
│  ┌──────┴───────┐  ┌──────────────────────────────────────────┐ │
│  │ Firebase     │  │ Socket.IO (Real-time Canvas/Kahoot)      │ │
│  │ Admin SDK    │  │                                          │ │
│  └──────────────┘  └──────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Google       │  │ Firebase     │  │ Sentry               │  │
│  │ Gemini API   │  │ (Auth/DB)    │  │ (Error Tracking)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Server-side AI Proxy** — The Gemini API key never reaches the browser. All AI calls route through `/api/ai/*` endpoints authenticated via Firebase ID tokens.
2. **Fail-Closed Auth** — In production, if Firebase Admin is not configured, all AI proxy requests are rejected (503). No anonymous traffic can consume Gemini quota.
3. **PWA-First** — Workbox service worker enables offline access, critical for rural schools with unreliable connectivity.
4. **Route-Level Code Splitting** — All 35+ routes use `React.lazy()` for on-demand loading.
5. **Real-Time Collaboration** — Socket.IO powers live canvas drawing and Kahoot-style quiz sessions.

---

## 2. Project Structure

```
MathDigitizer/
├── .github/workflows/          # CI/CD pipelines
│   ├── deploy.yml              # Build & deploy to Hostinger via FTP
│   ├── quality-gates.yml       # Type check + tests + build + governance
│   └── guard-critical-files.yml # Protects auth chain integrity
├── scripts/                    # Build & ops scripts
│   ├── check-bundle-budget.mjs
│   ├── check-route-budgets.mjs
│   ├── check-governance.mjs
│   ├── run-quality-gates.mjs
│   ├── gen-og-image.mjs
│   ├── gen-sitemap.mjs
│   ├── migrate-from-ai-studio.mjs
│   ├── backup-firestore.mjs
│   └── promote-to-production.mjs
├── src/
│   ├── components/             # 89 React components
│   │   ├── analytics/          # Analytics dashboard sub-components
│   │   ├── blog/               # SEO blog posts (public)
│   │   ├── dashboard/          # Dashboard sub-components
│   │   ├── extraction/         # Extraction engine sub-components
│   │   ├── flashcards/         # Flashcard system
│   │   ├── graph-digitizer/    # Graph digitizer tools
│   │   ├── home/               # Landing page sections
│   │   ├── library/            # Library & Pedagogue editor
│   │   ├── live/               # Live sessions (Kahoot, Whiteboard, Exams)
│   │   ├── pedagogue-command-center/
│   │   ├── school-inquiries/   # B2B lead pipeline
│   │   ├── smart-ocr/          # OCR sub-components
│   │   ├── student/            # Student-facing views
│   │   └── ui/                 # Shared UI primitives
│   ├── contexts/               # React Context providers
│   │   ├── AccessibilityContext.tsx
│   │   ├── AuthContext.tsx
│   │   ├── GamificationContext.tsx
│   │   └── ToastContext.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useModalA11y.ts
│   │   ├── useRealtimeTasks.ts
│   │   ├── useTaskActions.ts
│   │   └── useTaskFilters.ts
│   ├── lib/                    # Core business logic
│   │   ├── ai/                 # AI domain modules (see §3)
│   │   ├── analytics.ts        # GA4 event tracking
│   │   ├── curriculumData.ts   # MK national curriculum (БРО)
│   │   ├── curriculumKnowledge.ts
│   │   ├── earlyWarning.ts     # Student risk detection
│   │   ├── emailService.ts
│   │   ├── export.ts           # PDF/DOCX/CSV export
│   │   ├── firebase.ts         # Firebase client init
│   │   ├── gemini.ts           # Legacy AI facade (deprecated)
│   │   ├── knowledgeModel.ts   # Knowledge graph model
│   │   ├── mathVerify.ts       # Math verification (Compute Engine)
│   │   ├── observability.ts    # Sentry + performance monitoring
│   │   ├── payment.ts          # Payment flow helpers
│   │   ├── pedagogyPolicy.ts   # Pedagogical rules engine
│   │   ├── pedagogyQa.ts       # Pedagogy quality assurance
│   │   ├── promptEngineering.ts # Prompt templates
│   │   ├── ragContext.ts       # RAG context builder
│   │   ├── saas.ts             # SaaS/billing logic (Pro access)
│   │   ├── schema.ts           # TypeScript interfaces (all entities)
│   │   ├── seo.ts              # SEO/meta helpers
│   │   ├── sound.ts            # Audio feedback
│   │   ├── srsAlgorithm.ts     # Spaced repetition (SM-2)
│   │   └── utils.ts            # Shared utilities
│   ├── locales/                # i18n translation files
│   │   ├── mk/                 # Macedonian (21 namespaces)
│   │   ├── en/                 # English (21 namespaces)
│   │   └── al/                 # Albanian (21 namespaces)
│   ├── store/                  # Zustand stores
│   │   └── useLibraryStore.ts  # Library state (tasks, filters, UI)
│   ├── App.tsx                 # Root component + route definitions
│   ├── i18n.ts                 # i18next configuration
│   ├── main.tsx                # Entry point
│   └── setupTests.ts           # Vitest setup
├── server.ts                   # Express + Socket.IO backend
├── vite.config.ts              # Vite build configuration
├── firestore.rules             # Firestore security rules
├── vercel.json                 # Vercel rewrites (Firebase auth proxy)
├── firebase.json               # Firebase project config
├── firebase-applet-config.json # Firebase client config
├── playwright.config.ts        # E2E test config
└── package.json                # Dependencies & scripts
```

### Component Count by Domain

| Domain | Components | Key Files |
|--------|-----------|-----------|
| Extraction & OCR | 8+ | ExtractionEngine, SmartOCR, GraphDigitizer |
| Library & Materials | 10+ | Library, MaterialsFactory, CurriculumFactory |
| Live Sessions | 6+ | GameHost, GamePlayer, LiveCanvas, VirtualWhiteboard |
| Student Tools | 8+ | Flashcards, AdaptiveTest, StudentDashboard, TodoList |
| Teacher Tools | 12+ | SmartGrader, Gradebook, AnalyticsDashboard, EarlyWarning |
| AI Pedagogy | 5+ | AIPedagogyCritique, PedagogueCommandCenter, TaskDifferentiation |
| Billing & Admin | 5+ | BillingDashboard, Pricing, SchoolInquiriesDashboard |
| Shared UI | 10+ | Layout, MathRenderer, LanguageSwitcher, CommandPalette |

---

## 3. AI Integration

### 3.1 Gemini API Proxy (server.ts)

The Express server acts as a secure proxy between the browser and Google's Gemini API:

```
Browser → POST /api/ai/generate-content (Bearer token)
       → Server verifies Firebase ID token
       → Server calls Gemini API with GEMINI_API_KEY
       → Response returned to browser
```

**Endpoints:**

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/ai/generate-content` | POST | Firebase ID Token | Text/multimodal generation |
| `/api/ai/embed-content` | POST | Firebase ID Token | Text embeddings (RAG) |
| `/api/ai/chats/create` | POST | Firebase ID Token | Create chat session |
| `/api/ai/chats/:id/send-message` | POST | Firebase ID Token | Send chat message |
| `/api/billing/verify-payment` | POST | Admin only | Approve/reject payments |
| `/api/billing/status` | GET | Firebase ID Token | User billing status |
| `/api/youtube/transcript` | GET | None | YouTube transcript extraction |
| `/api/scrape` | GET | None | Web content scraping (SSRF-protected) |
| `/api/health` | GET | None | Health check |

### 3.2 AI Domain Modules (src/lib/ai/)

The AI layer is decomposed into focused domain modules:

| Module | Responsibility |
|--------|---------------|
| `client.ts` | Gemini client initialization, proxy fallback, auth token injection |
| `models.ts` | Centralized model IDs (single source of truth) |
| `extraction.ts` | PDF/image/video → structured math tasks |
| `grading.ts` | Automated assessment with Bloom's/DoK classification |
| `generation.ts` | Task generation, differentiation, test creation |
| `materials.ts` | Worksheet/PDF material generation |
| `media.ts` | Image generation, TTS, multimodal processing |
| `chat.ts` | Conversational AI tutor sessions |
| `kahoot.ts` | Quiz generation for live sessions |
| `embeddings.ts` | Vector embeddings for semantic search (RAG) |
| `utils.ts` | Shared AI helpers (token counting, retry logic) |
| `index.ts` | Barrel export |

### 3.3 Model Configuration

| Model ID | Role | Use Case |
|----------|------|----------|
| `gemini-3.1-pro-preview` | PRO_MODEL | Extraction, pedagogy, spatial multimodal |
| `gemini-3.5-flash` | DEFAULT_MODEL | General generation (balanced) |
| `gemini-3.6-flash` | FLASH_36_MODEL | Fast + high quality generation |
| `gemini-3-flash-preview` | FAST_MODEL | Legacy fast option (UI selectable) |
| `gemini-3.5-flash-lite` | LITE_MODEL | High-volume batch operations |
| `gemini-3.1-flash-tts-preview` | TTS_MODEL | Text-to-speech audio output |
| `gemini-3.1-flash-image` | IMAGE_MODEL | Illustration generation |
| `gemini-embedding-2` | EMBEDDING_MODEL | Semantic search / RAG |

### 3.4 Client-Side AI Architecture

The `client.ts` module implements a dual-path strategy:

1. **Build-time key** (`VITE_GEMINI_API_KEY`) — Used when deployed to static hosting (Vercel). The key is referrer-restricted to the production domain.
2. **Server proxy fallback** — When no build-time key is available, a browser proxy client routes all calls through `/api/ai/*` with Firebase auth tokens.

```typescript
// Proxy client mirrors the GoogleGenAI interface
const proxyClient = {
  models: {
    generateContent: (payload) => postJson('/api/ai/generate-content', payload),
    embedContent: (payload) => postJson('/api/ai/embed-content', payload),
  },
  chats: {
    create: async (payload) => { /* server-managed session */ }
  }
};
```

### 3.5 Curriculum RAG

The platform integrates North Macedonia's official curriculum (БРО стандарди) as a RAG context source:

- `curriculumData.ts` — Full K-12 curriculum data (21 grade levels, competency codes like МА.7.5.2)
- `ragContext.ts` — Builds context blocks for AI prompts
- `curriculumKnowledge.ts` — Firestore-backed curriculum chunk storage
- `embeddings.ts` — Vector search over curriculum chunks

---

## 4. State Management

### 4.1 Zustand Store (useLibraryStore)

The primary client-side state is managed via Zustand in `src/store/useLibraryStore.ts`:

**State slices:**
- **Tasks** — `tasks: MathTask[]`, loading state
- **Filters** — search query, difficulty, source, tags, grade level, folder, DoK level, sort order
- **Search modes** — keyword vs. semantic (embedding-based)
- **UI state** — zoomed images, collapsed steps, expanded prompts, copied formula tracking
- **Selection** — multi-select for batch operations
- **Custom ordering** — drag-and-drop task reordering

### 4.2 React Contexts

| Context | Purpose |
|---------|---------|
| `AuthContext` | Firebase auth state, user profile, role, Pro status |
| `ToastContext` | Global notification system |
| `GamificationContext` | XP, levels, daily quests, streaks, badges |
| `AccessibilityContext` | WCAG 2.1 AA preferences, reduced motion |

### 4.3 Server-Side State

- **Socket.IO rooms** — Real-time canvas events and Kahoot game state
- **In-memory chat sessions** — Server maintains up to 200 Gemini chat sessions (LRU eviction)
- **Firestore** — All persistent state (see §7)

---

## 5. i18n Architecture

### 5.1 Configuration

- **Library:** react-i18next ^17.0.10 + i18next-browser-languagedetector ^8.2.1
- **Languages:** Macedonian (mk, default), Albanian (al), English (en)
- **Detection order:** localStorage → browser navigator → HTML lang tag
- **Storage key:** `mathdigitizer_language`
- **Fallback:** Macedonian (mk)
- **Suspense:** Disabled (`useSuspense: false`)

### 5.2 Namespaces (21 total)

| Namespace | Domain |
|-----------|--------|
| `common` | Shared UI strings, buttons, errors |
| `navigation` | Menu items, breadcrumbs |
| `pricing` | Pricing page, plan descriptions |
| `home` | Landing page |
| `library` | Task library |
| `extraction` | Extraction engine |
| `dashboard` | User dashboard |
| `flashcards` | Flashcard system |
| `gradebook` | Grade management |
| `differentiation` | Task differentiation |
| `earlyWarning` | Early warning system |
| `billing` | Billing & payments |
| `schoolInquiries` | B2B school inquiries |
| `smartOcr` | Smart OCR |
| `smartGrader` | AI grading |
| `graphDigitizer` | Graph digitizer |
| `analytics` | Analytics dashboard |
| `pedagogue` | Pedagogue command center |
| `materialsFactory` | Materials factory |
| `tutorChat` | AI tutor chat |
| `adaptiveTest` | Adaptive testing |

### 5.3 File Organization

```
src/locales/
├── mk/          # Macedonian (default, complete)
│   ├── common.json
│   ├── navigation.json
│   ├── ... (21 files)
│   └── adaptiveTest.json
├── en/          # English (complete)
│   └── ... (21 files)
└── al/          # Albanian (complete)
    └── ... (21 files)
```

### 5.4 Usage Pattern

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('extraction');
  return <button>{t('startExtraction')}</button>;
}
```

---

## 6. Authentication & Authorization

### 6.1 Firebase Auth

- **Provider:** Google OAuth 2.0 (signInWithPopup, fallback to signInWithRedirect)
- **Domain:** `mathdigitizer.vercel.app` (configured for Vercel deployment)
- **Token:** Firebase ID tokens used for server-side API authentication

### 6.2 Role-Based Access Control

| Role | Access Level |
|------|-------------|
| `teacher` | Full platform access, admin functions, Pro features |
| `student` | Learning tools, flashcards, adaptive tests, live sessions |
| Admin (email-based) | Payment verification, system administration |

### 6.3 Pro Access (hasProAccess)

```typescript
// src/lib/saas.ts
export function hasProAccess(profile: UserProfile | null): boolean {
  if (ADMIN_EMAIL && profile?.email === ADMIN_EMAIL) return true;
  return Boolean(profile?.isPro) || isOnTrial(profile);
}
```

**Pro activation paths:**
1. **7-day free trial** — `trialStartedAt` timestamp, auto-expires
2. **Manual payment approval** — Admin verifies bank/PayPal receipt → sets `isPro: true`
3. **Teacher grant** — Teachers can activate Pro on other accounts (not their own)
4. **Admin override** — `VITE_ADMIN_EMAIL` always has Pro access

### 6.4 Route Protection

The `ProtectedRoute` component enforces:
- Authentication (Firebase logged in)
- Role restrictions (`allowedRoles: ['teacher']`)
- Pro requirement (`requirePro: true`)

### 6.5 Server-Side Auth (Fail-Closed)

```typescript
// server.ts — requireAuth middleware
async function requireAuth(req, res, next) {
  if (!firebaseAdminInitialized) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Auth service unavailable" });
    }
    return next(); // Dev-only permissive fallback
  }
  // Verify Bearer token via Firebase Admin SDK
  const decodedToken = await admin.auth().verifyIdToken(token);
  next();
}
```

---

## 7. Database Schema

### 7.1 Firestore Collections

| Collection | Purpose | Key Fields |
|-----------|---------|------------|
| `users` | User profiles | uid, email, displayName, role, isPro, trialStartedAt, proStartedAt, paymentChannel |
| `tasks` | Math task library | title, original_text, solution_steps, latex_formulas, difficulty, dok_level, bloom_taxonomy, embedding, author_uid |
| `user_stats` | Gamification state | xp, level, tasks_completed, streak, badges, quests |
| `todos` | Student task lists | text, completed, dueDate, userId |
| `classrooms` | Teacher classrooms | name, teacherId, inviteCode, studentIds |
| `assignments` | Classroom assignments | classroomId, title, taskIds, dueDate |
| `student_progress` | Assignment completion | studentId, assignmentId, taskId, status |
| `flashcards` | SRS flashcards | front, back, user_uid, interval, ease_factor |
| `task_attempts` | Cognitive telemetry | user_id, task_id, steps_taken, total_time_spent, mistake_count |
| `graded_submissions` | AI grading results | student_identifier, teacher_uid, score, pedagogical_evaluation |
| `live_sessions` | Kahoot game state | teacher_uid, quiz_data, status, participants |
| `whiteboard_sessions` | Saved whiteboards | authorId, strokes |
| `summative_exams` | Formal exams | teacher_uid, test_data, status |
| `summative_attempts` | Exam submissions | exam_id, student_uid, answers, score, anti_cheat |
| `active_user_sessions` | Live activity beacons | userId (real-time monitoring) |
| `payment_receipts` | Payment verification | payer_name, payment_channel, reference_code, status |
| `school_inquiries` | B2B leads | school_name, seat_count, billing_period_interest, status |
| `sales_ops_alert_state` | Admin alert tracking | dashboard_id, acknowledged_signature |
| `curriculum_knowledge` | RAG chunks | Curriculum text chunks for semantic search |
| `ui_events` | UI telemetry | uid, event data (teacher-readable) |

### 7.2 Security Rules Highlights

- **Users:** Self-read/write only; teachers can read all; Pro status immutable via self-service
- **Tasks:** Any authenticated user reads; only author writes/deletes; strict field validation
- **Payment receipts:** Create by authenticated user (status must be 'pending'); update by teachers only
- **School inquiries:** Public create (validated); read/update by teachers only
- **Live sessions:** Teacher owns; students can only modify `participants` map
- **Task attempts:** Write-once (no updates allowed after creation)

### 7.3 Data Validation

Firestore rules enforce:
- String length limits (title ≤ 200, original_text ≤ 50000)
- List size limits (solution_steps ≤ 50, tags ≤ 10)
- Enum validation (difficulty ∈ ['easy', 'medium', 'hard'])
- Date format validation (ISO 8601)
- Field allowlists (no unexpected fields)
- Immutable fields (author_uid, created_at)

---

## 8. Deployment

### 8.1 Production Architecture

```
GitHub (main branch)
    │
    ├──→ GitHub Actions (deploy.yml)
    │       │
    │       ├── npm install
    │       ├── npm run build (OG image + sitemap + Vite)
    │       ├── lftp upload to Hostinger
    │       └── Verify deployment (bundle fingerprint check)
    │
    └──→ math.mismath.net (Hostinger Apache/cPanel)
```

### 8.2 Hostinger FTP Deployment

- **Target:** `math.mismath.net`
- **Method:** lftp direct puts (zero remote listing for speed)
- **Path:** `domains/mismath.net/public_html/math` (via `FTP_SERVER_DIR` secret)
- **Verification:** Post-deploy curl check confirms the expected bundle hash is live
- **Permissions:** 755 directories, 644 files

### 8.3 Vercel (Secondary/Preview)

`vercel.json` configures rewrites for Firebase Auth paths:
```json
{
  "rewrites": [
    { "source": "/__/auth/:path*", "destination": "https://mathdigitizer-pro.firebaseapp.com/__/auth/:path*" },
    { "source": "/__/firebase/init.json", "destination": "https://mathdigitizer-pro.firebaseapp.com/__/firebase/init.json" }
  ]
}
```

### 8.4 CI/CD Pipelines

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `deploy.yml` | Push to main | Build → FTP upload → Verify |
| `quality-gates.yml` | PR + push to main | Type check → Tests → Build → Governance → Bundle budget |
| `guard-critical-files.yml` | PR + push to main | Verify vercel.json, firebase config, PWA denylist, auth method, migration scripts, .gitignore |

### 8.5 Build Pipeline

```bash
npm run build
# Executes:
# 1. node scripts/gen-og-image.mjs    — Generate Open Graph image
# 2. node scripts/gen-sitemap.mjs     — Generate sitemap.xml
# 3. vite build                       — Bundle with code splitting
```

---

## 9. Testing

### 9.1 Test Framework

- **Unit/Integration:** Vitest ^4.1.10 (jsdom environment, forks pool)
- **E2E:** Playwright ^1.61.1
- **Component:** @testing-library/react ^16.3.2
- **Firestore Rules:** @firebase/rules-unit-testing ^5.0.1

### 9.2 Test Coverage

- **109 automated tests** across unit, integration, and smoke tests
- **Smoke tests** for critical components: ProtectedRoute, TutorChat, MaterialsFactory, ExtractionEngine, SmartGrader, AnalyticsDashboard, MathRenderer
- **Domain logic tests:** mathVerify, srsAlgorithm, pedagogyQa, promptEngineering, ragContext, seo, observability, knowledgeModel, flashcardsSM2
- **AI module tests:** client, models, embeddings, utils

### 9.3 Test Configuration

```typescript
// vite.config.ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/setupTests.ts',
  pool: 'forks',
  exclude: ['e2e/**', 'node_modules/**', 'src/lib/firestore.rules.test.ts'],
}
```

### 9.4 Quality Gates

```bash
npm run quality:gates
# Runs:
# 1. TypeScript type check (tsc --noEmit)
# 2. Vitest (all tests)
# 3. Vite build
# 4. Governance check (scripts/check-governance.mjs)
# 5. Bundle budget check (scripts/check-bundle-budget.mjs)
```

---

## 10. Security

### 10.1 API Key Protection

- **Gemini API key** is never exposed to the browser in production
- Server proxy requires Firebase ID token verification
- Build-time key (`VITE_GEMINI_API_KEY`) is referrer-restricted to production domain
- Old `/api/config` endpoint (which leaked the key) has been removed

### 10.2 Fail-Closed Authentication

- Production: Firebase Admin not configured → 503 (reject all)
- Development: Permissive fallback (logged as warning)
- Admin endpoints: Email allowlist verification (`ADMIN_EMAILS` env var)

### 10.3 SSRF Protection (Web Scraper)

```typescript
// Blocks private/internal hosts
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i, /^127\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./, /^0\.0\.0\.0$/,
  /^169\.254\./,  // Cloud metadata endpoint
  /^\[::1\]$/, /^\[fe80:/i, /^\[fc[0-9a-f]{2}:/i, /^\[fd[0-9a-f]{2}:/i,
];
// Also blocks suspicious numeric hosts (decimal/hex IP encoding)
// Redirects are NEVER followed (prevents SSRF via 3xx)
```

### 10.4 CORS Policy

- Allowlist-based: `DEFAULT_ALLOWED_ORIGINS = ["https://math.mismath.net"]`
- Configurable via `ALLOWED_ORIGINS` env var
- Fails closed (no wildcard fallback)

### 10.5 Firestore Security Rules

- Comprehensive field-level validation
- Role-based access (teacher/student/admin)
- Immutable field protection (author_uid, created_at)
- Write-once patterns (task_attempts cannot be updated)
- Self-service Pro escalation blocked

### 10.6 Error Tracking (Sentry)

- `@sentry/react` ^10.56.0 for client-side error capture
- `observability.ts` — Route views, timing, global error handlers
- Production-only initialization (no Sentry in dev)

### 10.7 Secret Hygiene

- `.gitignore` protects `serviceAccount-*.json` and `scripts/secrets/`
- GitHub Actions secrets for FTP credentials, API keys
- `guard-critical-files.yml` CI check ensures secrets are never committed

### 10.8 Input Validation

- Socket.IO room IDs: regex-validated (`/^[a-zA-Z0-9_-]{3,80}$/`)
- YouTube transcript: hostname allowlist (youtube.com variants only)
- Web scraper: URL protocol restriction (http/https only), 10s timeout, 20KB content limit

---

## 11. Performance

### 11.1 Route-Level Code Splitting

All 35+ routes use `React.lazy()` with dynamic imports:

```typescript
const ExtractionEngine = lazy(() => import('./components/ExtractionEngine'));
const SmartOCR = lazy(() => import('./components/SmartOCR'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
// ... 32+ more lazy routes
```

### 11.2 Vendor Chunk Strategy

The Vite build uses manual chunks to optimize caching:

| Chunk | Contents |
|-------|----------|
| `vendor-react-core` | react, react-dom, react-router-dom |
| `vendor-firebase` | Firebase SDK |
| `vendor-ai` | @google/genai |
| `vendor-recharts` | Recharts |
| `vendor-d3` | D3.js |
| `vendor-katex` | KaTeX |
| `vendor-mathlive` | MathLive |
| `vendor-markdown-math` | remark-math, rehype-katex |
| `vendor-jspdf` | jsPDF |
| `vendor-html2canvas` | html2canvas |
| `vendor-pdfjs` | pdf.js |
| `vendor-docx` | docx |
| `vendor-mammoth` | mammoth |
| `vendor-konva` | react-konva, konva |
| `vendor-jsxgraph` | JSXGraph |

### 11.3 PWA & Offline

- **Service Worker:** Workbox with auto-update
- **Cache strategy:** CacheFirst for fonts (1-year expiry)
- **Max cache size:** 5MB per file
- **Navigation fallback:** SPA routing with `/api` and `/__/` denylist
- **Installable:** Standalone display mode, custom icons

### 11.4 Bundle Budgets

Quality gate scripts enforce:
- `check-bundle-budget.mjs` — Total bundle size limits
- `check-route-budgets.mjs` — Per-route chunk size limits
- `check-governance.mjs` — Architecture governance rules

### 11.5 Runtime Optimizations

- **@tanstack/react-query** — Server state caching, deduplication
- **@tanstack/react-virtual** — Virtualized lists for large datasets
- **react-window** — Windowed rendering
- **Fuse.js** — Client-side fuzzy search (no server round-trip)
- **Zustand** — Minimal re-renders (selector-based subscriptions)
- **Framer Motion** — GPU-accelerated animations

---

## Appendix: NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server (Express + Vite HMR) |
| `npm run build` | Production build (OG image + sitemap + Vite) |
| `npm run start` | Production server |
| `npm run test` | Run Vitest (watch mode) |
| `npm run test:smoke` | Run smoke tests only |
| `npm run lint` | TypeScript type check |
| `npm run quality:bundle` | Check bundle size budgets |
| `npm run quality:routes` | Check per-route budgets |
| `npm run quality:governance` | Architecture governance |
| `npm run quality:gates` | All quality gates |
| `npm run migrate:dry` | Dry-run Firestore migration |
| `npm run migrate` | Execute Firestore migration |
| `npm run backup` | Backup Firestore data |
| `npm run promote` | Promote to production |

---

*Document generated from actual codebase analysis. Last verified: July 2026.*
