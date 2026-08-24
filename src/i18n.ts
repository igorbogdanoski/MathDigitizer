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
import mkDifferentiation from './locales/mk/differentiation.json';
import mkEarlyWarning from './locales/mk/earlyWarning.json';
import mkBilling from './locales/mk/billing.json';
import mkSchoolInquiries from './locales/mk/schoolInquiries.json';
import mkSmartOcr from './locales/mk/smartOcr.json';
import mkSmartGrader from './locales/mk/smartGrader.json';
import mkGraphDigitizer from './locales/mk/graphDigitizer.json';
import mkAnalytics from './locales/mk/analytics.json';
import mkPedagogue from './locales/mk/pedagogue.json';
import mkMaterialsFactory from './locales/mk/materialsFactory.json';
import mkTutorChat from './locales/mk/tutorChat.json';
import mkAdaptiveTest from './locales/mk/adaptiveTest.json';
import mkClassrooms from './locales/mk/classrooms.json';
import mkTeacherDashboard from './locales/mk/teacherDashboard.json';
import mkStudentDashboard from './locales/mk/studentDashboard.json';
import mkKahoot from './locales/mk/kahoot.json';
import mkLiveCanvas from './locales/mk/liveCanvas.json';
import mkInteractiveSolver from './locales/mk/interactiveSolver.json';
import mkLessonPlan from './locales/mk/lessonPlan.json';
import mkCurriculumFactory from './locales/mk/curriculumFactory.json';
import mkTestGenerator from './locales/mk/testGenerator.json';
import mkGlobalTutor from './locales/mk/globalTutor.json';
import mkExams from './locales/mk/exams.json';

import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enPricing from './locales/en/pricing.json';
import enHome from './locales/en/home.json';
import enLibrary from './locales/en/library.json';
import enExtraction from './locales/en/extraction.json';
import enDashboard from './locales/en/dashboard.json';
import enFlashcards from './locales/en/flashcards.json';
import enGradebook from './locales/en/gradebook.json';
import enDifferentiation from './locales/en/differentiation.json';
import enEarlyWarning from './locales/en/earlyWarning.json';
import enBilling from './locales/en/billing.json';
import enSchoolInquiries from './locales/en/schoolInquiries.json';
import enSmartOcr from './locales/en/smartOcr.json';
import enSmartGrader from './locales/en/smartGrader.json';
import enGraphDigitizer from './locales/en/graphDigitizer.json';
import enAnalytics from './locales/en/analytics.json';
import enPedagogue from './locales/en/pedagogue.json';
import enMaterialsFactory from './locales/en/materialsFactory.json';
import enTutorChat from './locales/en/tutorChat.json';
import enAdaptiveTest from './locales/en/adaptiveTest.json';
import enClassrooms from './locales/en/classrooms.json';
import enTeacherDashboard from './locales/en/teacherDashboard.json';
import enStudentDashboard from './locales/en/studentDashboard.json';
import enKahoot from './locales/en/kahoot.json';
import enLiveCanvas from './locales/en/liveCanvas.json';
import enInteractiveSolver from './locales/en/interactiveSolver.json';
import enLessonPlan from './locales/en/lessonPlan.json';
import enCurriculumFactory from './locales/en/curriculumFactory.json';
import enTestGenerator from './locales/en/testGenerator.json';
import enGlobalTutor from './locales/en/globalTutor.json';
import enExams from './locales/en/exams.json';

