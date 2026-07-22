import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Clock3, Download, FileText, Mail, School, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../lib/firebase';
import { sendProActivationEmail } from '../lib/emailService';
import { trackProActivated } from '../lib/analytics';
import { SEO } from './SEO';
import { useToast } from '../contexts/ToastContext';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';

type InquiryStatus = 'new' | 'contacted' | 'closed';
type ReceiptStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';
type KpiPeriod = 'day' | 'week' | 'month';

interface SchoolInquiry {
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
  requester_uid: string;
  created_at: string;
  status: ReceiptStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_note?: string;
}

interface SalesOpsAlertState {
  dashboard_id: 'school_inquiries';
  acknowledged_signature: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  updated_at: string;
}

interface BillingCtaTelemetryEvent {
  id: string;
  eventType?: string;
  createdAt?: string;
}

type OpsAlertLevel = 'warning' | 'critical';

interface OpsAlert {
  id: string;
  message: string;
  level: OpsAlertLevel;
}

const STATUS_OPTIONS: InquiryStatus[] = ['new', 'contacted', 'closed'];
const RECEIPT_STATUS_OPTIONS: ReceiptStatus[] = ['pending', 'reviewed', 'approved', 'rejected'];

const inquiryStatusPriority: Record<InquiryStatus, number> = {
  new: 0,
  contacted: 1,
  closed: 2,
};

const receiptStatusPriority: Record<ReceiptStatus, number> = {
  pending: 0,
  reviewed: 1,
  approved: 2,
  rejected: 3,
};

const statusChipClass = (status: InquiryStatus) => {
  if (status === 'new') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'contacted') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
};

