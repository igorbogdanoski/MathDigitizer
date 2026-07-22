export type InquiryStatus = 'new' | 'contacted' | 'closed';
export type ReceiptStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';
export type KpiPeriod = 'day' | 'week' | 'month';

export interface SchoolInquiry {
  id: string;
  contact_name: string;
  school_name: string;
  email: string;
  seat_count?: string;
  message?: string;
  requester_uid?: string | null;
  billing_period_interest: 'monthly' | 'annual';
  plan_context: string;
  created_at: string;
  status: InquiryStatus;
}

export interface PaymentReceipt {
  id: string;
  payer_name: string;
  payer_email: string;
  payment_channel: 'bank' | 'paypal';
  reference_code: string;
  note?: string;
  amount_label: string;
  billing_period_interest: 'monthly' | 'annual';
  plan_context: string;
  requester_uid: string;
  created_at: string;
  status: ReceiptStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_note?: string;
}

export interface SalesOpsAlertState {
  dashboard_id: 'school_inquiries';
  acknowledged_signature: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  updated_at: string;
}

export interface BillingCtaTelemetryEvent {
  id: string;
  eventType?: string;
  createdAt?: string;
}

export type OpsAlertLevel = 'warning' | 'critical';

export interface OpsAlert {
  id: string;
  message: string;
  level: OpsAlertLevel;
}

export const STATUS_OPTIONS: InquiryStatus[] = ['new', 'contacted', 'closed'];
export const RECEIPT_STATUS_OPTIONS: ReceiptStatus[] = ['pending', 'reviewed', 'approved', 'rejected'];

export const inquiryStatusPriority: Record<InquiryStatus, number> = {
  new: 0,
  contacted: 1,
  closed: 2,
};

export const receiptStatusPriority: Record<ReceiptStatus, number> = {
  pending: 0,
  reviewed: 1,
  approved: 2,
  rejected: 3,
};

export const statusChipClass = (status: InquiryStatus) => {
  if (status === 'new') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'contacted') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
};

export const receiptStatusChipClass = (status: ReceiptStatus) => {
  if (status === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (status === 'reviewed') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
};

export const statusLabel = (status: InquiryStatus, t: (key: string) => string) => {
  if (status === 'new') return t('statusNew');
  if (status === 'contacted') return t('statusContacted');
  return t('statusClosed');
};

export const receiptStatusLabel = (status: ReceiptStatus, t: (key: string) => string) => {
  if (status === 'pending') return t('receiptStatusPending');
  if (status === 'reviewed') return t('receiptStatusReviewed');
  if (status === 'approved') return t('receiptStatusApproved');
  return t('receiptStatusRejected');
};

export const getKpiPeriodLabels = (t: (key: string) => string): Record<KpiPeriod, string> => ({
  day: t('kpiToday'),
  week: t('kpiThisWeek'),
  month: t('kpiThisMonth'),
});

export const toTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const escapeCsvCell = (value: string | number | null | undefined) => {
  const asString = String(value ?? '');
  if (asString.includes('"') || asString.includes(',') || asString.includes('\n')) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
};

export const downloadCsvFile = (fileName: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) => {
  const csvLines = [headers.map((header) => escapeCsvCell(header)).join(',')];

  rows.forEach((row) => {
    csvLines.push(row.map((cell) => escapeCsvCell(cell)).join(','));
  });

  const csvContent = csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const getPeriodStart = (period: KpiPeriod, now: Date) => {
  const start = new Date(now);

  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }

  if (period === 'week') {
    const day = start.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
};

export const readAlertThreshold = (envKey: string, fallback: number) => {
  const raw = (import.meta as any)?.env?.[envKey];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const PENDING_ALERT_THRESHOLD = readAlertThreshold('VITE_PENDING_ALERT_THRESHOLD', 8);
export const PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD = readAlertThreshold('VITE_PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD', 1);
export const BILLING_CTA_CONVERSION_ALERT_THRESHOLD = readAlertThreshold('VITE_BILLING_CTA_CONVERSION_ALERT_THRESHOLD', 0.8);
export const BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD = readAlertThreshold('VITE_BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD', 0.5);

export const buildSparklinePath = (values: number[], width: number, height: number) => {
  if (values.length === 0) return '';
  const maxValue = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / maxValue) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

export const getPreviousPeriodRange = (period: KpiPeriod, now: Date) => {
  const currentStart = getPeriodStart(period, now);

  if (period === 'day') {
    const previousStart = currentStart - 24 * 60 * 60 * 1000;
    return { start: previousStart, end: currentStart };
  }

  if (period === 'week') {
    const previousStart = currentStart - 7 * 24 * 60 * 60 * 1000;
    return { start: previousStart, end: currentStart };
  }

  const currentStartDate = new Date(currentStart);
  const previousStartDate = new Date(currentStartDate);
  previousStartDate.setMonth(previousStartDate.getMonth() - 1);
  return { start: previousStartDate.getTime(), end: currentStart };
};

export const formatDelta = (value: number) => {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${value}`;
};
