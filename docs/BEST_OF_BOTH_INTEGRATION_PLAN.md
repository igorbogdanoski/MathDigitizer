# MathDigitizer Best-of-Both Integration Plan

## Purpose

This plan combines the strongest elements from:

1. igorbogdanoski/math-textbook-digitalization (pedagogical QA discipline, deterministic quality loop, cross-page audit).
2. virgiliojr94/book-to-skill (secure extraction hardening, parser fallback strategy, metadata observability, token-cost discipline).

Goal: raise MathDigitizer to a higher level in pedagogy, trust, reliability, and scalable SaaS execution while preserving current product rules.

## Strategic Outcomes

1. Better grading trust.

- Fewer silent content regressions (lost exercises, changed formulas, inconsistent notation).
- Stronger teacher confidence through explainable and auditable quality checks.

1. Safer and more robust ingestion.

- Better resistance to malicious or invisible Unicode and prompt-injection style artifacts.
- Graceful parser fallback when preferred extractors are missing.

1. Stronger long-term knowledge asset.

- Cleaner, structured, quality-scored artifacts for RAG and future analytics.
- Better consistency across books, pages, and teacher corrections.

1. Cost-aware AI operations.

- Deterministic checks before model calls.
- Token and cost reporting as a first-class metric for every ingestion and grading flow.

## Guardrails (Must Not Break)

1. Product and pedagogy rules in [docs/PRODUCT_RULES.md](docs/PRODUCT_RULES.md) remain non-negotiable.
2. Pricing and payment realities remain unchanged during this rollout (Free, Pro, School, PayPal plus bank transfer).
3. Deterministic checks must never claim semantic certainty they cannot prove.
4. No copyrighted textbook raw passages are redistributed as product outputs.
5. New components must pass existing quality gates and route budget discipline.

## What We Will Reuse

### From math-textbook-digitalization (Pedagogy and QA)

1. Deterministic quality separation.

- Keep model reasoning separate from deterministic validators.

1. Content-vs-presentation diff logic.

- Detect mathematical meaning changes separately from cosmetic formatting changes.

1. Whole-book audit patterns.

- Terminology drift detection.
- Notation consistency checks.
- Structural consistency checks (heading hierarchy, figure references, page continuity).

1. Feedback clustering to rule promotion.

- Repeated findings become candidate rules.
- Human-approved promotion for high-confidence rules.

### From book-to-skill (Security and Extraction Reliability)

1. Sanitization pipeline.

- Strip invisible Unicode and bidi control characters before downstream processing.

1. Advisory injection scanner.

- Scan extracted content for suspicious instruction-like patterns and unsafe authority phrases.

1. Parser fallback and dependency checks.

- Preferred parser to fallback parser chain.
- Dependency preflight command with explicit status.

1. Extraction metadata contract.

- Standard metadata: source, extraction method, pages, chars, token estimate, warnings, skipped files.

1. Token and cost observability mindset.

- Track processing cost per pipeline stage and keep budgets explicit.

## Target Architecture Additions

### New Backend Modules

1. src/lib/ingestion/sanitize.ts

- Unicode sanitizer and normalization layer.

1. src/lib/ingestion/injectionScan.ts

- Advisory scanner with rule categories and severity.

1. src/lib/ingestion/extractorOrchestrator.ts

- Parser selection, fallback chain, dependency preflight integration.

1. src/lib/quality/contentSignature.ts

- Canonical representation of math content signatures.

1. src/lib/quality/presentationDiff.ts

- Formatting and layout-level diffs.

1. src/lib/quality/wholeBookAudit.ts

- Cross-page terminology, notation, and structure checks.

1. src/lib/quality/feedbackCluster.ts

- Group repeated findings and compute systematic confidence scores.

1. src/lib/quality/ruleCandidate.ts

- Convert high-confidence clusters to reviewable rule candidates.

### New API Endpoints

1. POST /api/ingestion/preflight

- Dependency and parser readiness report.

1. POST /api/ingestion/sanitize

- Returns sanitized text plus sanitation stats.

1. POST /api/quality/diff

- Content and presentation diff report.

1. POST /api/quality/audit

- Whole-book audit report.

1. POST /api/quality/cluster

- Cluster findings and suggest rule candidates.

