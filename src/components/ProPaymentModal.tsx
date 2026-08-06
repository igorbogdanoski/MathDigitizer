import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCircle2, Copy, FileText, Landmark, Loader2, Receipt, Sparkles, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { signInWithGoogle } from '../lib/firebase';
import { BillingPeriod, getManualPaymentDetails, getProPricingPlans } from '../lib/saas';
import { generateInvoiceHtml, openInvoiceInPrintWindow } from '../lib/invoicing';
import {
  allocatePaymentIntentRef,
  attachPaymentReceipt,
  compressReceiptToDataUrl,
  createPaymentIntent,
  type PaymentIntentRecord,
} from '../lib/paymentIntents';
import {
  sendAdminNotificationEmail,
  sendPaymentIntentCreatedEmail,
  sendPaymentReceivedEmail,
} from '../lib/paymentEmails';
import { trackReceiptSubmitted } from '../lib/analytics';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

/** Recipient shown on invoices / bank transfer details (sole proprietor behind MathDigitizer). */
const PAYMENT_RECIPIENT = 'Игор Богданоски';

interface ProPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selects the plan shown first in the modal (matches the pricing toggle). */
  initialPeriod: BillingPeriod;
}

type PaymentStep = 'details' | 'bank' | 'receipt' | 'done';

interface AllocatedIntent {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
}

