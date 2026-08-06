/**
 * Payment workflow email notifications (EmailJS — same transport as
 * src/lib/emailService.ts; only two templates exist, so customer-facing
 * emails reuse the teacher template and admin notifications the admin one,
 * distinguished via the `email_type` template param).
 *
 * All functions are fire-and-forget safe: callers may `.catch(() => {})`
 * exactly like the existing receipt/activation email call sites.
 */

import { ADMIN_EMAIL, EMAIL_TEMPLATES, sendEmail } from './emailService';
import type { PaymentIntentRecord, PaymentIntentPlan } from './paymentIntents';

/** Admin inbox for payment notifications (task-specified default, env-overridable). */
const PAYMENTS_ADMIN_EMAIL =
  ((import.meta as any)?.env?.VITE_PAYMENTS_ADMIN_EMAIL as string | undefined)?.trim() ||
  'igor.bogdanoski@mismath.net';

const planLabel = (plan: PaymentIntentPlan): string =>
  plan === 'annual' ? 'MathDigitizer Pro — Annual (Годишно)' : 'MathDigitizer Pro — Monthly (Месечно)';

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('mk-MK', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
};

export async function sendPaymentIntentCreatedEmail(
  userEmail: string,
  customerName: string,
  invoiceNumber: string,
  amount: number,
  plan: PaymentIntentPlan
): Promise<void> {
  await sendEmail(EMAIL_TEMPLATES.teacher, {
    to_email: userEmail,
    teacher_email: userEmail,
    teacher_name: customerName,
    email_type: 'payment_intent_created',
    reference_code: invoiceNumber,
    plan: planLabel(plan),
    amount: `${amount.toLocaleString('en-US')} MKD`,
    subject: `[MathDigitizer] Invoice ${invoiceNumber} - Payment Instructions`,
    message:
      `Ја генериравме фактурата ${invoiceNumber} за ${planLabel(plan)}. ` +
      `Износ: ${amount.toLocaleString('en-US')} MKD. ` +
      'Откачи ја фактурата, направи ја уплатата преку банка и подоцна прикачи ја потврдата во Billing таблата.',
  });
}

/** "We received your payment — it will be reviewed within 24h." */
export async function sendPaymentReceivedEmail(userEmail: string, invoiceNumber: string): Promise<void> {
  await sendEmail(EMAIL_TEMPLATES.teacher, {
    to_email: userEmail,
    teacher_email: userEmail,
    email_type: 'payment_received',
    reference_code: invoiceNumber,
    subject: `MathDigitizer Pro — уплатата е примена (${invoiceNumber})`,
    message:
      `Ја примивме вашата уплата за фактура ${invoiceNumber}. ` +
      'Ќе ја провериме во рок од 24 часа и ќе ве известиме по е-пошта штом ќе биде одобрена.',
  });
}

/** "Pro activated! Here's what you get." */
export async function sendProActivatedEmail(
  userEmail: string,
  plan: PaymentIntentPlan,
  expiresAt: string
): Promise<void> {
  await sendEmail(EMAIL_TEMPLATES.teacher, {
    to_email: userEmail,
    teacher_email: userEmail,
    email_type: 'pro_activated',
    plan: planLabel(plan),
    amount: formatDate(expiresAt),
    subject: 'MathDigitizer Pro е активиран 🎉',
    message:
      'Вашата Pro претплата е активирана! Добијате: напредна педагошка аналитика, PDF Фабрика за масовна изработка, ' +
      `приоритетни AI генерации и приоритетна поддршка. Претплатата важи до ${formatDate(expiresAt)}.`,
  });
}

/** "Payment rejected: reason." */
export async function sendPaymentRejectedEmail(userEmail: string, reason: string): Promise<void> {
  await sendEmail(EMAIL_TEMPLATES.teacher, {
    to_email: userEmail,
    teacher_email: userEmail,
    email_type: 'payment_rejected',
    subject: 'MathDigitizer Pro — уплатата не е потврдена',
    message:
      `За жал, не можевме да ја потврдиме вашата уплата. Причина: ${reason} ` +
      `Контактирајте нè на ${PAYMENTS_ADMIN_EMAIL} за да го решиме проблемот.`,
  });
}

/** "New payment to review" → admin inbox. */
export async function sendAdminNotificationEmail(paymentIntent: PaymentIntentRecord): Promise<void> {
  const toEmail = PAYMENTS_ADMIN_EMAIL || ADMIN_EMAIL;
  await sendEmail(EMAIL_TEMPLATES.admin, {
    to_email: toEmail,
    email_type: 'new_payment_intent',
    teacher_name: paymentIntent.customer_name,
    teacher_email: paymentIntent.email,
    reference_code: paymentIntent.invoice_number,
    plan: planLabel(paymentIntent.plan),
    amount: `${paymentIntent.amount.toLocaleString('en-US')} MKD`,
    subject: `[MathDigitizer Admin] New Payment to Review - ${paymentIntent.invoice_number}`,
    message:
      `Нова уплата чека преглед во Payment Admin таблата (/payment-admin).\n` +
      `Фактура: ${paymentIntent.invoice_number}\n` +
      `Клиент: ${paymentIntent.customer_name} (${paymentIntent.email})\n` +
      `План: ${planLabel(paymentIntent.plan)}\n` +
      `Износ: ${paymentIntent.amount.toLocaleString('en-US')} MKD\n` +
      `Статус: ${paymentIntent.status}`,
  });
}