### New UI Surfaces

1. Ingestion Safety Panel.

- Sanitization summary, scanner findings, parser method used.

1. Quality Intelligence Panel.

- Content regressions vs formatting regressions.
- Cross-book consistency warnings.
- Rule candidate queue (human approve or reject).

## Detailed Implementation Plan (8 Weeks)

### Phase 0 (Week 0): Alignment and Baseline

1. Freeze baseline metrics.

- Current ingestion failure rate.
- Current grading correction rate.
- Current time-to-verified-output.

1. Define quality taxonomy.

- Error classes: content-loss, formula-change, notation-drift, terminology-drift, structure-regression, security-signal.

1. Define event schema.

- ingestion_preflight_result, sanitize_stats, quality_diff_result, audit_finding, rule_candidate_action.

Acceptance criteria:

1. Baseline dashboard snapshot stored.
2. Shared taxonomy approved.

### Phase 1 (Weeks 1-2): Ingestion Security Hardening

1. Build sanitization core.

- Remove or flag invisible Unicode and bidi controls.
- Preserve readable content and never silently destroy semantic text.

1. Build advisory scanner.

- Rule groups: injection-like directives, hidden authority claims, suspicious encoded content patterns.

1. Build dependency preflight plus fallback extraction.

- Preferred parser route by format.
- Deterministic fallback with clear warnings.

1. Add metadata contract.

- Include parser used, fallback count, warnings, estimated tokens, and extraction confidence.

Acceptance criteria:

1. Zero critical sanitizer regressions on known good fixtures.
2. Preflight endpoint returns deterministic status for all supported formats.
3. Fallback path works in integration tests when primary parser is unavailable.

### Phase 2 (Weeks 3-4): Content vs Presentation Quality Engine

1. Implement content signature model.

- Exercise presence checks.
- Formula semantic checks.
- Figure reference continuity checks.

1. Implement presentation diff model.

- Layout and formatting deltas separated from content-risk deltas.

1. Build quality API and reports.

- Unified report with severity and explainability fields.

Acceptance criteria:

1. Known regression test set catches all high-severity content defects.
2. Cosmetic formatting changes do not trigger content-loss alerts.

### Phase 3 (Weeks 5-6): Whole-Book Audit and Learning Loop

1. Implement cross-page audit.

- Terminology consistency.
- Notation consistency.
- Structural consistency.

1. Implement feedback clustering.

- Deduplicate repeated findings.
- Score systematic defects by frequency and spread.

1. Rule candidate workflow.

- Human review queue with approve, reject, or defer.
- Approved rules versioned and traceable.

Acceptance criteria:

1. Audit identifies seeded multi-page inconsistencies in test corpus.
2. Clustering reduces duplicate finding noise by at least 60 percent in validation data.
3. Every approved rule has provenance (who approved and from which evidence set).

### Phase 4 (Weeks 7-8): Productization, UX, and Governance

1. UX integration.

- Add Safety and Quality panels into the main teacher workflow.

1. Observability and budgets.

- Add token and cost metrics per stage.
- Add quality gates to CI for new quality modules.

1. Rollout strategy.

- Feature flags: quality_v2, ingestion_security_v2, whole_book_audit_v1.
- Gradual rollout: internal, then beta teachers, then full rollout.

1. Documentation and training.

- Operator manual for reviewers.
- Internal incident runbook for ingestion and quality regressions.

Acceptance criteria:

1. Feature flags allow instant rollback of each subsystem.
2. Production telemetry shows stable performance and no error spikes after staged rollout.

## Testing Strategy

### Unit Tests

1. Sanitization fixtures (invisible chars, bidi controls, mixed-language text).
2. Scanner fixtures (benign vs suspicious instructions).
3. Content signature tests (lost exercise, changed formula, figure mismatch).
4. Audit tests (terminology drift, notation drift, structural drift).
5. Clustering tests (dedupe, frequency thresholds, confidence scoring).

### Integration Tests

1. End-to-end ingestion with parser fallback.
2. End-to-end quality diff plus audit plus cluster pipeline.
3. Rule approval workflow and version propagation.

### E2E Tests

1. Teacher uploads content, sees safety report, proceeds.
2. Reviewer sees content vs presentation warnings clearly separated.
3. Reviewer promotes a systematic issue to a rule.

