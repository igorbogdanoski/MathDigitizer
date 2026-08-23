import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, collection } from 'firebase/firestore';
import { LiveKahootSession } from '../../lib/schema';
import { MathRenderer } from '../MathRenderer';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Play, SkipForward, BarChart, Trophy, LogOut, CheckCircle2, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { playSound } from '../../lib/sound';
import { useTranslation } from 'react-i18next';

export const GameHost = ({ sessionPin }: { sessionPin: string }) => {
  const { t } = useTranslation('kahoot');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<LiveKahootSession | null>(null);

  useEffect(() => {
    if (!sessionPin) return;
    const unsub = onSnapshot(doc(db, 'live_sessions', sessionPin), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as LiveKahootSession;
        setSession(prev => {
          if (prev && prev.status === 'lobby' && data.status === 'playing') playSound('start');
          if (prev && prev.status === 'playing' && data.status === 'discussion') playSound('start');
          if (prev && prev.status !== 'finished' && data.status === 'finished') playSound('win');
          return data;
        });
      }
    });
    return () => unsub();
  }, [sessionPin]);

  if (!session) return (
    <div className="p-10 flex justify-center items-center h-screen" role="status" aria-live="polite" aria-label={t('host.loading')}>
      <div className="animate-spin text-indigo-500 rounded-full w-12 h-12 border-t-2 border-b-2"></div>
    </div>
  );

  const participants = Object.values(session.participants || {});
  const questionCount = session.quiz_data.questions.length;
  const currentQuestion = session.status !== 'lobby' && session.status !== 'finished' 
    ? session.quiz_data.questions[session.current_question_index] 
    : null;

  const startGame = async () => {
    await updateDoc(doc(db, 'live_sessions', sessionPin), {
      status: 'playing',
      current_question_index: 0,
      current_question_start_time: Date.now()
    });
  };

  const nextQuestion = async () => {
    if (session.current_question_index >= questionCount - 1) {
      await updateDoc(doc(db, 'live_sessions', sessionPin), { status: 'finished' });
    } else {
      // Reset participant answers
      const updates: any = {
        status: 'playing',
        current_question_index: session.current_question_index + 1,
        current_question_start_time: Date.now()
      };
      
      const newParticipants = { ...session.participants };
      Object.keys(newParticipants).forEach(uid => {
        newParticipants[uid].has_answered_current = false;
        newParticipants[uid].current_answer_index = undefined;
      });
      updates.participants = newParticipants;
      
      await updateDoc(doc(db, 'live_sessions', sessionPin), updates);
    }
  };

  const enterDiscussion = async () => {
    await updateDoc(doc(db, 'live_sessions', sessionPin), { status: 'discussion' });
  };

  const endGame = async () => {
    // Save to telemetry
    try {
      const batch = [];
      for (const p of participants) {
        batch.push(
          setDoc(doc(collection(db, 'task_attempts')), {
             user_id: p.uid, // Using kahoot guest ID if not logged in
             task_id: `kahoot_${sessionPin}`,
             start_time: new Date(session.created_at).toISOString(),
             end_time: new Date().toISOString(),
             status: 'completed',
             steps_taken: [],
             total_time_spent: Math.floor((Date.now() - session.created_at)/1000),
             total_hints_used: 0,
             mistake_count: Math.floor((1 - (p.score / (questionCount * 1000))) * questionCount), // Estimate
             cognitive_score: p.score,
             curriculum_topic: session.quiz_data.title,
             // Attribution reaches the live session too (Phase 7.1), so a Kahoot
             // round counts towards per-code mastery like any other graded work.
             ...(session.quiz_data.curriculum_refs?.length
               ? { curriculum_refs: session.quiz_data.curriculum_refs }
               : {})
          })
        );
      }
      await Promise.all(batch);
    } catch (e) {
      console.error("Error saving telemetry", e);
    }

    await updateDoc(doc(db, 'live_sessions', sessionPin), { status: 'finished' });
  };

  // Renders
  if (session.status === 'lobby') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        {/* Animated background bubbles */}
        <div className="absolute inset-0 opacity-20">
           <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-3xl animate-blob"></div>
           <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000"></div>
        </div>

        <div className="z-10 text-center space-y-8 max-w-4xl w-full">
           <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 mb-8 mx-auto">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             <span className="text-sm font-bold tracking-widest uppercase">{t('host.waitingRoom')}</span>
           </div>

           <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
             {session.quiz_data.title}
           </h1>

           <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 mt-8 flex flex-col md:flex-row items-center gap-10">
             <div className="flex-1 text-center">
               <p className="text-slate-400 font-bold uppercase tracking-widest mb-4">{t('host.gamePinLabel', { host: window.location.host })}</p>
               <div
                 className="text-7xl md:text-8xl font-black tracking-widest text-indigo-400 [text-shadow:_0_0_30px_rgb(99_102_241_/_40%)]"
                 aria-label={t('host.gamePinAria', { pin: session.id })}
               >
                 {session.id}
               </div>
             </div>
             <div className="flex flex-col items-center gap-3 shrink-0">
               <div className="p-3 bg-white rounded-2xl shadow-lg">
                 <QRCodeSVG
                   value={`${window.location.origin}/play?pin=${session.id}`}
                   size={140}
                   bgColor="#ffffff"
                   fgColor="#1e1b4b"
                   level="M"
                   title={t('host.qrAlt')}
                 />
               </div>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('host.scanToJoin')}</p>
             </div>
           </div>

           <div className="flex flex-col md:flex-row items-center justify-between mt-12 bg-slate-900/50 p-6 rounded-2xl border border-white/5 gap-4">
             <div className="flex items-center gap-3">
               <Users className="w-8 h-8 text-slate-400" aria-hidden="true" />
               <span className="text-2xl font-bold" aria-live="polite">{t('host.joinedCount', { count: participants.length })}</span>
             </div>
             <Button
               onClick={startGame}
               disabled={participants.length === 0}
               size="lg"
               className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-8 rounded-xl"
             >
               {t('host.start')} <Play className="w-5 h-5 ml-2" aria-hidden="true" />
             </Button>
           </div>

           <div className="flex flex-wrap gap-4 justify-center mt-8" role="list" aria-label={t('host.participantsList')}>
              {participants.map(p => (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={p.uid} role="listitem" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-lg">
                  {p.name}
                </motion.div>
              ))}
           </div>
        </div>
      </div>
    );
  }

  if (session.status === 'playing' || session.status === 'discussion') {
    const answeredCount = participants.filter(p => p.has_answered_current).length;
    
    // Calculate stats if discussion
    const stats: Record<number, number> = {};
    if (session.status === 'discussion') {
      currentQuestion?.options.forEach((_: any, i: number) => stats[i] = 0);
      participants.forEach(p => {
        if (p.current_answer_index !== undefined) {
          stats[p.current_answer_index] = (stats[p.current_answer_index] || 0) + 1;
        }
      });
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col p-6 transition-colors">
        <header className="flex justify-between items-center mb-8 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
          {session.status === 'playing' && session.current_question_start_time && currentQuestion?.timeLimit && (
             <div
               className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all ease-linear"
               role="progressbar"
               aria-label={t('host.timeRemaining')}
               aria-valuemin={0}
               aria-valuemax={currentQuestion.timeLimit}
               style={{
                 width: '100%',
                 animation: `shrink ${currentQuestion.timeLimit}s linear forwards`
               }}>
             </div>
          )}
          <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>

          <div className="flex items-center gap-4 relative z-10">
            <div
              className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold px-4 py-2 rounded-lg"
              aria-label={t('host.gamePinAria', { pin: session.id })}
            >
              PIN: {session.id}
            </div>
            <div className="text-sm font-bold text-slate-500">
              {t('host.questionProgress', { current: session.current_question_index + 1, total: questionCount })}
            </div>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <span className="font-bold text-slate-700 dark:text-slate-300" aria-live="polite">
              {t('host.answersProgress', { answered: answeredCount, total: participants.length })}
            </span>
            <Button variant="outline" onClick={endGame} size="sm" className="border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">{t('host.endGame')}</Button>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto flex flex-col gap-8 relative z-10">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
            <h2 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              <MathRenderer content={currentQuestion?.question || ''} />
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
            {currentQuestion?.options.map((opt: string, i: number) => {
              const isCorrect = i === currentQuestion.correctIndex;
              const isDiscussion = session.status === 'discussion';
              
              // Colors matching Kahoot style (Red, Blue, Yellow, Green)
              const colors = [
                'bg-red-500 hover:bg-red-600', 
                'bg-blue-500 hover:bg-blue-600', 
                'bg-yellow-500 hover:bg-yellow-600', 
                'bg-emerald-500 hover:bg-emerald-600'
              ];
              const colorClass = colors[i % colors.length];
              
              // If discussion, dim wrong answers
              const displayClass = isDiscussion && !isCorrect 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 opacity-50' 
                : colorClass;

              const optionAria = t('host.optionAria', { letter: String.fromCharCode(65 + i), text: opt })
                + (isDiscussion && isCorrect ? ` — ${t('host.correctAria')}` : '')
                + (isDiscussion ? ` — ${t('host.votesAria', { count: stats[i] || 0 })}` : '');

              return (
                <div
                  key={i}
                  role="listitem"
                  aria-label={optionAria}
                  className={`relative p-8 rounded-2xl flex items-center justify-center transition-all ${displayClass} ${!isDiscussion ? 'shadow-[0_8px_0_rgba(0,0,0,0.2)]' : ''}`}
                >
                  <span className="absolute top-4 left-4 text-white/50 font-black text-2xl" aria-hidden="true">{String.fromCharCode(65+i)}</span>
                  <div className={`text-2xl font-bold ${isDiscussion && !isCorrect ? 'text-slate-500' : 'text-white'}`}>
                    <MathRenderer content={opt} />
                  </div>
                  
                  {isDiscussion && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       {isCorrect && <CheckCircle2 className="w-8 h-8 text-white animate-bounce" aria-hidden="true" />}
                       <span className="bg-black/20 text-white px-3 py-1 rounded-full font-bold">
                         {stats[i] || 0}
                       </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-auto flex justify-center py-6">
            {session.status === 'playing' ? (
              <Button size="lg" onClick={enterDiscussion} className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 h-16 rounded-2xl text-xl shadow-xl">
                <BarChart className="w-6 h-6 mr-3" aria-hidden="true" /> {t('host.lockAndDiscuss')}
              </Button>
            ) : (
              <Button size="lg" onClick={nextQuestion} className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 h-16 rounded-2xl text-xl shadow-xl">
                {session.current_question_index >= questionCount - 1 ? t('host.showPodium') : t('host.nextQuestion')} <SkipForward className="w-6 h-6 ml-3" aria-hidden="true" />
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Podium
  const sortedParticipants = [...participants].sort((a,b) => b.score - a.score);
  // Visual order is 2nd — 1st — 3rd; place is the actual ranking.
  const podiumSlots = [
    { place: 2, index: 1, y: 200, box: 'bg-slate-300 h-64', rank: 'text-5xl text-slate-600', score: 'text-lg text-slate-500' },
    { place: 1, index: 0, y: 300, box: 'bg-yellow-400 h-80', rank: 'text-6xl text-yellow-700', score: 'text-xl text-yellow-800' },
    { place: 3, index: 2, y: 150, box: 'bg-amber-700 h-48', rank: 'text-4xl text-amber-900', score: 'text-lg text-amber-900' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[#ffd700]/10"></div>
      <div className="z-10 text-center space-y-12 max-w-4xl w-full">
         <Trophy className="w-32 h-32 mx-auto text-yellow-400 mb-8 [filter:drop-shadow(0_0_30px_rgba(250,204,21,0.5))]" aria-hidden="true" />
         <h1 className="text-6xl font-black mb-12">{t('host.finalPodium')}</h1>

         <ol className="flex justify-center items-end gap-6 h-96 list-none">
           {podiumSlots.map(slot => {
             const p = sortedParticipants[slot.index];
             if (!p) return null;
             return (
               <motion.li
                 key={p.uid}
                 initial={{ y: slot.y }}
                 animate={{ y: 0 }}
                 aria-label={t('host.podiumPlace', { place: slot.place, name: p.name, score: p.score })}
                 className={`w-1/3 rounded-t-3xl flex flex-col items-center p-6 relative ${slot.box}`}
               >
                 <div className="absolute -top-16 text-3xl font-bold bg-slate-800 px-6 py-2 rounded-full">{p.name}</div>
                 <span className={`font-black mt-auto ${slot.rank}`} aria-hidden="true">{slot.place}</span>
                 <span className={`font-bold ${slot.score}`}>{t('host.points', { score: p.score })}</span>
               </motion.li>
             );
           })}
         </ol>

         <Button onClick={() => navigate('/library')} className="mt-12 bg-white text-slate-900">
           {t('host.leaveGame')}
         </Button>
      </div>
    </div>
  );
};
