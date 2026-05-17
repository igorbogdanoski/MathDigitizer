import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, BookOpen, Factory, Wand2, ArrowRight, Sparkles, Quote, Play, Square, Info, X, FileText, Cpu, ShieldCheck, CheckCircle, FileType2, Zap, Users } from 'lucide-react';
import { Button } from './ui/Button';
import { generateSpeech } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { MathRenderer } from './MathRenderer';
import { SEO } from './SEO';
import { useToast } from '../contexts/ToastContext';

const MATH_QUOTES = [
  { text: "Математиката е азбуката со која Бог го напишал универзумот.", author: "Галилео Галилеј" },
  { text: "Чистата математика е, на свој начин, поезија на логичките идеи.", author: "Алберт Ајнштајн" },
  { text: "Суштината на математиката не е да ги направи едноставните работи комплицирани, туку комплицираните работи едноставни.", author: "Стенли Гудер" },
  { text: "Во математиката не ги разбираш работите. Само се навикнуваш на нив.", author: "Џон фон Нојман" },
  { text: "Математиката е кралица на науките.", author: "Карл Фридрих Гаус" },
  { text: "Единствениот начин да научиш математика е да решаваш математика.", author: "Пол Халмос" },
  { text: "Природата е напишана во математички јазик.", author: "Галилео Галилеј" },
  { text: "Математиката не познава раси или географски граници; за математиката, културниот свет е една земја.", author: "Дејвид Хилберт" },
  { text: "Ако луѓето не веруваат дека математиката е едноставна, тоа е само затоа што не сфаќаат колку е комплициран животот.", author: "Џон фон Нојман" },
  { text: "Математиката се состои од докажување на најочигледните работи на најмалку очигледен начин.", author: "Џорџ Поја" }
];

const HOME_VALUE_POINTS = [
  'AI екстракција што навистина штеди време во подготовка.',
  'Педагошки analytics и интервенции наместо само генеративен шум.',
  'Локално подготвен SaaS модел со Pro и school plan за реални институции.',
];

const HOME_SIGNAL_CARDS = [
  { title: 'Teacher-first SaaS', value: '490 MKD', detail: 'месечно за Pro Teacher' },
  { title: 'Годишна вредност', value: '4,900 MKD', detail: 'најдобра опција за цела година' },
  { title: 'School rollout', value: 'По договор', detail: 'invoice, банка и onboarding' },
  { title: 'Локални плаќања', value: 'PayPal + Банка', detail: 'без чекање на Stripe setup' },
];

const HOME_WORKFLOW_STEPS = [
  { title: 'Екстракција', detail: 'Видео, PDF или слика во структурирани математички задачи.' },
  { title: 'Педагошка библиотека', detail: 'RAG-ready содржина за повторна употреба, анализа и тестови.' },
  { title: 'Испорака', detail: 'Материјали, analytics и live classroom workflows од истиот систем.' },
];

interface HomeProps {
  setActiveTab?: (tab: 'home' | 'extract' | 'library' | 'factory') => void;
  user: any;
  signInWithGoogle: () => void;
}

import { useAuth } from '../contexts/AuthContext';
import { hasProAccess } from '../lib/saas';

