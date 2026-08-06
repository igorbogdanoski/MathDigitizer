# Preview Deployment Checklist

## Smoke test plan
- Open the pricing page and verify the Pro activation modal opens.
- Generate an invoice and confirm the print window flow works.
- Create a payment intent and upload a receipt.
- Confirm the admin review dashboard shows the new payment intent.
- Validate the export API health and task endpoints with a Firebase token.

## Environment checks
- Ensure Firebase Admin credentials are configured on the server.
- Set the payment and email env vars in the preview environment.
- Confirm ALLOWED_ORIGINS includes the preview host.

## Expected outcomes
- Billing flow completes without console errors.
- Admin receives the new payment notification.
- Export endpoints respond with 401/200/429 behavior as expected.
