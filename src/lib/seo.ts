import { getProPricingPlans } from './saas';

export interface RouteSeoConfig {
  title: string;
  description: string;
  keywords: string;
  canonical?: string;
  noindex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const SITE_URL = 'https://math.mismath.net';
const SITE_NAME = 'MathDigitizer Pro';

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

function buildDefaultStructuredData(pathname: string): Array<Record<string, unknown>> {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/pwa-icon.svg'),
        width: 512,
        height: 512
      },
      email: 'igor.bogdanoski@mismath.net',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'igor.bogdanoski@mismath.net',
        contactType: 'customer support',
        availableLanguage: ['Macedonian', 'English']
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'mk',
      description: 'AI едукативна платформа за математика на македонски јазик — OCR екстракција, автоматско оценување и интерактивни алатки за наставници.'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      description: 'Водечка AI едукативна платформа за математика на македонски јазик. Дигитализација од YouTube и слики, OCR екстракција, автоматско AI оценување и интерактивни математички алатки за наставници.',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url: absoluteUrl(pathname || '/'),
      inLanguage: 'mk',
      screenshot: {
        '@type': 'ImageObject',
        url: absoluteUrl('/og-image.png'),
        width: 1200,
        height: 630
      },
      author: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL
      },
      offers: {
        '@type': 'Offer',
        price: getProPricingPlans()[0].priceMkd.toFixed(2),
        priceCurrency: 'MKD',
        availability: 'https://schema.org/InStock',
        url: absoluteUrl('/pricing')
      }
    }
  ];
}

function buildPricingStructuredData(): Array<Record<string, unknown>> {
  return [
    ...buildDefaultStructuredData('/pricing'),
    {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'MathDigitizer Pro — Teacher Pricing Plans',
      url: absoluteUrl('/pricing'),
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Pro Teacher Monthly',
          description: 'Месечен Pro план за индивидуални наставници — флексибилен влезен праг.',
          priceCurrency: 'MKD',
          price: getProPricingPlans()[0].priceMkd.toFixed(2),
          availability: 'https://schema.org/InStock',
          url: absoluteUrl('/pricing'),
          eligibleDuration: 'P1M',
          seller: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL
          }
        },
        {
          '@type': 'Offer',
          name: 'Pro Teacher Annual',
          description: 'Годишен Pro план — најдобра вредност, заштеда од речиси 2 месеци.',
          priceCurrency: 'MKD',
          price: getProPricingPlans()[1].priceMkd.toFixed(2),
          availability: 'https://schema.org/InStock',
          url: absoluteUrl('/pricing'),
          eligibleDuration: 'P1Y',
          seller: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL
          }
        }
      ]
    }
  ];
}

