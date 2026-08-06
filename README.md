# Run and deploy your AI Studio app

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

This contains everything you need to run your app locally.

View your app in AI Studio: [AI Studio app](https://ai.studio/apps/78b66c2e-8ca0-449c-8e89-6a89b72ffcef)

Product rules and long-term standards: [docs/PRODUCT_RULES.md](docs/PRODUCT_RULES.md)
Architecture governance (ADR): [docs/ADR-0001-pedagogy-first-saas-governance.md](docs/ADR-0001-pedagogy-first-saas-governance.md)
Execution plan (14 days): [docs/ACTION_PLAN-14D.md](docs/ACTION_PLAN-14D.md)
Execution tracker (daily discipline): [docs/EXECUTION_TRACKER.md](docs/EXECUTION_TRACKER.md)

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Optional) Configure checkout links in [.env.local](.env.local):
   - `VITE_STRIPE_PAYMENT_LINK=https://...`
   - `VITE_PAYPAL_PAYMENT_LINK=https://...`
   - `VITE_BANK_TRANSFER_PAYMENT_LINK=https://...` (link to bank transfer instructions / payment page)
   - `VITE_PRO_MONTHLY_PRICE_MKD=490`
   - `VITE_PRO_ANNUAL_PRICE_MKD=4900`
   - `VITE_PAYPAL_EMAIL=igor.bogdanoski@mismath.net`
   - `VITE_BILLING_CONTACT_EMAIL=igor.bogdanoski@mismath.net`
   - `VITE_BANK_NAME=NLB Bank`
   - `VITE_BANK_ACCOUNT_NUMBER=210501596102457`
   - `VITE_BANK_IBAN=MK07210501596102457`
   - `VITE_BANK_SWIFT=TUTNMK22`
   - `VITE_SCHOOL_PLAN_LABEL=По договор / фактура`
   - `VITE_PENDING_ALERT_THRESHOLD=8`
   - `VITE_PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD=1`
   - `VITE_BILLING_CTA_CONVERSION_ALERT_THRESHOLD=0.8`
   - `VITE_BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD=0.5`
   - `VITE_ENABLE_UNSAFE_JSXGRAPH_SCRIPT=false` (recommended default for security hardening)
   Shared ops alert acknowledge state is stored in Firestore at `sales_ops_alert_state/school_inquiries` and is auto-managed by teacher actions in the dashboard.
   Billing CTA conversion telemetry is logged in Firestore `student_progress` with `eventType: billing_cta_click` and surfaced in the teacher School Inquiries KPI panel.
   The app loads heavyweight optional editors/exporters (`mathlive`, `docx`) at runtime from trusted CDN/module endpoints to keep the core bundle lean.
4. Run the app:
   `npm run dev`

## Quality Gates (No-Compromise Mode)

The repository includes automated quality gates to enforce pedagogy-first SaaS governance and performance budgets.

Run locally:

- `npm run quality:governance`
- `npm run quality:bundle`
- `npm run quality:gates`

CI workflow:

- [.github/workflows/quality-gates.yml](.github/workflows/quality-gates.yml)

## Deployment Policy (Vercel)

- Start now with Preview Deployments for every PR.
- Use a closed beta URL after stability checkpoint A.
- Promote to Production only after the readiness criteria in [docs/ACTION_PLAN-14D.md](docs/ACTION_PLAN-14D.md) are met for at least 7 consecutive days.
- For the payment and cross-app upgrade, follow the release checklist in [docs/DEPLOYMENT_READINESS_CHECKLIST.md](docs/DEPLOYMENT_READINESS_CHECKLIST.md).
- For preview deployment validation, use [docs/PREVIEW_DEPLOYMENT_CHECKLIST.md](docs/PREVIEW_DEPLOYMENT_CHECKLIST.md).
- Ensure the server has Firebase Admin credentials and the required email/payment env vars before rollout.