import alCommon from './locales/al/common.json';
import alNavigation from './locales/al/navigation.json';
import alPricing from './locales/al/pricing.json';
import alHome from './locales/al/home.json';
import alLibrary from './locales/al/library.json';
import alExtraction from './locales/al/extraction.json';
import alDashboard from './locales/al/dashboard.json';
import alFlashcards from './locales/al/flashcards.json';
import alGradebook from './locales/al/gradebook.json';
import alDifferentiation from './locales/al/differentiation.json';
import alEarlyWarning from './locales/al/earlyWarning.json';
import alBilling from './locales/al/billing.json';
import alSchoolInquiries from './locales/al/schoolInquiries.json';
import alSmartOcr from './locales/al/smartOcr.json';
import alSmartGrader from './locales/al/smartGrader.json';
import alGraphDigitizer from './locales/al/graphDigitizer.json';
import alAnalytics from './locales/al/analytics.json';
import alPedagogue from './locales/al/pedagogue.json';
import alMaterialsFactory from './locales/al/materialsFactory.json';
import alTutorChat from './locales/al/tutorChat.json';
import alAdaptiveTest from './locales/al/adaptiveTest.json';
import alClassrooms from './locales/al/classrooms.json';
import alTeacherDashboard from './locales/al/teacherDashboard.json';
import alStudentDashboard from './locales/al/studentDashboard.json';
import alKahoot from './locales/al/kahoot.json';
import alLiveCanvas from './locales/al/liveCanvas.json';
import alInteractiveSolver from './locales/al/interactiveSolver.json';
import alLessonPlan from './locales/al/lessonPlan.json';
import alCurriculumFactory from './locales/al/curriculumFactory.json';
import alTestGenerator from './locales/al/testGenerator.json';
import alGlobalTutor from './locales/al/globalTutor.json';
import alExams from './locales/al/exams.json';

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
        differentiation: mkDifferentiation,
        earlyWarning: mkEarlyWarning,
        billing: mkBilling,
        schoolInquiries: mkSchoolInquiries,
        smartOcr: mkSmartOcr,
        smartGrader: mkSmartGrader,
        graphDigitizer: mkGraphDigitizer,
        analytics: mkAnalytics,
        pedagogue: mkPedagogue,
        materialsFactory: mkMaterialsFactory,
        tutorChat: mkTutorChat,
        adaptiveTest: mkAdaptiveTest,
        classrooms: mkClassrooms,
        teacherDashboard: mkTeacherDashboard,
        studentDashboard: mkStudentDashboard,
        kahoot: mkKahoot,
        liveCanvas: mkLiveCanvas,
        interactiveSolver: mkInteractiveSolver,
        lessonPlan: mkLessonPlan,
        curriculumFactory: mkCurriculumFactory,
        testGenerator: mkTestGenerator,
        globalTutor: mkGlobalTutor,
        exams: mkExams,
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
        differentiation: enDifferentiation,
        earlyWarning: enEarlyWarning,
        billing: enBilling,
        schoolInquiries: enSchoolInquiries,
        smartOcr: enSmartOcr,
        smartGrader: enSmartGrader,
        graphDigitizer: enGraphDigitizer,
        analytics: enAnalytics,
        pedagogue: enPedagogue,
        materialsFactory: enMaterialsFactory,
        tutorChat: enTutorChat,
        adaptiveTest: enAdaptiveTest,
        classrooms: enClassrooms,
        teacherDashboard: enTeacherDashboard,
        studentDashboard: enStudentDashboard,
        kahoot: enKahoot,
        liveCanvas: enLiveCanvas,
        interactiveSolver: enInteractiveSolver,
        lessonPlan: enLessonPlan,
        curriculumFactory: enCurriculumFactory,
        testGenerator: enTestGenerator,
        globalTutor: enGlobalTutor,
        exams: enExams,
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
        differentiation: alDifferentiation,
        earlyWarning: alEarlyWarning,
        billing: alBilling,
        schoolInquiries: alSchoolInquiries,
        smartOcr: alSmartOcr,
        smartGrader: alSmartGrader,
        graphDigitizer: alGraphDigitizer,
        analytics: alAnalytics,
        pedagogue: alPedagogue,
        materialsFactory: alMaterialsFactory,
        tutorChat: alTutorChat,
        adaptiveTest: alAdaptiveTest,
        classrooms: alClassrooms,
        teacherDashboard: alTeacherDashboard,
        studentDashboard: alStudentDashboard,
        kahoot: alKahoot,
        liveCanvas: alLiveCanvas,
        interactiveSolver: alInteractiveSolver,
        lessonPlan: alLessonPlan,
        curriculumFactory: alCurriculumFactory,
        testGenerator: alTestGenerator,
        globalTutor: alGlobalTutor,
        exams: alExams,
      },
    },
    fallbackLng: 'mk',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'pricing', 'home', 'library', 'extraction', 'dashboard', 'flashcards', 'gradebook', 'differentiation', 'earlyWarning', 'billing', 'schoolInquiries', 'smartOcr', 'smartGrader', 'graphDigitizer', 'analytics', 'pedagogue', 'materialsFactory', 'tutorChat', 'adaptiveTest', 'classrooms', 'teacherDashboard', 'studentDashboard', 'kahoot', 'liveCanvas', 'interactiveSolver', 'lessonPlan', 'curriculumFactory', 'testGenerator', 'globalTutor', 'exams'],
    
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
