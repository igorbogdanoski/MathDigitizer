/**
 * Payment Intents workflow — automated bank-transfer Pro activation.
 *
 * Stripe is not available in North Macedonia, so Pro is paid via bank
 * transfer against a generated invoice:
 *
 *   1. User generates an invoice (src/lib/invoicing.ts) and pays to NLB Bank.
 *   2. "I've paid" creates a `payment_intents` doc (status: pending_payment).
 *   3. User uploads a receipt → status: receipt_uploaded (admin notified).
 *   4. Admin reviews (→ admin_review), then approves or rejects.
 *   5. Approve activates Pro on `users/{uid}` and emails the user.
 *
 * The legacy `payment_receipts` flow (Pricing inline form →
 * SchoolInquiriesDashboard review) is untouched and keeps working.
 */

import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export type PaymentIntentStatus =
  | 'pending_payment'
  | 'receipt_uploaded'
  | 'admin_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export type PaymentIntentPlan = 'monthly' | 'annual';

/**
 * Firestore document in `payment_intents`.
 * (Named `PaymentIntentRecord` because src/lib/payment.ts already exports a
 * dormant Stripe-shaped `PaymentIntent` type.)
 */
export interface PaymentIntentRecord {
  id: string;
  user_id: string;
  email: string;
  customer_name: string;
  plan: PaymentIntentPlan;
  amount: number;
  currency: 'MKD';
  status: PaymentIntentStatus;
  /** Compressed receipt image stored as a data URL (no Firebase Storage in this project). */
  receipt_url?: string;
  invoice_number: string;
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export const PAYMENT_INTENTS_COLLECTION = 'payment_intents';

/** Intents still awaiting a bank transfer become stale after this many days. */
export const PAYMENT_INTENT_EXPIRY_DAYS = 14;

export const PLAN_DURATION_MS: Record<PaymentIntentPlan, number> = {
  monthly: 31 * 24 * 60 * 60 * 1000,
  annual: 365 * 24 * 60 * 60 * 1000,
};

/** Invoice number: MD-<year>-<6 chars from the pre-generated doc id>. */
export function buildInvoiceNumber(docId: string, date: Date = new Date()): string {
  return `MD-${date.getFullYear()}-${docId.slice(0, 6).toUpperCase()}`;
}

/** Pre-generate a Firestore doc so the invoice number exists before the intent is written. */
export function allocatePaymentIntentRef() {
  const ref = doc(collection(db, PAYMENT_INTENTS_COLLECTION));
  return { ref, id: ref.id, invoiceNumber: buildInvoiceNumber(ref.id) };
}

export interface CreatePaymentIntentInput {
  userId: string;
  email: string;
  customerName: string;
  plan: PaymentIntentPlan;
  amount: number;
  invoiceNumber: string;
  intentId: string;
}

/**
 * Persist the payment intent with the pre-allocated id (setDoc, not addDoc,
 * so the invoice number derived from the id stays stable).
 */
export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentRecord> {
  const nowIso = new Date().toISOString();
  const data = {
    user_id: input.userId,
    email: input.email,
    customer_name: input.customerName,
    plan: input.plan,
    amount: input.amount,
    currency: 'MKD' as const,
    status: 'pending_payment' as const,
    invoice_number: input.invoiceNumber,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await setDoc(doc(db, PAYMENT_INTENTS_COLLECTION, input.intentId), data);

  return { id: input.intentId, ...data };
}

/** Attach the uploaded receipt and move the intent into the review queue. */
export async function attachPaymentReceipt(intentId: string, receiptDataUrl: string): Promise<void> {
  await updateDoc(doc(db, PAYMENT_INTENTS_COLLECTION, intentId), {
    status: 'receipt_uploaded',
    receipt_url: receiptDataUrl,
    updated_at: new Date().toISOString(),
  });
}

/** Admin opened the receipt — mark as actively under review (idempotent). */
export async function markPaymentIntentInReview(intent: PaymentIntentRecord): Promise<void> {
  if (intent.status !== 'receipt_uploaded') return;
  await updateDoc(doc(db, PAYMENT_INTENTS_COLLECTION, intent.id), {
    status: 'admin_review',
    updated_at: new Date().toISOString(),
  });
}

/** Admin marked a stale pending intent as expired. */
export async function expirePaymentIntent(intentId: string, reviewerUid: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, PAYMENT_INTENTS_COLLECTION, intentId), {
    status: 'expired',
    reviewed_by: reviewerUid,
    reviewed_at: nowIso,
    updated_at: nowIso,
  });
}

