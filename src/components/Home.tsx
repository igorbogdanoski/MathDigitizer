import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, BookOpen, Factory, Wand2, ArrowRight, Sparkles, Quote, Play, Square, Info, X, FileText, Cpu, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { generateSpeech } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="space-y-12 pb-12 animate-in fade-in duration-500">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl">
        {/* Animated Background */}
        <motion.div 
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: [0, 1, -1, 0]
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity,
            ease: "linear" 
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-slate-900/90"></div>
        
        <div className="relative z-10 px-8 py-16 md:py-24 md:px-16 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-sm font-medium mb-6 border border-blue-500/30">
            <Sparkles className="w-4 h-4" />
            <span>Едукативна технологија од следната генерација</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Дигитализирајте ја <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              математиката на светско ниво
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mb-10 leading-relaxed">
            MathDigitizer Pro користи најнапредна Gemini 3.1 Pro вештачка интелигенција за беспрекорна екстракција на задачи, препознавање ракопис и интерактивно поучување преку Сократовиот метод.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {!user ? (
              <Button 
                size="lg" 
                onClick={signInWithGoogle}
                className="bg-blue-600 hover:bg-blue-500 text-white border-none text-base h-14 px-10 rounded-xl shadow-lg shadow-blue-900/20 group"
              >
                <Sparkles className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                Започни бесплатно
              </Button>
            ) : (
              <Button 
                size="lg" 
                onClick={() => navigate('/extract')}
                className="bg-blue-600 hover:bg-blue-500 text-white border-none text-base h-14 px-10 rounded-xl shadow-lg shadow-blue-900/20"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Започни со екстракција
              </Button>
            )}
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setShowGuide(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-base h-14 px-10 rounded-xl backdrop-blur-sm"
            >
              <Info className="w-5 h-5 mr-2" />
              Како функционира?
            </Button>
          </div>
          
          {!user && (
            <p className="mt-6 text-sm text-slate-400">
              Не е потребна кредитна картичка. Пријавете се со Google за неколку секунди.
            </p>
          )}
        </div>
      </section>

      {/* Quote of the Day */}
      <section className="max-w-4xl mx-auto">
        <div className="relative p-8 md:p-10 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-500 to-cyan-400"></div>
          <Quote className="absolute top-6 right-8 w-24 h-24 text-slate-50 dark:text-slate-700 opacity-50 transform -rotate-12 group-hover:scale-110 transition-transform duration-500" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Мисла на денот
              </h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePlayQuote}
                disabled={isGeneratingAudio}
                className="rounded-full w-10 h-10 p-0 flex items-center justify-center dark:border-slate-600 dark:text-slate-300"
                title={isPlaying ? "Стопирај" : "Слушни"}
              >
                {isGeneratingAudio ? (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 ml-1 fill-current" />
                )}
              </Button>
            </div>
            <blockquote className="text-2xl md:text-3xl font-medium text-slate-800 dark:text-slate-100 leading-snug mb-6">
              "{quoteOfDay.text}"
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{quoteOfDay.author}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Познат математичар / научник</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ scale: 1.03, y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/extract')}
          className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-2xl hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wand2 className="w-32 h-32 text-blue-600" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
            <Wand2 className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">Видео & URL Екстракција</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            Претворете YouTube туторијали и веб страни во интерактивни задачи преку моќниот Gemini 3.1 Pro модел.
          </p>
          <div className="flex items-center text-blue-600 dark:text-blue-400 font-bold text-sm tracking-wide uppercase">
            Отвори алатка <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.03, y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/smart-ocr')}
          className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-2xl hover:border-emerald-400 dark:hover:border-emerald-500 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileText className="w-32 h-32 text-emerald-600" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">Smart OCR</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            Скенирајте стари книги или ракописи. Нашиот OCR ги претвора во перфектен LaTeX код во реално време.
          </p>
          <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-sm tracking-wide uppercase">
            Отвори алатка <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.03, y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/library')}
          className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl border border-indigo-500/30 hover:shadow-indigo-500/20 transition-all cursor-pointer group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Cpu className="w-32 h-32 text-indigo-400" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/40 border border-white/10">
            <Cpu className="w-7 h-7 text-white animate-pulse" />
          </div>
          <h3 className="text-2xl font-extrabold text-white mb-3">Pedagogue Command Center</h3>
          <p className="text-slate-400 mb-6 leading-relaxed">
            Влезете во „Оперативната соба“ на математиката. Анализирајте го когнитивниот отпечаток и симулирајте Сократови дијалози.
          </p>
          <div className="flex items-center text-indigo-400 font-bold text-sm tracking-wide uppercase">
            Отвори Центар <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.03, y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/factory')}
          className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-500 transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
            <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">Генератор на Тестови</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            Селектирајте задачи од библиотеката и автоматски генерирајте професионални PDF тестови и работни листови подготвени за печатење.
          </p>
          <div className="flex items-center text-purple-600 dark:text-purple-400 font-bold text-sm tracking-wide uppercase">
            Отвори генератор <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
          </div>
        </motion.div>
      </section>

      {/* Pricing Teaser Section */}
      <section className="py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Изберете го вашиот план</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Започнете бесплатно и надградете кога ќе ви бидат потребни понапредни функционалности за вашето учење или подучување.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm relative">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Основни</h3>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">Бесплатно</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">секогаш</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                До 5 екстракции дневно
              </li>
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Основна библиотека
              </li>
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Ограничени флешкарти
              </li>
            </ul>
            {!user ? (
              <Button onClick={signInWithGoogle} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white border-none h-12 rounded-xl font-semibold">
                Регистрирај се
              </Button>
            ) : (
              <Button disabled className="w-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-none h-12 rounded-xl font-semibold">
                Вашиот моментален план
              </Button>
            )}
          </div>

          {/* Pro Tier */}
          <div className="bg-gradient-to-b from-blue-600 to-indigo-700 rounded-3xl p-8 border border-blue-500 shadow-xl shadow-blue-900/20 relative transform md:-translate-y-4">
            <div className="absolute top-0 right-8 transform -translate-y-1/2">
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-lg">
                Најпопуларно
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Професионални</h3>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-white">$9.99</span>
              <span className="text-blue-200 font-medium">/ месечно</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3 text-blue-50">
                <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Неограничени екстракции
              </li>
              <li className="flex items-center gap-3 text-blue-50">
                <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Напредна аналитика и извештаи
              </li>
              <li className="flex items-center gap-3 text-blue-50">
                <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Генератор на тестови (Фабрика)
              </li>
              <li className="flex items-center gap-3 text-blue-50">
                <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Приоритетна поддршка
              </li>
            </ul>
            <Button 
              onClick={handleUpgradeToPro}
              disabled={isUpgrading || userProfile?.isPro}
              className="w-full bg-white hover:bg-blue-50 text-blue-700 border-none h-12 rounded-xl font-bold shadow-lg"
            >
              {isUpgrading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Процесирање...
                </span>
              ) : userProfile?.isPro ? (
                "Веќе сте Pro корисник"
              ) : (
                "Надгради на Pro"
              )}
            </Button>
          </div>
        </div>
      </section>

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
