# Action Plan (14 Days)

This plan is a strict execution contract for the next 14 days.

Execution tracker: [docs/EXECUTION_TRACKER.md](EXECUTION_TRACKER.md)

## Goal

Stabilize core product quality while continuing focused growth in pedagogy, SEO, and SaaS readiness.

## Working Mode

- Allocation: 70% stabilization, 30% feature advancement.
- Merge policy: no merge without quality gates passing.
- Definition of done: diagnostics clean, tests green, governance gate green, bundle gate green.

## Non-Negotiable Gates

Run on each meaningful change:

- `npm run lint`
- `npm run test:smoke`
- `npm run test -- src/lib/seo.test.ts src/lib/promptEngineering.test.ts src/lib/knowledgeModel.test.ts`
- `npm run build`
- `npm run quality:gates`

## Day-By-Day Plan

1. Day 1: Baseline and freeze line

- Record baseline metrics (build size, failing tests count, key warnings).
- Freeze architectural drift: no direct policy logic in UI components.
- Deliverable: baseline section added to this file with measured values.

1. Day 2: Critical flow smoke coverage

- Add smoke tests for: login/auth guard, tutor interaction, material generation, export flow.
- Deliverable: smoke test suite runnable in CI.

1. Day 3: Runtime observability

- Add unified error capture and route-level performance logging.
- Track: action success rate, error rate, p95 latency for critical flows.
- Deliverable: logging hooks enabled and documented.

1. Day 4: Pedagogy QA harness v1

- Create evaluation rubric (accuracy, scaffold quality, curriculum alignment, clarity, safety).
- Add minimum golden prompts set for three school levels.
- Deliverable: repeatable local evaluation command.

1. Day 5: SEO hardening pass

- Verify all public routes have metadata + structured data.
- Ensure internal routes remain noindex.
- Deliverable: route checklist added and validated.

1. Day 6: Security hardening pass

- Review all dynamic/runtime-loaded modules and feature flags.
- Ensure unsafe execution paths are opt-in only.
- Deliverable: security checklist results in docs.

1. Day 7: Stability checkpoint A

- Review week metrics against baseline.
- Fix highest-severity regressions only.
- Deliverable: checkpoint notes and go/no-go for week 2.

1. Day 8: SaaS reliability and billing telemetry

- Validate billing CTA, inquiry funnel, and alert thresholds.
- Add reconciliation check for usage and billing signals.
- Deliverable: reliability report and threshold tuning notes.

1. Day 9: Modularity cleanup

- Enforce domain boundaries: learning, assessment, content, live, ops.
- Reduce cross-domain direct imports where possible.
- Deliverable: boundary exceptions list and remediation tasks.

1. Day 10: Performance budgets v2

- Add per-route budget checks for key routes.
- Add trend comparison versus baseline (regression threshold).
- Deliverable: documented budgets and CI check output.

1. Day 11: Pedagogy QA harness v2

- Expand golden dataset with difficult and edge examples.
- Add pass/fail threshold per rubric dimension.
- Deliverable: evaluation summary report template.

1. Day 12: Release readiness drill

- Run full clean install and quality gates from scratch.
- Dry run deployment to preview target.
- Deliverable: release dry-run log.

1. Day 13: Bug burn-down

- Resolve all P0/P1 issues and most P2 issues.
- Deliverable: prioritized bug list with closure status.

1. Day 14: Production readiness review

- Execute production checklist.
- Decide: continue hardening or promote to production rollout stage.
- Deliverable: signed readiness decision note.

## Weekly Cadence

- Daily: 15-minute quality standup (regressions, blockers, gate status).
- Twice weekly: pedagogy and content quality review.
- Weekly: architecture governance review (ADR compliance and boundaries).

## Production Readiness Criteria

The app is considered production ready when all items below are true for at least 7 consecutive days:

- No P0 and no unresolved security-high issues.
- Quality gates pass on all merges.
- Core smoke tests pass consistently.
- Error rate under 1% on critical flows.
- p95 latency for core interactions within agreed threshold.
- Pedagogy rubric pass rate >= 90% on golden dataset.
- Public SEO checklist complete for all public routes.
- Billing and school inquiry telemetry validated.

## Vercel Strategy (When To Use It)

Use Vercel in stages, not all at once.

1. Stage A (Now): Preview-only deployment

- Use Vercel preview for every PR and UX review.
- Do not announce publicly yet.
- Purpose: fast feedback on UI, SEO rendering, and runtime behavior.

1. Stage B (After Day 7 checkpoint): Closed beta URL

- Share with a small trusted teacher cohort.
- Enable monitoring and collect real usage signals.
- Promote only if no critical incidents in beta window.

1. Stage C (After Day 14 + criteria met): Public production

- Promote Vercel production domain.
- Keep Firebase security and operational alerts active.
- Maintain rollback playbook and release notes discipline.

## Vercel Should Not Be Blocked By 100%

Do not wait for a theoretical 100% perfect state. Instead:

- Use Vercel preview immediately for development quality.
- Gate public production by measurable readiness criteria in this plan.
- Treat production readiness as a controlled threshold, not perfection.

## Ownership Template

- Product and pedagogy owner: approves rubric and curriculum alignment.
- Engineering owner: enforces gates and architecture constraints.
- Operations owner: verifies billing and inquiry reliability.

## Baseline Metrics (Fill on Day 1)

- Build JS total:
- Build CSS total:
- Core smoke tests count:
- Gate pass rate:
- Error rate (critical flows):
- p95 latency (critical flows):