## KPI Framework

### Quality KPIs

1. Content regression escape rate (target: down at least 40 percent in 60 days).
2. False-positive content alerts (target: below 10 percent).
3. Whole-book consistency score (target: up at least 25 percent).

### Operational KPIs

1. Ingestion failure rate (target: down at least 30 percent).
2. Fallback success rate (target: above 95 percent on supported formats).
3. Time-to-verified-output (target: down at least 20 percent).

### Business and Trust KPIs

1. Teacher correction burden per assignment (target: down at least 30 percent).
2. Pro conversion from quality-focused workflows (target: measurable uplift).
3. Support tickets related to wrong or unclear grading (target: down at least 35 percent).

## Risks and Mitigations

1. Over-flagging benign content.

- Mitigation: severity thresholds, reviewer override, telemetry tuning window.

1. Performance overhead from new deterministic checks.

- Mitigation: incremental execution, caching, and existing route and build budgets.

1. Rule drift and prompt bloat.

- Mitigation: rule lifecycle states (candidate, active, deprecated) and periodic pruning.

1. Legal and copyright exposure in generated artifacts.

- Mitigation: strict no-raw-passage policy for external copyrighted material and audit logs.

1. Team overload during rollout.

- Mitigation: feature-flagged staged release and explicit ownership matrix.

## Ownership Matrix

1. AI and Extraction owner.

- Sanitization, scanner, parser orchestration, dependency preflight.

1. Pedagogy and Quality owner.

- Content signatures, audit logic, rule candidate policy.

1. Frontend owner.

- Safety and Quality panels and reviewer UX.

1. QA owner.

- Regression corpus, CI gates, E2E stability.

1. Product owner.

- KPI review cadence and rollout go-no-go decisions.

## Definition of Done

1. All four phases completed with acceptance criteria met.
2. KPIs tracked in production for at least 30 days post rollout.
3. Teacher-facing docs and internal runbook published.
4. No unresolved critical security or quality findings.
5. Measurable quality and trust improvement validated by user behavior and support metrics.

## Expected Impact for MathDigitizer

After implementation, MathDigitizer gains:

1. Stronger pedagogical reliability.

- The system catches math-content errors earlier and with clearer evidence.

1. Stronger teacher trust and adoption.

- Teachers can see why the system flagged an issue and what changed.

1. Stronger platform resilience.

- Ingestion continues to work across parser and tool variability.

1. Stronger long-term RAG dataset quality.

- Cleaner artifacts and structured feedback loops improve future retrieval and grading.

1. Stronger SaaS credibility.

- Quality and safety become visible product advantages, not only internal engineering details.

## Execution Status (Live)

### Completed now (Phase 1 start)

1. Implemented deterministic sanitization module: src/lib/ingestion/sanitize.ts.
2. Implemented advisory prompt-injection scanner: src/lib/ingestion/injectionScan.ts.
3. Implemented ingestion preflight core report builder: src/lib/ingestion/preflight.ts.
4. Implemented API endpoint: api/ingestion/preflight.ts (GET/POST).
5. Integrated sanitize and scan into extraction pipeline in src/lib/ai/extraction.ts for:

- custom instructions,
- manual transcript,
- URL transcript/context,
- text source payload.

1. Implemented warn/block policy layer for injection signals:

- strict mode for user instruction inputs,
- advisory mode for source/transcript content.

1. Implemented Firestore-safe metadata contract:

- transient `__ingestion_meta` via src/lib/ingestion/metadata.ts
- automatic strip before persistence in src/components/ExtractionEngine.tsx

1. Implemented configurable policy strictness by source type:

- src/lib/ingestion/config.ts
- env controls: `VITE_INGESTION_POLICY_USER_INPUT_MODE`, `VITE_INGESTION_POLICY_SOURCE_CONTENT_MODE`

1. Implemented lightweight ingestion security analytics:

- src/lib/analytics.ts -> `trackIngestionSecurity`
- src/components/ExtractionEngine.tsx emits severity and sanitization signal after extraction

1. Implemented Ingestion Safety Panel in extraction UI:

- surfaces source kind, scan severity, sanitize changed flag, and parser path
- powered by transient `__ingestion_meta` contract

