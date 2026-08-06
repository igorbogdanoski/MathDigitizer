import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  CalendarCheck, CheckCircle2, Clock3, Coins, Eye, Inbox, Loader2,
  ShieldCheck, ThumbsDown, XCircle,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  approvePaymentIntent,
  expirePaymentIntent,
  isPaymentAdmin,
  markPaymentIntentInReview,
  PAYMENT_INTENTS_COLLECTION,
  rejectPaymentIntent,
  type PaymentIntentRecord,
  type PaymentIntentStatus,
} from '../lib/paymentIntents';
import { sendPaymentRejectedEmail, sendProActivatedEmail } from '../lib/paymentEmails';
import { trackProActivated } from '../lib/analytics';
import { SEO } from './SEO';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

type StatusFilter = 'all' | PaymentIntentStatus;

const STATUS_ORDER: PaymentIntentStatus[] = [
  'pending_payment',
  'receipt_uploaded',
  'admin_review',
  'approved',
  'rejected',
  'expired',
];

export const PaymentAdminDashboard: React.FC = () => {
  const { t, i18n } = useTranslation('billing');
  const dateLocale = i18n.language === 'al' ? 'sq-AL' : i18n.language === 'en' ? 'en-US' : 'mk-MK';
  const { user, userProfile, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();

  const [intents, setIntents] = useState<PaymentIntentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionIntentId, setActionIntentId] = useState<string | null>(null);
  const [rejectingIntentId, setRejectingIntentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewingIntent, setViewingIntent] = useState<PaymentIntentRecord | null>(null);

  const isAdmin = isPaymentAdmin(userProfile?.email ?? user?.email);

  useEffect(() => {
    if (!user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    const intentsQuery = query(collection(db, PAYMENT_INTENTS_COLLECTION), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      intentsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PaymentIntentRecord[];
        setIntents(items);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load payment intents:', error);
        showToast(t('payAdminLoadError'), 'error');
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [user, isAdmin, showToast, t]);

  const statusLabels: Record<PaymentIntentStatus, string> = useMemo(
    () => ({
      pending_payment: t('payAdminStatusPendingPayment'),
      receipt_uploaded: t('payAdminStatusReceiptUploaded'),
      admin_review: t('payAdminStatusAdminReview'),
      approved: t('payAdminStatusApproved'),
      rejected: t('payAdminStatusRejected'),
      expired: t('payAdminStatusExpired'),
    }),
    [t]
  );

  const statusBadgeClass: Record<PaymentIntentStatus, string> = {
    pending_payment: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    receipt_uploaded: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    admin_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    expired: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };

  const filteredIntents = useMemo(
    () => (statusFilter === 'all' ? intents : intents.filter((intent) => intent.status === statusFilter)),
    [intents, statusFilter]
  );

  const summary = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pendingReview = intents.filter(
      (intent) => intent.status === 'receipt_uploaded' || intent.status === 'admin_review'
    ).length;

    const approvedToday = intents.filter(
      (intent) =>
        intent.status === 'approved' &&
        intent.reviewed_at &&
        new Date(intent.reviewed_at).getTime() >= startOfToday.getTime()
    ).length;

    const revenueThisMonth = intents
      .filter(
        (intent) =>
          intent.status === 'approved' &&
          intent.reviewed_at &&
          new Date(intent.reviewed_at).getTime() >= startOfMonth.getTime()
      )
      .reduce((total, intent) => total + (Number.isFinite(intent.amount) ? intent.amount : 0), 0);

    return { pendingReview, approvedToday, revenueThisMonth };
  }, [intents]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(dateLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const handleViewReceipt = async (intent: PaymentIntentRecord) => {
    setViewingIntent(intent);
    try {
      await markPaymentIntentInReview(intent);
    } catch (error) {
      console.error('Failed to mark intent as in review:', error);
    }
  };

  const handleApprove = async (intent: PaymentIntentRecord) => {
    if (!user) return;
    setActionIntentId(intent.id);
    try {
      const { proEndsAt } = await approvePaymentIntent(intent, user.uid);
      sendProActivatedEmail(intent.email, intent.plan, proEndsAt).catch(() => {});
      trackProActivated(`invoice_${intent.plan}`);
      showToast(t('payAdminApproveSuccess'), 'success');
    } catch (error) {
      console.error('Failed to approve payment intent:', error);
      showToast(t('payAdminActionError'), 'error');
    } finally {
      setActionIntentId(null);
    }
  };

  const handleReject = async (intent: PaymentIntentRecord) => {
    if (!user) return;
    const reason = rejectionReason.trim();
    if (!reason) return;

    setActionIntentId(intent.id);
    try {
      await rejectPaymentIntent(intent.id, user.uid, reason);
      sendPaymentRejectedEmail(intent.email, reason).catch(() => {});
      showToast(t('payAdminRejectSuccess'), 'success');
      setRejectingIntentId(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Failed to reject payment intent:', error);
      showToast(t('payAdminActionError'), 'error');
    } finally {
      setActionIntentId(null);
    }
  };

  const handleExpire = async (intent: PaymentIntentRecord) => {
    if (!user) return;
    setActionIntentId(intent.id);
    try {
      await expirePaymentIntent(intent.id, user.uid);
      showToast(t('payAdminExpiredSuccess'), 'success');
    } catch (error) {
      console.error('Failed to expire payment intent:', error);
      showToast(t('payAdminActionError'), 'error');
    } finally {
      setActionIntentId(null);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <SEO title={t('payAdminTitle')} description={t('payAdminSubtitle')} canonical="/payment-admin" noindex />
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-10 text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">{t('payAdminNoAccess')}</p>
        </div>
      </div>
    );
  }

  const canReview = (intent: PaymentIntentRecord) =>
    intent.status === 'receipt_uploaded' || intent.status === 'admin_review';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <SEO title={t('payAdminTitle')} description={t('payAdminSubtitle')} canonical="/payment-admin" noindex />

      <section className="rounded-3xl p-8 md:p-10 bg-gradient-to-r from-slate-900 to-indigo-900 text-white border border-slate-800 shadow-2xl">
        <h1 className="text-3xl md:text-4xl font-black mb-3">{t('payAdminTitle')}</h1>
        <p className="text-slate-200 max-w-3xl">{t('payAdminSubtitle')}</p>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2">
            <Inbox className="w-4 h-4" />
            {t('payAdminCardPending')}
          </div>
          <div className="text-3xl font-black text-amber-900 dark:text-amber-100">{summary.pendingReview}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-2">
            <CalendarCheck className="w-4 h-4" />
            {t('payAdminCardApprovedToday')}
          </div>
          <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100">{summary.approvedToday}</div>
        </div>
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/40 bg-indigo-50 dark:bg-indigo-900/20 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 mb-2">
            <Coins className="w-4 h-4" />
            {t('payAdminCardRevenueMonth')}
          </div>
          <div className="text-3xl font-black text-indigo-900 dark:text-indigo-100">
            {summary.revenueThisMonth.toLocaleString('en-US')}{' '}
            <span className="text-base font-bold text-indigo-500 dark:text-indigo-300">MKD</span>
          </div>
        </div>
      </section>

      {/* Status filters */}
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            statusFilter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
          }`}
        >
          {t('payAdminFilterAll')} ({intents.length})
        </button>
        {STATUS_ORDER.map((status) => {
          const count = intents.filter((intent) => intent.status === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {statusLabels[status]} ({count})
            </button>
          );
        })}
      </section>

      {/* Intent list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : filteredIntents.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 py-16 text-center">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('payAdminEmpty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIntents.map((intent) => {
            const isBusy = actionIntentId === intent.id;
            const isRejecting = rejectingIntentId === intent.id;
            return (
              <div
                key={intent.id}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-black text-slate-900 dark:text-white">{intent.invoice_number}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass[intent.status]}`}
                      >
                        {statusLabels[intent.status]}
                      </span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {intent.amount.toLocaleString('en-US')} MKD ·{' '}
                        {intent.plan === 'annual' ? t('payAdminPlanAnnual') : t('payAdminPlanMonthly')}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{t('payAdminCustomer')}:</span>{' '}
                      {intent.customer_name} · {intent.email}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {t('payAdminCreated')}: {formatDate(intent.created_at)}
                      {intent.reviewed_at ? ` · ${t('payAdminReviewed')}: ${formatDate(intent.reviewed_at)}` : ''}
                    </div>
                    {intent.rejection_reason && (
                      <div className="text-xs italic text-red-500 dark:text-red-400 mt-1">
                        {t('payIntentsRejectionReason')}: "{intent.rejection_reason}"
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {intent.receipt_url ? (
                      <Button variant="outline" size="sm" onClick={() => handleViewReceipt(intent)}>
                        <Eye className="w-4 h-4 mr-1.5" />
                        {t('payAdminViewReceipt')}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">{t('payAdminNoReceipt')}</span>
                    )}

                    {canReview(intent) && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={isBusy}
                          onClick={() => handleApprove(intent)}
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          )}
                          {t('payAdminApprove')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingIntentId(isRejecting ? null : intent.id);
                            setRejectionReason('');
                          }}
                        >
                          <ThumbsDown className="w-4 h-4 mr-1.5" />
                          {t('payAdminReject')}
                        </Button>
                      </>
                    )}

                    {intent.status === 'pending_payment' && (
                      <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => handleExpire(intent)}>
                        <Clock3 className="w-4 h-4 mr-1.5" />
                        {t('payAdminMarkExpired')}
                      </Button>
                    )}
                  </div>
                </div>

                {isRejecting && (
                  <div className="mt-4 rounded-xl border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/10 p-4 space-y-3">
                    <textarea
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      className="w-full min-h-20 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-red-500"
                      placeholder={t('payAdminReasonPlaceholder')}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isBusy || !rejectionReason.trim()}
                      onClick={() => handleReject(intent)}
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-1.5" />
                      )}
                      {t('payAdminConfirmReject')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt viewer */}
      <Modal
        isOpen={viewingIntent !== null}
        onClose={() => setViewingIntent(null)}
        ariaLabel={t('payAdminReceiptTitle')}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      >
        {viewingIntent && (
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{t('payAdminReceiptTitle')}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {viewingIntent.invoice_number} · {viewingIntent.customer_name} ·{' '}
                  {viewingIntent.amount.toLocaleString('en-US')} MKD
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingIntent(null)}>
                {t('payModalClose')}
              </Button>
            </div>
            {viewingIntent.receipt_url ? (
              <img
                src={viewingIntent.receipt_url}
                alt={t('payAdminReceiptTitle')}
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10"
              />
            ) : (
              <p className="text-slate-500 dark:text-slate-400">{t('payAdminNoReceipt')}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
