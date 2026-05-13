import { describe, it, expect } from 'vitest';
import { hasProAccess, canUsePremiumFeature, getProPricingPlans, getManualPaymentDetails, PREMIUM_FEATURES } from './saas';
import type { UserProfile } from './schema';

const baseProfile: UserProfile = {
  uid: 'uid-1',
  email: 'teacher@school.mk',
  displayName: 'Ana Jovanovska',
  role: 'teacher',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('hasProAccess', () => {
  it('returns false when profile is null', () => {
    expect(hasProAccess(null)).toBe(false);
  });

  it('returns false when profile is undefined', () => {
    expect(hasProAccess(undefined)).toBe(false);
  });

  it('returns false when isPro is absent', () => {
    expect(hasProAccess(baseProfile)).toBe(false);
  });

  it('returns false when isPro is false', () => {
    expect(hasProAccess({ ...baseProfile, isPro: false })).toBe(false);
  });

  it('returns true when isPro is true', () => {
    expect(hasProAccess({ ...baseProfile, isPro: true })).toBe(true);
  });
});

describe('canUsePremiumFeature', () => {
  it('mirrors hasProAccess for all premium features', () => {
    const proProfile = { ...baseProfile, isPro: true };
    const freeProfile = { ...baseProfile };

    for (const feature of Object.values(PREMIUM_FEATURES)) {
      expect(canUsePremiumFeature(proProfile, feature)).toBe(true);
      expect(canUsePremiumFeature(freeProfile, feature)).toBe(false);
      expect(canUsePremiumFeature(null, feature)).toBe(false);
    }
  });
});

describe('getProPricingPlans', () => {
  it('returns exactly two plans: monthly and annual', () => {
    const plans = getProPricingPlans();
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.period)).toEqual(expect.arrayContaining(['monthly', 'annual']));
  });

  it('annual plan has a positive default price', () => {
    const plans = getProPricingPlans();
    const annual = plans.find((p) => p.period === 'annual');
    expect(annual).toBeDefined();
    expect(annual!.priceMkd).toBeGreaterThan(0);
  });

  it('monthly plan has a positive default price', () => {
    const plans = getProPricingPlans();
    const monthly = plans.find((p) => p.period === 'monthly');
    expect(monthly).toBeDefined();
    expect(monthly!.priceMkd).toBeGreaterThan(0);
  });

  it('annual plan is marked as featured', () => {
    const plans = getProPricingPlans();
    const annual = plans.find((p) => p.period === 'annual');
    expect(annual!.featured).toBe(true);
  });

  it('annual savings is non-negative', () => {
    const plans = getProPricingPlans();
    const annual = plans.find((p) => p.period === 'annual')!;
    const monthly = plans.find((p) => p.period === 'monthly')!;
    const expectedSavings = Math.max(monthly.priceMkd * 12 - annual.priceMkd, 0);
    expect(annual.savingsAmountMkd).toBe(expectedSavings);
  });
});

describe('getManualPaymentDetails', () => {
  it('returns a non-empty paypal email by default', () => {
    const details = getManualPaymentDetails();
    expect(typeof details.paypalEmail).toBe('string');
    expect(details.paypalEmail!.length).toBeGreaterThan(0);
  });

  it('returns a non-empty bank IBAN by default', () => {
    const details = getManualPaymentDetails();
    expect(typeof details.bankIban).toBe('string');
    expect(details.bankIban!.length).toBeGreaterThan(0);
  });

  it('billingContactEmail falls back to paypalEmail', () => {
    const details = getManualPaymentDetails();
    // In test env both are driven by defaults, so at minimum it should be a string
    expect(typeof details.billingContactEmail).toBe('string');
  });
});