const receiptStatusChipClass = (status: ReceiptStatus) => {
  if (status === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (status === 'reviewed') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
};

const toTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const escapeCsvCell = (value: string | number | null | undefined) => {
  const asString = String(value ?? '');
  if (asString.includes('"') || asString.includes(',') || asString.includes('\n')) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
};

const downloadCsvFile = (fileName: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) => {
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

const getPeriodStart = (period: KpiPeriod, now: Date) => {
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

const readAlertThreshold = (envKey: string, fallback: number) => {
  const raw = (import.meta as any)?.env?.[envKey];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const PENDING_ALERT_THRESHOLD = readAlertThreshold('VITE_PENDING_ALERT_THRESHOLD', 8);
const PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD = readAlertThreshold('VITE_PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD', 1);
const BILLING_CTA_CONVERSION_ALERT_THRESHOLD = readAlertThreshold('VITE_BILLING_CTA_CONVERSION_ALERT_THRESHOLD', 0.8);
const BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD = readAlertThreshold('VITE_BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD', 0.5);

const buildSparklinePath = (values: number[], width: number, height: number) => {
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

const getPreviousPeriodRange = (period: KpiPeriod, now: Date) => {
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

const formatDelta = (value: number) => {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${value}`;
};

export const SchoolInquiriesDashboard: React.FC = () => {
  const { t, i18n } = useTranslation('schoolInquiries');
  const dateLocale = i18n.language === 'al' ? 'sq-AL' : i18n.language === 'en' ? 'en-US' : 'mk-MK';
  const { user } = useAuth();
  const { showToast } = useToast();

  const statusLabel = (status: InquiryStatus) => {
    if (status === 'new') return t('statusNew');
    if (status === 'contacted') return t('statusContacted');
    return t('statusClosed');
  };

  const receiptStatusLabel = (status: ReceiptStatus) => {
    if (status === 'pending') return t('receiptStatusPending');
    if (status === 'reviewed') return t('receiptStatusReviewed');
    if (status === 'approved') return t('receiptStatusApproved');
    return t('receiptStatusRejected');
  };

  const KPI_PERIOD_LABELS: Record<KpiPeriod, string> = {
    day: t('kpiToday'),
    week: t('kpiThisWeek'),
    month: t('kpiThisMonth'),
  };
  const [inquiries, setInquiries] = useState<SchoolInquiry[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingReceiptId, setSavingReceiptId] = useState<string | null>(null);
  const [receiptReviewNotes, setReceiptReviewNotes] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [acknowledgedAlertSignature, setAcknowledgedAlertSignature] = useState<string | null>(null);
  const [acknowledgedBy, setAcknowledgedBy] = useState<string | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [billingCtaEvents, setBillingCtaEvents] = useState<BillingCtaTelemetryEvent[]>([]);

  useEffect(() => {
    const inquiriesQuery = query(collection(db, 'school_inquiries'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      inquiriesQuery,
      (snapshot) => {
        const next = snapshot.docs.map((inquiryDoc) => {
          const data = inquiryDoc.data() as Omit<SchoolInquiry, 'id'>;
          return {
            id: inquiryDoc.id,
            ...data,
          };
        });
        setInquiries(next);
        setLastUpdatedAt(new Date().toISOString());
      },
      (error) => {
        console.error('Failed to load school inquiries:', error);
        showToast(t('toastLoadInquiriesError'), 'error');
      }
    );

    return () => unsubscribe();
  }, [showToast, t]);

  useEffect(() => {
    const receiptsQuery = query(collection(db, 'payment_receipts'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      receiptsQuery,
      (snapshot) => {
        const next = snapshot.docs.map((receiptDoc) => {
          const data = receiptDoc.data() as Omit<PaymentReceipt, 'id'>;
          return {
            id: receiptDoc.id,
            ...data,
          };
        });
        setReceipts(next);
        setLastUpdatedAt(new Date().toISOString());
      },
      (error) => {
        console.error('Failed to load payment receipts:', error);
        showToast(t('toastLoadReceiptsError'), 'error');
      }
    );

    return () => unsubscribe();
  }, [showToast, t]);

  useEffect(() => {
    const telemetryQuery = query(
      collection(db, 'ui_events'),
      where('eventType', '==', 'billing_cta_click'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      telemetryQuery,
      (snapshot) => {
        const next = snapshot.docs.map((eventDoc) => {
          const data = eventDoc.data() as BillingCtaTelemetryEvent;
          return { ...data, id: eventDoc.id };
        });
        setBillingCtaEvents(next);
      },
      (error) => {
        console.error('Failed to load billing CTA telemetry:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredInquiries = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    return inquiries
      .filter((inquiry) => {
        const statusMatches = activeStatusFilter === 'all' || inquiry.status === activeStatusFilter;
        if (!statusMatches) return false;
        if (!normalized) return true;

        const haystack = [inquiry.school_name, inquiry.contact_name, inquiry.email, inquiry.message ?? ''].join(' ').toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => {
        const priorityDelta = inquiryStatusPriority[a.status] - inquiryStatusPriority[b.status];
        if (priorityDelta !== 0) return priorityDelta;
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
      });
  }, [activeStatusFilter, inquiries, searchQuery]);

  const filteredReceipts = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    return receipts
      .filter((receipt) => {
        if (!normalized) return true;

        const haystack = [receipt.payer_name, receipt.payer_email, receipt.reference_code, receipt.plan_context].join(' ').toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => {
        const priorityDelta = receiptStatusPriority[a.status] - receiptStatusPriority[b.status];
        if (priorityDelta !== 0) return priorityDelta;
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
      });
  }, [receipts, searchQuery]);

  const counters = useMemo(() => {
    return inquiries.reduce(
      (acc, inquiry) => {
        acc[inquiry.status] += 1;
        return acc;
      },
      { new: 0, contacted: 0, closed: 0 }
    );
  }, [inquiries]);

  const receiptCounters = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        acc[receipt.status] += 1;
        return acc;
      },
      { pending: 0, reviewed: 0, approved: 0, rejected: 0 }
    );
  }, [receipts]);

  const kpiSnapshot = useMemo(() => {
    const now = new Date();
    const periods: KpiPeriod[] = ['day', 'week', 'month'];

    return periods.map((period) => {
      const startTimestamp = getPeriodStart(period, now);

      const periodInquiries = inquiries.filter((inquiry) => toTimestamp(inquiry.created_at) >= startTimestamp);
      const periodReceipts = receipts.filter((receipt) => toTimestamp(receipt.created_at) >= startTimestamp);
      const previousRange = getPreviousPeriodRange(period, now);
      const previousInquiries = inquiries.filter((inquiry) => {
        const timestamp = toTimestamp(inquiry.created_at);
        return timestamp >= previousRange.start && timestamp < previousRange.end;
      });
      const previousReceipts = receipts.filter((receipt) => {
        const timestamp = toTimestamp(receipt.created_at);
        return timestamp >= previousRange.start && timestamp < previousRange.end;
      });

      const inquiryCounts = periodInquiries.reduce(
        (acc, inquiry) => {
          acc[inquiry.status] += 1;
          return acc;
        },
        { new: 0, contacted: 0, closed: 0 }
      );

      const receiptCounts = periodReceipts.reduce(
        (acc, receipt) => {
          acc[receipt.status] += 1;
          return acc;
        },
        { pending: 0, reviewed: 0, approved: 0, rejected: 0 }
      );

      const resolvedReceipts = receiptCounts.reviewed + receiptCounts.approved + receiptCounts.rejected;
      const approvalRate = resolvedReceipts > 0 ? Math.round((receiptCounts.approved / resolvedReceipts) * 100) : 0;
      const previousReceiptCounts = previousReceipts.reduce(
        (acc, receipt) => {
          acc[receipt.status] += 1;
          return acc;
        },
        { pending: 0, reviewed: 0, approved: 0, rejected: 0 }
      );
      const previousResolvedReceipts = previousReceiptCounts.reviewed + previousReceiptCounts.approved + previousReceiptCounts.rejected;
      const previousApprovalRate = previousResolvedReceipts > 0 ? Math.round((previousReceiptCounts.approved / previousResolvedReceipts) * 100) : 0;

      return {
        period,
        label: KPI_PERIOD_LABELS[period],
        inquiriesTotal: periodInquiries.length,
        inquiriesDelta: periodInquiries.length - previousInquiries.length,
        inquiryCounts,
        receiptsTotal: periodReceipts.length,
        receiptsDelta: periodReceipts.length - previousReceipts.length,
        receiptCounts,
        approvalRate,
        approvalRateDelta: approvalRate - previousApprovalRate,
      };
    });
  }, [inquiries, receipts, KPI_PERIOD_LABELS]);

  const sevenDayTrend = useMemo(() => {
    const days = 7;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const labels: string[] = [];
    const inquiriesByDay: number[] = [];
    const approvedByDay: number[] = [];
    const pendingByDay: number[] = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const dayStart = new Date(startOfToday);
      dayStart.setDate(startOfToday.getDate() - offset);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      const dayStartTs = dayStart.getTime();
      const dayEndTs = dayEnd.getTime();

      const dayInquiries = inquiries.filter((inquiry) => {
        const timestamp = toTimestamp(inquiry.created_at);
        return timestamp >= dayStartTs && timestamp < dayEndTs;
      }).length;

      const dayApproved = receipts.filter((receipt) => {
        const timestamp = toTimestamp(receipt.created_at);
        return timestamp >= dayStartTs && timestamp < dayEndTs && receipt.status === 'approved';
      }).length;

      const dayPending = receipts.filter((receipt) => {
        const timestamp = toTimestamp(receipt.created_at);
        return timestamp >= dayStartTs && timestamp < dayEndTs && receipt.status === 'pending';
      }).length;

      labels.push(dayStart.toLocaleDateString(dateLocale, { weekday: 'short' }));
      inquiriesByDay.push(dayInquiries);
      approvedByDay.push(dayApproved);
      pendingByDay.push(dayPending);
    }

    return {
      labels,
      inquiriesByDay,
      approvedByDay,
      pendingByDay,
      inquiriesPath: buildSparklinePath(inquiriesByDay, 100, 28),
      approvedPath: buildSparklinePath(approvedByDay, 100, 28),
      pendingPath: buildSparklinePath(pendingByDay, 100, 28),
    };
  }, [inquiries, receipts, dateLocale]);

  const billingCtaKpis = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayTs = startOfToday.getTime();
    const sevenDaysAgoTs = startOfTodayTs - 6 * 24 * 60 * 60 * 1000;

    const timestamps = billingCtaEvents
      .map((event) => toTimestamp(event.createdAt))
      .filter((timestamp) => timestamp > 0);

    const todayCount = timestamps.filter((timestamp) => timestamp >= startOfTodayTs).length;
    const weekCount = timestamps.filter((timestamp) => timestamp >= sevenDaysAgoTs).length;

    const weekPendingReceipts = receipts.filter((receipt) => {
      const createdAtTs = toTimestamp(receipt.created_at);
      return createdAtTs >= sevenDaysAgoTs && receipt.status === 'pending';
    }).length;

    const weekConversionRatio = weekPendingReceipts > 0 ? weekCount / weekPendingReceipts : null;

    return {
      todayCount,
      weekCount,
      totalCount: billingCtaEvents.length,
      weekPendingReceipts,
      weekConversionRatio,
      weekConversionRatioLabel: weekConversionRatio === null ? 'N/A' : `${weekConversionRatio.toFixed(2)}x`,
    };
  }, [billingCtaEvents, receipts]);

  const opsAlerts = useMemo(() => {
    const alerts: OpsAlert[] = [];
    if (receiptCounters.pending >= PENDING_ALERT_THRESHOLD) {
      alerts.push({
        id: 'pending-threshold',
        message: t('alertPendingThreshold', { count: receiptCounters.pending, threshold: PENDING_ALERT_THRESHOLD }),
        level: 'warning',
      });
    }

    const approvedBase = Math.max(receiptCounters.approved, 1);
    const pendingToApprovedRatio = receiptCounters.pending / approvedBase;
    if (pendingToApprovedRatio > PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD && receiptCounters.pending > 0) {
      alerts.push({
        id: 'pending-approved-ratio',
        message: t('alertPendingApprovedRatio', { ratio: pendingToApprovedRatio.toFixed(2), threshold: PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD }),
        level: 'warning',
      });
    }

    if (
      billingCtaKpis.weekConversionRatio !== null &&
      billingCtaKpis.weekConversionRatio < BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD
    ) {
      alerts.push({
        id: 'billing-conversion-critical',
        message: t('alertBillingConversionCritical', { ratio: billingCtaKpis.weekConversionRatio.toFixed(2), threshold: BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD.toFixed(2) }),
        level: 'critical',
      });
    } else if (
      billingCtaKpis.weekConversionRatio !== null &&
      billingCtaKpis.weekConversionRatio < BILLING_CTA_CONVERSION_ALERT_THRESHOLD
    ) {
      alerts.push({
        id: 'billing-conversion-warning',
        message: t('alertBillingConversionWarning', { ratio: billingCtaKpis.weekConversionRatio.toFixed(2), threshold: BILLING_CTA_CONVERSION_ALERT_THRESHOLD.toFixed(2) }),
        level: 'warning',
      });
    }
    return alerts;
  }, [billingCtaKpis.weekConversionRatio, receiptCounters, t]);

  const highestAlertLevel = useMemo<OpsAlertLevel | null>(() => {
    if (opsAlerts.length === 0) return null;
    return opsAlerts.some((alert) => alert.level === 'critical') ? 'critical' : 'warning';
  }, [opsAlerts]);

  const alertCounts = useMemo(() => {
    return opsAlerts.reduce(
      (acc, alert) => {
        acc[alert.level] += 1;
        return acc;
      },
      { warning: 0, critical: 0 }
    );
  }, [opsAlerts]);

  const activeAlertSignature = useMemo(() => {
    if (opsAlerts.length === 0) return null;
    return opsAlerts.map((alert) => `${alert.level}:${alert.id}:${alert.message}`).join('|');
  }, [opsAlerts]);

  useEffect(() => {
    const alertStateRef = doc(db, 'sales_ops_alert_state', 'school_inquiries');

    const unsubscribe = onSnapshot(
      alertStateRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setAcknowledgedAlertSignature(null);
          setAcknowledgedBy(null);
          setAcknowledgedAt(null);
          return;
        }

        const data = snapshot.data() as Partial<SalesOpsAlertState>;
        setAcknowledgedAlertSignature(typeof data.acknowledged_signature === 'string' ? data.acknowledged_signature : null);
        setAcknowledgedBy(typeof data.acknowledged_by === 'string' ? data.acknowledged_by : null);
        setAcknowledgedAt(typeof data.acknowledged_at === 'string' ? data.acknowledged_at : null);
      },
      (error) => {
        console.error('Failed to read shared alert acknowledgement:', error);
        showToast(t('toastLoadAckError'), 'error');
      }
    );

    return () => unsubscribe();
  }, [showToast, t]);

  const persistAlertAcknowledgement = async (signature: string | null) => {
    if (!user) {
      showToast(t('toastLoginRequiredAck'), 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const alertStateRef = doc(db, 'sales_ops_alert_state', 'school_inquiries');

    try {
      await setDoc(
        alertStateRef,
        {
          dashboard_id: 'school_inquiries',
          acknowledged_signature: signature,
          acknowledged_by: signature ? user.uid : null,
          acknowledged_at: signature ? nowIso : null,
          updated_at: nowIso,
        } as SalesOpsAlertState,
        { merge: true }
      );
    } catch (error) {
      console.error('Failed to persist shared alert acknowledgement:', error);
      showToast(t('toastSaveAckError'), 'error');
    }
  };

  const handleAcknowledgeAlerts = async () => {
    if (!activeAlertSignature) return;
    await persistAlertAcknowledgement(activeAlertSignature);
    showToast(t('toastAlertsAcknowledged'), 'success');
  };

  const handleReopenAlerts = async () => {
    await persistAlertAcknowledgement(null);
  };

  const isAlertAcknowledged = Boolean(activeAlertSignature && acknowledgedAlertSignature === activeAlertSignature);

  const lastAcknowledgementLabel = useMemo(() => {
    if (!acknowledgedAt) return t('noAcknowledgeYet');
    const actor = acknowledgedBy ?? 'N/A';
    return `${actor} at ${new Date(acknowledgedAt).toLocaleString(dateLocale)}`;
  }, [acknowledgedAt, acknowledgedBy, t, dateLocale]);

  const alertHealthBadge = useMemo(() => {
    const hasCriticalAlerts = opsAlerts.some((alert) => alert.level === 'critical');

    if (opsAlerts.length === 0) {
      return {
        label: t('noActiveAlerts'),
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
      };
    }

    if (isAlertAcknowledged) {
      return {
        label: t('acknowledgedBadge'),
        className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      };
    }

    if (acknowledgedAt) {
      return {
        label: t('newSinceAcknowledge'),
        className: hasCriticalAlerts
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      };
    }

    return {
      label: hasCriticalAlerts ? t('criticalAlerts') : t('activeAlerts'),
      className: hasCriticalAlerts
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    };
  }, [acknowledgedAt, isAlertAcknowledged, opsAlerts, t]);

  const currentPendingToApprovedRatio = useMemo(() => {
    const approvedBase = Math.max(receiptCounters.approved, 1);
    return receiptCounters.pending / approvedBase;
  }, [receiptCounters]);

  const handleDownloadInvoice = (receipt: PaymentReceipt) => {
    const invoiceNumber = `MD-${receipt.id.slice(0, 8).toUpperCase()}`;
    const issueDate = new Date(receipt.reviewed_at ?? receipt.created_at).toLocaleDateString(dateLocale);
    const html = `<!DOCTYPE html>
<html lang="mk">
<head>
<meta charset="UTF-8"/>
<title>${t('invoicePdf')} ${invoiceNumber}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f46e5; padding-bottom: 24px; margin-bottom: 32px; }
  .brand { font-size: 28px; font-weight: 900; color: #4f46e5; }
  .brand-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h1 { font-size: 22px; font-weight: 900; color: #1e293b; margin: 0 0 8px; }
  .invoice-meta p { margin: 2px 0; font-size: 13px; color: #475569; }
  .status-badge { display: inline-block; background: #dcfce7; color: #166534; border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-top: 8px; }
  section { margin-bottom: 28px; }
  h2 { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .info-item span { font-size: 14px; font-weight: 600; color: #1e293b; }
  .amount-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
  .amount-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  .amount-row:last-child { border-bottom: none; font-size: 18px; font-weight: 900; color: #4f46e5; }
  .amount-row:last-child .label { color: #1e293b; font-weight: 700; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MathDigitizer Pro</div>
      <div class="brand-sub">mathdigitizer.pro · igor.bogdanoski@mismath.net</div>
      <div class="brand-sub">Игор Богданоски · NLB Bank · IBAN MK07210501596102457 · SWIFT TUTNMK22</div>
    </div>
    <div class="invoice-meta">
      <h1>${t('invoiceTitle')}</h1>
      <p><strong>${t('invoiceNumber')}</strong> ${invoiceNumber}</p>
      <p><strong>${t('invoiceDate')}</strong> ${issueDate}</p>
      <p><strong>${t('invoiceReference')}</strong> ${receipt.reference_code}</p>
      <div class="status-badge">${t('invoicePaid')}</div>
    </div>
  </div>

  <section>
    <h2>${t('invoiceBuyerInfo')}</h2>
    <div class="info-grid">
      <div class="info-item"><label>Ime i prezime</label><span>${receipt.payer_name}</span></div>
      <div class="info-item"><label>Email</label><span>${receipt.payer_email}</span></div>
      <div class="info-item"><label>${t('invoicePaymentChannel')}</label><span>${receipt.payment_channel === 'bank' ? t('invoiceBankTransfer') : 'PayPal'}</span></div>
      <div class="info-item"><label>${t('invoiceReference')}</label><span>${receipt.reference_code}</span></div>
    </div>
  </section>

  <section>
    <h2>${t('invoiceServiceDescription')}</h2>
    <div class="amount-box">
      <div class="amount-row">
        <span class="label">${t('invoiceProduct')}</span>
        <span>${receipt.plan_context}</span>
      </div>
      <div class="amount-row">
        <span class="label">${t('invoicePeriod')}</span>
        <span>${receipt.billing_period_interest === 'annual' ? t('invoiceAnnualSubscription') : t('invoiceMonthlySubscription')}</span>
      </div>
      ${receipt.review_note ? `<div class="amount-row"><span class="label">${t('invoiceNote')}</span><span>${receipt.review_note}</span></div>` : ''}
      <div class="amount-row">
        <span class="label">${t('invoiceTotal')}</span>
        <span>${receipt.amount_label}</span>
      </div>
    </div>
  </section>

  <div class="footer">
    ${t('invoiceFooter')} · MathDigitizer Pro © ${new Date().getFullYear()}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleUpdateStatus = async (inquiryId: string, nextStatus: InquiryStatus) => {
    setSavingId(inquiryId);
    try {
      await updateDoc(doc(db, 'school_inquiries', inquiryId), { status: nextStatus });
      showToast(t('toastStatusUpdated'), 'success');
    } catch (error) {
      console.error('Failed to update inquiry status:', error);
      showToast(t('toastStatusUpdateError'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateReceiptStatus = async (receipt: PaymentReceipt, nextStatus: ReceiptStatus) => {
    if (!user) {
      showToast(t('toastLoginRequiredReview'), 'error');
      return;
    }

    const reviewNote = (receiptReviewNotes[receipt.id] ?? '').trim();

    setSavingReceiptId(receipt.id);
    try {
      await updateDoc(doc(db, 'payment_receipts', receipt.id), {
        status: nextStatus,
        reviewed_by: user.uid,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote,
      });

      if (nextStatus === 'approved' && receipt.requester_uid) {
        const proStartedAt = new Date().toISOString();
        const proEndsAt = receipt.billing_period_interest === 'annual'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

        await updateDoc(doc(db, 'users', receipt.requester_uid), {
          isPro: true,
          proStartedAt,
          proEndsAt,
          paymentChannel: receipt.payment_channel,
        });
        sendProActivationEmail({
          teacher_name: receipt.payer_name,
          teacher_email: receipt.payer_email,
          reference_code: receipt.reference_code,
          plan: receipt.plan_context ?? '',
          amount: receipt.amount_label ?? '',
        }).catch(() => {});
        trackProActivated(receipt.plan_context ?? 'unknown');
      }

      showToast(t('toastReceiptStatusUpdated'), 'success');
    } catch (error) {
      console.error('Failed to update receipt status:', error);
      showToast(t('toastReceiptStatusError'), 'error');
    } finally {
      setSavingReceiptId(null);
    }
  };

  const handleExportInquiriesCsv = () => {
    if (filteredInquiries.length === 0) {
      showToast(t('toastNoInquiriesExport'), 'info');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsvFile(
      `school-inquiries-${timestamp}.csv`,
      ['id', 'status', 'created_at', 'school_name', 'contact_name', 'email', 'seat_count', 'plan_context', 'billing_period_interest', 'message'],
      filteredInquiries.map((inquiry) => [
        inquiry.id,
        inquiry.status,
        inquiry.created_at,
        inquiry.school_name,
        inquiry.contact_name,
        inquiry.email,
        inquiry.seat_count ?? '',
        inquiry.plan_context,
        inquiry.billing_period_interest,
        inquiry.message ?? '',
      ])
    );
    showToast(t('toastInquiriesCsvDownloaded'), 'success');
  };

  const handleExportReceiptsCsv = () => {
    if (filteredReceipts.length === 0) {
      showToast(t('toastNoReceiptsExport'), 'info');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsvFile(
      `payment-receipts-${timestamp}.csv`,
      ['id', 'status', 'created_at', 'payer_name', 'payer_email', 'payment_channel', 'reference_code', 'amount_label', 'plan_context', 'billing_period_interest', 'reviewed_by', 'reviewed_at', 'review_note'],
      filteredReceipts.map((receipt) => [
        receipt.id,
        receipt.status,
        receipt.created_at,
        receipt.payer_name,
        receipt.payer_email,
        receipt.payment_channel,
        receipt.reference_code,
        receipt.amount_label,
        receipt.plan_context,
        receipt.billing_period_interest,
        receipt.reviewed_by ?? '',
        receipt.reviewed_at ?? '',
        receipt.review_note ?? '',
      ])
    );
    showToast(t('toastReceiptsCsvDownloaded'), 'success');
  };

  const handleExportKpiCsv = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsvFile(
      `sales-kpi-${timestamp}.csv`,
      [
        'period',
        'inquiries_total',
        'inquiries_new',
        'inquiries_contacted',
        'inquiries_closed',
        'receipts_total',
        'receipts_pending',
        'receipts_reviewed',
        'receipts_approved',
        'receipts_rejected',
        'approval_rate_percent',
        'delta_inquiries_total',
        'delta_receipts_total',
        'delta_approval_rate_percent',
      ],
      kpiSnapshot.map((entry) => [
        entry.label,
        entry.inquiriesTotal,
        entry.inquiryCounts.new,
        entry.inquiryCounts.contacted,
        entry.inquiryCounts.closed,
        entry.receiptsTotal,
        entry.receiptCounts.pending,
        entry.receiptCounts.reviewed,
        entry.receiptCounts.approved,
        entry.receiptCounts.rejected,
        entry.approvalRate,
        entry.inquiriesDelta,
        entry.receiptsDelta,
        entry.approvalRateDelta,
      ])
    );
    showToast(t('toastKpiCsvDownloaded'), 'success');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <SEO
        title={t('seoTitle')}
        description={t('seoDescription')}
        keywords="school inquiries, sales inbox, school licensing, leads"
        canonical="/school-inquiries"
        noindex
      />

      <section className="rounded-3xl p-8 md:p-10 bg-gradient-to-r from-slate-900 to-indigo-900 text-white border border-slate-800 shadow-2xl">
        <h1 className="text-3xl md:text-4xl font-black mb-3">{t('inboxTitle')}</h1>
        <p className="text-slate-200 max-w-3xl">{t('inboxDescription')}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('statusNew')}</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{counters.new}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('statusContacted')}</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{counters.contacted}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('statusClosed')}</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{counters.closed}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">{t('kpiSnapshot')}</h2>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${alertHealthBadge.className}`}>
              {alertHealthBadge.label}
            </span>
            <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
              <div>{t('lastUpdated')} {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString(dateLocale) : 'N/A'}</div>
              <div>{t('lastAcknowledged')} {lastAcknowledgementLabel}</div>
            </div>
            <Button type="button" variant="outline" className="h-10" onClick={handleExportKpiCsv}>
              <Download className="w-4 h-4 mr-2" />
              {t('exportKpiCsv')}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('alertPolicy')}</div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm text-slate-700 dark:text-slate-200">
            <div>
              <span className="font-semibold">{t('pendingThreshold')}</span> {PENDING_ALERT_THRESHOLD}
            </div>
            <div>
              <span className="font-semibold">{t('ratioThreshold')}</span> {PENDING_TO_APPROVED_RATIO_ALERT_THRESHOLD}
            </div>
            <div>
              <span className="font-semibold">{t('currentRatio')}</span> {currentPendingToApprovedRatio.toFixed(2)}
            </div>
            <div>
              <span className="font-semibold">{t('conversionThreshold')}</span> {BILLING_CTA_CONVERSION_ALERT_THRESHOLD.toFixed(2)}x
            </div>
            <div>
              <span className="font-semibold">{t('criticalThresholdLabel')}</span> {BILLING_CTA_CONVERSION_CRITICAL_THRESHOLD.toFixed(2)}x
            </div>
            <div>
              <span className="font-semibold">{t('currentConversion')}</span> {billingCtaKpis.weekConversionRatioLabel}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('billingCtaSignal')}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-slate-700 dark:text-slate-200">
            <div>
              <span className="font-semibold">{t('clicksToday')}</span> {billingCtaKpis.todayCount}
            </div>
            <div>
              <span className="font-semibold">{t('clicksLast7Days')}</span> {billingCtaKpis.weekCount}
            </div>
            <div>
              <span className="font-semibold">{t('clicksTotal')}</span> {billingCtaKpis.totalCount}
            </div>
            <div>
              <span className="font-semibold">{t('conversion7d')}</span> {billingCtaKpis.weekConversionRatioLabel}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('baselineLabel', { count: billingCtaKpis.weekPendingReceipts })}
          </div>
        </div>

        {opsAlerts.length > 0 && !isAlertAcknowledged ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('opsAlerts')}
                </div>
                {highestAlertLevel ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${highestAlertLevel === 'critical' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}
                  >
                    {highestAlertLevel === 'critical' ? `${t('criticalAlerts')} (${alertCounts.critical})` : `${t('activeAlerts')} (${alertCounts.warning})`}
                  </span>
                ) : null}
              </div>
              <Button type="button" variant="outline" className="h-8 px-3" onClick={handleAcknowledgeAlerts}>
                {t('acknowledge')}
              </Button>
            </div>
            {opsAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`text-sm ${alert.level === 'critical' ? 'text-rose-800 dark:text-rose-200 font-semibold' : 'text-amber-800 dark:text-amber-200'}`}
              >
                {alert.message}
              </div>
            ))}
          </div>
        ) : null}

        {opsAlerts.length > 0 && isAlertAcknowledged ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 flex items-center justify-between gap-2">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              {t('alertsAcknowledged')}
              {acknowledgedAt ? (
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {`By ${acknowledgedBy ?? 'N/A'} at ${new Date(acknowledgedAt).toLocaleString(dateLocale)}`}
                </span>
              ) : null}
            </div>
            <Button type="button" variant="outline" className="h-8 px-3" onClick={handleReopenAlerts}>
              {t('showAlerts')}
            </Button>
          </div>
        ) : null}

        <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('sevenDayTrend')}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-700 p-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('trendInquiries')}</div>
              <svg viewBox="0 0 100 28" className="w-full h-10" role="img" aria-label="Inquiries trend">
                <path d={sevenDayTrend.inquiriesPath} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-700 p-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('trendApprovedReceipts')}</div>
              <svg viewBox="0 0 100 28" className="w-full h-10" role="img" aria-label="Approved receipts trend">
                <path d={sevenDayTrend.approvedPath} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-700 p-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('trendPendingReceipts')}</div>
              <svg viewBox="0 0 100 28" className="w-full h-10" role="img" aria-label="Pending receipts trend">
                <path d={sevenDayTrend.pendingPath} fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{sevenDayTrend.labels.join(' · ')}</div>
        </article>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {kpiSnapshot.map((entry) => (
            <article key={entry.period} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{entry.label}</div>
              <div className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">{t('kpiInquiries')}</span> {entry.inquiriesTotal} ({t('kpiInquiriesDetail', { new: entry.inquiryCounts.new, contacted: entry.inquiryCounts.contacted, closed: entry.inquiryCounts.closed })})
              </div>
              <div className={`text-xs font-semibold ${entry.inquiriesDelta > 0 ? 'text-emerald-700 dark:text-emerald-300' : entry.inquiriesDelta < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {t('vsPreviousPeriod')} {formatDelta(entry.inquiriesDelta)} {t('trendInquiries').toLowerCase()}
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">{t('kpiReceipts')}</span> {entry.receiptsTotal} ({t('kpiReceiptsDetail', { pending: entry.receiptCounts.pending, approved: entry.receiptCounts.approved })})
              </div>
              <div className={`text-xs font-semibold ${entry.receiptsDelta > 0 ? 'text-emerald-700 dark:text-emerald-300' : entry.receiptsDelta < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {t('vsPreviousPeriod')} {formatDelta(entry.receiptsDelta)} {t('kpiReceipts').toLowerCase().replace(':', '')}
              </div>
              <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{t('kpiApprovalRate')} {entry.approvalRate}%</div>
              <div className={`text-xs font-semibold ${entry.approvalRateDelta > 0 ? 'text-emerald-700 dark:text-emerald-300' : entry.approvalRateDelta < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {t('vsPreviousPeriod')} {formatDelta(entry.approvalRateDelta)} pp
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {(['all', ...STATUS_OPTIONS] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setActiveStatusFilter(status)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${activeStatusFilter === status ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}
              >
                {status === 'all' ? t('statusAll') : statusLabel(status)}
              </button>
            ))}
          </div>

          <label className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-9 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('schoolInquiries')}</h2>
          <Button type="button" variant="outline" className="h-10" onClick={handleExportInquiriesCsv}>
            <Download className="w-4 h-4 mr-2" />
            {t('exportCsv')}
          </Button>
        </div>

        {filteredInquiries.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
            {t('noInquiries')}
          </div>
        ) : (
          filteredInquiries.map((inquiry) => (
            <article key={inquiry.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 md:p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusChipClass(inquiry.status)}`}>
                      {statusLabel(inquiry.status)}
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
                      onClick={() => handleUpdateStatus(inquiry.id, statusOption)}
                      className="w-full h-10"
                    >
                      {inquiry.status === statusOption ? <CheckCircle2 className="w-4 h-4 mr-2" /> : null}
                      {statusLabel(statusOption)}
                    </Button>
                  ))}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('paymentReceipts')}</h2>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">{t('totalLabel')} {filteredReceipts.length}</div>
            <Button type="button" variant="outline" className="h-10" onClick={handleExportReceiptsCsv}>
              <Download className="w-4 h-4 mr-2" />
              {t('exportCsv')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">{t('receiptStatusPending')}</div>
            <div className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">{receiptCounters.pending}</div>
          </div>
          <div className="rounded-xl border border-blue-200/70 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">{t('receiptStatusReviewed')}</div>
            <div className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">{receiptCounters.reviewed}</div>
          </div>
          <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">{t('receiptStatusApproved')}</div>
            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">{receiptCounters.approved}</div>
          </div>
          <div className="rounded-xl border border-rose-200/70 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/20 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-300">{t('receiptStatusRejected')}</div>
            <div className="text-2xl font-black text-rose-900 dark:text-rose-100 mt-1">{receiptCounters.rejected}</div>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
            {t('noReceipts')}
          </div>
        ) : (
          filteredReceipts.map((receipt) => (
            <article key={receipt.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 md:p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${receiptStatusChipClass(receipt.status)}`}>
                      {receiptStatusLabel(receipt.status)}
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
                      value={receiptReviewNotes[receipt.id] ?? ''}
                      onChange={(event) => setReceiptReviewNotes((current) => ({ ...current, [receipt.id]: event.target.value }))}
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
                      onClick={() => handleUpdateReceiptStatus(receipt, statusOption)}
                      className="w-full h-10"
                    >
                      {receiptStatusLabel(statusOption)}
                    </Button>
                  ))}

                  {(receipt.status === 'approved' || receipt.status === 'reviewed') && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDownloadInvoice(receipt)}
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
          ))
        )}
      </section>
    </div>
  );
};
