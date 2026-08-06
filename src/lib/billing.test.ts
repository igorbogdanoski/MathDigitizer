import { describe, expect, it } from 'vitest';
import { mergeBillingActivity } from './billing';

describe('mergeBillingActivity', () => {
  it('sorts entries correctly when created_at is a Firestore-style timestamp object', () => {
    const receipts = [
      {
        id: 'receipt-1',
        created_at: { toDate: () => new Date('2024-01-01T00:00:00.000Z') },
      },
    ];

    const intents = [
      {
        id: 'intent-1',
        created_at: { seconds: 1704067201, nanoseconds: 0 },
      },
    ];

    const result = mergeBillingActivity(receipts as any, intents as any);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'intent-1', kind: 'intent' });
    expect(result[1]).toMatchObject({ id: 'receipt-1', kind: 'receipt' });
  });
});
