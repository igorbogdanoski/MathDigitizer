const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const TEMPLATE_ADMIN = import.meta.env.VITE_EMAILJS_TEMPLATE_ADMIN as string;
const TEMPLATE_TEACHER = import.meta.env.VITE_EMAILJS_TEMPLATE_TEACHER as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

/** EmailJS template ids, exported so domain modules (e.g. paymentEmails) can reuse the same transport. */
export const EMAIL_TEMPLATES = {
  admin: TEMPLATE_ADMIN,
  teacher: TEMPLATE_TEACHER,
} as const;

export { ADMIN_EMAIL };

export interface ReceiptEmailParams {
  teacher_name: string;
  teacher_email: string;
  reference_code: string;
  plan: string;
  amount: string;
}

export async function sendEmail(templateId: string, params: Record<string, string>): Promise<void> {
  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.warn('[emailService] Missing EmailJS config — skipping send');
    return;
  }
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: templateId,
      user_id: PUBLIC_KEY,
      template_params: params,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[emailService] Failed to send email (template=${templateId}): ${res.status} ${body}`);
    throw new Error(`EmailJS send failed: ${res.status}`);
  }
}

export async function sendReceiptNotification(params: ReceiptEmailParams): Promise<void> {
  await sendEmail(TEMPLATE_ADMIN, { to_email: ADMIN_EMAIL, ...params });
}

export async function sendProActivationEmail(params: ReceiptEmailParams): Promise<void> {
  await sendEmail(TEMPLATE_TEACHER, { to_email: params.teacher_email, ...params });
}