export const Home: React.FC<HomeProps> = ({ user, signInWithGoogle }) => {
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
        title="Напредна AI едукација на македонски јазик"
        description="Водечка AI едукативна платформа за математика на македонски јазик. Беспрекорна дигитализација, OCR екстракција и интерактивни натпревари."
        keywords="математика, AI, автоматизирано оценување, генератор на задачи, OCR математика, едукација, македонски јазик, EdTech"
        canonical="/"
        type="website"
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'MathDigitizer Pro',
            alternateName: 'MathDigitizer',
            url: 'https://mathdigitizer.pro',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'All',
            inLanguage: 'mk',
            softwareVersion: '3.1',
            creator: {
              '@type': 'Person',
              name: 'Игор Богданоски'
            },
            offers: {
              '@type': 'Offer',
              price: isPro ? '490.00' : '0.00',
              priceCurrency: 'MKD',
              availability: 'https://schema.org/InStock',
              category: 'EdTech'
            },
            description: 'Платформа за автоматска AI екстракција на математика, онлајн испити и автоматско оценување.'
          },
          {
            '@context': 'https://schema.org',
            '@type': 'EducationalOrganization',
            name: 'MathDigitizer Pro Education',
            url: 'https://mathdigitizer.pro',
            logo: 'https://mathdigitizer.pro/pwa-icon.svg',
            sameAs: []
          }
        ]}
      />
      
      {/* Advanced Hero Section (World-Class EdTech Landing) */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 text-white shadow-[0_0_100px_rgba(37,99,235,0.18)] mx-4 lg:mx-8 xl:mx-12 mt-4 px-6 md:px-12 py-16 lg:py-24 transition-colors duration-500 border border-slate-800/80">
        
        {/* Deep Abstract Animated Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 hover:opacity-30 transition-opacity duration-1000"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] max-w-4xl h-[120%] rounded-[100%] bg-blue-600/20 blur-[150px] pointer-events-none mix-blend-screen"></div>

        {/* Floating Geometric Orbits */}
        <motion.div 
          animate={{ y: [0, -40, 0], rotate: [0, 10, 0], scale: [1, 1.1, 1] }} 
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-10 lg:left-32 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-blue-500/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] flex items-center justify-center text-blue-300 text-3xl shadow-[0_0_40px_rgba(59,130,246,0.2)] hidden md:flex"
        >
          <MathRenderer content="$\int_a^b$" inline />
        </motion.div>
        
        <motion.div 
          animate={{ y: [0, 40, 0], rotate: [0, -15, 0], scale: [1, 1.1, 1] }} 
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-20 right-10 lg:right-32 w-32 h-32 bg-gradient-to-br from-rose-500/10 to-orange-500/5 backdrop-blur-2xl border border-white/10 rounded-full flex items-center justify-center text-rose-300 font-mono text-xl shadow-[0_0_40px_rgba(244,63,94,0.2)] hidden md:flex flex-col gap-2"
        >
          <span className="text-xl font-black">Kahoot!</span>
          <Zap className="w-5 h-5 text-rose-400" />
        </motion.div>

        <div className="relative z-10 w-full max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] gap-12 items-center">
          <div>
            <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.8, type: "spring" }}
               className="inline-flex flex-wrap items-center gap-3 px-6 py-2.5 rounded-full bg-slate-800/90 text-blue-300 text-xs sm:text-sm font-black mb-10 border border-blue-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(59,130,246,0.4)] tracking-widest uppercase ring-1 ring-blue-400/20"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 via-indigo-300 to-cyan-300 flex items-center justify-center text-slate-950 shadow-sm">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">MathDigitizer Pro</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 tracking-wide">Креирано од Игор Богданоски</span>
              </div>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
              className="text-5xl md:text-7xl lg:text-[5.6rem] font-black tracking-tight mb-6 leading-[0.92] text-left"
            >
              Помалку хаос.
              <br />
              <span className="relative inline-block mt-2">
                <span className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 blur-2xl opacity-35"></span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-200 to-cyan-200">
                  Повеќе математика.
                </span>
              </span>
            </motion.h1>

            <motion.p 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.35, duration: 0.8 }}
               className="text-lg md:text-2xl text-slate-300 max-w-3xl mb-8 leading-relaxed font-medium text-left"
            >
              MathDigitizer е teacher-first AI платформа што спојува <strong className="text-white">екстракција</strong>, <strong className="text-white">педагошка аналитика</strong> и <strong className="text-white">готови classroom workflows</strong> во еден систем што реално штеди време.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.8 }}
              className="grid gap-3 mb-8"
            >
              {HOME_VALUE_POINTS.map((point) => (
                <div key={point} className="flex items-start gap-3 text-left">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-slate-200 text-base md:text-lg">{point}</span>
                </div>
              ))}
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.55, duration: 0.8 }}
               className="flex flex-col sm:flex-row gap-4 relative z-20 mb-5"
            >
              {!user ? (
                <Button 
                  size="lg" 
                  onClick={(e) => {
                    e.preventDefault();
                    signInWithGoogle();
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-900 border-none text-lg h-16 px-10 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.18)] hover:shadow-[0_0_60px_rgba(255,255,255,0.28)] group overflow-hidden relative transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-blue-100 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  <Sparkles className="w-6 h-6 mr-3 group-hover:animate-pulse relative z-10 text-blue-600" />
                  <span className="relative z-10 font-black">Регистрирај се бесплатно</span>
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  onClick={() => navigate('/classrooms')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white border-none text-lg h-16 px-10 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_rgba(79,70,229,0.55)] group overflow-hidden relative transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  <Factory className="w-6 h-6 mr-3 relative z-10" />
                  <span className="relative z-10 font-black">Отвори го контролниот центар</span>
                </Button>
              )}
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/pricing')}
                className="bg-slate-800/50 hover:bg-slate-700/60 text-white border-slate-600 text-lg h-16 px-10 rounded-2xl backdrop-blur-xl transition-all duration-300"
              >
                <Zap className="w-6 h-6 mr-3" />
                <span className="font-bold">Види Pro цена</span>
              </Button>
            </motion.div>

            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              Погледни ја методологијата зад платформата
            </button>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 1 }}
              className="mt-10 w-full max-w-2xl"
            >
              <div className="flex items-center gap-3 mb-4 text-left">
                <div className="h-px w-10 bg-slate-700"></div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Student Quick Entry</p>
              </div>
              <div className="bg-slate-800/45 p-3 rounded-[2rem] backdrop-blur-2xl border border-slate-700 shadow-2xl transition-all duration-500 focus-within:bg-slate-800/80 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_40px_rgba(79,70,229,0.3)]">
                <form onSubmit={handleJoinKahoot} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                    <input 
                      type="text" 
                      value={kahootPin}
                      onChange={(e) => setKahootPin(e.target.value)}
                      placeholder="Внеси ПИН за игра или испит" 
                      className="w-full bg-slate-900/50 border border-slate-600/50 rounded-2xl pl-14 pr-6 h-16 text-white text-lg placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-mono font-black tracking-wider sm:text-center"
                    />
                  </div>
                  <Button type="submit" className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-white rounded-2xl px-10 h-16 font-black text-lg shadow-[0_0_30px_rgba(16,185,129,0.35)] transition-all duration-300 hover:scale-[1.02] active:scale-95">
                    ВЛЕЗИ
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.9 }}
            className="relative"
          >
            <div className="rounded-[2rem] border border-white/10 bg-white/8 backdrop-blur-2xl p-6 md:p-7 shadow-[0_30px_100px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-200/80 mb-2">Teacher cockpit</div>
                  <div className="text-2xl font-black text-white">Еден систем за цел workflow</div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 via-indigo-300 to-cyan-300 flex items-center justify-center text-slate-950 shadow-lg">
                  <Cpu className="w-7 h-7" />
                </div>
              </div>

              <div className="space-y-4">
                {HOME_WORKFLOW_STEPS.map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-black text-cyan-200">0{index + 1}</div>
                      <div className="text-lg font-black text-white">{step.title}</div>
                    </div>
                    <div className="text-sm text-slate-300 leading-relaxed">{step.detail}</div>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-300/20 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] font-black text-indigo-200 mb-2">Founding price</div>
                  <div className="text-3xl font-black text-white">490 MKD</div>
                  <div className="text-sm text-slate-300 mt-1">месечно за Pro Teacher</div>
                </div>
                <div className="rounded-2xl bg-white/6 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] font-black text-cyan-200 mb-2">Payments</div>
                  <div className="text-lg font-black text-white">PayPal + Банка</div>
                  <div className="text-sm text-slate-300 mt-1">локално practical checkout додека bank stack се комплетира</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Value Signals */}
      <section className="max-w-7xl mx-auto px-6 -mt-2">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {HOME_SIGNAL_CARDS.map((card) => (
            <div key={card.title} className="rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/60 p-6 shadow-sm backdrop-blur-xl">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 mb-3">{card.title}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mb-2">{card.value}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">{card.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Advanced Bento Grid Features */}
      <section className="max-w-[85rem] mx-auto px-6 py-20">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 text-center tracking-tighter">Изграден за реален училиштен workflow</h2>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-16 text-lg max-w-3xl mx-auto font-medium">Наместо да продава десетици неповрзани AI функции, Home сега јасно покажува како платформата води од извор до анализа, материјали и live classroom delivery.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Main Focus: Live Kahoot Mode (Spans 12 cols) */}
          <motion.div 
            whileHover={{ y: -8, scale: 1.01 }}
            onClick={() => navigate('/library')}
            className="md:col-span-12 bg-gradient-to-br from-rose-500 to-orange-500 dark:from-rose-900 dark:to-orange-900 p-10 md:p-14 rounded-[3rem] shadow-2xl hover:shadow-rose-500/30 transition-all duration-500 cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute -right-20 -top-20 w-[600px] h-[600px] bg-white/10 blur-[80px] rounded-full mix-blend-overlay"></div>
            <div className="relative z-10 flex flex-col h-full w-full md:w-2/3">
               <div className="w-20 h-20 bg-white/20 backdrop-blur-xl border border-white/30 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-2xl">
                 <Play className="w-10 h-10 text-white fill-white" />
               </div>
               <h3 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">MathKahoot!<br/>Жива Училница</h3>
               <p className="text-xl text-rose-50/90 mb-10 leading-relaxed font-semibold">
                 Претворете ги задачите во интерактивна трка. Прикажете го PIN-от на проектор и гледајте како гемификацијата го зголемува фокусот 10x.
               </p>
               <div className="mt-auto inline-flex items-center bg-white text-rose-600 font-black text-lg px-8 py-4 rounded-2xl w-max shadow-xl group-hover:scale-105 transition-transform">
                 Започни Сесија <ArrowRight className="w-6 h-6 ml-3" />
               </div>
            </div>
            {/* Kahoot Decor Graphic */}
            <div className="hidden md:flex absolute -right-10 bottom-0 top-0 items-center justify-center w-1/2 pointer-events-none">
                <div className="w-full max-w-sm h-3/4 bg-white/10 backdrop-blur-md rounded-l-[3rem] border-y border-l border-white/20 p-8 shadow-2xl flex flex-col justify-center gap-4">
                   <div className="text-white font-black text-3xl text-center mb-4">Кој е резултатот?</div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-red-500 h-24 rounded-2xl border-b-4 border-red-700"></div>
                      <div className="bg-blue-500 h-24 rounded-2xl border-b-4 border-blue-700"></div>
                      <div className="bg-amber-400 h-24 rounded-2xl border-b-4 border-amber-600"></div>
                      <div className="bg-emerald-500 h-24 rounded-2xl border-b-4 border-emerald-700"></div>
                   </div>
                </div>
            </div>
          </motion.div>

          {/* AI Extractor (Spans 4 cols) */}
          <motion.div 
            whileHover={{ y: -8, scale: 1.02 }}
            onClick={() => navigate('/extract')}
            className="md:col-span-6 bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-xl hover:shadow-2xl border border-slate-200 dark:border-slate-700 transition-all duration-500 cursor-pointer group flex flex-col relative overflow-hidden"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/30">
              <Wand2 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4 leading-tight">AI Визуелна<br/>Екстракција</h3>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 flex-1 font-medium">
              Youtube линк или слика. Ние го претвораме видеото во интерактивни задачи со точен LaTeX.
            </p>
            <div className="flex items-center text-blue-600 dark:text-blue-400 font-black text-lg">
              Пробај <ArrowRight className="w-6 h-6 ml-2 group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>

          {/* DOK & PDF Factory (Spans 8 cols) */}
          <motion.div 
            whileHover={{ y: -8, scale: 1.01 }}
            onClick={() => navigate('/classrooms')}
            className="md:col-span-6 bg-slate-100 dark:bg-slate-800/50 p-10 md:p-14 rounded-[3rem] shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer group flex flex-col relative overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            <div className="absolute right-0 top-0 opacity-5">
               <FileType2 className="w-[400px] h-[400px] text-amber-500 transform translate-x-1/4 -translate-y-1/4 group-hover:rotate-12 transition-transform duration-700" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full w-full">
                <div className="flex gap-4 mb-8">
                   <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                     <BookOpen className="w-8 h-8 text-white" />
                   </div>
                   <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                     <ShieldCheck className="w-8 h-8 text-white" />
                   </div>
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">Dugga Испити &<br/>PDF Производство</h3>
                <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 leading-relaxed font-medium">
                  Организирајте сигурни lockdown тестирања или генерирајте инстант работни листови спремни за печатење. Одредете тежина според DOK.
                </p>
                <div className="mt-auto flex items-center text-slate-800 dark:text-white font-black text-lg bg-white dark:bg-slate-700 px-8 py-4 rounded-2xl w-max shadow-md group-hover:shadow-xl transition-all">
                  Кон Печатницата <ArrowRight className="w-6 h-6 ml-3" />
                </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quote of the Day (Modernized as a floating card) */}
      <section className="max-w-5xl mx-auto px-6 mb-16">
        <div className="relative p-10 md:p-14 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-indigo-950/40 dark:to-blue-900/20 rounded-[2.5rem] shadow-inner border border-blue-100 dark:border-indigo-500/20 overflow-hidden group hover:shadow-lg transition-all duration-300">
          <Quote className="absolute top-10 right-10 w-32 h-32 text-blue-200 dark:text-blue-500/10 opacity-50 transform -rotate-12 group-hover:scale-110 transition-transform duration-700" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-sm font-black tracking-widest text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-2">
                <BrainCircuit className="w-5 h-5" />
                Едукативна Мисла
              </h3>
              <Button 
                variant="outline" 
                onClick={handlePlayQuote}
                disabled={isGeneratingAudio}
                className="rounded-full w-12 h-12 p-0 flex items-center justify-center bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-500/30 shadow-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white transition-all duration-300"
                title={isPlaying ? "Стопирај" : "Слушни аудио"}
              >
                {isGeneratingAudio ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <Square className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 ml-1 fill-current" />
                )}
              </Button>
            </div>
            <blockquote className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 leading-snug mb-8 tracking-tight transition-colors duration-300">
              "{quoteOfDay.text}"
            </blockquote>
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 px-5 py-2.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 inline-block font-semibold text-slate-700 dark:text-slate-300 transition-colors duration-300">
                — {quoteOfDay.author}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modern High-End Footer Teaser for Pricing */}
      <section className="max-w-4xl mx-auto px-6 text-center pt-8 border-t border-slate-200 dark:border-slate-800/50 pb-12">
         <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight transition-colors duration-300">Подготвени да ја трансформирате едукацијата?</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 transition-colors duration-300">Core користењето останува достапно, а Pro е наменет за наставници што сакаат побрз, посигурен и посериозен workflow.</p>
         {!user ? (
            <Button onClick={signInWithGoogle} className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white h-14 px-8 rounded-2xl font-bold font-sans shadow-xl transition-all duration-300">
               Започнете Сега
            </Button>
         ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button onClick={() => navigate('/library')} className="bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white text-white h-14 px-8 rounded-2xl font-bold font-sans shadow-xl transition-all duration-300">
                Кон Библиотеката
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
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Како функционира MathDigitizer Pro?
                </h2>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Затвори модал"
                  title="Затвори"
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Екстракција на задачи</h3>
                    <p className="text-slate-600 dark:text-slate-300">Одете во табулаторот "Екстракција" и внесете линк од YouTube видео со математичко предавање. Нашата вештачка интелигенција ќе ги анализира и извлече сите задачи и теоретски концепти.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Зачувување во Библиотека</h3>
                    <p className="text-slate-600 dark:text-slate-300">Откако задачите ќе бидат извлечени, можете да ги прегледате, да генерирате визуелизации за нив и да ги зачувате во вашата лична "Библиотека" за понатамошна употреба.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Креирање Материјали</h3>
                    <p className="text-slate-600 dark:text-slate-300">Во "Фабрика", изберете ги задачите што ви се потребни и автоматски генерирајте работни листови, тестови или збирки. Можете да ги експортирате во PDF, Word или JSON формат.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">4</div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Организација (To-Do)</h3>
                    <p className="text-slate-600 dark:text-slate-300">Користете ја секцијата "Задачи (To-Do)" за да ги планирате вашите лекции, да следите кои материјали треба да ги подготвите и да поставувате рокови.</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                <Button onClick={() => setShowGuide(false)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Разбрав, започни!
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
