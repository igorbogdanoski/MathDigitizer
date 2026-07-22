import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection } from 'firebase/firestore';
import { ArrowRight, Check, CheckCircle2, Copy, GraduationCap, Landmark, Sparkles, ShieldCheck, BrainCircuit, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db, signInWithGoogle } from '../lib/firebase';
import { SEO } from './SEO';
import { Button } from './ui/Button';
import { BillingPeriod, getManualPaymentDetails, getProPricingPlans, getUpgradeOptions, UpgradeChannel } from '../lib/saas';
import { sendReceiptNotification } from '../lib/emailService';
import { trackPricingView, trackReceiptSubmitted } from '../lib/analytics';

function buildReferenceCode(uid: string | undefined, period: BillingPeriod): string {
  if (!uid) return '';
  return `${uid.slice(0, 8).toUpperCase()}-PRO-${period === 'annual' ? 'ANN' : 'MON'}`;
}

export const Pricing: React.FC = () => {
  const { t } = useTranslation(['pricing', 'common']);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
  const [receiptRefManuallyEdited, setReceiptRefManuallyEdited] = useState(false);
  const [schoolInquiry, setSchoolInquiry] = useState({
    contactName: '',
    schoolName: '',
    email: user?.email ?? '',
    seatCount: '',
    message: '',
  });
  const [receiptForm, setReceiptForm] = useState({
    payerName: '',
    payerEmail: user?.email ?? '',
    paymentChannel: 'bank' as 'bank' | 'paypal',
    referenceCode: buildReferenceCode(user?.uid, 'annual'),
    note: '',
  });

  useEffect(() => { trackPricingView(); }, []);

  useEffect(() => {
    if (!receiptRefManuallyEdited) {
      setReceiptForm((current) => ({
        ...current,
        referenceCode: buildReferenceCode(user?.uid, billingPeriod),
      }));
    }
  }, [user?.uid, billingPeriod, receiptRefManuallyEdited]);
  const checkoutOptions = getUpgradeOptions();
  const pricingPlans = getProPricingPlans();
  const selectedPlan = pricingPlans.find((plan) => plan.period === billingPeriod) ?? pricingPlans[0];
  const primaryOption = checkoutOptions[0] ?? null;
  const manualPaymentDetails = getManualPaymentDetails();
  const schoolContactEmail = manualPaymentDetails.billingContactEmail ?? manualPaymentDetails.paypalEmail;

  const structuredOffers = pricingPlans.map((plan) => ({
    '@type': 'Offer',
    price: plan.priceMkd.toFixed(2),
    priceCurrency: 'MKD',
    availability: 'https://schema.org/InStock',
    category: plan.period === 'annual' ? 'AnnualSubscription' : 'MonthlySubscription',
    eligibleDuration: plan.period === 'annual' ? 'P1Y' : 'P1M',
    url: 'https://math.mismath.net/pricing',
    name: plan.label,
  }));

  const handleStartCheckout = async (channel?: UpgradeChannel) => {
    if (!user) {
      signInWithGoogle();
      return;
    }

    const selectedOption = channel ? checkoutOptions.find((option) => option.channel === channel) : primaryOption;
    if (!selectedOption) {
      showToast('Checkout не е конфигуриран. Поставете барем еден од VITE_STRIPE_PAYMENT_LINK, VITE_PAYPAL_PAYMENT_LINK или VITE_BANK_TRANSFER_PAYMENT_LINK.', 'info');
      return;
    }

    // Track billing CTA click for funnel telemetry (mirrors Dashboard tracking)
    try {
      await addDoc(collection(db, 'ui_events'), {
        uid: user.uid,
        eventType: 'billing_cta_click',
        source: 'pricing_page_checkout',
        channel: selectedOption.channel,
        billingPeriod,
        planLabel: selectedPlan.label,
        targetPath: selectedOption.link,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Non-blocking — telemetry failure must not interrupt checkout
    }

    setIsRedirecting(true);
    window.location.assign(selectedOption.link);
  };

  const formatPrice = (amount: number) => `${amount.toLocaleString('en-US')} MKD`;
  const schoolMailto = schoolContactEmail
    ? `mailto:${schoolContactEmail}?subject=${encodeURIComponent('MathDigitizer School Plan')}`
    : null;

  const handleCopy = async (label: string, value: string | null | undefined) => {
    if (!value) {
      showToast(`${label} не е достапно.`, 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      showToast(`${label} е копирано.`, 'success');
      window.setTimeout(() => setCopiedField((current) => (current === label ? null : current)), 2000);
    } catch (error) {
      console.error('Failed to copy payment detail:', error);
      showToast(`Не успеа копирање за ${label}.`, 'error');
    }
  };

  const handleSchoolInquiryChange = (field: keyof typeof schoolInquiry, value: string) => {
    setSchoolInquiry((current) => ({ ...current, [field]: value }));
  };

  const handleReceiptFormChange = (field: keyof typeof receiptForm, value: string) => {
    if (field === 'referenceCode') setReceiptRefManuallyEdited(true);
    setReceiptForm((current) => ({ ...current, [field]: value }));
  };

  const handleSchoolInquirySubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = schoolInquiry.contactName.trim();
    const trimmedSchool = schoolInquiry.schoolName.trim();
    const trimmedEmail = schoolInquiry.email.trim();
    const trimmedMessage = schoolInquiry.message.trim();
    const normalizedSeats = schoolInquiry.seatCount.trim();

    if (!trimmedName || !trimmedSchool || !trimmedEmail) {
      showToast('Име, училиште и email се задолжителни.', 'info');
      return;
    }

    setIsSubmittingInquiry(true);
    try {
      await addDoc(collection(db, 'school_inquiries'), {
        contact_name: trimmedName,
        school_name: trimmedSchool,
        email: trimmedEmail,
        seat_count: normalizedSeats,
        message: trimmedMessage,
        requester_uid: user?.uid ?? null,
        billing_period_interest: billingPeriod,
        plan_context: selectedPlan.label,
        created_at: new Date().toISOString(),
        status: 'new',
      });

      setSchoolInquiry({
        contactName: '',
        schoolName: '',
        email: user?.email ?? '',
        seatCount: '',
        message: '',
      });
      showToast('School inquiry е испратен. Ќе те контактираме наскоро.', 'success');
    } catch (error) {
      console.error('Failed to submit school inquiry:', error);
      showToast('Не успеа праќање на school inquiry. Пробај повторно.', 'error');
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  const handleReceiptSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      signInWithGoogle();
      return;
    }

    const trimmedName = receiptForm.payerName.trim();
    const trimmedEmail = receiptForm.payerEmail.trim();
    const trimmedReference = receiptForm.referenceCode.trim();
    const trimmedNote = receiptForm.note.trim();

    if (!trimmedName || !trimmedEmail || !trimmedReference) {
      showToast('Име, email и референца за уплата се задолжителни.', 'info');
      return;
    }

    setIsSubmittingReceipt(true);
    try {
      await addDoc(collection(db, 'payment_receipts'), {
        payer_name: trimmedName,
        payer_email: trimmedEmail,
        payment_channel: receiptForm.paymentChannel,
        reference_code: trimmedReference,
        note: trimmedNote,
        amount_label: `${formatPrice(selectedPlan.priceMkd)} ${selectedPlan.billingLabel}`,
        billing_period_interest: billingPeriod,
        plan_context: selectedPlan.label,
        requester_uid: user.uid,
        created_at: new Date().toISOString(),
        status: 'pending',
      });

      sendReceiptNotification({
        teacher_name: trimmedName,
        teacher_email: trimmedEmail,
        reference_code: trimmedReference,
        plan: selectedPlan.label,
        amount: `${formatPrice(selectedPlan.priceMkd)} ${selectedPlan.billingLabel}`,
      }).catch(() => {});
      trackReceiptSubmitted(billingPeriod);

      setReceiptForm({
        payerName: '',
        payerEmail: user.email ?? '',
        paymentChannel: 'bank',
        referenceCode: '',
        note: '',
      });
      showToast('Доказот за уплата е испратен. Ќе добиеш потврда по проверка.', 'success');
    } catch (error) {
      console.error('Failed to submit payment receipt:', error);
      showToast('Не успеа испраќање на доказ за уплата.', 'error');
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <SEO
        title={t('title')}
        description={t('subtitle')}
        keywords="ценовник, про наставник, годишен план, school licensing, директна банка, едукација, математика, македонија"
        canonical="/pricing"
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'MathDigitizer Pro',
            description: 'SaaS план за напредна AI едукациска продуктивност за наставници и училишта.',
            brand: {
              '@type': 'Brand',
              name: 'MathDigitizer'
            },
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            offers: structuredOffers,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'MathDigitizer School Plan',
            provider: {
              '@type': 'Organization',
              name: 'MathDigitizer',
            },
            areaServed: 'MK',
            offers: {
              '@type': 'Offer',
              priceCurrency: 'MKD',
              availability: 'https://schema.org/InStock',
              description: manualPaymentDetails.schoolPlanLabel,
              url: 'https://math.mismath.net/pricing',
            },
          }
        ]}
      />

      <section className="rounded-3xl p-10 bg-gradient-to-r from-indigo-700 to-blue-700 text-white shadow-2xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-black mb-4">MathDigitizer Pro — Ценовник</h1>
          <p className="text-indigo-100 text-lg leading-relaxed">Еден јасен план за наставници, годишна цена со подобра вредност и школска лиценца по договор. Ова е најчистиот стартен модел за домашен EdTech производ.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-indigo-50">
            <div className="rounded-full bg-white/15 px-4 py-2">490 МКД месечно</div>
            <div className="rounded-full bg-white/15 px-4 py-2">4.900 МКД годишно</div>
            <div className="rounded-full bg-white/15 px-4 py-2">Школски план: по договор</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-8 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Што добивате со Pro Teacher</h2>
            <div className="space-y-4">
              {[
                'Напредна аналитика со подлабоки педагошки сигнали за секој ученик',
                'PDF Фабрика и Фабрика за материјали за побрза масовна изработка',
                'Приоритетни AI генерации за побрза подготовка на часови и тестови',
                'Приоритетна поддршка и рана пристап до идните подобрувања'
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-slate-700 dark:text-slate-200">{item}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3 mt-8">
              <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5">
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Резултат</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">Помалку рачна подготовка</div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Фокус на време-заштеда, не на бескрајна листа од функции.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5">
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Вредност</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">Еден наставник = една лиценца</div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Најлесен модел за стартен производ и најјасен за купување.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5">
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Доверба</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">Локални начини на плаќање</div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">PayPal, директна банка и подоцна Stripe кога ќе биде целосно активен.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Бесплатно</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mb-2">0 МКД</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">Основно користење, добро за проба и прв чекор во апликацијата.</p>
            </div>
            <div className="rounded-3xl border-2 border-indigo-500 dark:border-indigo-400 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-6 shadow-lg dark:shadow-indigo-500/10 relative">
              <div className="absolute -top-3 left-6 rounded-full bg-indigo-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest">Препорачано</div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300 mb-3">Pro Наставник</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mb-2">490 МКД / месечно</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">Најдобар стартен план за индивидуални наставници.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Школски план</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mb-2">По договор</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">За училишта, фактурирање, банкарски трансфер и onboarding по институција.</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-200 dark:border-indigo-700/40 bg-indigo-50 dark:bg-indigo-900/20 p-8 shadow-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-4 h-4" /> {selectedPlan.featured ? 'Најдобра вредност' : 'Pro'}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/70 dark:bg-white/5 p-2 border border-indigo-100 dark:border-indigo-800/60 mb-6">
            {pricingPlans.map((plan) => (
              <button
                key={plan.period}
                type="button"
                onClick={() => setBillingPeriod(plan.period)}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition-colors ${billingPeriod === plan.period ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                title={plan.description}
              >
                {plan.period === 'monthly' ? t('monthly') : t('annual')}
              </button>
            ))}
          </div>

          <div className="text-sm font-bold text-slate-500 dark:text-slate-300 mb-1">{selectedPlan.label}</div>
          <div className="text-4xl font-black text-slate-900 dark:text-white mb-1">{formatPrice(selectedPlan.priceMkd)}</div>
          <div className="text-sm text-slate-500 dark:text-slate-300 mb-2">{selectedPlan.billingLabel}</div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{selectedPlan.description}</p>

          {selectedPlan.savingsLabel && selectedPlan.savingsAmountMkd ? (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
              {selectedPlan.savingsLabel} · заштедуваш {formatPrice(selectedPlan.savingsAmountMkd)} годишно.
            </div>
          ) : null}

          {primaryOption ? (
            <Button onClick={() => handleStartCheckout(primaryOption.channel)} disabled={isRedirecting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 mb-4">
              {isRedirecting ? 'Пренасочување...' : `${selectedPlan.ctaLabel} преку ${primaryOption.label.replace('Плати со ', '')}`}
            </Button>
          ) : null}

          <div className="w-full mb-4 flex items-start gap-2.5 rounded-xl bg-slate-100/80 dark:bg-white/5 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              Плаќање преку PayPal или директен банкарски трансфер (инструкции подолу). По прикачување потврда за уплата, Pro пристапот се активира рачно — обично во рок од неколку часа.
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {checkoutOptions.filter((option) => option !== primaryOption).map((option) => (
              <Button
                key={option.channel}
                onClick={() => handleStartCheckout(option.channel)}
                disabled={isRedirecting}
                variant="outline"
                className="w-full h-11 font-semibold dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                title={option.description}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-300 space-y-2">
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Поддржани канали: Stripe, PayPal и директна банка (според конфигурација)</div>
            <div className="flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Целта е јасна вредност за наставникот, а не сложен ценовник</div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="font-bold text-slate-900 dark:text-white">Рачни податоци за Pro Teacher уплата</div>

            {user && (
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  Ваша референца за уплата
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-base font-black text-indigo-900 dark:text-indigo-100 tracking-widest">
                    {buildReferenceCode(user.uid, billingPeriod)}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy('Референца', buildReferenceCode(user.uid, billingPeriod))}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 dark:border-indigo-700 px-2.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                    title={t('common:ariaCopyReference')}
                  >
                    {copiedField === 'Референца' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'Референца' ? 'Копирано' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1.5">Задолжително напишете ја оваа референца при банкарска уплата или PayPal порака.</p>
              </div>
            )}

            {[
              { label: 'PayPal email', value: manualPaymentDetails.paypalEmail },
              { label: 'Банка', value: manualPaymentDetails.bankName },
              { label: 'Сметка', value: manualPaymentDetails.bankAccountNumber },
              { label: 'IBAN', value: manualPaymentDetails.bankIban },
              { label: 'SWIFT/BIC', value: manualPaymentDetails.bankSwift },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/80 dark:bg-white/5 px-3 py-2 border border-slate-200/70 dark:border-white/10">
                <div>
                  <span className="font-semibold">{item.label}:</span>{' '}
                  <span>{item.value ?? 'Ќе биде додадено наскоро'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(item.label, item.value)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  title={`Копирај ${item.label}`}
                >
                  {copiedField === item.label ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedField === item.label ? 'Копирано' : 'Copy'}
                </button>
              </div>
            ))}
            <div><span className="font-semibold">Износ:</span> {formatPrice(selectedPlan.priceMkd)} {selectedPlan.billingLabel}</div>
          </div>

          <form onSubmit={handleReceiptSubmit} className="mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 space-y-3 text-sm">
            <div className="font-bold text-slate-900 dark:text-white">Испрати доказ за уплата</div>
            <label className="block space-y-1 text-slate-700 dark:text-slate-200">
              <span className="font-semibold">Име на уплатувач</span>
              <input
                type="text"
                value={receiptForm.payerName}
                onChange={(event) => handleReceiptFormChange('payerName', event.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Име и презиме"
              />
            </label>
            <label className="block space-y-1 text-slate-700 dark:text-slate-200">
              <span className="font-semibold">Email</span>
              <input
                type="email"
                value={receiptForm.payerEmail}
                onChange={(event) => handleReceiptFormChange('payerEmail', event.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@email.com"
              />
            </label>
            <label className="block space-y-1 text-slate-700 dark:text-slate-200">
              <span className="font-semibold">Канал на уплата</span>
              <select
                value={receiptForm.paymentChannel}
                onChange={(event) => handleReceiptFormChange('paymentChannel', event.target.value as 'bank' | 'paypal')}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                title={t('common:ariaSelectPaymentChannel')}
              >
                <option value="bank">Банкарска трансакција</option>
                <option value="paypal">PayPal</option>
              </select>
            </label>
            <label className="block space-y-1 text-slate-700 dark:text-slate-200">
              <span className="font-semibold">Референца / број на трансакција</span>
              <input
                type="text"
                value={receiptForm.referenceCode}
                onChange={(event) => handleReceiptFormChange('referenceCode', event.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Пр. TRX-2026-001"
              />
            </label>
            <label className="block space-y-1 text-slate-700 dark:text-slate-200">
              <span className="font-semibold">Забелешка (опционално)</span>
              <textarea
                value={receiptForm.note}
                onChange={(event) => handleReceiptFormChange('note', event.target.value)}
                className="w-full min-h-20 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Дополнителни детали за уплатата"
              />
            </label>
            <Button type="submit" disabled={isSubmittingReceipt} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11">
              {isSubmittingReceipt ? 'Испраќање...' : 'Испрати доказ'}
            </Button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Landmark className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">School / Institution Plan</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-300 mb-6">За училишта, најдобар светски модел е рачен договор: invoice, bank transfer, onboarding и лиценцирање според потребите на институцијата.</p>
          <div className="space-y-3 mb-6 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Фактура и директна банкарска уплата</div>
            <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Онбординг за наставнички тимови</div>
            <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Прилагоден договор и цена по потреба</div>
          </div>
          {schoolMailto ? (
            <a href={schoolMailto} className="inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
              Контактирај за school plan <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          ) : null}
          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">Статус: {manualPaymentDetails.schoolPlanLabel}</div>

          <form onSubmit={handleSchoolInquirySubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
            <div className="text-sm font-bold text-slate-900 dark:text-white">Испрати school inquiry</div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Контакт лице</span>
                <input
                  type="text"
                  value={schoolInquiry.contactName}
                  onChange={(event) => handleSchoolInquiryChange('contactName', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Име и презиме"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Училиште / институција</span>
                <input
                  type="text"
                  value={schoolInquiry.schoolName}
                  onChange={(event) => handleSchoolInquiryChange('schoolName', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Име на институција"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Email</span>
                <input
                  type="email"
                  value={schoolInquiry.email}
                  onChange={(event) => handleSchoolInquiryChange('email', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="contact@school.edu.mk"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Број на наставници</span>
                <input
                  type="text"
                  value={schoolInquiry.seatCount}
                  onChange={(event) => handleSchoolInquiryChange('seatCount', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Пр. 12"
                />
              </label>
            </div>
            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200 block">
              <span className="font-semibold">Порака</span>
              <textarea
                value={schoolInquiry.message}
                onChange={(event) => handleSchoolInquiryChange('message', event.target.value)}
                className="w-full min-h-28 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Кажи ни што ви треба: onboarding, фактура, број на одделенија, рокови..."
              />
            </label>
            <Button type="submit" disabled={isSubmittingInquiry} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12">
              {isSubmittingInquiry ? 'Испраќање...' : 'Испрати school inquiry'}
            </Button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Како да почнеш</h2>
          </div>
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
              <div className="font-bold text-slate-900 dark:text-white mb-1">1. Почни бесплатно</div>
              <div>Тестирај core workflow и види дали реално ти штеди време во подготовка.</div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
              <div className="font-bold text-slate-900 dark:text-white mb-1">2. Премини на Pro Teacher</div>
              <div>Кога ќе почувствуваш вредност, избери месечно или годишно и задржи едноставен billing модел.</div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
              <div className="font-bold text-slate-900 dark:text-white mb-1">3. Потоа school rollout</div>
              <div>За институции оди со manual sales и фактура, не со комплициран self-serve model прерано.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};