const routeEntries: Array<{ match: RegExp; seo: RouteSeoConfig }> = [
  {
    match: /^\/$/,
    seo: {
      title: 'MathDigitizer Pro | Напредна едукација и математика',
      description: 'Водечка AI едукативна платформа за математика на македонски јазик. Дигитализација, OCR екстракција, автоматско оценување и интерактивни математички алатки.',
      keywords: 'математика, AI, OCR, едукација, mathdigitizer, наставници, ученици',
      canonical: '/',
      structuredData: buildDefaultStructuredData('/'),
    },
  },
  {
    match: /^\/extract$/,
    seo: {
      title: 'AI Екстракција',
      description: 'Извлечете математички задачи од YouTube, слики и документи со мултимодален AI flow.',
      keywords: 'OCR, екстракција, YouTube, математика, LaTeX, AI',
      canonical: '/extract',
      noindex: true,
      structuredData: buildDefaultStructuredData('/extract'),
    },
  },
  {
    match: /^\/smart-ocr$/,
    seo: {
      title: 'Smart OCR',
      description: 'Скенирајте и дигитализирајте математички содржини со Smart OCR.',
      keywords: 'smart ocr, математика, дигитализација, скенирање',
      canonical: '/smart-ocr',
      noindex: true,
      structuredData: buildDefaultStructuredData('/smart-ocr'),
    },
  },
  {
    match: /^\/library$/,
    seo: {
      title: 'Библиотека',
      description: 'Уредувајте, класифицирајте и менаџирајте математички задачи и педагошки ресурси.',
      keywords: 'библиотека, задачи, математика, педагогија',
      canonical: '/library',
      noindex: true,
      structuredData: buildDefaultStructuredData('/library'),
    },
  },
  {
    match: /^\/dashboard$/,
    seo: {
      title: 'Профил и Напредок',
      description: 'Преглед на телеметрија, нивоа, значки и образовен напредок.',
      keywords: 'dashboard, прогрес, телеметрија, xp, значки',
      canonical: '/dashboard',
      noindex: true,
      structuredData: buildDefaultStructuredData('/dashboard'),
    },
  },
  {
    match: /^\/analytics$/,
    seo: {
      title: 'Аналитика',
      description: 'Педагошка аналитика и напредни метрики за учење и совладување.',
      keywords: 'аналитика, педагогија, статистика, учење',
      canonical: '/analytics',
      noindex: true,
      structuredData: buildDefaultStructuredData('/analytics'),
    },
  },
  {
    match: /^\/ai-pedagogy$/,
    seo: {
      title: 'AI Педагогија',
      description: 'Критика и подобрување на AI педагошки излези.',
      keywords: 'AI педагогија, критика, математика, промпт инженеринг',
      canonical: '/ai-pedagogy',
      noindex: true,
      structuredData: buildDefaultStructuredData('/ai-pedagogy'),
    },
  },
  {
    match: /^\/curriculum$/,
    seo: {
      title: 'Курикулум',
      description: 'Генерирање и работа со државни стандарди и наставни планови.',
      keywords: 'курикулум, стандарди, наставен план, математика',
      canonical: '/curriculum',
      noindex: true,
      structuredData: buildDefaultStructuredData('/curriculum'),
    },
  },
  {
    match: /^\/pricing$/,
    seo: {
      title: 'Pricing',
      description: 'Изберете помеѓу месечен и годишен Pro Teacher план, со school licensing и локални payment опции.',
      keywords: 'pricing, saas, pro teacher, annual plan, school licensing, банка, bank transfer, македонија',
      canonical: '/pricing',
      structuredData: buildPricingStructuredData(),
    },
  },
  {
    match: /^\/school-inquiries$/,
    seo: {
      title: 'School Inquiries',
      description: 'Внатрешен inbox за school licensing барања.',
      keywords: 'school inquiries, sales inbox, school leads',
      canonical: '/school-inquiries',
      noindex: true,
      structuredData: buildDefaultStructuredData('/school-inquiries'),
    },
  },
  {
    match: /^\/classrooms(\/[^/]+)?$/,
    seo: {
      title: 'Училници',
      description: 'Менаџирајте училници, активности и напредок на учениците.',
      keywords: 'училници, ученици, наставници, напредок',
      canonical: '/classrooms',
      noindex: true,
      structuredData: buildDefaultStructuredData('/classrooms'),
    },
  },
  {
    match: /^\/students\/[^/]+$/,
    seo: {
      title: 'Телеметрија на Ученик',
      description: 'Персонализиран увид во ученичкиот напредок и перформанси.',
      keywords: 'телеметрија, ученик, резултати, напредок',
      canonical: '/dashboard',
      noindex: true,
      structuredData: buildDefaultStructuredData('/dashboard'),
    },
  },
  {
    match: /^\/live-board$/,
    seo: {
      title: 'Жива Табла',
      description: 'Интерактивна табла за заедничка работа и математичка визуелизација.',
      keywords: 'жива табла, математика, визуелизација, колаборација',
      canonical: '/live-board',
      noindex: true,
      structuredData: buildDefaultStructuredData('/live-board'),
    },
  },
  {
    match: /^\/live\/[^/]+\/host$/,
    seo: {
      title: 'Live Host',
      description: 'Хост интерфејс за live сесии.',
      keywords: 'live host, math, classroom, session',
      canonical: '/live-board',
      noindex: true,
      structuredData: buildDefaultStructuredData('/live-board'),
    },
  },
  {
    match: /^\/play$/,
    seo: {
      title: 'Live Player',
      description: 'Учеснички интерфејс за live математички сесии.',
      keywords: 'live player, математика, игра, session',
      canonical: '/play',
      noindex: true,
      structuredData: buildDefaultStructuredData('/play'),
    },
  },
  {
    match: /^\/exam\/[^/]+$/,
    seo: {
      title: 'Испит',
      description: 'Персонализиран испитен интерфејс.',
      keywords: 'испит, математика, ученици',
      canonical: '/exam',
      noindex: true,
      structuredData: buildDefaultStructuredData('/exam'),
    },
  },
  // Protected app routes — authenticated only, never crawlable
  {
    match: /^\/exams-grading$/,
    seo: {
      title: 'Оценување на Испити',
      description: 'Управување и оценување на ученички испити.',
      keywords: 'испити, оценување, наставници',
      canonical: '/exams-grading',
      noindex: true,
      structuredData: buildDefaultStructuredData('/exams-grading'),
    },
  },
  {
    match: /^\/smart-grader$/,
    seo: {
      title: 'AI Градер',
      description: 'Автоматско AI оценување на математички одговори.',
      keywords: 'AI градер, оценување, математика, автоматско',
      canonical: '/smart-grader',
      noindex: true,
      structuredData: buildDefaultStructuredData('/smart-grader'),
    },
  },
  {
    match: /^\/factory$/,
    seo: {
      title: 'Фабрика за Материјали',
      description: 'Генерирање на наставни материјали и математички содржини со AI.',
      keywords: 'фабрика, материјали, AI генерирање, математика',
      canonical: '/factory',
      noindex: true,
      structuredData: buildDefaultStructuredData('/factory'),
    },
  },
  {
    match: /^\/mass-factory$/,
    seo: {
      title: 'Масовна Фабрика',
      description: 'Масовно генерирање на курикулумски материјали.',
      keywords: 'масовна фабрика, курикулум, AI, генерирање',
      canonical: '/mass-factory',
      noindex: true,
      structuredData: buildDefaultStructuredData('/mass-factory'),
    },
  },
  {
    match: /^\/todo$/,
    seo: {
      title: 'Задачи',
      description: 'Листа на математички задачи за решавање.',
      keywords: 'задачи, математика, ученици, решавање',
      canonical: '/todo',
      noindex: true,
      structuredData: buildDefaultStructuredData('/todo'),
    },
  },
  {
    match: /^\/flashcards$/,
    seo: {
      title: 'Флешкарти',
      description: 'Интерактивни флешкарти за совладување математички концепти.',
      keywords: 'флешкарти, математика, повторување, SRS',
      canonical: '/flashcards',
      noindex: true,
      structuredData: buildDefaultStructuredData('/flashcards'),
    },
  },
  {
    match: /^\/adaptive-test$/,
    seo: {
      title: 'Адаптивен Тест',
      description: 'Персонализиран адаптивен тест базиран на нивото на знаење.',
      keywords: 'адаптивен тест, математика, персонализиран, ученици',
      canonical: '/adaptive-test',
      noindex: true,
      structuredData: buildDefaultStructuredData('/adaptive-test'),
    },
  },
  // Public blog posts — SEO indexed
  {
    match: /^\/blog\/ocr-matematika$/,
    seo: {
      title: 'Како да дигитализирате математички задачи со AI',
      description: 'Практичен водич за наставници: претворете ракописни задачи, фотографии и PDF документи во дигитален LaTeX формат за секунди со AI OCR.',
      keywords: 'OCR математика, дигитализација математички задачи, AI OCR наставници, LaTeX конвертор, математика македонија',
      canonical: '/blog/ocr-matematika',
      structuredData: buildDefaultStructuredData('/blog/ocr-matematika'),
    },
  },
  {
    match: /^\/blog\/latex-ekstrakcija$/,
    seo: {
      title: 'LaTeX екстракција од YouTube видеа — автоматска дигитализација',
      description: 'Научете како да извлечете LaTeX формули и математички задачи директно од YouTube образовни видеа со еден клик. Без рачно препишување.',
      keywords: 'LaTeX екстракција, YouTube математика, LaTeX генератор македонија, математика видеа, автоматска дигитализација LaTeX',
      canonical: '/blog/latex-ekstrakcija',
      structuredData: buildDefaultStructuredData('/blog/latex-ekstrakcija'),
    },
  },
  {
    match: /^\/blog\/live-mathkahoot$/,
    seo: {
      title: 'Live математички натпревари во училница',
      description: 'Организирајте интерактивни live математички квизови за ученици во реално време — без потреба за посебна апликација.',
      keywords: 'математички квиз, live натпревар ученици, Math Kahoot македонија, интерактивна настава математика, live classroom математика',
      canonical: '/blog/live-mathkahoot',
      structuredData: buildDefaultStructuredData('/blog/live-mathkahoot'),
    },
  },
];

export function getRouteSeo(pathname: string): RouteSeoConfig {
  const match = routeEntries.find((entry) => entry.match.test(pathname));
  if (match) {
    return match.seo;
  }

  return {
    title: 'MathDigitizer Pro',
    description: 'AI едукативна платформа за математика на македонски јазик.',
    keywords: 'математика, AI, едукација',
    canonical: pathname,
    structuredData: buildDefaultStructuredData(pathname),
  };
}