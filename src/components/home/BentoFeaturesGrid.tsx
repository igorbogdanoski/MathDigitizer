import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Wand2, ArrowRight, Play, ShieldCheck, FileType2 } from 'lucide-react';
import { motion } from 'motion/react';

export const BentoFeaturesGrid: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="max-w-[85rem] mx-auto px-6 py-20">
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 text-center tracking-tighter">Изграден за реален училиштен workflow</h2>
      <p className="text-slate-500 dark:text-slate-400 text-center mb-16 text-lg max-w-3xl mx-auto font-medium">Наместо да продава десетици неповрзани AI функции, Home сега јасно покажува како платформата води од извор до анализа, материјали и live classroom delivery.</p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Main Focus: Live Kahoot Mode (Spans 12 cols) */}
        <motion.div
          whileHover={{ y: -8, scale: 1.01 }}
          onClick={() => navigate('/library')}
          className="md:col-span-12 bg-gradient-to-br from-rose-700 to-orange-700 dark:from-rose-900 dark:to-orange-900 p-10 md:p-14 rounded-7xl shadow-2xl hover:shadow-rose-500/30 transition-all duration-500 cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute -right-20 -top-20 w-[600px] h-[600px] bg-white/10 blur-[80px] rounded-full mix-blend-overlay"></div>
          <div className="relative z-10 flex flex-col h-full w-full md:w-2/3">
             <div className="w-20 h-20 bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
               <Play className="w-10 h-10 text-white fill-white" />
             </div>
             <h3 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">MathKahoot!<br/>Жива Училница</h3>
             <p className="text-xl text-rose-50 mb-10 leading-relaxed font-semibold">
               Претворете ги задачите во интерактивна трка. Прикажете го PIN-от на проектор и гледајте како гемификацијата го зголемува фокусот 10x.
             </p>
             <div className="mt-auto inline-flex items-center bg-white text-rose-600 font-black text-lg px-8 py-4 rounded-2xl w-max shadow-xl group-hover:scale-105 transition-transform">
               Започни Сесија <ArrowRight className="w-6 h-6 ml-3" />
             </div>
          </div>
          {/* Kahoot Decor Graphic */}
          <div className="hidden md:flex absolute -right-10 bottom-0 top-0 items-center justify-center w-1/2 pointer-events-none">
              <div className="w-full max-w-sm h-3/4 bg-white/10 backdrop-blur-md rounded-l-7xl border-y border-l border-white/20 p-8 shadow-2xl flex flex-col justify-center gap-4">
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
          className="md:col-span-6 bg-white dark:bg-slate-800 p-10 rounded-7xl shadow-xl hover:shadow-2xl border border-slate-200 dark:border-slate-700 transition-all duration-500 cursor-pointer group flex flex-col relative overflow-hidden"
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
          className="md:col-span-6 bg-slate-100 dark:bg-slate-800/50 p-10 md:p-14 rounded-7xl shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer group flex flex-col relative overflow-hidden border border-slate-200 dark:border-slate-700"
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
  );
};
