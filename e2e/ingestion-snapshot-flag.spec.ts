import { test, expect } from '@playwright/test';

test.describe('Ingestion snapshot persistence flag', () => {
  test('probe route reflects snapshot persistence behavior for both flag branches', async ({ page }) => {
    await page.goto('/__e2e__/ingestion-snapshot', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Ingestion Snapshot Flag Probe' })).toBeVisible({ timeout: 15_000 });

    const envFlagRaw = await page.getByTestId('env-flag-enabled').textContent();
    expect(envFlagRaw === 'true' || envFlagRaw === 'false').toBe(true);

    const payloadFalseRaw = await page.getByTestId('payload-override-false').textContent();
    const payloadTrueRaw = await page.getByTestId('payload-override-true').textContent();

    expect(payloadFalseRaw).toBeTruthy();
    expect(payloadTrueRaw).toBeTruthy();

    const payloadFalse = JSON.parse(payloadFalseRaw || '{}') as Record<string, unknown>;
    const payloadTrue = JSON.parse(payloadTrueRaw || '{}') as Record<string, unknown>;

    expect(payloadFalse.__ingestion_meta).toBeUndefined();
    expect(payloadFalse.ingestion_snapshot).toBeUndefined();

    expect(payloadTrue.__ingestion_meta).toBeUndefined();
    expect(payloadTrue.ingestion_snapshot).toBeDefined();

    const snapshot = payloadTrue.ingestion_snapshot as Record<string, unknown>;
    expect(snapshot.highest_severity).toBe('high');
    expect(snapshot.sanitized).toBe(true);
    expect(Array.isArray(snapshot.finding_ids)).toBe(true);
  });
});
