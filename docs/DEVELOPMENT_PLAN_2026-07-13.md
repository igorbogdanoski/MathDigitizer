# Development Plan — MathDigitizer Pro

_Compiled 2026-07-13. Based on: a 4-way parallel code review (lib/ business logic, auth/security/API surface, high-traffic components, admin/analytics components), a live production audit fixing three shipped incidents earlier the same day (site-wide scroll lock, Hostinger FTP deploy pipeline, UI discoverability gaps), a PWA/installability check, and a test-coverage survey. Companion to `docs/UI_UX_UPGRADE_PLAN.md` (UI/UX backlog — Sprints 0–3, mostly in progress) and `docs/DEPLOY_TROUBLESHOOTING.md` (deploy pipeline history)._

> **Process note on how this review was produced:** midway through the code review, the local `main` checkout was accidentally left on a stale branch that predated that day's fixes, so two of the four reviewer agents initially re-reported the already-fixed scroll-lock bug as new. This was caught and corrected (local `main` hard-reset to `origin/main`, every flagged file re-verified) before compiling this document — the findings below reflect the **actual current codebase**, not the stale snapshot. Flagged here as a reminder that this repo's local/remote branch divergence (see `docs/DEPLOY_TROUBLESHOOTING.md`-adjacent history) is itself an ongoing risk worth fixing (see Phase 4).

---

## 0. Executive summary

The product is functionally deep (35+ routes, ~90 components, ~30 distinct AI-powered features) but has never had a systematic security or architecture pass. This review found **4 critical security issues that allow any signed-in user to grant themselves free Pro access and escalate to a teacher role**, plus **2 completely broken AI features** (wrong API call), **1 fully non-functional feature** (missing Firestore rule), and a long tail of real race conditions and data-integrity bugs in the highest-traffic pages. None of this is visible from normal manual testing — it takes either targeted code review or a browser console — which is exactly why it went unnoticed.

**Recommended order of work:** security lockdown first (days, not weeks — these are small, surgical fixes), then the broken/non-functional features (quick wins, high user-visible impact), then the data-integrity race conditions, then testing infrastructure to prevent this class of thing shipping silently again, then architecture cleanup and the previously-discussed strategic items (i18n, tool investment, mobile).

---

## 1. Security findings (fix first — Phase 0)

All verified by direct code/rules inspection, not speculation.

### Critical