export const ProPaymentModal: React.FC<ProPaymentModalProps> = ({ isOpen, onClose, initialPeriod }) => {
  const { t } = useTranslation('billing');
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<PaymentStep>('details');
  const [plan, setPlan] = useState<BillingPeriod>(initialPeriod);
  const [customerName, setCustomerName] = useState(user?.displayName ?? '');
  const [customerEmail, setCustomerEmail] = useState(user?.email ?? '');
  const [allocated, setAllocated] = useState<AllocatedIntent | null>(null);
  const [createdIntent, setCreatedIntent] = useState<PaymentIntentRecord | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  const pricingPlans = getProPricingPlans();
  const selectedPlan = pricingPlans.find((p) => p.period === plan) ?? pricingPlans[0];
  const paymentDetails = getManualPaymentDetails();

  const bankDetails = useMemo(
    () => ({
      bank: paymentDetails.bankName ?? 'NLB Bank',
      iban: paymentDetails.bankIban ?? 'MK07210501596102457',
      swift: paymentDetails.bankSwift ?? 'TUTNMK22',
      recipient: PAYMENT_RECIPIENT,
    }),
    [paymentDetails.bankName, paymentDetails.bankIban, paymentDetails.bankSwift]
  );

  const formatPrice = (amount: number) => `${amount.toLocaleString('en-US')} MKD`;

  const buildInvoiceHtmlFor = (allocation: AllocatedIntent): string =>
    generateInvoiceHtml({
      invoiceNumber: allocation.invoiceNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      plan,
      amount: selectedPlan.priceMkd,
      bankDetails,
      issueDate: allocation.issueDate,
      dueDate: allocation.dueDate,
    });

  const handleGenerateInvoice = () => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      showToast(t('payModalMissingFields'), 'info');
      return;
    }

    setIsGenerating(true);
    try {
      const { id, invoiceNumber } = allocatePaymentIntentRef();
      const now = new Date();
      const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const allocation: AllocatedIntent = {
        id,
        invoiceNumber,
        issueDate: now.toISOString(),
        dueDate: due.toISOString(),
      };

      const opened = openInvoiceInPrintWindow(buildInvoiceHtmlFor(allocation));
      if (!opened) {
        showToast(t('payModalPopupBlocked'), 'error');
        return;
      }

      sendPaymentIntentCreatedEmail(
        customerEmail.trim(),
        customerName.trim(),
        allocation.invoiceNumber,
        selectedPlan.priceMkd,
        plan
      ).catch((error) => {
        console.error('Failed to send payment intent created email:', error);
      });

      setAllocated(allocation);
      showToast(t('payModalInvoiceOpened'), 'success');
      setStep('bank');
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      showToast(t('payModalUploadFailed'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadInvoiceAgain = () => {
    if (!allocated) return;
    openInvoiceInPrintWindow(buildInvoiceHtmlFor(allocated));
  };

  const handleCopyInvoiceNumber = async () => {
    if (!allocated) return;
    try {
      await navigator.clipboard.writeText(allocated.invoiceNumber);
      setCopiedInvoice(true);
      window.setTimeout(() => setCopiedInvoice(false), 2000);
    } catch (error) {
      console.error('Failed to copy invoice number:', error);
    }
  };

  const handleIPaid = async () => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    if (!allocated) return;

    setIsCreating(true);
    try {
      const intent = await createPaymentIntent({
        userId: user.uid,
        email: customerEmail.trim(),
        customerName: customerName.trim(),
        plan,
        amount: selectedPlan.priceMkd,
        invoiceNumber: allocated.invoiceNumber,
        intentId: allocated.id,
      });
      sendPaymentReceivedEmail(customerEmail.trim(), allocated.invoiceNumber).catch((error) => {
        console.error('Failed to send payment received email after intent creation:', error);
      });
      setCreatedIntent(intent);
      setStep('receipt');
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      showToast(t('payModalUploadFailed'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!user || !allocated || !receiptFile) return;

    setIsUploading(true);
    try {
      const dataUrl = await compressReceiptToDataUrl(receiptFile);
      await attachPaymentReceipt(allocated.id, dataUrl);

      sendPaymentReceivedEmail(customerEmail.trim(), allocated.invoiceNumber).catch((error) => {
        console.error('Failed to send payment received email after receipt upload:', error);
      });
      if (createdIntent) {
        sendAdminNotificationEmail({ ...createdIntent, status: 'receipt_uploaded' }).catch((error) => {
          console.error('Failed to send admin payment notification email:', error);
        });
      }
      trackReceiptSubmitted(plan);

      setStep('done');
    } catch (error) {
      console.error('Failed to upload receipt:', error);
      const message =
        error instanceof Error && error.message === 'receipt-too-large'
          ? t('payModalUploadTooLarge')
          : error instanceof Error && error.message === 'receipt-not-image'
            ? t('payModalUploadNotImage')
            : t('payModalUploadFailed');
      showToast(message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setStep('details');
    setAllocated(null);
    setCreatedIntent(null);
    setReceiptFile(null);
    onClose();
  };

  const detailRow = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 border border-slate-200/70 dark:border-white/10 text-sm">
      <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-bold text-slate-900 dark:text-white break-all text-right">{value}</span>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabel={t('payModalTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-white">{t('payModalTitle')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('payModalSubtitle')}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            aria-label={t('payModalClose')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!user && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
              {t('payModalRequiresLogin')}
            </div>
          )}

          {step === 'details' && (
            <>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                  {t('payModalStepPlan')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {pricingPlans.map((option) => (
                    <button
                      key={option.period}
                      type="button"
                      onClick={() => setPlan(option.period)}
                      className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                        plan === option.period
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {option.period === 'monthly' ? t('monthly') : t('annual')}
                      </div>
                      <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                        {formatPrice(option.priceMkd)}
                      </div>
                      {option.savingsLabel && (
                        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 mt-1">
                          {option.savingsLabel}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {t('payModalStepDetails')}
                </div>
                <label className="block space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">{t('payModalCustomerName')}</span>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t('payModalCustomerNamePlaceholder')}
                  />
                </label>
                <label className="block space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">{t('payModalCustomerEmail')}</span>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="you@email.com"
                  />
                </label>
              </div>

              <Button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={isGenerating}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t('payModalGeneratingInvoice')}
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    {t('payModalGenerateInvoice')}
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'bank' && allocated && (
            <>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                  {t('payModalStepBank')}
                </div>
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 px-4 py-3 mb-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                      {t('payModalAmountLabel')}
                    </span>
                    <span className="text-lg font-black text-indigo-900 dark:text-indigo-100">
                      {formatPrice(selectedPlan.priceMkd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                      {t('payModalInvoiceNumber')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <code className="text-sm font-black text-indigo-900 dark:text-indigo-100 tracking-widest">
                        {allocated.invoiceNumber}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyInvoiceNumber}
                        className="inline-flex items-center rounded-md border border-indigo-200 dark:border-indigo-700 p-1.5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                      >
                        {copiedInvoice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-2">{t('payModalReferenceNote')}</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{t('payModalBankNote')}</p>
                <div className="space-y-2">
                  {detailRow(t('invoiceRecipient'), bankDetails.recipient)}
                  {detailRow(t('invoiceBank'), bankDetails.bank)}
                  {detailRow('IBAN', bankDetails.iban)}
                  {detailRow('SWIFT/BIC', bankDetails.swift)}
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={handleIPaid}
                  disabled={isCreating}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t('payModalCreating')}
                    </>
                  ) : (
                    <>
                      <Landmark className="w-4 h-4 mr-2" />
                      {t('payModalIPaid')}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadInvoiceAgain}
                  className="w-full h-11 font-semibold dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {t('payModalDownloadInvoice')}
                </Button>
              </div>
            </>
          )}

          {step === 'receipt' && allocated && (
            <>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                  {t('payModalStepReceipt')}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{t('payModalUploadHint')}</p>
                <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-6 py-8 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors">
                  <Upload className="w-7 h-7 text-indigo-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">
                    {receiptFile ? receiptFile.name : t('payModalUploadButton')}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">JPG / PNG</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <Button
                type="button"
                onClick={handleUploadReceipt}
                disabled={!receiptFile || isUploading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t('payModalUploading')}
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4 mr-2" />
                    {t('payModalUploadButton')}
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'done' && (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
              <div className="text-lg font-black text-slate-900 dark:text-white">{t('payModalSuccessTitle')}</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('payModalSuccessMessage')}</p>
              <Button
                type="button"
                onClick={handleClose}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12"
              >
                {t('payModalClose')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
