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
import mkLibrary from './locales/mk/library.json';
import mkExtraction from './locales/mk/extraction.json';
import mkDashboard from './locales/mk/dashboard.json';
import mkFlashcards from './locales/mk/flashcards.json';
import mkGradebook from './locales/mk/gradebook.json';

import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enPricing from './locales/en/pricing.json';
import enHome from './locales/en/home.json';
import enLibrary from './locales/en/library.json';
import enExtraction from './locales/en/extraction.json';
import enDashboard from './locales/en/dashboard.json';
import enFlashcards from './locales/en/flashcards.json';
import enGradebook from './locales/en/gradebook.json';

import alCommon from './locales/al/common.json';
import alNavigation from './locales/al/navigation.json';
import alPricing from './locales/al/pricing.json';
import alHome from './locales/al/home.json';
import alLibrary from './locales/al/library.json';
import alExtraction from './locales/al/extraction.json';
import alDashboard from './locales/al/dashboard.json';
import alFlashcards from './locales/al/flashcards.json';
import alGradebook from './locales/al/gradebook.json';

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
        library: mkLibrary,
        extraction: mkExtraction,
        dashboard: mkDashboard,
        flashcards: mkFlashcards,
        gradebook: mkGradebook,
      },
      en: {
        common: enCommon,
        navigation: enNavigation,
        pricing: enPricing,
        home: enHome,
        library: enLibrary,
        extraction: enExtraction,
        dashboard: enDashboard,
        flashcards: enFlashcards,
        gradebook: enGradebook,
      },
      al: {
        common: alCommon,
        navigation: alNavigation,
        pricing: alPricing,
        home: alHome,
        library: alLibrary,
        extraction: alExtraction,
        dashboard: alDashboard,
        flashcards: alFlashcards,
        gradebook: alGradebook,
      },
    },
    fallbackLng: 'mk',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'pricing', 'home', 'library', 'extraction', 'dashboard', 'flashcards', 'gradebook'],
    
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
