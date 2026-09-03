import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { BrainCircuit, Factory, Sparkles, CheckCircle, FileText, Cpu, Zap, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion } from 'motion/react';
import { MathRenderer } from '../MathRenderer';

interface HeroSectionProps {
  t: TFunction<'home'>;
  user: any;
  signInWithGoogle: () => void;
  kahootPin: string;
  setKahootPin: React.Dispatch<React.SetStateAction<string>>;
  onJoinKahoot: (e: React.FormEvent) => void;
  onShowGuide: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  t,
  user,
  signInWithGoogle,
  kahootPin,
  setKahootPin,
  onJoinKahoot,
  onShowGuide,
}) => {
  const navigate = useNavigate();
  const valuePoints = t('valuePoints', { returnObjects: true }) as string[];
  const workflowSteps = t('workflowSteps', { returnObjects: true }) as { title: string; detail: string }[];

  return (
    <section className="relative overflow-hidden rounded-6xl bg-slate-950 text-white shadow-[0_0_100px_rgba(37,99,235,0.18)] mx-4 lg:mx-8 xl:mx-12 mt-4 px-6 md:px-12 py-16 lg:py-24 transition-colors duration-500 border border-slate-800/80">

      {/* Deep Abstract Animated Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 hover:opacity-30 transition-opacity duration-1000"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] max-w-4xl h-[120%] rounded-[100%] bg-blue-600/20 blur-[150px] pointer-events-none mix-blend-screen"></div>

      {/* Floating Geometric Orbits */}
      <motion.div
        animate={{ y: [0, -40, 0], rotate: [0, 10, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-10 lg:left-32 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-blue-500/5 backdrop-blur-2xl border border-white/10 rounded-5xl flex items-center justify-center text-blue-300 text-3xl shadow-[0_0_40px_rgba(59,130,246,0.2)] hidden md:flex"
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
            {t('hero.title').split(' ')[0]}
            <br />
            <span className="relative inline-block mt-2">
              <span className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 blur-2xl opacity-35"></span>
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-200 to-cyan-200">
                {t('hero.title').split(' ').slice(1).join(' ')}
              </span>
            </span>
          </motion.h1>

          <motion.p
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.35, duration: 0.8 }}
             className="text-lg md:text-2xl text-slate-300 max-w-3xl mb-8 leading-relaxed font-medium text-left"
          >
            {t('hero.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.8 }}
            className="grid gap-3 mb-8"
          >
            {valuePoints.map((point) => (
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
            onClick={onShowGuide}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white transition-colors"
          >
            <FileText className="w-4 h-4" />
            Погледни ја методологијата зад платформата
          </button>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 1 }}
            className="mt-8 w-full max-w-lg"
          >
            <p className="text-xs font-semibold text-slate-400 mb-2.5 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Ученик? Влези со PIN за игра или испит
            </p>
            <form onSubmit={onJoinKahoot} className="flex gap-2">
              <input
                type="text"
                value={kahootPin}
                onChange={(e) => setKahootPin(e.target.value)}
                placeholder="Внеси PIN код"
                className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 h-11 text-white text-sm placeholder-slate-500 focus:ring-1 focus:ring-indigo-500/60 focus:outline-none transition-all font-mono tracking-wider"
              />
              <Button type="submit" size="sm" className="bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-5 h-11 font-semibold text-sm transition-all duration-200 shrink-0">
                Влези
              </Button>
            </form>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.9 }}
          className="relative"
        >
          <div className="rounded-5xl border border-white/10 bg-white/8 backdrop-blur-2xl p-6 md:p-7 shadow-[0_30px_100px_rgba(15,23,42,0.45)]">
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
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-black text-cyan-200">0{index + 1}</div>
                    <div className="text-lg font-black text-white">{step.title}</div>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed">{step.detail}</div>
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
                <div className="text-lg font-black text-white">Директна банка</div>
                <div className="text-sm text-slate-300 mt-1">уплата + потврда → рачна активација</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
