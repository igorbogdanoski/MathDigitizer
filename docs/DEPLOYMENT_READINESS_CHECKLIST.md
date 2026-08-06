# Deployment Readiness Checklist

## Release scope
- Payment automation (invoice + bank-transfer intent workflow)
- Cross-app export API for sibling apps
- Billing history aggregation and admin review flow

## Required environment variables
- GEMINI_API_KEY
- APP_URL
- ALLOWED_ORIGINS
- VITE_API_BASE_URL
- VITE_PRO_MONTHLY_PRICE_MKD
- VITE_PRO_ANNUAL_PRICE_MKD
- VITE_BANK_NAME
- VITE_BANK_ACCOUNT_NUMBER
- VITE_BANK_IBAN
- VITE_BANK_SWIFT
- VITE_PAYPAL_EMAIL
- VITE_BILLING_CONTACT_EMAIL
- VITE_PAYMENTS_ADMIN_EMAIL
- VITE_EMAILJS_SERVICE_ID
- VITE_EMAILJS_TEMPLATE_ADMIN
- VITE_EMAILJS_TEMPLATE_TEACHER
- VITE_EMAILJS_PUBLIC_KEY
- VITE_ADMIN_EMAIL

## Pre-deploy validation
- Run `npm run lint`
- Run `npm run test -- --run`
- Run `npm run quality:gates`

## Production hardening checks
- Firebase Admin credentials available for server.ts
- CORS allowlist set to production domains only
- Auth required for `/api/export/*`
- Rate limiting enabled for export endpoints
- Billing/admin email notifications tested in staging

## Rollout plan
1. Deploy preview build
2. Validate payment flow end to end with test account
3. Validate cross-app export flow from sibling apps
4. Promote to production after 7 consecutive stable days
