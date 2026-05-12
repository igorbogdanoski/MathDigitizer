import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, BookOpen, Factory, Wand2, ArrowRight, Sparkles, Quote, Play, Square, Info, X, FileText, Cpu, ShieldCheck, CheckCircle, FileType2, Zap, Users } from 'lucide-react';
import { Button } from './ui/Button';
import { generateSpeech } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import { MathRenderer } from './MathRenderer';

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

interface HomeProps {
  setActiveTab?: (tab: 'home' | 'extract' | 'library' | 'factory') => void;
  user: any;
  signInWithGoogle: () => void;
}

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export const Home: React.FC<HomeProps> = ({ user, signInWithGoogle }) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [quoteOfDay, setQuoteOfDay] = useState(MATH_QUOTES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [kahootPin, setKahootPin] = useState('');

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
    
    setIsUpgrading(true);
    try {
      // Simulate Stripe Checkout delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update user profile in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { isPro: true });
      
      alert("Успешно се претплативте на Pro верзијата! (Ова е симулација)");
    } catch (error) {
      console.error("Error upgrading to Pro:", error);
      alert("Настана грешка при процесирање на плаќањето.");
    } finally {
      setIsUpgrading(false);
    }
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
      alert("Неуспешно генерирање на аудио. Обидете се повторно.");
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
      <Helmet>
        <title>MathDigitizer Pro | Напредна едукација и математика</title>
        <meta name="description" content="Водечка AI едукативна платформа за математика на македонски јазик. Беспрекорна дигитализација, OCR екстракција од YouTube/слики, автоматизирано Bloom/DOK оценување и интерактивни Live MathKahoot натпревари." />
        <meta name="keywords" content="математика, AI, автоматизирано оценување, генератор на задачи, OCR математика, Live MathKahoot, Bloom's Taxonomy, едукација, македонски јазик, MathDigitizer Pro, EdTech, настава, учење" />
        <meta name="author" content="Игор Богданоски" />
        <link rel="canonical" href="https://mathdigitizer.pro" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://mathdigitizer.pro/" />
        <meta property="og:title" content="MathDigitizer Pro | Напредна AI Интелигентна Едукација" />
        <meta property="og:description" content="Едукативна платформа без компромиси. Користи Gemini 3.1 Pro за Multimodal LaTeX Екстракција од видео и слика, Live MathKahoot натпревари, и Bloom's Smart Auto-Grader кој автоматски лоцира грешки во ракопис." />
        <meta property="og:image" content="/og-image.jpg" />
        <meta property="og:site_name" content="MathDigitizer Pro" />
        <meta property="og:locale" content="mk_MK" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://mathdigitizer.pro/" />
        <meta name="twitter:title" content="MathDigitizer Pro | Напредна AI Интелигентна Едукација" />
        <meta name="twitter:description" content="Едукативна платформа без компромиси. Користи Gemini 3.1 Pro за Multimodal LaTeX Екстракција од видео и слика, Live MathKahoot натпревари, и Bloom's Smart Auto-Grader кој автоматски лоцира грешки во ракопис." />
        <meta name="twitter:image" content="/og-image.jpg" />

        {/* Advanced SEO: JSON-LD Structured Data for EdTech */}
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "MathDigitizer Pro",
              "alternateName": "MathDigitizer",
              "url": "https://mathdigitizer.pro",
              "applicationCategory": "EducationalApplication",
              "operatingSystem": "All",
              "inLanguage": "mk",
              "softwareVersion": "3.1",
              "creator": {
                "@type": "Person",
                "name": "Игор Богданоски"
              },
              "offers": {
                "@type": "Offer",
                "price": "0.00",
                "priceCurrency": "MKD",
                "availability": "https://schema.org/InStock",
                "category": "EdTech"
              },
              "description": "Платформа за автоматска AI екстракција на математика, Dugga онлајн испити и автоматско оценување.",
              "featureList": [
                "Multimodal LaTeX Екстракција",
                "Smart Auto-Grader",
                "Live MathKahoot",
                "Bloom Taxonomy Analytics",
                "NanoBanana Visualization"
              ],
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "bestRating": "5",
                "worstRating": "1",
                "ratingCount": "1250"
              }
            }
          `}
        </script>
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              "name": "MathDigitizer Pro Education",
              "url": "https://mathdigitizer.pro",
              "logo": "https://mathdigitizer.pro/pwa-icon.svg",
              "sameAs": []
            }
          `}
        </script>
      </Helmet>
      
      {/* Advanced Hero Section (World-Class EdTech Landing) */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 dark:bg-slate-950 text-white shadow-[0_0_100px_rgba(37,99,235,0.2)] mx-4 lg:mx-8 xl:mx-12 mt-4 px-6 md:px-12 py-20 lg:py-40 flex flex-col items-center text-center transition-colors duration-500 border border-slate-800 dark:border-slate-800/80">
        
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

        <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">
          <motion.div 
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 0.8, type: "spring" }}
             className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-800/80 text-blue-300 text-xs sm:text-sm font-black mb-10 border border-blue-500/30 backdrop-blur-xl shadow-[0_0_30px_rgba(59,130,246,0.3)] tracking-widest uppercase"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">Едукативна платформа од следната генерација</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
            className="text-6xl md:text-8xl lg:text-[7rem] font-black tracking-tighter mb-8 leading-[0.95]"
          >
            Еволуција на <br className="hidden md:block" />
            <span className="relative inline-block mt-2">
              <span className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 blur-2xl opacity-40"></span>
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">
                 математиката
              </span>
            </span> 
          </motion.h1>
          
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.4, duration: 0.8 }}
             className="text-lg md:text-2xl text-slate-300 max-w-3xl mb-14 leading-relaxed font-medium"
          >
            Ги спојуваме <strong className="text-white">Dugga испитните стандарди</strong>, <strong className="text-rose-300">Kahoot! гемификацијата</strong> и моќната <strong className="text-blue-300">Gemini 3.1 Pro AI екстракција</strong> во еден врвен систем.
          </motion.div>
          
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.6, duration: 0.8 }}
             className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto relative z-20"
          >
            {!user ? (
              <Button 
                size="lg" 
                onClick={signInWithGoogle}
                className="bg-white hover:bg-slate-100 text-slate-900 border-none text-lg h-16 px-10 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] group overflow-hidden relative transition-all duration-300"
              >
                <div className="absolute inset-0 bg-blue-100 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Sparkles className="w-6 h-6 mr-3 group-hover:animate-pulse relative z-10 text-blue-600" />
                <span className="relative z-10 font-black">Регистрирај се Бесплатно</span>
              </Button>
            ) : (
              <Button 
                size="lg" 
                onClick={() => navigate('/classrooms')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white border-none text-lg h-16 px-10 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_rgba(79,70,229,0.7)] group overflow-hidden relative transition-all duration-300"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Factory className="w-6 h-6 mr-3 relative z-10" />
                <span className="relative z-10 font-black">Оди во Контролниот Центар</span>
              </Button>
            )}
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setShowGuide(true)}
              className="bg-slate-800/50 hover:bg-slate-700/50 text-white border-slate-600 text-lg h-16 px-10 rounded-2xl backdrop-blur-xl transition-all duration-300"
            >
              <FileText className="w-6 h-6 mr-3" />
              <span className="font-bold">Методологија</span>
            </Button>
          </motion.div>
          
          {/* Quick Kahoot Entry Component */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-20 w-full max-w-xl mx-auto"
          >
             <div className="flex items-center justify-center gap-3 mb-4">
               <div className="h-px w-10 bg-slate-700"></div>
               <p className="text-xs font-black uppercase tracking-widest text-slate-400">Студентски Портал</p>
               <div className="h-px w-10 bg-slate-700"></div>
             </div>
             <div className="bg-slate-800/40 p-3 rounded-[2rem] backdrop-blur-2xl border border-slate-700 shadow-2xl transition-all duration-500 focus-within:bg-slate-800/80 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_40px_rgba(79,70,229,0.3)]">
              <form onSubmit={handleJoinKahoot} className="flex gap-3">
                <div className="relative flex-1">
                   <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                   <input 
                     type="text" 
                     value={kahootPin}
                     onChange={(e) => setKahootPin(e.target.value)}
                     placeholder="Внеси ПИН за Игра / Испит..." 
                     className="w-full bg-slate-900/50 border border-slate-600/50 rounded-2xl pl-14 pr-6 h-16 text-white text-xl placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-mono font-black tracking-wider text-center"
                   />
                </div>
                <Button type="submit" className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-white rounded-2xl px-10 h-16 font-black text-xl shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300 hover:scale-105 active:scale-95">
                  ВЛЕЗИ
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Stats Tape (Updated) */}
      <div className="border-y border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/50 py-6 transition-colors duration-500 shadow-sm overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white dark:from-slate-900 dark:via-transparent dark:to-slate-900 z-10 w-full pointer-events-none"></div>
         <div className="max-w-7xl mx-auto px-6 flex justify-center items-center gap-10 md:gap-16 text-slate-500 dark:text-slate-400 font-bold text-sm md:text-lg animate-[pulse_4s_ease-in-out_infinite]">
            <div className="flex items-center gap-3 shrink-0"><CheckCircle className="w-6 h-6 text-emerald-500"/> Dugga Enterprise Испити</div>
            <div className="flex items-center gap-3 shrink-0"><Cpu className="w-6 h-6 text-blue-500"/> Gemini 3.1 Pro Engine</div>
            <div className="flex items-center gap-3 shrink-0"><Play className="w-6 h-6 text-rose-500"/> MathKahoot Интеракција</div>
            <div className="flex items-center gap-3 shrink-0"><ShieldCheck className="w-6 h-6 text-indigo-500"/> SRS Адаптивни Тестови</div>
         </div>
      </div>

      {/* Advanced Bento Grid Features */}
      <section className="max-w-[85rem] mx-auto px-6 py-20">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 text-center tracking-tighter">Напреден Едукативен Екосистем</h2>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-16 text-lg max-w-2xl mx-auto font-medium">Конструиран за десеткратно зголемување на продуктивноста на наставникот и ангажманот на ученикот.</p>
        
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
         <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 transition-colors duration-300">Платформата е целосно бесплатна за едукатори во бета тестирање.</p>
         {!user ? (
            <Button onClick={signInWithGoogle} className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white h-14 px-8 rounded-2xl font-bold font-sans shadow-xl transition-all duration-300">
               Започнете Сега
            </Button>
         ) : (
            <Button onClick={() => navigate('/extract')} className="bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white text-white h-14 px-8 rounded-2xl font-bold font-sans shadow-xl transition-all duration-300">
               Кон Библиотеката
            </Button>
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
          <div className="text-sm text-slate-500 dark:text-slate-400">
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
                  onClick={() => setShowGuide(false)}
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
