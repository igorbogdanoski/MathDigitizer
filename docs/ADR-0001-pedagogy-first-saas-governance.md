# ADR-0001: Pedagogy-First SaaS Governance

## Status

Accepted

## Date

2026-05-12

## Context

MathDigitizer Pro is evolving into a production EdTech SaaS platform where pedagogical quality is the primary product value, and architecture must preserve:

- instructional integrity
- security boundaries
- SEO discoverability
- modular scalability

Recent work introduced stronger SEO, modular prompt architecture, and billing/ops workflows. We need a single governance decision that keeps future modules aligned with pedagogy-first standards.

## Decision

Adopt a governance model where every new module must satisfy four mandatory gates before merge:

1. Pedagogy Gate

- Must integrate with the centralized pedagogy protocol in [src/lib/pedagogyPolicy.ts](../src/lib/pedagogyPolicy.ts).
- Must explicitly define instructional intent: scaffolded, balanced, or mastery.
- Must include at least one metacognitive checkpoint where learner reflection is expected.

1. SaaS Architecture Gate

- Business rules and policy logic must live in lib-level modules, not UI components.
- Route-level features must be lazy-loadable unless they are core shell dependencies.
- No hidden cross-module coupling: imports should follow feature boundaries.

1. SEO/Discovery Gate

- Public routes must have route SEO metadata and structured data blocks.
- Internal/ops routes must be marked noindex.
- Canonical URL strategy must be deterministic and route-owned.

1. Security Gate

- Arbitrary code execution in user-facing runtime is forbidden by default.
- Any unsafe execution path requires explicit opt-in env flag and validation guard.
- Third-party high-risk dependencies must be isolated behind feature flags or external runtime boundaries.

## Consequences

Positive:

- Higher pedagogical consistency across all AI-generated flows.
- Better operational maintainability and predictable module growth.
- Lower regression risk for SEO and security surfaces.

Trade-offs:

- Slightly slower feature onboarding due to governance checklist.
- More explicit architecture work when introducing experimental tools.

## Enforcement Checklist (for each new module)

- [ ] Pedagogy: module references pedagogy protocol and declares priority mode.
- [ ] Theory: output flow references at least one learning-theory pattern (CRA, Bloom, ZPD, retrieval, metacognition).
- [ ] SEO: route metadata present; structured data present for public pages.
- [ ] SaaS: domain logic extracted from UI into lib/service layer.
- [ ] Modularity: lazy loading considered and documented.
- [ ] Security: no default unsafe runtime execution.
- [ ] Tests: unit tests added/updated for core module policy behavior.
- [ ] Build: project builds with no new diagnostics.

## Related Files

- [src/lib/pedagogyPolicy.ts](../src/lib/pedagogyPolicy.ts)
- [src/lib/promptEngineering.ts](../src/lib/promptEngineering.ts)
- [src/lib/seo.ts](../src/lib/seo.ts)
- [src/components/SEO.tsx](../src/components/SEO.tsx)
- [src/components/GeometryWorkspace.tsx](../src/components/GeometryWorkspace.tsx)