export interface ReviewResult {
  proStartedAt: string;
  proEndsAt: string;
}

/**
 * Approve: close the intent AND activate Pro on the user's doc.
 * Mirrors the proven SchoolInquiriesDashboard approval flow
 * (isPro + proStartedAt + proEndsAt + paymentChannel on `users/{uid}`).
 * Firestore rules require the reviewer to be a teacher and a different
 * account than the payer (canTeacherActivateProOnUser).
 */
export async function approvePaymentIntent(intent: PaymentIntentRecord, reviewerUid: string): Promise<ReviewResult> {
  const nowIso = new Date().toISOString();
  const proEndsAt = new Date(Date.now() + PLAN_DURATION_MS[intent.plan]).toISOString();

  await updateDoc(doc(db, PAYMENT_INTENTS_COLLECTION, intent.id), {
    status: 'approved',
    reviewed_by: reviewerUid,
    reviewed_at: nowIso,
    updated_at: nowIso,
  });

  await updateDoc(doc(db, 'users', intent.user_id), {
    isPro: true,
    proStartedAt: nowIso,
    proEndsAt,
    paymentChannel: 'bank',
  });

  return { proStartedAt: nowIso, proEndsAt };
}

/** Reject: close the intent with a reason (email is sent by the caller). */
export async function rejectPaymentIntent(
  intentId: string,
  reviewerUid: string,
  rejectionReason: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, PAYMENT_INTENTS_COLLECTION, intentId), {
    status: 'rejected',
    reviewed_by: reviewerUid,
    reviewed_at: nowIso,
    rejection_reason: rejectionReason,
    updated_at: nowIso,
  });
}

/** True while the intent still expects a bank transfer / receipt. */
export function isIntentPendingAction(intent: PaymentIntentRecord): boolean {
  return intent.status === 'pending_payment' || intent.status === 'receipt_uploaded' || intent.status === 'admin_review';
}

/** A pending_payment intent older than PAYMENT_INTENT_EXPIRY_DAYS is treated as expired in the UI. */
export function isIntentStale(intent: PaymentIntentRecord, now: Date = new Date()): boolean {
  if (intent.status !== 'pending_payment') return false;
  const created = new Date(intent.created_at).getTime();
  return now.getTime() - created > PAYMENT_INTENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Admin allowlist for the payment dashboard. There is no dedicated admin
 * role in Firestore (role is self-declared teacher/student), so privileged
 * pages are gated by email — same approach as server.ts ADMIN_EMAILS.
 */
const ENV_ADMIN_EMAIL = ((import.meta as any)?.env?.VITE_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase();
const ENV_PAYMENTS_ADMIN_EMAIL = ((import.meta as any)?.env?.VITE_PAYMENTS_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase();

export const PAYMENT_ADMIN_EMAILS: string[] = Array.from(
  new Set(
    [ENV_ADMIN_EMAIL, ENV_PAYMENTS_ADMIN_EMAIL, 'igor.bogdanoski@mismath.net']
      .filter((email): email is string => Boolean(email))
      .map((email) => email.toLowerCase())
  )
);

export function isPaymentAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return PAYMENT_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Downscale an image file to a JPEG data URL small enough to live inside a
 * Firestore document (1 MiB hard limit). No Firebase Storage in this project
 * and no new npm deps allowed, so receipts are stored inline as data URLs.
 */
export async function compressReceiptToDataUrl(file: File, maxBytes = 750_000): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('receipt-not-image');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('receipt-decode-failed'));
      img.src = objectUrl;
    });

    const attempts: Array<{ maxDimension: number; quality: number }> = [
      { maxDimension: 1400, quality: 0.85 },
      { maxDimension: 1000, quality: 0.72 },
      { maxDimension: 800, quality: 0.6 },
    ];

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('receipt-canvas-unavailable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', attempt.quality);
      if (dataUrl.length <= maxBytes) return dataUrl;
    }

    throw new Error('receipt-too-large');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
