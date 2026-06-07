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

export const GameHost = ({ sessionPin }: { sessionPin: string }) => {
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

  if (!session) return <div className="p-10 flex justify-center items-center h-screen"><div className="animate-spin text-indigo-500 rounded-full w-12 h-12 border-t-2 border-b-2"></div></div>;

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
             curriculum_topic: session.quiz_data.title
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
             <span className="text-sm font-bold tracking-widest uppercase">Live Session Waiting Room</span>
           </div>

           <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
             {session.quiz_data.title}
           </h1>

           <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 mt-8 flex flex-col md:flex-row items-center gap-10">
             <div className="flex-1 text-center">
               <p className="text-slate-400 font-bold uppercase tracking-widest mb-4">Game PIN (Се приклучуваат на {window.location.host}/play)</p>
               <div className="text-7xl md:text-8xl font-black tracking-widest text-indigo-400 [text-shadow:_0_0_30px_rgb(99_102_241_/_40%)]">
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
                 />
               </div>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Скенирај за да се приклучиш</p>
             </div>
           </div>

           <div className="flex flex-col md:flex-row items-center justify-between mt-12 bg-slate-900/50 p-6 rounded-2xl border border-white/5 gap-4">
             <div className="flex items-center gap-3">
               <Users className="w-8 h-8 text-slate-400" />
               <span className="text-2xl font-bold">{participants.length} Приклучени</span>
             </div>
             <Button 
               onClick={startGame} 
               disabled={participants.length === 0}
               size="lg" 
               className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-8 rounded-xl"
             >
               Започни <Play className="w-5 h-5 ml-2" />
             </Button>
           </div>
           
           <div className="flex flex-wrap gap-4 justify-center mt-8">
              {participants.map(p => (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={p.uid} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-lg">
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
             <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all ease-linear" style={{
               width: '100%',
               animation: `shrink ${currentQuestion.timeLimit}s linear forwards`
             }}>
             </div>
          )}
          <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>

          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold px-4 py-2 rounded-lg">
              PIN: {session.id}
            </div>
            <div className="text-sm font-bold text-slate-500">
              Q: {session.current_question_index + 1} / {questionCount}
            </div>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {answeredCount} / {participants.length} Answers
            </span>
            <Button variant="outline" onClick={endGame} size="sm" className="border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">End Game</Button>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto flex flex-col gap-8 relative z-10">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
            <h2 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              <MathRenderer content={currentQuestion?.question || ''} />
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              return (
                <div key={i} className={`relative p-8 rounded-2xl flex items-center justify-center transition-all ${displayClass} ${!isDiscussion ? 'shadow-[0_8px_0_rgba(0,0,0,0.2)]' : ''}`}>
                  <span className="absolute top-4 left-4 text-white/50 font-black text-2xl">{String.fromCharCode(65+i)}</span>
                  <div className={`text-2xl font-bold ${isDiscussion && !isCorrect ? 'text-slate-500' : 'text-white'}`}>
                    <MathRenderer content={opt} />
                  </div>
                  
                  {isDiscussion && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       {isCorrect && <CheckCircle2 className="w-8 h-8 text-white animate-bounce" />}
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
                <BarChart className="w-6 h-6 mr-3" /> Заклучи одговори & Дискутирај
              </Button>
            ) : (
              <Button size="lg" onClick={nextQuestion} className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 h-16 rounded-2xl text-xl shadow-xl">
                {session.current_question_index >= questionCount - 1 ? 'Прикажи Подиум' : 'Следно прашање'} <SkipForward className="w-6 h-6 ml-3" />
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Podium
  const sortedParticipants = [...participants].sort((a,b) => b.score - a.score);
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[#ffd700]/10"></div>
      <div className="z-10 text-center space-y-12 max-w-4xl w-full">
         <Trophy className="w-32 h-32 mx-auto text-yellow-400 mb-8 [filter:drop-shadow(0_0_30px_rgba(250,204,21,0.5))]" />
         <h1 className="text-6xl font-black mb-12">Финален Подиум</h1>
         
         <div className="flex justify-center items-end gap-6 h-96">
           {sortedParticipants[1] && (
             <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="w-1/3 bg-slate-300 rounded-t-3xl h-64 flex flex-col items-center p-6 relative">
               <div className="absolute -top-16 text-3xl font-bold bg-slate-800 px-6 py-2 rounded-full">{sortedParticipants[1].name}</div>
               <span className="text-5xl font-black text-slate-600 mt-auto">2</span>
               <span className="text-lg font-bold text-slate-500">{sortedParticipants[1].score} бодови</span>
             </motion.div>
           )}
           {sortedParticipants[0] && (
             <motion.div initial={{ y: 300 }} animate={{ y: 0 }} className="w-1/3 bg-yellow-400 rounded-t-3xl h-80 flex flex-col items-center p-6 relative">
               <div className="absolute -top-16 text-3xl font-bold bg-slate-800 px-6 py-2 rounded-full">{sortedParticipants[0].name}</div>
               <span className="text-6xl font-black text-yellow-700 mt-auto">1</span>
               <span className="text-xl font-bold text-yellow-800">{sortedParticipants[0].score} бодови</span>
             </motion.div>
           )}
           {sortedParticipants[2] && (
             <motion.div initial={{ y: 150 }} animate={{ y: 0 }} className="w-1/3 bg-amber-700 rounded-t-3xl h-48 flex flex-col items-center p-6 relative">
               <div className="absolute -top-16 text-3xl font-bold bg-slate-800 px-6 py-2 rounded-full">{sortedParticipants[2].name}</div>
               <span className="text-4xl font-black text-amber-900 mt-auto">3</span>
               <span className="text-lg font-bold text-amber-900">{sortedParticipants[2].score} бодови</span>
             </motion.div>
           )}
         </div>
         
         <Button onClick={() => navigate('/library')} className="mt-12 bg-white text-slate-900">
           Напушти Ја Играта
         </Button>
      </div>
    </div>
  );
};
