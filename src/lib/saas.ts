import { UserProfile } from './schema';

export const PREMIUM_FEATURES = {
  advancedAnalytics: 'advanced_analytics',
  unlimitedExtraction: 'unlimited_extraction',
  priorityGeneration: 'priority_generation',
} as const;

export type PremiumFeature = typeof PREMIUM_FEATURES[keyof typeof PREMIUM_FEATURES];
export type BillingPeriod = 'monthly' | 'annual';

const TRIAL_DAYS = 7;

export function trialDaysRemaining(profile: UserProfile | null | undefined): number {
  if (!profile?.trialStartedAt || profile.isPro) return 0;
  const started = new Date(profile.trialStartedAt).getTime();
  const elapsed = Math.floor((Date.now() - started) / 86_400_000);
  return Math.max(0, TRIAL_DAYS - elapsed);
}

export function isOnTrial(profile: UserProfile | null | undefined): boolean {
  return trialDaysRemaining(profile) > 0;
}

const ADMIN_EMAIL = (import.meta as any)?.env?.VITE_ADMIN_EMAIL as string | undefined;

export function hasProAccess(profile: UserProfile | null | undefined): boolean {
  if (ADMIN_EMAIL && profile?.email === ADMIN_EMAIL) return true;
  return Boolean(profile?.isPro) || isOnTrial(profile);
}

function readCheckoutLink(envKey: string): string | null {
  const raw = (import.meta as any)?.env?.[envKey];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvString(envKey: string): string | null {
  const raw = (import.meta as any)?.env?.[envKey];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvNumber(envKey: string): number | null {
  const raw = readEnvString(envKey);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getUpgradeLink(): string | null {
  return readCheckoutLink('VITE_STRIPE_PAYMENT_LINK');
}

export function getPayPalUpgradeLink(): string | null {
  return readCheckoutLink('VITE_PAYPAL_PAYMENT_LINK');
}

export function getBankTransferUpgradeLink(): string | null {
  return readCheckoutLink('VITE_BANK_TRANSFER_PAYMENT_LINK');
}

export type UpgradeChannel = 'stripe' | 'paypal' | 'bank';

export interface UpgradeOption {
  channel: UpgradeChannel;
  label: string;
  description: string;
  link: string;
}

export interface ProPricingPlan {
  period: BillingPeriod;
  label: string;
  priceMkd: number;
  billingLabel: string;
  description: string;
  ctaLabel: string;
  savingsAmountMkd?: number;
  savingsLabel?: string;
  featured?: boolean;
}

export interface ManualPaymentDetails {
  paypalEmail: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIban: string | null;
  bankSwift: string | null;
  billingContactEmail: string | null;
  schoolPlanLabel: string;
}

export function getProPricingPlans(): ProPricingPlan[] {
  const monthlyPrice = readEnvNumber('VITE_PRO_MONTHLY_PRICE_MKD') ?? 490;
  const annualPrice = readEnvNumber('VITE_PRO_ANNUAL_PRICE_MKD') ?? 4900;
  const annualSavings = Math.max(monthlyPrice * 12 - annualPrice, 0);

  return [
    {
      period: 'monthly',
      label: 'Pro Teacher Monthly',
      priceMkd: monthlyPrice,
      billingLabel: 'месечно',
      description: 'За индивидуални наставници што сакаат низок влезен праг и флексибилност.',
      ctaLabel: 'Започни месечно',
    },
    {
      period: 'annual',
      label: 'Pro Teacher Annual',
      priceMkd: annualPrice,
      billingLabel: 'годишно',
      description: 'Најдобра вредност за наставници што ќе работат со платформата цела година.',
      ctaLabel: 'Заклучи годишна цена',
      savingsAmountMkd: annualSavings,
      savingsLabel: annualSavings > 0 ? 'Заштеда од речиси 2 месеци' : undefined,
      featured: true,
    },
  ];
}

export function getUpgradeOptions(): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  const stripe = getUpgradeLink();
  const paypal = getPayPalUpgradeLink();
  const bank = getBankTransferUpgradeLink();

  if (stripe) {
    options.push({
      channel: 'stripe',
      label: 'Плати со Stripe',
      description: 'Картичка и брз checkout.',
      link: stripe,
    });
  }

  if (paypal) {
    options.push({
      channel: 'paypal',
      label: 'Плати со PayPal',
      description: 'PayPal checkout опција.',
      link: paypal,
    });
  }

  if (bank) {
    options.push({
      channel: 'bank',
      label: 'Директна банкарска трансакција',
      description: 'Уплата преку банка со инструкции.',
      link: bank,
    });
  }

  return options;
}

export function getManualPaymentDetails(): ManualPaymentDetails {
  const billingContactEmail = readEnvString('VITE_BILLING_CONTACT_EMAIL') ?? readEnvString('VITE_PAYPAL_EMAIL') ?? 'igor.bogdanoski@mismath.net';

  return {
    paypalEmail: readEnvString('VITE_PAYPAL_EMAIL') ?? 'igor.bogdanoski@mismath.net',
    bankName: readEnvString('VITE_BANK_NAME') ?? 'NLB Bank',
    bankAccountNumber: readEnvString('VITE_BANK_ACCOUNT_NUMBER') ?? '210501596102457',
    bankIban: readEnvString('VITE_BANK_IBAN') ?? 'MK07210501596102457',
    bankSwift: readEnvString('VITE_BANK_SWIFT') ?? 'TUTNMK22',
    billingContactEmail,
    schoolPlanLabel: readEnvString('VITE_SCHOOL_PLAN_LABEL') ?? 'По договор / фактура',
  };
}

export function canUsePremiumFeature(profile: UserProfile | null | undefined, _feature: PremiumFeature): boolean {
  return hasProAccess(profile);
}
