import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { TFunction } from 'i18next';
import { Button } from '../ui/Button';

export interface BillingHealthBadge {
  label: string;
  className: string;
}

export interface BillingGuideItem {
  key: string;
  title: string;
  description: string;
  isActive: boolean;
}

interface BillingHealthSectionProps {
  billingHealthBadge: BillingHealthBadge;
  billingCtaLabel: string | null;
  billingGuideItems: BillingGuideItem[];
  activeGuideItem: BillingGuideItem;
  latestApprovedReceiptAt: string | null;
  hasPendingReceipt: boolean;
  formatReceiptTimestamp: (iso?: string | null) => string | null;
  onTrackBillingCta: () => void;
  t: TFunction<'dashboard'>;
}

export const BillingHealthSection: React.FC<BillingHealthSectionProps> = ({
  billingHealthBadge,
  billingCtaLabel,
  billingGuideItems,
  activeGuideItem,
  latestApprovedReceiptAt,
  hasPendingReceipt,
  formatReceiptTimestamp,
  onTrackBillingCta,
  t,
}) => {
  return (
    <>
      {latestApprovedReceiptAt ? (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <div className="text-sm font-black text-emerald-800 dark:text-emerald-200">{t('proActivated')}</div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{t('proActivatedDesc')}</p>
            </div>
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              {t('activatedAt')} {formatReceiptTimestamp(latestApprovedReceiptAt)}
            </div>
          </div>
        </section>
      ) : null}

      {!latestApprovedReceiptAt && hasPendingReceipt ? (
        <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 md:p-5">
          <div className="text-sm font-black text-amber-800 dark:text-amber-200">{t('paymentInReview')}</div>
          <p className="text-sm text-amber-700 dark:text-amber-300">{t('paymentInReviewDesc')}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <AlertTriangle className="w-4 h-4 text-slate-500 dark:text-slate-300" />
            {t('billingHealth')}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${billingHealthBadge.className}`}>
              {billingHealthBadge.label}
            </span>
            {billingCtaLabel ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                onClick={onTrackBillingCta}
              >
                {billingCtaLabel}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            <Info className="w-3.5 h-3.5" />
            {t('statusGuide')}
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-200 mb-2">
            <span className="font-semibold">{t('currentFocus')}</span> {activeGuideItem.title} - {activeGuideItem.description}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {billingGuideItems.map((item) => (
              <div
                key={item.key}
                className={`rounded-lg px-2.5 py-2 border ${item.isActive ? 'border-indigo-300 dark:border-indigo-400/30 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-300' : 'border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}
              >
                <span className="font-semibold">{item.title}:</span> {item.description}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