1. **Any authenticated user can self-grant Pro access and self-promote to `teacher` role.** `firestore.rules:241-243` — the `users/{userId}` update rule only validates shape (`isValidUserProfile`), never pins `role`/`isPro` to their previous values. A client-side `updateDoc(doc(db,'users',uid), {isPro: true, role: 'teacher'})` passes the rules as written. Role escalation then cascades into every rule gated on `isTeacher()` (which just re-reads the same self-controlled document) — read/write access to `school_inquiries`, `payment_receipts` (other users' PII/payment data), grading on `summative_attempts`, deleting `curriculum_knowledge`/`live_sessions`. `canTeacherActivateProOnUser()` additionally lets any self-declared teacher grant Pro to *any other user's* document, no relationship check.
2. **Gemini API key is shipped in the public client bundle via two separate paths, unrestricted by anything but a weak HTTP-referrer check.** (a) The documented path: `VITE_GEMINI_API_KEY` inlined by Vite (`src/lib/gemini.ts:78-120`), mitigated only by referrer restriction — trivially bypassed by any non-browser HTTP client. (b) An **undocumented second path**: `vite.config.ts`'s `define` block inlines the raw `GEMINI_API_KEY` (meant to stay server-side) into the client bundle whenever it's present in the build environment — confirmed present in an actual `dist/assets/gemini-*.js` build artifact already in the working tree. Either path lets anyone extract the key from devtools/view-source and run up the Gemini bill outside the app, and bypasses every client-side Pro/role gate for AI features entirely.
3. **`ProtectedRoute`'s role check silently no-ops when `userProfile` is `null`.** `src/components/ProtectedRoute.tsx:44` — `if (allowedRoles && userProfile && !allowedRoles.includes(...))`. A freshly-signed-in user whose Firestore profile doc doesn't exist yet (mid-onboarding) or whose fetch threw (swallowed in `AuthContext.tsx:54-56`) has `userProfile === null`, making the whole guard falsy. They can navigate straight to `students/:studentId`, `school-inquiries`, or `curriculum-admin` before role selection completes.
4. **`server.ts`'s AI proxy and scrape/transcript endpoints are unauthenticated**, and `server.ts` fails CORS **open** by default (any origin) when `ALLOWED_ORIGINS` is unset, unlike `api/_shared.ts` which fails closed. Combined: on any Express/Hostinger-style deployment where that env var is forgotten, `/api/ai/*` is an open, unmetered proxy to the paid Gemini API for anyone on the internet.

### High

5. **SSRF protection (`isPrivateHost`) is bypassable**, identically in `api/_shared.ts` and `server.ts`: misses the cloud metadata IP (`169.254.169.254`), alternate IP encodings (decimal/hex/octal), IPv6 private ranges beyond literal loopback, and — most importantly — does no re-validation on redirect (`fetch()` defaults to `redirect: 'follow'`), so a URL that passes the check can 302 to a private/metadata address and the fetch follows it anyway. No DNS-rebinding protection either.
6. `api/scrape.ts` / `api/youtube/transcript.ts` (and their `server.ts` twins) have no auth and no rate limiting beyond a 10s timeout — usable as a free, anonymous scraping/SSRF proxy.
7. Several Firestore collections allow any authenticated user to write/delete data they don't own: `assignments` (no ownership check at all — any student can edit/delete any teacher's assignment), `live_sessions` update (any user can tamper with another teacher's live session), `whiteboard_sessions` update (any user can overwrite another user's board), `task_attempts` update (owning student can rewrite the entire doc, no field restrictions — self-grade tampering if a grade field lives there), `users/{userId}` read (any signed-in user, including students, can read any other user's full profile — email, role, Pro/trial status; a `list` query would enumerate the whole collection).
8. **The `active_user_sessions` collection (Live Classroom Monitor's data source) has no Firestore rule at all** — confirmed via direct inspection of `firestore.rules` (no matching `match` block, no catch-all default). Under standard Firestore semantics this means the feature is currently **non-functional in production** (every read/write permission-denied), not merely insecure. Separately, even once a rule is added, `LiveClassroomMonitor.tsx:16-19`'s query has no per-teacher/classroom scoping — it would show every teacher's live sessions platform-wide unless the new rule adds that scoping itself.
9. The two backend implementations of "the same" endpoints (`server.ts` vs `api/*.ts`, used for Hostinger vs Vercel respectively) have drifted: `api/scrape.ts` preserves MathJax/KaTeX formula markup, `server.ts`'s version silently strips it; `/api/ai/*` exists only in `server.ts`, meaning a Vercel-only deployment with no client-exposed key would break every AI feature (which in practice is what's forcing reliance on the exposed-key path in finding 2).

**Immediate action for Phase 0:** lock the Firestore rules gap (pin `role`/`isPro` to unchanged-unless-admin, add `active_user_sessions` rule with teacher-scoping, add ownership checks to `assignments`/`live_sessions`/`whiteboard_sessions`/`task_attempts`), fix the `vite.config.ts` define-block key leak, fix the `ProtectedRoute` null-profile bypass, and gate `server.ts`'s AI proxy behind a Firebase ID token check. These are small, targeted diffs — not a redesign — and should ship before any of the strategic work below.

---

## 2. Broken / non-functional features (Phase 1 — quick wins)

1. **`generateInterventionTasks` and `generateTargetedPracticeTasks` are completely broken** (`src/lib/gemini.ts:481`, `:2178`) — both call `result.text()` as a function; it's a getter property everywhere else in the file (30+ correct call sites). Every invocation throws. `generateTargetedPracticeTasks` is wired into `SmartGrader.tsx`, `AdaptiveTest.tsx`, `StudentTelemetryView.tsx` — targeted practice generation is broken for every user, every time.
2. **Flashcards spaced-repetition study mode has a reproducible crash and silently skips ~half of due cards.** `calculateSM2` always pushes `next_review` into the future, so the due-card queue shrinks by one after every review, but `handleReview` (`Flashcards.tsx:161-204`) advances the index using the stale pre-review array length. Traced concretely: a 4-card session throws `TypeError` on the 3rd review (`studyCards[currentIndex]` becomes `undefined`); sessions that don't crash still skip roughly half the due cards without ever showing them.
3. **Live Classroom Monitor is non-functional** — see security finding 8 above (missing Firestore rule).
4. **AnalyticsDashboard crashes for trial users whose trial expires mid-session.** `AnalyticsDashboard.tsx:63-70` returns early (`if (!isPro)`) before ~15 more hooks are declared later in the function. `isPro` depends on `Date.now()` via `trialDaysRemaining()`, re-evaluated fresh every render — not a stable flag pinned at mount. A trial user who keeps the page open across their trial-expiry moment and triggers any re-render gets "Rendered fewer hooks than during the previous render" and the page crashes.
5. `analyzeSolutionImage`'s response schema (`gemini.ts:1988-2016`) lists `good_sides`/`bad_sides` in `required` but never declares them in `properties` — a malformed JSON Schema that means Gemini can never actually return those two fields, silently undermining the grading UI that expects them.
6. `sendReceiptNotification` (manual Pro-activation payment flow) has zero error handling (`emailService.ts:15-27`) — any EmailJS failure silently drops the admin notification with no logging anywhere. A teacher believes their payment receipt was submitted; the founder never sees it.

---

## 3. Data-integrity / race-condition bugs (Phase 2)

Grouped by component, most severe first within each.

**Library.tsx** (highest-traffic page):
- Pagination + a real-time listener on page 0 can silently drop a task from the merged list once a user has loaded page 2+ and someone else creates a new task — the shifted item falls into a gap neither page covers, until a full reload.
- A DOM-event listener effect closes over a stale `store.tasks` snapshot (dependency array only tracks `selectedForTest`) — "Generate Live Session"/"Export to Flashcards" can use outdated task text if tasks changed without the selection changing.
- Unselected Zustand store subscription (`useLibraryStore()` with no selector) means the entire page tree re-renders every second while any practice timer runs.

**ExtractionEngine.tsx:**
- Bulk multi-URL extraction accumulates results locally and only saves after the whole batch succeeds — one failing URL in a 5-link batch discards the other 4 successful extractions entirely, silently.
- Task-update-after-edit matches by `title === ... || original_text === ...` — two extracted tasks with identical text (plausible with "Summary" mode or duplicate problems) can have the wrong one overwritten.
- XP/quest credit is awarded unconditionally whenever `extractedTasks.length > 0`, even if every individual Firestore save inside the batch failed.

**InteractiveSolver.tsx:**
- The effect that registers a student as "actively solving" in `active_user_sessions` has no cleanup — any unmount that isn't the explicit finish/close handler (nav-away, tab close, crash) leaves a phantom "still active" student in the teacher's Live Classroom Monitor forever.
- "Finish" button has no in-flight guard — a fast double-click writes two `task_attempts` docs and double-awards XP.
- `userName` is read from `userProfile` synchronously in the same effect that fetches it asynchronously — the teacher-facing live session always shows the fallback (email), never the actual display name, on first mount.
- No role check before writing spectator records — a teacher previewing a task appears as an "active student" in their own monitor.

**PedagogueCommandCenter.tsx:**
- `cognitiveFingerprint` isn't reset when the selected task changes — switching tasks shows the previous task's fingerprint scores under the new task's title until manually regenerated.
- Two separate async-generation races (Socratic simulation, lesson script): switching the selected task before an in-flight `await` resolves lets the stale task's result land on top of the newly-selected task's UI — and for the lesson script, get persisted to Firestore under the wrong task's document.
- `d3.forceSimulation` in the knowledge-map view is never explicitly stopped on cleanup or re-render — rapid tab toggling spins up concurrent simulations (self-limiting after a few seconds, but a real leak).

**AnalyticsDashboard.tsx:**
- Intervention-plan generation has no guard against the selected student changing mid-generation — the result can be displayed/labeled under the wrong student.

**Dashboard.tsx:**
- Conditional-hooks Rules-of-Hooks violation: 4 `useMemo`s are declared after three early returns (`isLoading`, `role==='teacher'`, `role==='student'`, `!stats`) gated on two independently-resolving async sources (`isLoading` from a one-shot fetch, `stats` from a separate `onSnapshot`). Any account whose role is neither `teacher` nor `student` can hit a "more hooks than previous render" crash once the stats snapshot arrives after the loading flag clears.
- `isLoading` is decoupled from the `stats` data it's meant to gate — users can briefly (or persistently, if the listener is slow) see a false "error loading stats" card while the skeleton has already disappeared.

---

## 4. Architecture cleanup (Phase 4 — lower urgency, real maintainability cost)

- **`src/lib/gemini.ts` is a 2,629-line, single-file god-object** covering ~25 distinct AI features, with ~30 hardcoded model-name string literals and no consistent error-handling contract (some functions throw, some swallow-and-return-`[]`, some swallow-and-return-partial-defaults — a caller can't predict which without reading the implementation). This is the single biggest long-term maintainability risk in the codebase. Recommend splitting by feature domain (extraction, grading, curriculum, chat) once the security/bug fixes above are shipped — not before, to avoid conflating a refactor with the correctness fixes.
- **A second, more sophisticated curriculum-RAG subsystem (`curriculumKnowledge.ts`) is fully built (Firestore + embeddings) but never actually consumed** — the admin UI lets someone spend real embedding-API calls populating it, and nothing reads it back. Every live generation function instead uses a cruder static-keyword search (`buildCurriculumContextBlock`), and that's only wired into 2 of ~20 generation functions despite prompts repeatedly claiming curriculum alignment. Decide: finish wiring the RAG subsystem in, or delete it and the admin ingestion UI — the current half-built state is actively misleading (implies curriculum grounding that mostly isn't happening).
- The "pedagogy QA harness" (`pedagogyQa.ts`/`pedagogyPolicy.ts`) checks whether prompt *templates* contain certain keywords, not whether AI *output* meets any pedagogical bar — two of its scoring dimensions can never fail because the template unconditionally contains the keywords being searched for. It currently provides no real signal about output quality.
- `docx` (Word export) is fetched at runtime from an unpinned CDN (`esm.sh`) with no integrity check, despite the same package already being an installed, unused local dependency — swap to the local import.
- Minor: `PREMIUM_FEATURES`/`canUsePremiumFeature` in `saas.ts` is dead API surface (all three "features" resolve identically, nothing calls it); pricing is hardcoded in `seo.ts`'s structured data separately from the env-var-driven price in `saas.ts` and will silently drift if pricing changes; `SRB_CURRICULUM`/`ALB_CURRICULUM` are near-empty placeholder stubs shown on equal footing with the fully-populated MK curriculum in the country selector, with no "coming soon" indication.
- **Process/tooling:** local `git` `main` branch has repeatedly diverged from `origin/main` this session (root cause of the stale-review issue noted at the top of this doc) — worth a deliberate cleanup (`git reset --hard origin/main` after confirming no unique local work) and going forward, always branching fresh from `origin/main` rather than local `main`.

---

## 5. Testing strategy (Phase 3)

**Current state:** 21 test files exist (mostly `src/lib/*.test.ts` covering business logic, plus a handful of component smoke tests). All of them **do** run in CI via `quality-gates.yml`'s `npm run test -- --run` step (not just the smaller `test:smoke` subset used for fast local iteration) — coverage is better wired-in than it first appears. However: ~70 top-level components exist and only a fraction have any test at all, and **there is zero end-to-end (E2E) testing** — no Playwright/Cypress suite committed to the repo (the Playwright usage in this session was an ad-hoc manual debugging tool, not a CI-gating suite).

This matters concretely: neither of the two most expensive incidents from today's session (the site-wide scroll-lock bug, the FTP deploy-path mismatch) was something a unit test could have caught — both are cross-cutting runtime/infra behavior, exactly what E2E testing exists for. Several of the newly-found bugs above (Rules-of-Hooks crashes, the SM2 study-session crash) are also fundamentally about runtime behavior across multiple state transitions, not pure-function logic — component/E2E territory, not `lib/` unit territory.

**Recommended additions, roughly in priority order:**
1. **A small, curated Playwright E2E suite** (not exhaustive — a handful of golden paths), run headless in CI on every PR as its own job (kept separate from the fast unit-test job):
   - A generic **regression test for the scroll-lock bug class**: load every top-level route, assert `document.body`'s computed `overflow-y` is never `hidden` outside of an actually-open modal. Cheap to write, would have caught today's incident and the two "already fixed, don't re-break it" files directly.
   - Anonymous visitor: Home → Pricing render without console errors.
   - Auth flow: sign-in → role selection → land on the correct dashboard.
   - Core teacher journey: Library loads, a task can be opened, InteractiveSolver accepts a correct step and shows feedback.
   - Extraction smoke test with a mocked AI response (avoid real API cost in CI).
2. **Component tests for the bug-prone components found in this review**: Flashcards (the SM2/study-session bug above is a perfect regression-test candidate), AnalyticsDashboard (hooks-crash regression), Dashboard (conditional-hooks regression).
3. **Firestore rules tests** (`@firebase/rules-unit-testing`) — given how many of today's critical findings are rules gaps, an automated test suite that asserts "student cannot write `isPro: true`", "student cannot read another student's profile", etc. would catch regressions here specifically and is relatively cheap to write against the existing rules file.
4. Expand `lib/` unit coverage to the files this review touched most (`gemini.ts`'s schema/error-handling contracts, `srsAlgorithm.ts`).

---

## 6. PWA / mobile installability

**Current state: already working.** Verified live: `vite-plugin-pwa` is configured (`registerType: 'autoUpdate'`, `display: 'standalone'`, workbox service worker with font caching), the manifest is served correctly at `https://math.mismath.net/manifest.webmanifest`, and a live Playwright check confirmed the service worker actually registers in the browser. The app is already installable via "Add to Home Screen" on Android and iOS today, with a standalone launch experience and its own icon.

**Minor gaps worth closing (low effort):**
- All manifest icons are SVG-only (`pwa-icon.svg` reused for every size, including maskable) — add real PNG icons (192×192, 512×512, maskable variant) for more consistent rendering across Android launchers/OEM skins, some of which handle SVG manifest icons inconsistently.
- Manifest's `lang` field is `"en"` despite the app being Macedonian — cosmetic, but should say `"mk"`.

**Native Android — recommendation: not now.** The PWA already delivers what a native app would mainly provide for a content/tool product like this (home-screen icon, standalone launch, working offline shell). A full native rewrite is a large parallel codebase with no clear ROI signal yet. If Play Store presence specifically becomes a business need later, a **Capacitor wrapper around the existing React app** (days of work, not months — reuses 100% of the current codebase) is the right-sized next step, not a rewrite. Revisit only once there's real usage data showing mobile-device traffic and/or a concrete ask from users for Play Store distribution.

---

## 7. Localization (i18n) roadmap

Carried over from the strategic discussion earlier in this session, included here for completeness:

- **Albanian first.** Same national curriculum, same regulatory context, large underserved market within North Macedonia (~25% of the population) — this is translation-only work, no new curriculum logic needed (confirmed with the founder).
- Infrastructure cost is real and mostly one-time: introduce `react-i18next` (or equivalent), extract the hundreds of currently-hardcoded Macedonian UI strings into translation keys across ~50-60 components, and add a language parameter to the AI-generation prompts in `gemini.ts` so extracted/generated content can be produced in the target language against the same underlying curriculum data.
- Once that infrastructure exists, additional languages (Turkish, then English for out-of-country presentation/investor demos) are incremental additions, not repeats of the large lift.
- **Sequencing relative to the rest of this plan:** do not start this before Phase 0–2 (security + broken features + data races) — i18n touches nearly every component file, and doing it before the correctness fixes above would mean re-touching the same files twice and risk masking regressions in translated strings. Natural point to start: after Phase 2, potentially in parallel with Phase 3 (testing) since they touch different files.

---

## 8. Feature/tool investment priorities

Carried over from the strategic discussion earlier in this session:

- **Highest priority — sharpen further:** `InteractiveSolver` + the Socratic tutoring flow (now with the CortexJS fast-equivalence pre-check) — this is the product's core differentiator.
- **High priority — UX polish, strong retention driver:** `MaterialsFactory` / `TestGenerator` / `LessonPlanGenerator` — daily-use teacher tools with high-frequency usage.
- **Wait for usage data before investing further:** `AnalyticsDashboard` / `PedagogueCommandCenter` (cognitive fingerprinting, intervention plans) — impressive "wow" features, but no usage data yet confirming teachers actually rely on them day-to-day.
- **Low priority:** `GraphDigitizer` / `GeoGebraViewer` — nice-to-have, niche usage.
- **Nav bar / sidebar:** no redesign needed now — today's fix closed the one measured overflow bug (1366px) via spacing only; the existing grouped "Алатки" dropdown pattern scales fine for the current route count. Revisit a sidebar only if 3-4+ major new top-level features get added.

---

## 9. Phased plan with timeline

Timeline assumes a solo/small-team pace (the founder's actual working mode this session), not a staffed team — phases are sized in **working days of focused effort**, sequential unless marked parallel.

| Phase | Scope | Est. effort | Depends on |
|---|---|---|---|
| **0 — Security lockdown** | Firestore rules gaps (self-Pro-escalation, `active_user_sessions`, ownership checks on `assignments`/`live_sessions`/`whiteboard_sessions`/`task_attempts`, `users` read scoping), `vite.config.ts` key-leak fix, `ProtectedRoute` null-profile bypass fix, auth-gate `server.ts`'s AI proxy, fix CORS-fails-open default, tighten SSRF checks (metadata IP, redirect re-validation) | 2–3 days | none — start immediately |
| **1 — Broken features** | Fix `result.text()` bugs (2 functions), fix Flashcards SM2/study-session crash, fix `analyzeSolutionImage` schema, add error handling + logging to `sendReceiptNotification` | 1–2 days | Phase 0 (touches some of the same auth-adjacent code paths only incidentally — can start in parallel once Phase 0's rules changes are drafted) |
| **2 — Data-integrity races** | Library pagination/stale-closure fixes, ExtractionEngine batch-save + XP-on-failure fixes, InteractiveSolver cleanup/double-XP guards, PedagogueCommandCenter task-switch race guards, AnalyticsDashboard hooks-crash + intervention race fixes, Dashboard conditional-hooks fix | 3–4 days | Phase 1 (touches overlapping files; sequencing avoids merge churn) |
| **3 — Testing infrastructure** | Playwright E2E suite (scroll-lock regression test + 4-5 golden paths) wired into CI as its own job, Firestore rules unit tests, component regression tests for the Phase 1/2 bugs found today | 3–5 days | Phase 2 (write regression tests for bugs just fixed, not before) |
| **4 — Architecture cleanup** | Split `gemini.ts` by feature domain, resolve `curriculumKnowledge.ts` (finish wiring or remove), fix `docx` CDN dependency, remove dead `PREMIUM_FEATURES` API, unify pricing source, git branch hygiene | 4–6 days, **can run partially in parallel with Phase 3** | Phase 0–2 (don't refactor code that's mid-bugfix) |
| **5 — PWA polish** | Real PNG manifest icons, `lang` fix | <1 day | none — can slot in anytime, including during Phase 0 |
| **6 — Localization (Albanian)** | i18n infrastructure + string extraction + AI-prompt language parameter | 2–3 weeks | Phase 2 complete (avoid touching the same files twice) |
| **7 — Ongoing** | Tool investment priorities (§8) applied as normal feature work; nav/sidebar revisited only if trigger condition in §8 is met | ongoing | — |

**Suggested near-term sequencing:** Phase 0 this week (it's small and everything else is riskier to build on top of an insecure base), Phase 1 immediately after (or overlapping, since it's mostly independent files), Phase 2 the following week, Phase 3 right after so the fixes just made get regression coverage, Phase 4 and Phase 5 opportunistically alongside Phase 3. Phase 6 (Albanian) is the first "new feature" work and deliberately sequenced last among the near-term items so it isn't built on top of files that are about to change underneath it.
