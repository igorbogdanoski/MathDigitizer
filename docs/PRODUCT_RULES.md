# Product Rules

These rules define how MathDigitizer should be built, marketed, and maintained from now on.

## Product Identity

- MathDigitizer is an AI-first EdTech SaaS focused on mathematics, pedagogy, and teacher productivity.
- The product must feel credible for teachers, schools, and institutional buyers in Macedonia and beyond.
- Every major feature should improve one of these outcomes: time savings, better pedagogy, better student insight, or higher assessment quality.

## Non-Negotiable Product Principles

- Pedagogy first: product decisions must improve real classroom value, not just add AI novelty.
- RAG compatibility first: extracted, graded, and generated educational content should strengthen the long-term knowledge base.
- Evidence over guesswork: generated outputs should prefer retrieved context, curriculum alignment, and explicit reasoning scaffolds.
- Teacher trust is mandatory: unclear automation, fake upgrades, and misleading UX are not allowed.
- SEO and SaaS discipline are core business requirements, not optional polish.

## AI And Prompting Standards

- Prompt strategy must stay modular and centrally managed.
- Retrieval should be attempted before freeform generation when domain context exists.
- Prompt envelopes, retrieval helpers, and orchestration logic should remain reusable across features.
- New AI flows should prefer explicit strategy selection rather than hidden prompt drift.
- Generated academic content should remain curriculum-aware, age-appropriate, and pedagogically defensible.

## Data And Knowledge Standards

- Scanned and extracted learning artifacts should be preserved whenever practical to support long-term dataset quality.
- Knowledge structures should support future grading, retrieval, analytics, and recommendation workflows.
- Teacher-authored notes and manual corrections are high-value signals and should not be discarded.
- Educational records must be structured for future auditability and quality review.

## SaaS And Pricing Standards

- Start with a simple pricing model: Free, Pro Teacher Monthly, Pro Teacher Annual, and School Plan by agreement.
- Default public pricing is per teacher, not per student.
- The public pricing page must stay simple, outcome-driven, and easy to buy from.
- Local payment methods matter: PayPal, bank transfer, and invoice-style school workflows should be supported.
- School or institution pricing should remain contact-led until usage patterns justify a more complex self-serve model.
- Never auto-upgrade a user without a real billing or approval path.

## SEO And Conversion Standards

- Every public route should have meaningful title, description, canonical data, and relevant schema when appropriate.
- Pricing, landing, and conversion routes must explain value in outcomes, not feature overload.
- Public pages should present MathDigitizer as a credible SaaS product, not an experimental demo.
- Structured data should stay aligned with the real offer shown on the page.

## UX And Brand Standards

- The first impression must feel premium, intentional, and trustworthy.
- Visual design should reflect mathematics, intelligence, clarity, and modern education.
- Icons, metadata, and landing surfaces should reinforce a coherent MathDigitizer identity.
- Accessibility is required: controls need clear labels, good contrast, and keyboard-safe interaction.
- Empty states, pricing states, and gated states must explain what the user gains by continuing.

## Engineering Standards

- New behavior should be implemented at the real control point, not patched through duplicated UI logic.
- Shared rules and helpers belong in central libraries, not copied across components.
- Edits should be minimal, local, and reversible when uncertainty is high.
- Validation is required after substantive changes: diagnostics first, then focused tests when available.
- Existing user changes must not be reverted unless explicitly requested.

## Security And Trust Standards

- Payment and upgrade flows must not imply access before billing is confirmed.
- Sensitive payment details should be configurable and easy to update.
- Firestore and auth changes must preserve least-privilege access.
- Product messaging should not promise unsupported integrations or capabilities.

## Launch And Growth Standards

- Free should demonstrate value quickly.
- Pro should emphasize saved teacher time, better analytics, and stronger workflow quality.
- School sales should emphasize invoice support, onboarding, and institutional trust.
- Pricing changes should be intentional and easy to explain publicly.

## Working Rule

When a future change conflicts with these rules, the change should be reconsidered before implementation.
