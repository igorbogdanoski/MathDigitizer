/**
 * Payment Integration — Stripe + Bank Transfer
 *
 * ЗАБЕЛЕШКА: Stripe моментално НЕ е достапен во Македонија.
 * Овој модул е подготвен за идна имплементација кога Stripe ќе
 * биде достапен, или за интеграција со локални payment процесори.
 *
 * Тековни методи:
 * - Банкарски трансфер (IBAN: MK07210501596102457)
 * - PayPal (igor.bogdanoski@mismath.net)
 *
 * Идни методи:
 * - Stripe (кога ќе биде достапен во МК)
 * - Локални payment процесори (CaSys, NLB плаќање)
 */

import type { BillingPeriod } from './saas';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentMethod = 'bank' | 'paypal' | 'stripe' | 'local_processor';

export type PaymentStatus =
  | 'pending'      // Чека уплата
  | 'processing'   // Се обработува
  | 'completed'    // Успешно
  | 'failed'       // Неуспешно
  | 'refunded';    // Вратено

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  billingPeriod: BillingPeriod;
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: 'pro_monthly' | 'pro_annual' | 'school';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export interface PaymentConfig {
  // Stripe (кога ќе биде достапен)
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;

  // PayPal
  paypalEmail: string;
  paypalClientId?: string;

  // Банкарски трансфер
  bankName: string;
  bankAccountNumber: string;
  bankIban: string;
  bankSwift: string;

  // Локални процесори (идно)
  localProcessorApiKey?: string;
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export const PRICING = {
  pro_monthly: {
    amount: 490,
    currency: 'MKD',
    interval: 'month' as const,
    features: [
      'Неограничени дигитализации',
      'AI оценување',
      'Неограничени флеш картички',
      'Напредна педагогија',
      'Приоритетна поддршка',
    ],
  },
  pro_annual: {
    amount: 4900,
    currency: 'MKD',
    interval: 'year' as const,
    savings: 980, // 2 месеци бесплатно
    features: [
      'Сè од Pro Monthly',
      '2 месеци бесплатно',
      'Приоритетна поддршка',
      'Ран пристап до нови функции',
    ],
  },
  school: {
    amount: null, // По договор
    currency: 'MKD',
    interval: 'year' as const,
    features: [
      'Неограничени наставници',
      'Ученички профили',
      'Централизирана администрација',
      'Обука и поддршка',
      'Прилагодени интеграции',
    ],
  },
} as const;

// ─── Stripe Integration (Placeholder) ────────────────────────────────────────

/**
 * Stripe Checkout Session Creator
 *
 * КОГА STRIPE ЌЕ БИДЕ ДОСТАПЕН ВО МК:
 * 1. Креирај Stripe account на https://stripe.com/mk
 * 2. Добиј API keys од Stripe Dashboard
 * 3. Попни ги env var-овите:
 *    - VITE_STRIPE_PUBLISHABLE_KEY
 *    - STRIPE_SECRET_KEY (server-side only)
 *    - STRIPE_WEBHOOK_SECRET (server-side only)
 * 4. Откоментирај го кодот подолу
 */

export async function createStripeCheckoutSession(
  priceId: string,
  customerEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  // TODO: Implement when Stripe is available in MK
  //
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  //
  // const session = await stripe.checkout.sessions.create({
  //   payment_method_types: ['card'],
  //   line_items: [{ price: priceId, quantity: 1 }],
  //   mode: 'subscription',
  //   customer_email: customerEmail,
  //   success_url: successUrl,
  //   cancel_url: cancelUrl,
  //   metadata: {
  //     app: 'mathdigitizer',
  //   },
  // });
  //
  // return { sessionId: session.id, url: session.url! };

  throw new Error(
    'Stripe сè уште не е достапен во Македонија. ' +
    'Ве молиме користете банкарски трансфер или PayPal.'
  );
}

/**
 * Stripe Webhook Handler
 *
 * Обрабува настани од Stripe:
 * - checkout.session.completed → Активирај Pro
 * - customer.subscription.deleted → Деактивирај Pro
 * - invoice.payment_failed → Обележи past_due
 */

export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<void> {
  // TODO: Implement when Stripe is available in MK
  //
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // const event = stripe.webhooks.constructEvent(
  //   payload,
  //   signature,
  //   process.env.STRIPE_WEBHOOK_SECRET!
  // );
  //
  // switch (event.type) {
  //   case 'checkout.session.completed':
  //     // Активирај Pro на корисникот
  //     break;
  //   case 'customer.subscription.deleted':
  //     // Деактивирај Pro
  //     break;
  //   case 'invoice.payment_failed':
  //     // Обележи past_due
  //     break;
  // }

  console.warn('Stripe webhook handler not implemented yet');
}

// ─── Bank Transfer Verification ──────────────────────────────────────────────

/**
 * Верификација на банкарски трансфер
 *
 * Тековен процес (рачен):
 * 1. Корисникот уплатува на IBAN
 * 2. Наставникот прикачува потврда
 * 3. Администраторот верификува и активира Pro
 *
 * Иден процес (автоматски):
 * 1. Интеграција со банка API (NLB, CaSys)
 * 2. Автоматска детекција на уплата
 * 3. Автоматска активација на Pro
 */

export interface BankTransferVerification {
  referenceCode: string;
  amount: number;
  payerName: string;
  payerEmail: string;
  receiptImage?: string; // Base64 или URL
  status: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
}

export async function verifyBankTransfer(
  verification: BankTransferVerification
): Promise<{ success: boolean; message: string }> {
  // TODO: Implement bank API integration
  //
  // За сега, ова е рачен процес:
  // 1. Администраторот гледа листа на pending верификации
  // 2. Проверува банкарска сметка
  // 3. Верификува или одбива

  return {
    success: false,
    message: 'Банкарската верификација е рачен процес. Контактирајте администратор.',
  };
}

// ─── Payment Status Helpers ──────────────────────────────────────────────────

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    bank: 'Банкарски трансфер',
    paypal: 'PayPal',
    stripe: 'Кредитна картичка (Stripe)',
    local_processor: 'Локално плаќање',
  };
  return labels[method];
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: 'Чека уплата',
    processing: 'Се обработува',
    completed: 'Успешно',
    failed: 'Неуспешно',
    refunded: 'Вратено',
  };
  return labels[status];
}

export function formatAmount(amount: number, currency: string = 'MKD'): string {
  return new Intl.NumberFormat('mk-MK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

// ─── Default Payment Config ──────────────────────────────────────────────────

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  paypalEmail: 'igor.bogdanoski@mismath.net',
  bankName: 'NLB Bank',
  bankAccountNumber: '210501596102457',
  bankIban: 'MK07210501596102457',
  bankSwift: 'TUTNMK22',
};
