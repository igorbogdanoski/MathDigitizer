import React from 'react';
import { Clock3, FileText, Mail } from 'lucide-react';
import { Button } from '../ui/Button';
import { RECEIPT_STATUS_OPTIONS, receiptStatusChipClass, receiptStatusLabel } from './types';
import type { PaymentReceipt, ReceiptStatus } from './types';

interface ReceiptCardProps {
  receipt: PaymentReceipt;
  savingReceiptId: string | null;
  reviewNote: string;
  onReviewNoteChange: (id: string, note: string) => void;
  onUpdateStatus: (receipt: PaymentReceipt, status: ReceiptStatus) => void;
  onDownloadInvoice: (receipt: PaymentReceipt) => void;
  t: (key: string) => string;
}

export const ReceiptCard: React.FC<ReceiptCardProps> = ({
  receipt,
  savingReceiptId,
  reviewNote,
  onReviewNoteChange,
  onUpdateStatus,
  onDownloadInvoice,
  t,
}) => (
  <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 md:p-6 shadow-sm">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${receiptStatusChipClass(receipt.status)}`}>
            {receiptStatusLabel(receipt.status, t)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock3 className="w-3.5 h-3.5" />
            {receipt.created_at}
          </span>
        </div>

        <h3 className="text-xl font-black text-slate-900 dark:text-white">{receipt.payer_name}</h3>

        <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-500" /> {receipt.payer_email}</div>
          <div>{t('channelLabel')} <span className="font-semibold">{receipt.payment_channel === 'bank' ? t('bankChannel') : 'PayPal'}</span></div>
          <div>{t('referenceLabel')} <span className="font-semibold">{receipt.reference_code}</span></div>
          <div>{t('amountLabel')} <span className="font-semibold">{receipt.amount_label}</span></div>
          <div>{t('planLabel')} <span className="font-semibold">{receipt.plan_context}</span> ({receipt.billing_period_interest})</div>
          {receipt.note ? <div className="text-slate-600 dark:text-slate-300">{t('noteLabel')} {receipt.note}</div> : null}
        </div>
      </div>

      <div className="w-full md:w-56 space-y-2">
        <label className="block space-y-1 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold">{t('reviewNoteLabel')}</span>
          <textarea
            value={reviewNote}
            onChange={(event) => onReviewNoteChange(receipt.id, event.target.value)}
            className="w-full min-h-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t('reviewNotePlaceholder')}
          />
        </label>

        {RECEIPT_STATUS_OPTIONS.map((statusOption) => (
          <Button
            key={statusOption}
            type="button"
            variant={receipt.status === statusOption ? 'default' : 'outline'}
            disabled={savingReceiptId === receipt.id || receipt.status === statusOption}
            onClick={() => onUpdateStatus(receipt, statusOption)}
            className="w-full h-10"
          >
            {receiptStatusLabel(statusOption, t)}
          </Button>
        ))}

        {(receipt.status === 'approved' || receipt.status === 'reviewed') && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onDownloadInvoice(receipt)}
            className="w-full h-10 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
          >
            <FileText className="w-4 h-4 mr-2" />
            {t('invoicePdf')}
          </Button>
        )}
      </div>
    </div>

    {(receipt.reviewed_by || receipt.reviewed_at || receipt.review_note) ? (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-300">
        <div>{t('reviewedBy')} {receipt.reviewed_by ?? 'N/A'}</div>
        <div>{t('reviewedAt')} {receipt.reviewed_at ?? 'N/A'}</div>
        <div>{t('reviewNoteResult')} {receipt.review_note || t('noNote')}</div>
      </div>
    ) : null}
  </article>
);
