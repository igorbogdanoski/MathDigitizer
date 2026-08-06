import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  CreditCard, Crown, Clock, CheckCircle2, XCircle, AlertCircle,
  ArrowRight, Shield, CalendarDays, Receipt, Sparkles, Loader2, FileDown, Landmark,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { hasProAccess, isOnTrial, trialDaysRemaining, getProPricingPlans, getManualPaymentDetails } from '../lib/saas';
import {
  PAYMENT_INTENTS_COLLECTION,
  type PaymentIntentRecord,
  type PaymentIntentStatus,
} from '../lib/paymentIntents';
import { generateInvoiceHtml, openInvoiceInPrintWindow } from '../lib/invoicing';
import { SEO } from './SEO';
import { Link } from 'react-router-dom';

type ReceiptStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

interface PaymentReceipt {
  id: string;
  payer_name: string;
  payer_email: string;
  payment_channel: 'bank' | 'paypal';
  reference_code: string;
  note?: string;
  amount_label: string;
  billing_period_interest: 'monthly' | 'annual';
  plan_context: string;
  created_at: string;
  status: ReceiptStatus;
  reviewed_at?: string;
  review_note?: string;
}

const STATUS_CONFIG: Record<ReceiptStatus, { label: string; icon: React.ReactNode; className: string }> = {
  pending: {
    label: 'Во исчекување',
    icon: <Clock className="w-4 h-4" />,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  reviewed: {
    label: 'Прегледано',
    icon: <AlertCircle className="w-4 h-4" />,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  approved: {
    label: 'Одобрено',
    icon: <CheckCircle2 className="w-4 h-4" />,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  rejected: {
    label: 'Одбиено',
    icon: <XCircle className="w-4 h-4" />,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  },
};

/** Status badges for the new invoice-based `payment_intents` flow. */
const INTENT_STATUS_STYLE: Record<PaymentIntentStatus, { key: string; className: string }> = {
  pending_payment: {
    key: 'billing:payIntentsStatusPendingPayment',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  receipt_uploaded: {
    key: 'billing:payIntentsStatusReceiptUploaded',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  admin_review: {
    key: 'billing:payIntentsStatusAdminReview',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  approved: {
    key: 'billing:payIntentsStatusApproved',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  rejected: {
    key: 'billing:payIntentsStatusRejected',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  },
  expired: {
    key: 'billing:payIntentsStatusExpired',
    className: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
};

const INTENT_STATUS_FALLBACKS: Record<PaymentIntentStatus, string> = {
  pending_payment: 'Чека уплата',
  receipt_uploaded: 'Прикачена потврда',
  admin_review: 'Во преглед',
  approved: 'Одобрено',
  rejected: 'Одбиено',
  expired: 'Истечено',
};

export const BillingDashboard: React.FC = () => {
  const { t } = useTranslation('common');
  const { user, userProfile } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(true);
  const [intents, setIntents] = useState<PaymentIntentRecord[]>([]);
  const [isLoadingIntents, setIsLoadingIntents] = useState(true);

  const isPro = hasProAccess(userProfile);
  const onTrial = isOnTrial(userProfile);
  const trialDays = trialDaysRemaining(userProfile);
  const pricingPlans = getProPricingPlans();
  const paymentDetails = getManualPaymentDetails();

  useEffect(() => {
    if (!user) {
      setIsLoadingReceipts(false);
      return;
    }

    const receiptsQuery = query(
      collection(db, 'payment_receipts'),
      where('requester_uid', '==', user.uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(receiptsQuery, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as PaymentReceipt[];
      setReceipts(items);
      setIsLoadingReceipts(false);
    }, () => {
      setIsLoadingReceipts(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsLoadingIntents(false);
      return;
    }

    // No orderBy here on purpose: where + orderBy would require a composite
    // index; the list is sorted client-side below instead.
    const intentsQuery = query(
      collection(db, PAYMENT_INTENTS_COLLECTION),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(intentsQuery, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as PaymentIntentRecord[];
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setIntents(items);
      setIsLoadingIntents(false);
    }, () => {
      setIsLoadingIntents(false);
    });

    return unsubscribe;
  }, [user]);

  const handleDownloadIntentInvoice = (intent: PaymentIntentRecord) => {
    const details = getManualPaymentDetails();
    const issueDate = intent.created_at;
    const dueDate = new Date(new Date(intent.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const html = generateInvoiceHtml({
      invoiceNumber: intent.invoice_number,
      customerName: intent.customer_name,
      customerEmail: intent.email,
      plan: intent.plan,
      amount: intent.amount,
      bankDetails: {
        bank: details.bankName ?? 'NLB Bank',
        iban: details.bankIban ?? 'MK07210501596102457',
        swift: details.bankSwift ?? 'TUTNMK22',
        recipient: 'Игор Богданоски',
      },
      issueDate,
      dueDate,
    });
    openInvoiceInPrintWindow(html);
  };

  const planStatus = useMemo(() => {
    if (isPro && !onTrial) return 'pro';
    if (onTrial) return 'trial';
    return 'free';
  }, [isPro, onTrial]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('mk-MK', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <SEO
        title="Billing — MathDigitizer Pro"
        description="Управувајте со вашата претплата и прегледајте ја историјата на плаќања."
        canonical="/billing"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-indigo-600" />
            {t('billing.title', 'Billing')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('billing.subtitle', 'Управувајте со вашата претплата и плаќања')}
          </p>
        </div>
        {!isPro && (
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {t('billing.upgrade', 'Надгради на Pro')}
          </Link>
        )}
      </div>

      {/* Plan Status Card */}
      <div className={`rounded-3xl border-2 p-8 ${
        planStatus === 'pro'
          ? 'border-indigo-300 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20'
          : planStatus === 'trial'
            ? 'border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {planStatus === 'pro' ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white">
                  <Crown className="w-4 h-4" /> Pro Teacher
                </span>
              ) : planStatus === 'trial' ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-bold text-white">
                  <Clock className="w-4 h-4" /> {t('billing.trial', 'Пробен период')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-200 dark:bg-slate-700 px-4 py-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                  {t('billing.free', 'Бесплатен план')}
                </span>
              )}
            </div>

            {planStatus === 'pro' && (
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {userProfile?.proStartedAt && (
                  <p className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-indigo-500" />
                    {t('billing.activeSince', 'Активен од')}: {formatDate(userProfile.proStartedAt)}
                  </p>
                )}
                {userProfile?.paymentChannel && (
                  <p className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    {t('billing.paymentMethod', 'Метод на плаќање')}: {userProfile.paymentChannel.toUpperCase()}
                  </p>
                )}
              </div>
            )}

            {planStatus === 'trial' && (
              <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {t('billing.trialDaysLeft', '{{days}} дена преостанати од пробниот период', { days: trialDays })}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {t('billing.trialExpiry', 'По истекувањето, потребно е да надградите за да продолжите со Pro функциите.')}
                </p>
              </div>
            )}

            {planStatus === 'free' && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                {t('billing.freeDescription', 'Користите ги основните функции бесплатно. Надградете за целосен пристап.')}
              </p>
            )}
          </div>

          {planStatus !== 'pro' && (
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors shrink-0"
            >
              {t('billing.viewPlans', 'Види планови')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pricingPlans.map((plan) => (
          <div
            key={plan.period}
            className={`rounded-2xl border p-6 ${
              plan.featured
                ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                {plan.period === 'monthly' ? t('billing.monthly', 'Месечно') : t('billing.annual', 'Годишно')}
              </span>
              {plan.featured && (
                <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                  {t('billing.bestValue', 'Најдобра вредност')}
                </span>
              )}
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {plan.priceMkd.toLocaleString('en-US')} <span className="text-lg font-bold text-slate-400">МКД</span>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{plan.billingLabel}</div>
            {plan.savingsLabel && (
              <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {plan.savingsLabel}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Invoices & payments — new bank-transfer (payment_intents) flow */}
      {(intents.length > 0 || isLoadingIntents) && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-600" />
              {t('billing:payIntentsTitle', 'Фактури и плаќања')}
            </h2>
          </div>

          {isLoadingIntents ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {intents.map((intent) => {
                const statusStyle = INTENT_STATUS_STYLE[intent.status] ?? INTENT_STATUS_STYLE.pending_payment;
                return (
                  <div key={intent.id} className="px-8 py-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-1">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {intent.amount.toLocaleString('en-US')} MKD ·{' '}
                          {intent.plan === 'annual'
                            ? t('billing.annual', 'Годишно')
                            : t('billing.monthly', 'Месечно')}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusStyle.className}`}
                        >
                          {t(statusStyle.key, INTENT_STATUS_FALLBACKS[intent.status])}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 space-y-0.5">
                        <p>
                          <span className="font-medium">{t('billing:payIntentsInvoice', 'Фактура')}:</span>{' '}
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {intent.invoice_number}
                          </code>
                        </p>
                        <p>
                          <span className="font-medium">{t('billing.channel', 'Канал')}:</span>{' '}
                          {t('billing:payIntentsMethodBank', 'Банкарски трансфер (фактура)')}
                        </p>
                        <p>{formatDate(intent.created_at)}</p>
                        {intent.rejection_reason && (
                          <p className="text-xs italic text-red-500 dark:text-red-400 mt-1">
                            {t('billing:payIntentsRejectionReason', 'Причина за одбивање')}: "{intent.rejection_reason}"
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadIntentInvoice(intent)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-700 px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shrink-0"
                    >
                      <FileDown className="w-4 h-4" />
                      {t('billing:payIntentsDownloadInvoice', 'Преземи фактура')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payment History */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            {t('billing.paymentHistory', 'Историја на плаќања')}
          </h2>
        </div>

        {isLoadingReceipts ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-16 px-8">
            <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {t('billing.noPayments', 'Нема запишани плаќања.')}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {t('billing.noPaymentsHint', 'Кога ќе уплатите и ќе прикачите потврда, ќе се појави тука.')}
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
            >
              {t('billing.goToPricing', 'Оди на ценовник')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {receipts.map((receipt) => {
              const statusConfig = STATUS_CONFIG[receipt.status];
              return (
                <div key={receipt.id} className="px-8 py-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {receipt.amount_label}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusConfig.className}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 space-y-0.5">
                      <p>
                        <span className="font-medium">{t('billing.reference', 'Референца')}:</span>{' '}
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{receipt.reference_code}</code>
                      </p>
                      <p>
                        <span className="font-medium">{t('billing.channel', 'Канал')}:</span>{' '}
                        {receipt.payment_channel === 'bank' ? t('billing.bankTransfer', 'Банкарски трансфер') : 'PayPal'}
                      </p>
                      <p>{formatDate(receipt.created_at)}</p>
                      {receipt.review_note && (
                        <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-1">
                          "{receipt.review_note}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Instructions (for non-Pro users) */}
      {!isPro && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-8">
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">
            {t('billing.howToPay', 'Како да уплатите')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 space-y-2 text-sm">
              <div className="font-bold text-slate-900 dark:text-white mb-3">
                {t('billing.bankDetails', 'Банкарски трансфер')}
              </div>
              <p><span className="font-semibold">{t('billing.bank', 'Банка')}:</span> {paymentDetails.bankName}</p>
              <p><span className="font-semibold">IBAN:</span> {paymentDetails.bankIban}</p>
              <p><span className="font-semibold">SWIFT:</span> {paymentDetails.bankSwift}</p>
              <p><span className="font-semibold">{t('billing.account', 'Сметка')}:</span> {paymentDetails.bankAccountNumber}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 space-y-2 text-sm">
              <div className="font-bold text-slate-900 dark:text-white mb-3">PayPal</div>
              <p><span className="font-semibold">Email:</span> {paymentDetails.paypalEmail}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                {t('billing.paypalNote', 'Напишете ја вашата референца во PayPal пораката. Референцата ја добивате на ценовникот по најава.')}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
            {t('billing.activationNote', 'По уплатата, прикачете потврда на ценовникот. Pro пристапот се активира рачно, обично во рок од неколку часа.')}
          </div>
        </div>
      )}
    </div>
  );
};
