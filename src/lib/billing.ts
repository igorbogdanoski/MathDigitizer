export interface BillingHistoryEntry {
  id: string;
  created_at?: unknown;
  kind: 'receipt' | 'intent';
  [key: string]: unknown;
}

function getTimestampMillis(value: unknown): number {
  if (!value) return 0;

  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.toDate === 'function') {
      const dateValue = (record.toDate as () => Date)();
      return dateValue instanceof Date ? dateValue.getTime() : 0;
    }

    if (typeof record.seconds === 'number') {
      const seconds = record.seconds;
      const nanoseconds = typeof record.nanoseconds === 'number' ? record.nanoseconds : 0;
      return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
    }
  }

  return 0;
}

export function mergeBillingActivity<T extends { id: string; created_at?: unknown }>(
  receipts: T[],
  intents: T[]
): BillingHistoryEntry[] {
  const entries: BillingHistoryEntry[] = [
    ...receipts.map((item) => ({ ...item, kind: 'receipt' as const })),
    ...intents.map((item) => ({ ...item, kind: 'intent' as const })),
  ];

  return entries.sort((a, b) => {
    const aTime = getTimestampMillis(a.created_at);
    const bTime = getTimestampMillis(b.created_at);
    return bTime - aTime;
  });
}
