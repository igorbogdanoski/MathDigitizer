import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, BookOpen, Factory, Wand2, ArrowRight, Sparkles, Quote, Play, Square, Info, X, FileText, Cpu, ShieldCheck, CheckCircle, FileType2 } from 'lucide-react';
import { Button } from './ui/Button';
import { generateSpeech } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Helmet } from 'react-helmet-async';

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
        <meta name="description" content="Дигитализирајте ја математиката на светско ниво. Напредна едукативна платформа со AI екстракција, Dugga испити, и Bloom's оценување." />
        <meta name="keywords" content="математика, AI, Dugga, испити, екстракција, едукација, македонски, MathDigitizer, MathKahoot, онлајн" />
        <link rel="canonical" href="https://mathdigitizer.mk" />
        <meta property="og:title" content="MathDigitizer Pro | Дигитализирајте ја математиката" />
        <meta property="og:description" content="Водечка AI платформа за математичка едукација со вграден Dugga режим, Кахут квизови и напредни алатки за наставници." />
        <meta name="twitter:card" content="summary_large_image" />
        {/* Advanced SEO: JSON-LD Structured Data for EdTech */}
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "MathDigitizer Pro",
              "applicationCategory": "EducationalApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "MKD"
              },
              "description": "Платформа за автоматска AI екстракција на математика, Dugga онлајн испити, и автоматско оценување.",
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "1250"
              }
            }
          `}
        </script>
      </Helmet>
      
      {/* Hero Section (World-Class EdTech Landing) */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 dark:bg-slate-950 text-white shadow-2xl mx-4 lg:mx-8 xl:mx-12 mt-4 px-6 py-20 lg:py-32 flex flex-col items-center text-center transition-colors duration-300 border border-slate-800 dark:border-slate-800/50">
        {/* Abstract Grid and Gradients Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full rounded-full bg-blue-600/20 blur-[120px] pointer-events-none"></div>

        {/* Floating Geometric/Math Orbits (Motion) */}
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} 
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-10 lg:left-32 w-16 h-16 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-blue-300 font-mono text-2xl shadow-2xl hidden md:flex"
        >
          ∫
        </motion.div>
        <motion.div 
          animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }} 
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-20 right-10 lg:right-32 w-20 h-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-indigo-300 font-mono text-xl shadow-2xl hidden md:flex"
        >
          E=mc²
        </motion.div>

        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center">
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-300 text-sm font-semibold mb-8 border border-blue-500/20 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.15)]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Платформа од следната генерација</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tight mb-8 leading-[1.05]"
          >
            Дигитализирајте ја <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-300">
               математиката 
            </span> на <br className="hidden lg:block"/> светско ниво
          </motion.h1>
          
          <motion.p 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="text-lg md:text-2xl text-slate-300 max-w-2xl mb-12 leading-relaxed"
          >
            Интегриран Dugga испитен режим, AI екстракција од видеа и автоматско оценување по Блум.
          </motion.p>
          
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.3 }}
             className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            {!user ? (
              <Button 
                size="lg" 
                onClick={signInWithGoogle}
                className="bg-blue-600 hover:bg-blue-500 text-white border-none text-base h-16 px-10 rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.4)] hover:shadow-[0_0_50px_rgba(37,99,235,0.6)] group overflow-hidden relative transition-all duration-300"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Sparkles className="w-5 h-5 mr-3 group-hover:animate-pulse relative z-10" />
                <span className="relative z-10 font-bold">Регистрирај се Бесплатно</span>
              </Button>
            ) : (
              <Button 
                size="lg" 
                onClick={() => navigate('/classrooms')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white border-none text-base h-16 px-10 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_50px_rgba(79,70,229,0.6)] group overflow-hidden relative transition-all duration-300"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Factory className="w-5 h-5 mr-3 relative z-10" />
                <span className="relative z-10 font-bold">Оди во Контролниот Центар</span>
              </Button>
            )}
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setShowGuide(true)}
              className="bg-white/5 hover:bg-white/10 text-white border-white/10 text-base h-16 px-10 rounded-2xl backdrop-blur-md transition-all duration-300"
            >
              <Info className="w-5 h-5 mr-3" />
              <span className="font-bold">Како функционира?</span>
            </Button>
          </motion.div>
          
          {/* Quick Join Component */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="mt-14 w-full max-w-md mx-auto"
          >
             <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Приклучок за Ученици</p>
             <div className="bg-white/5 p-2 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 focus-within:bg-white/10 focus-within:border-white/20">
              <form onSubmit={handleJoinKahoot} className="flex gap-2">
                <input 
                  type="text" 
                  value={kahootPin}
                  onChange={(e) => setKahootPin(e.target.value)}
                  placeholder="Внесете ПИН или Испит Код..." 
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono font-bold tracking-widest text-center"
                />
                <Button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl px-6 h-12 font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300">
                  Влези
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Stats Tape */}
      <div className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden py-4 transition-colors duration-300 shadow-sm">
         <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center sm:justify-between items-center gap-8 text-slate-500 dark:text-slate-400 font-semibold text-sm md:text-base">
            <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400"/> Dugga Официјален Режим</div>
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-blue-500 dark:text-blue-400"/> Gemini 3.1 Pro Мотор</div>
            <div className="flex items-center gap-2"><FileType2 className="w-5 h-5 text-rose-500 dark:text-rose-400"/> Инстант PDF Збирки</div>
            <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-500 dark:text-indigo-400"/> Блум Оценување</div>
         </div>
      </div>

      {/* Modern Bento Grid Features (World-Class Design) */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-12 text-center tracking-tight transition-colors duration-300">Мудро конструиран едукативен екосистем</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Focus: Dugga Exams (Spans 2 columns) */}
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/exams-grading')}
            className="md:col-span-2 bg-gradient-to-br from-indigo-900 to-slate-900 dark:from-indigo-950 dark:to-slate-950 p-8 md:p-12 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:shadow-indigo-900/20 transition-all cursor-pointer group relative overflow-hidden border border-transparent dark:border-slate-800/50"
          >
            <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500/20 blur-3xl rounded-full"></div>
            <div className="relative z-10 flex flex-col h-full">
               <div className="w-16 h-16 bg-white/10 backdrop-blur border border-white/20 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                 <ShieldCheck className="w-8 h-8 text-indigo-300" />
               </div>
               <h3 className="text-3xl font-black text-white mb-4">Dugga Центар за Оценување</h3>
               <p className="text-lg text-indigo-100/80 mb-8 max-w-md leading-relaxed">
                 Сумативно онлајн тестирање во безбедна "lockdown" околина, автоматско бодување и телеметрија во реално време за секој ученик.
               </p>
               <div className="mt-auto flex items-center text-white font-bold tracking-wide">
                 Погледни Испити <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
               </div>
            </div>
            {/* Visual Deco */}
            <div className="hidden md:block absolute right-8 bottom-8 left-1/2 ml-16 top-8 bg-slate-800/50 rounded-2xl border border-white/10 p-6 overflow-hidden">
               <div className="space-y-4">
                  <div className="h-6 w-1/3 bg-indigo-500/20 rounded"></div>
                  <div className="h-4 w-3/4 bg-white/5 rounded"></div>
                  <div className="h-4 w-full bg-white/5 rounded"></div>
                  <div className="mt-8 flex gap-2">
                     <div className="h-10 w-24 bg-emerald-500/20 border border-emerald-500/50 rounded-lg"></div>
                     <div className="h-10 w-24 bg-white/5 rounded-lg"></div>
                  </div>
               </div>
            </div>
          </motion.div>

          {/* AI Extractor */}
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/extract')}
            className="md:col-span-1 bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer group flex flex-col relative overflow-hidden"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
              <Wand2 className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 transition-colors duration-300">AI Екстракција</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 flex-1 leading-relaxed transition-colors duration-300">
              Вметнете YouTube линк или слика. Платформата ќе ги извлече сите задачи со прецизен LaTeX.
            </p>
            <div className="flex items-center text-blue-600 dark:text-blue-400 font-bold tracking-wide mt-auto transition-colors duration-300">
              Дигитализирај <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>

          {/* MathKahoot */}
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/library')}
            className="md:col-span-1 bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer group flex flex-col relative overflow-hidden"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/30">
              <Play className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 transition-colors duration-300">MathKahoot!</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 flex-1 leading-relaxed transition-colors duration-300">
              Моќна гемификација на училницата. Интерактивни квизови во реално време, идеални за ученици.
            </p>
            <div className="flex items-center text-rose-500 dark:text-rose-400 font-bold tracking-wide mt-auto transition-colors duration-300">
              Играј веднаш <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>

          {/* DOK & PDF Factory */}
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/classrooms')}
            className="md:col-span-2 bg-slate-800 dark:bg-slate-900 p-8 md:p-12 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all cursor-pointer group flex flex-col relative overflow-hidden border border-transparent dark:border-slate-800/50"
          >
            {/* Visual Deco */}
            <div className="absolute right-0 top-0 opacity-10">
               <Cpu className="w-64 h-64 text-amber-500 transform translate-x-1/4 -translate-y-1/4 group-hover:rotate-12 transition-transform duration-700 ease-out" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full md:w-3/5">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-amber-500/30">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-black text-white mb-4">Фабрика за Тестови</h3>
                <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                  Генерирајте инстант работни листови, скрипти и учебници спремни за печатење. Одредете ја тежината според DOK.
                </p>
                <div className="flex items-center text-amber-400 font-bold tracking-wide mt-auto">
                  Конструирај PDF <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
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
