import React from 'react';
import { CheckCircle2, Clock3, Mail, School, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { STATUS_OPTIONS, statusChipClass, statusLabel } from './types';
import type { InquiryStatus, SchoolInquiry } from './types';

interface InquiryCardProps {
  inquiry: SchoolInquiry;
  savingId: string | null;
  onUpdateStatus: (id: string, status: InquiryStatus) => void;
  t: (key: string) => string;
}

export const InquiryCard: React.FC<InquiryCardProps> = ({ inquiry, savingId, onUpdateStatus, t }) => (
  <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 md:p-6 shadow-sm">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusChipClass(inquiry.status)}`}>
            {statusLabel(inquiry.status, t)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock3 className="w-3.5 h-3.5" />
            {inquiry.created_at}
          </span>
        </div>

        <h2 className="text-xl font-black text-slate-900 dark:text-white">{inquiry.school_name}</h2>

        <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <div className="flex items-center gap-2"><School className="w-4 h-4 text-indigo-500" /> {t('contactLabel')} {inquiry.contact_name}</div>
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-500" /> {inquiry.email}</div>
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> {t('teachersLabel')} {inquiry.seat_count || 'N/A'}</div>
          <div>{t('planLabel')} <span className="font-semibold">{inquiry.plan_context}</span> ({inquiry.billing_period_interest})</div>
          {inquiry.message ? <div className="text-slate-600 dark:text-slate-300">{t('messageLabel')} {inquiry.message}</div> : null}
        </div>
      </div>

      <div className="w-full md:w-56 space-y-2">
        {STATUS_OPTIONS.map((statusOption) => (
          <Button
            key={statusOption}
            type="button"
            variant={inquiry.status === statusOption ? 'default' : 'outline'}
            disabled={savingId === inquiry.id || inquiry.status === statusOption}
            onClick={() => onUpdateStatus(inquiry.id, statusOption)}
            className="w-full h-10"
          >
            {inquiry.status === statusOption ? <CheckCircle2 className="w-4 h-4 mr-2" /> : null}
            {statusLabel(statusOption, t)}
          </Button>
        ))}
      </div>
    </div>
  </article>
);
