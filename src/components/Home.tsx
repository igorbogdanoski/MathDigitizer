import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrainCircuit } from 'lucide-react';
import { Button } from './ui/Button';
import { generateSpeech } from '../lib/gemini';
import { SEO } from './SEO';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { hasProAccess } from '../lib/saas';
import { HeroSection } from './home/HeroSection';
import { BentoFeaturesGrid } from './home/BentoFeaturesGrid';
import { TestimonialsSection } from './home/TestimonialsSection';
import { QuoteOfDayCard } from './home/QuoteOfDayCard';
import { GuideModal } from './home/GuideModal';
import { StickyBottomCta } from './home/StickyBottomCta';
import { MATH_QUOTES } from './home/constants';

interface HomeProps {
  setActiveTab?: (tab: 'home' | 'extract' | 'library' | 'factory') => void;
  user: any;
  signInWithGoogle: () => void;
}

export const Home: React.FC<HomeProps> = ({ user, signInWithGoogle }) => {
  const { t } = useTranslation('home');
  const platformStats = t('platformStats', { returnObjects: true }) as { value: string; label: string }[];
  const signalCards = t('signalCards', { returnObjects: true }) as { title: string; value: string; detail: string }[];
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [quoteOfDay, setQuoteOfDay] = useState(MATH_QUOTES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [kahootPin, setKahootPin] = useState('');
  const isPro = hasProAccess(userProfile);
  const footerCtaRef = useRef<HTMLDivElement>(null);
  const [isFooterCtaVisible, setIsFooterCtaVisible] = useState(false);
  const [stickyBarDismissed, setStickyBarDismissed] = useState(false);

  // Hide the sticky bottom CTA once the equivalent footer CTA is already
  // visible on screen, so guests never see two "sign up" prompts at once.
  useEffect(() => {
    const node = footerCtaRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsFooterCtaVisible(entry.isIntersecting),
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleJoinKahoot = (e: React.FormEvent) => {
    e.preventDefault();
    if (kahootPin.trim()) {
      navigate(`/play?pin=${kahootPin.trim()}`);
    }
  };

  useEffect(() => {
    // Simple logic to pick a quote based on the current day
    const today = new Date();
    const index = (today.getFullYear() + today.getMonth() + today.getDate()) % MATH_QUOTES.length;
    setQuoteOfDay(MATH_QUOTES[index]);
  }, []);

  const handleUpgradeToPro = async () => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    navigate('/pricing');
  };

  const handlePlayQuote = async () => {
    if (isPlaying && audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const textToSpeak = `${quoteOfDay.text} - ${quoteOfDay.author}`;
      const audioDataUrl = await generateSpeech(textToSpeak);
      const audio = new Audio(audioDataUrl);

      audio.onended = () => setIsPlaying(false);
      audio.play();

      setAudioElement(audio);
      setIsPlaying(true);
    } catch (error) {
      console.error("Failed to play audio:", error);
      showToast("Неуспешно генерирање на аудио. Обидете се повторно.", 'error');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  return (
    <div className="space-y-16 pb-16 animate-in fade-in duration-700 min-h-screen font-sans bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      <SEO
        title="MathDigitizer Pro — Помалку хаос. Повеќе математика."
        description="Teacher-first AI платформа за македонски наставници. AI екстракција, Live MathKahoot, PDF фабрика и педагошка аналитика — во еден систем."
        keywords="математика, AI, автоматизирано оценување, генератор на задачи, OCR математика, едукација, македонски јазик, EdTech, дигитализација"
        canonical="/"
        type="website"
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'MathDigitizer Pro',
            alternateName: 'MathDigitizer',
            url: 'https://math.mismath.net',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'All',
            inLanguage: 'mk',
            softwareVersion: '3.1',
            creator: {
              '@type': 'Person',
              name: 'Игор Богданоски',
              url: 'https://math.mismath.net'
            },
            offers: {
              '@type': 'Offer',
              price: isPro ? '490.00' : '0.00',
              priceCurrency: 'MKD',
              availability: 'https://schema.org/InStock',
              category: 'EdTech'
            },
            description: 'Платформа за автоматска AI екстракција на математика, онлајн испити и автоматско оценување за македонски наставници.'
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'MathDigitizer Pro',
            url: 'https://math.mismath.net',
            description: 'Teacher-first AI платформа за македонски наставници по математика.',
            inLanguage: 'mk',
            publisher: {
              '@type': 'Person',
              name: 'Игор Богданоски'
            },
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: 'https://math.mismath.net/library?q={search_term_string}' },
              'query-input': 'required name=search_term_string'
            }
          }
        ]}
      />

      {/* Advanced Hero Section (World-Class EdTech Landing) */}
      <HeroSection
        t={t}
        user={user}
        signInWithGoogle={signInWithGoogle}
        kahootPin={kahootPin}
        setKahootPin={setKahootPin}
        onJoinKahoot={handleJoinKahoot}
        onShowGuide={() => setShowGuide(true)}
      />

      {/* Platform Stats Strip */}
      <section className="max-w-7xl mx-auto px-6 -mt-2">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {platformStats.map((stat) => (
            <div key={stat.label} className="rounded-4xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/60 p-6 shadow-sm backdrop-blur-xl text-center">
              <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400 mb-2">{stat.value}</div>
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{stat.label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">* Проценки базирани на beta период со реални наставници</p>
      </section>

      {/* Advanced Bento Grid Features */}
      <BentoFeaturesGrid />

      {/* Testimonials Section */}
      <TestimonialsSection t={t} />

      {/* Social Proof / Value Signals — positioned after features to build trust before pricing */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {signalCards.map((card) => (
            <div key={card.title} className="rounded-4xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/60 p-6 shadow-sm backdrop-blur-xl">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 mb-3">{card.title}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mb-2">{card.value}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">{card.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Quote of the Day (Modernized as a floating card) */}
      <QuoteOfDayCard
        quoteOfDay={quoteOfDay}
        isPlaying={isPlaying}
        isGeneratingAudio={isGeneratingAudio}
        onPlayQuote={handlePlayQuote}
      />

      {/* Modern High-End Footer Teaser for Pricing */}
      <section ref={footerCtaRef} className="max-w-4xl mx-auto px-6 text-center pt-8 border-t border-slate-200 dark:border-slate-800/50 pb-12">
         <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight transition-colors duration-300">{t('cta.title')}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 transition-colors duration-300">{t('cta.subtitle')}</p>
         {!user ? (
            <Button onClick={signInWithGoogle} className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white h-14 px-8 rounded-2xl font-bold font-sans shadow-xl transition-all duration-300">
               {t('cta.button')}
            </Button>
         ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button onClick={() => navigate('/library')} className="bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white text-white h-14 px-8 rounded-2xl font-bold font-sans shadow-xl transition-all duration-300">
                {t('navigation:library')}
              </Button>
              {!isPro && (
                <Button
                  onClick={handleUpgradeToPro}
                  variant="outline"
                  className="h-14 px-8 rounded-2xl font-bold font-sans border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-400/40 dark:hover:bg-amber-500/10"
                >
                  Отклучи Pro (Checkout)
                </Button>
              )}
            </div>
         )}
      </section>

      {/* Footer minimal info */}
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-12 py-8 bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-1.5 rounded-lg">
              <BrainCircuit className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-300">MathDigitizer <span className="text-blue-500">Pro</span></span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 text-center">
            Креирано од <span className="font-semibold text-slate-700 dark:text-slate-300">Игор Богданоски</span>
            <span className="mx-2 opacity-40">·</span>
            © {new Date().getFullYear()} Сите права задржани. Развиено за македонското образование.
          </div>
        </div>
      </footer>

      {/* Guide Modal */}
      <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* Sticky bottom CTA — only for non-logged-in visitors, hidden once the
          footer CTA above is already visible, and dismissible with the X. */}
      <StickyBottomCta
        isVisible={!user && !isFooterCtaVisible && !stickyBarDismissed}
        onDismiss={() => setStickyBarDismissed(true)}
        onSignUp={signInWithGoogle}
      />
    </div>
  );
};
