import type { PaymentReceipt } from './types';

export const generateInvoiceHtml = (receipt: PaymentReceipt, t: (key: string) => string, dateLocale: string): string => {
  const invoiceNumber = `MD-${receipt.id.slice(0, 8).toUpperCase()}`;
  const issueDate = new Date(receipt.reviewed_at ?? receipt.created_at).toLocaleDateString(dateLocale);

  return `<!DOCTYPE html>
<html lang="mk">
<head>
<meta charset="UTF-8"/>
<title>${t('invoiceTitle')}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f46e5; padding-bottom: 24px; margin-bottom: 32px; }
  .brand { font-size: 28px; font-weight: 900; color: #4f46e5; }
  .brand-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h1 { font-size: 22px; font-weight: 900; color: #1e293b; margin: 0 0 8px; }
  .invoice-meta p { margin: 2px 0; font-size: 13px; color: #475569; }
  .status-badge { display: inline-block; background: #dcfce7; color: #166534; border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-top: 8px; }
  section { margin-bottom: 28px; }
  h2 { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .info-item span { font-size: 14px; font-weight: 600; color: #1e293b; }
  .amount-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
  .amount-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  .amount-row:last-child { border-bottom: none; font-size: 18px; font-weight: 900; color: #4f46e5; }
  .amount-row:last-child .label { color: #1e293b; font-weight: 700; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MathDigitizer Pro</div>
      <div class="brand-sub">mathdigitizer.pro · igor.bogdanoski@mismath.net</div>
      <div class="brand-sub">Игор Богданоски · NLB Bank · IBAN MK07210501596102457 · SWIFT TUTNMK22</div>
    </div>
    <div class="invoice-meta">
      <h1>${t('invoiceTitle')}</h1>
      <p><strong>${t('invoiceNumber')}</strong> ${invoiceNumber}</p>
      <p><strong>${t('invoiceDate')}</strong> ${issueDate}</p>
      <p><strong>${t('invoiceReference')}</strong> ${receipt.reference_code}</p>
      <div class="status-badge">${t('invoicePaid')}</div>
    </div>
  </div>

  <section>
    <h2>${t('invoiceBuyerInfo')}</h2>
    <div class="info-grid">
      <div class="info-item"><label>Ime i prezime</label><span>${receipt.payer_name}</span></div>
      <div class="info-item"><label>Email</label><span>${receipt.payer_email}</span></div>
      <div class="info-item"><label>${t('invoicePaymentChannel')}</label><span>${receipt.payment_channel === 'bank' ? t('invoiceBankTransfer') : 'PayPal'}</span></div>
      <div class="info-item"><label>${t('invoiceReference')}</label><span>${receipt.reference_code}</span></div>
    </div>
  </section>

  <section>
    <h2>${t('invoiceServiceDescription')}</h2>
    <div class="amount-box">
      <div class="amount-row">
        <span class="label">${t('invoiceProduct')}</span>
        <span>${receipt.plan_context}</span>
      </div>
      <div class="amount-row">
        <span class="label">${t('invoicePeriod')}</span>
        <span>${receipt.billing_period_interest === 'annual' ? t('invoiceAnnualSubscription') : t('invoiceMonthlySubscription')}</span>
      </div>
      ${receipt.review_note ? `<div class="amount-row"><span class="label">${t('invoiceNote')}</span><span>${receipt.review_note}</span></div>` : ''}
      <div class="amount-row">
        <span class="label">${t('invoiceTotal')}</span>
        <span>${receipt.amount_label}</span>
      </div>
    </div>
  </section>

  <div class="footer">
    ${t('invoiceFooter')} · MathDigitizer Pro © ${new Date().getFullYear()}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
};
