/**
 * i18n Configuration — MathDigitizer Pro
 * 
 * Supported languages:
 * - mk (Македонски) — default
 * - al (Albanian) — high priority for MK market (25% population)
 * - en (English) — international/diaspora
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import mkCommon from './locales/mk/common.json';
import mkNavigation from './locales/mk/navigation.json';
import mkPricing from './locales/mk/pricing.json';
import mkHome from './locales/mk/home.json';

import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enPricing from './locales/en/pricing.json';
import enHome from './locales/en/home.json';

import alCommon from './locales/al/common.json';
import alNavigation from './locales/al/navigation.json';
import alPricing from './locales/al/pricing.json';
import alHome from './locales/al/home.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'mk', name: 'Македонски', flag: '🇲🇰' },
  { code: 'al', name: 'Albanian', flag: '🇦🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      mk: {
        common: mkCommon,
        navigation: mkNavigation,
        pricing: mkPricing,
        home: mkHome,
      },
      en: {
        common: enCommon,
        navigation: enNavigation,
        pricing: enPricing,
        home: enHome,
      },
      al: {
        common: alCommon,
        navigation: alNavigation,
        pricing: alPricing,
        home: alHome,
      },
    },
    fallbackLng: 'mk',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'pricing', 'home'],
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mathdigitizer_language',
    },
    
    interpolation: {
      escapeValue: false, // React already escapes
    },
    
    react: {
      useSuspense: false, // Avoid suspense boundaries for now
    },
  });

export default i18n;
