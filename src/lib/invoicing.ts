/**
 * Automated invoice generation for the bank-transfer Pro flow.
 *
 * Produces a standalone, print-ready HTML invoice (MathDigitizer branding)
 * that auto-opens the browser print dialog so the user can save it as PDF.
 * Strings are localized via the shared i18n instance (mk/en/al) using the
 * `billing` namespace (`invoice.*` keys).
 */

import i18n from '../i18n';

export interface GenerateInvoiceParams {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  plan: 'monthly' | 'annual';
  /** Amount in MKD. */
  amount: number;
  bankDetails: { bank: string; iban: string; swift: string; recipient: string };
  issueDate: string;
  dueDate: string;
}

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  mk: 'mk-MK',
  al: 'sq-AL',
  en: 'en-US',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function generateInvoiceHtml(params: GenerateInvoiceParams): string {
  const language = (i18n.language || 'mk').split('-')[0];
  const locale = LOCALE_BY_LANGUAGE[language] ?? 'mk-MK';
  const t = (key: string): string => i18n.t(`billing:${key}`, { defaultValue: '' }) as string;

  const planLabel = params.plan === 'annual' ? t('invoicePlanAnnual') : t('invoicePlanMonthly');
  const amountLabel = `${params.amount.toLocaleString('en-US')} MKD`;
  const customerName = escapeHtml(params.customerName);
  const customerEmail = escapeHtml(params.customerEmail);
  const invoiceNumber = escapeHtml(params.invoiceNumber);
  const bank = escapeHtml(params.bankDetails.bank);
  const iban = escapeHtml(params.bankDetails.iban);
  const swift = escapeHtml(params.bankDetails.swift);
  const recipient = escapeHtml(params.bankDetails.recipient);

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="UTF-8"/>
<title>${t('invoiceDocTitle')} ${invoiceNumber}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f46e5; padding-bottom: 24px; margin-bottom: 32px; }
  .brand { font-size: 28px; font-weight: 900; color: #4f46e5; }
  .brand-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h1 { font-size: 22px; font-weight: 900; color: #1e293b; margin: 0 0 8px; }
  .invoice-meta p { margin: 2px 0; font-size: 13px; color: #475569; }
  .status-badge { display: inline-block; background: #fef3c7; color: #92400e; border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-top: 8px; }
  section { margin-bottom: 28px; }
  h2 { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .info-item span { font-size: 14px; font-weight: 600; color: #1e293b; word-break: break-word; }
  .amount-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
  .amount-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; gap: 16px; }
  .amount-row:last-child { border-bottom: none; font-size: 18px; font-weight: 900; color: #4f46e5; }
  .amount-row:last-child .label { color: #1e293b; font-weight: 700; }
  .bank-box { background: #eef2ff; border: 2px solid #c7d2fe; border-radius: 12px; padding: 20px 24px; }
  .bank-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; gap: 16px; }
  .bank-row .label { color: #475569; font-weight: 600; }
  .bank-row .value { font-weight: 700; color: #1e293b; word-break: break-all; text-align: right; }
  .instructions { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px 20px; font-size: 13px; color: #78350f; line-height: 1.6; }
  .instructions strong { color: #92400e; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MathDigitizer Pro</div>
      <div class="brand-sub">math.mismath.net · igor.bogdanoski@mismath.net</div>
      <div class="brand-sub">${t('invoiceSellerLabel')}: Игор Богданоски</div>
    </div>
    <div class="invoice-meta">
      <h1>${t('invoiceDocTitle')}</h1>
      <p><strong>${t('invoiceNumberLabel')}</strong> ${invoiceNumber}</p>
      <p><strong>${t('invoiceIssueDate')}</strong> ${formatDate(params.issueDate, locale)}</p>
      <p><strong>${t('invoiceDueDate')}</strong> ${formatDate(params.dueDate, locale)}</p>
      <div class="status-badge">${t('invoiceStatusUnpaid')}</div>
    </div>
  </div>

  <section>
    <h2>${t('invoiceBilledTo')}</h2>
    <div class="info-grid">
      <div class="info-item"><label>${t('invoiceCustomerName')}</label><span>${customerName}</span></div>
      <div class="info-item"><label>${t('invoiceEmail')}</label><span>${customerEmail}</span></div>
    </div>
  </section>

  <section>
    <h2>${t('invoiceService')}</h2>
    <div class="amount-box">
      <div class="amount-row">
        <span class="label">${t('invoiceProduct')}</span>
        <span>MathDigitizer Pro</span>
      </div>
      <div class="amount-row">
        <span class="label">${t('invoicePlan')}</span>
        <span>${planLabel}</span>
      </div>
      <div class="amount-row">
        <span class="label">${t('invoiceTotal')}</span>
        <span>${amountLabel}</span>
      </div>
    </div>
  </section>

  <section>
    <h2>${t('invoicePayTo')}</h2>
    <div class="bank-box">
      <div class="bank-row"><span class="label">${t('invoiceRecipient')}</span><span class="value">${recipient}</span></div>
      <div class="bank-row"><span class="label">${t('invoiceBank')}</span><span class="value">${bank}</span></div>
      <div class="bank-row"><span class="label">IBAN</span><span class="value">${iban}</span></div>
      <div class="bank-row"><span class="label">SWIFT/BIC</span><span class="value">${swift}</span></div>
      <div class="bank-row"><span class="label">${t('invoiceReference')}</span><span class="value">${invoiceNumber}</span></div>
    </div>
  </section>

  <section>
    <h2>${t('invoiceInstructionsTitle')}</h2>
    <div class="instructions">
      ${t('invoiceInstructions1')}<br/>
      ${t('invoiceInstructions2').replace('{{invoiceNumber}}', invoiceNumber)}<br/>
      ${t('invoiceInstructions3')}
    </div>
  </section>

  <div class="footer">
    ${t('invoiceFooter')} · MathDigitizer Pro © ${new Date().getFullYear()}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

/** Open the generated invoice in a new print-ready window (same pattern as SchoolInquiriesDashboard). */
export function openInvoiceInPrintWindow(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