1. Added unit tests:

- src/lib/ingestion/sanitize.test.ts
- src/lib/ingestion/injectionScan.test.ts
- src/lib/ingestion/preflight.test.ts
- src/lib/ingestion/policy.test.ts
- src/lib/ingestion/metadata.test.ts
- src/lib/ingestion/config.test.ts

1. Added CI and local quality gate wiring for ingestion security:

- package.json -> quality:ingestion
- scripts/run-quality-gates.mjs includes quality:ingestion
- .github/workflows/quality-gates.yml includes Ingestion security gate and Route budget gate

1. Added reviewer-facing interpretation guide for ingestion safety warnings:

- docs/INGESTION_WARNINGS_REVIEWER_GUIDE.md

1. Added optional admin diagnostics endpoint for ingestion safety visibility:

- src/lib/ingestion/diagnostics.ts
- api/ingestion/diagnostics.ts
- optional key guard via `INGESTION_DIAGNOSTICS_KEY` and `x-admin-key` header

1. Added diagnostics unit coverage and included it in ingestion quality gate:

- src/lib/ingestion/diagnostics.test.ts
- package.json -> quality:ingestion now includes diagnostics test

1. Added Firestore-safe optional ingestion metadata persistence foundation:

- src/lib/ingestion/metadata.ts adds `buildPersistedIngestionSnapshot`
- src/lib/ingestion/config.ts adds `resolveIngestionSnapshotPersistenceEnabled`
- src/components/ExtractionEngine.tsx writes bounded `ingestion_snapshot` only when feature flag is enabled
- firestore.rules updated allowlist and constraints for `ingestion_snapshot`
- src/lib/schema.ts includes optional `ingestion_snapshot` contract

1. Added rollout checklist for policy modes and snapshot persistence:

- docs/INGESTION_POLICY_ROLLOUT_CHECKLIST.md

1. Added minimal diagnostics widget in admin diagnostics flow:

- src/components/SystemIntegrityCheck.tsx now fetches and displays `/api/ingestion/diagnostics`
- includes policy mode visibility, scanner severity mix, high-severity rule IDs, and advisories

1. Added runbook for repeated high-severity signal spikes:

- docs/INGESTION_HIGH_SEVERITY_RUNBOOK.md

1. Added dashboard-level severity mix trend chart:

- src/components/SystemIntegrityCheck.tsx now stores the latest diagnostics snapshots locally
- visual trend chart for low/medium/high severity composition over recent checkpoints

1. Added retention and reset control for local diagnostics trend history:

- src/components/SystemIntegrityCheck.tsx includes reset action to clear local severity history snapshots

1. Validation result:

- `npx vitest run src/lib/ingestion/sanitize.test.ts src/lib/ingestion/injectionScan.test.ts`
- `npx vitest run src/lib/ingestion/sanitize.test.ts src/lib/ingestion/injectionScan.test.ts src/lib/ingestion/preflight.test.ts`
- `npx vitest run src/lib/ingestion/sanitize.test.ts src/lib/ingestion/injectionScan.test.ts src/lib/ingestion/preflight.test.ts src/lib/ingestion/policy.test.ts`
- `npx vitest run src/lib/ingestion/sanitize.test.ts src/lib/ingestion/injectionScan.test.ts src/lib/ingestion/preflight.test.ts src/lib/ingestion/policy.test.ts src/lib/ingestion/metadata.test.ts src/components/ExtractionEngine.smoke.test.tsx`
- `npx vitest run src/lib/ingestion/sanitize.test.ts src/lib/ingestion/injectionScan.test.ts src/lib/ingestion/preflight.test.ts src/lib/ingestion/policy.test.ts src/lib/ingestion/metadata.test.ts src/lib/ingestion/config.test.ts src/components/ExtractionEngine.smoke.test.tsx`
- `npm run quality:ingestion`
- Status: 7 test files passed, 16 tests passed.

### Next 72 hours (expert execution lane)

1. Add E2E check for ingestion snapshot persistence flag behavior.
2. Add diagnostics card for preflight dependency status toggled view.
3. Add role-gated visibility control for ingestion diagnostics panel.
4. Add trend export option (JSON) for diagnostics snapshots.
