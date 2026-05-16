const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const TEMPLATE_ADMIN = import.meta.env.VITE_EMAILJS_TEMPLATE_ADMIN as string;
const TEMPLATE_TEACHER = import.meta.env.VITE_EMAILJS_TEMPLATE_TEACHER as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

export interface ReceiptEmailParams {
  teacher_name: string;
  teacher_email: string;
  reference_code: string;
  plan: string;
  amount: string;
}

async function sendEmail(templateId: string, params: Record<string, string>): Promise<void> {
  if (!SERVICE_ID || !PUBLIC_KEY) return;
  await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: templateId,
      user_id: PUBLIC_KEY,
      template_params: params,
    }),
  });
}

export async function sendReceiptNotification(params: ReceiptEmailParams): Promise<void> {
  await sendEmail(TEMPLATE_ADMIN, { to_email: ADMIN_EMAIL, ...params });
}

export async function sendProActivationEmail(params: ReceiptEmailParams): Promise<void> {
  await sendEmail(TEMPLATE_TEACHER, { to_email: params.teacher_email, ...params });
}
