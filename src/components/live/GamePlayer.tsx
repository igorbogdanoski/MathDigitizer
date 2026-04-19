import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { LiveKahootSession } from '../../lib/schema';
import { MathRenderer } from '../MathRenderer';
import { Button } from '../ui/Button';
import { CheckCircle2, UserCircle2, Trophy, Loader2, Lightbulb, Zap } from 'lucide-react';

export const GamePlayer = ({ sessionPin }: { sessionPin?: string }) => {
  const [pin, setPin] = useState(sessionPin || '');
  const [name, setName] = useState('');
  const [session, setSession] = useState<LiveKahootSession | null>(null);
  const [uid, setUid] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  // Generate a random UID for anonymous student if none exists
  useEffect(() => {
    let storedUid = localStorage.getItem('kahoot_guest_uid');
    if (!storedUid) {
      storedUid = 'guest_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('kahoot_guest_uid', storedUid);
    }
    setUid(storedUid);
  }, []);

  useEffect(() => {
    if (!sessionPin || !uid) return;
    const unsub = onSnapshot(doc(db, 'live_sessions', sessionPin), (doc) => {
      if (doc.exists()) {
        setSession(doc.data() as LiveKahootSession);
      } else {
        setError('Играта не постои или е завршена.');
      }
    });
    return () => unsub();
  }, [sessionPin, uid]);

  const joinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsJoining(true);
    try {
      const docRef = doc(db, 'live_sessions', pin);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        setError('Неважечки ПИН код.');
        setIsJoining(false);
        return;
      }
      
      const data = snap.data() as LiveKahootSession;
      if (data.status !== 'lobby') {
        setError('Играта е веќе започната.');
        setIsJoining(false);
        return;
      }

      await updateDoc(docRef, {
        [`participants.${uid}`]: {
          uid,
          name,
          score: 0,
          has_answered_current: false
        }
      });
      
      // Update URL to trigger the listener
      window.history.pushState({}, '', `/play?pin=${pin}`);
      // Force trigger the listener by setting state directly here if needed, 
      // but reloading with ?pin= is handled by the parent
      window.location.search = `?pin=${pin}`;

    } catch (err) {
      setError('Грешка при приклучување.');
    } finally {
      setIsJoining(false);
    }
  };

  const submitAnswer = async (index: number) => {
    if (!session || !pin) return;
    
    // Quick local check if already answered to prevent double trigger
    if (session.participants[uid]?.has_answered_current) return;

    const currentQ = session.quiz_data.questions[session.current_question_index];
    const isCorrect = index === currentQ.correctIndex;
    
    // Simplistic scoring: 1000 for correct. (Can add timer-based later)
    const points = isCorrect ? 1000 : 0;
    
    await updateDoc(doc(db, 'live_sessions', pin), {
      [`participants.${uid}.has_answered_current`]: true,
      [`participants.${uid}.current_answer_index`]: index,
      [`participants.${uid}.score`]: (session.participants[uid]?.score || 0) + points
    });
  };

  // State 1: Join Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="bg-white p-8 rounded-3xl max-w-sm w-full mx-auto relative z-10 shadow-2xl">
          <h1 className="text-3xl font-black text-slate-900 text-center mb-8 tracking-tight">MathKahoot<span className="text-indigo-600">!</span></h1>
          
          <form onSubmit={joinGame} className="space-y-4">
            <div>
               <input 
                 type="text" 
                 value={pin}
                 onChange={(e) => setPin(e.target.value)}
                 placeholder="Game PIN"
                 disabled={!!sessionPin && sessionPin !== ''}
                 className="w-full h-16 text-center text-2xl font-bold rounded-xl bg-slate-100 border-2 border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder:font-medium placeholder:text-slate-400"
                 required
               />
            </div>
            <div>
               <input 
                 type="text" 
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 placeholder="Nickname"
                 className="w-full h-16 text-center text-xl font-bold rounded-xl bg-slate-100 border-2 border-slate-200 text-slate-900 focus:border-indigo-500 focus:outline-none placeholder:font-medium placeholder:text-slate-400"
                 required
               />
            </div>
            
            {error && <p className="text-red-500 text-center font-bold text-sm">{error}</p>}
            
            <Button type="submit" disabled={isJoining} className="w-full h-16 text-xl font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xl shadow-slate-900/20">
              {isJoining ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Enter'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const me = session.participants[uid];

  // State 2: Lobby
  if (session.status === 'lobby') {
    return (
      <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-6 text-white text-center">
        <h2 className="text-4xl font-black mb-4">Се приклучивте!</h2>
        <p className="text-2xl font-bold opacity-80 mb-12">Го чекаме наставникот да започне...</p>
        <div className="bg-white/20 px-8 py-4 rounded-full text-2xl font-black">
          {me?.name}
        </div>
      </div>
    );
  }

  // State 3: Finished
  if (session.status === 'finished') {
    return (
      <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center p-6 text-white text-center">
        <Trophy className="w-24 h-24 mb-6 shadow-black/20 drop-shadow-xl" />
        <h2 className="text-5xl font-black mb-4">Играта Заврши!</h2>
        <p className="text-2xl font-bold opacity-80 mb-12">Погледнете ја таблата кај наставникот.</p>
        <div className="bg-white/20 px-8 py-4 rounded-3xl text-3xl font-black text-center min-w-[200px]">
          <span className="block text-sm opacity-70 uppercase tracking-widest mb-1">Your Score</span>
          {me?.score}
        </div>
      </div>
    );
  }

  const currentQ = session.quiz_data.questions[session.current_question_index];
  const hasAnswered = me?.has_answered_current;

  // Clear hint when question changes
  useEffect(() => {
    setActiveHint(null);
  }, [session.current_question_index]);

  // State 4: Playing - Waiting for next round or discussing
  if (hasAnswered || session.status === 'discussion') {
    const isDiscussion = session.status === 'discussion';
    const iWasCorrect = me?.current_answer_index === currentQ.correctIndex;
    
    if (isDiscussion) {
      return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-white text-center ${iWasCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {iWasCorrect ? (
            <>
              <CheckCircle2 className="w-24 h-24 mb-6" />
              <h2 className="text-4xl font-black mb-4">Точно!</h2>
            </>
          ) : (
            <>
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6">
                <span className="text-5xl font-black">X</span>
              </div>
              <h2 className="text-4xl font-black mb-4">Погрешно</h2>
            </>
          )}
          <div className="bg-black/20 px-8 py-4 rounded-full text-2xl font-black mt-8">
            Score: {me?.score}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-200 flex flex-col items-center justify-center p-6 text-slate-800 text-center">
        <div className="w-16 h-16 border-4 border-slate-400 border-t-slate-800 rounded-full animate-spin mb-8"></div>
        <h2 className="text-3xl font-black mb-4">Чекаме другите играчи...</h2>
        <p className="text-xl font-bold opacity-60">Одговорот е забележан.</p>
      </div>
    );
  }

  // State 5: Playing - Answering
  const colors = [
    'bg-red-500 active:bg-red-700', 
    'bg-blue-500 active:bg-blue-700', 
    'bg-yellow-500 active:bg-yellow-700', 
    'bg-emerald-500 active:bg-emerald-700'
  ];

  const requestHint = () => {
    setIsHintLoading(true);
    // Simulate smart AI hint generation locally based on the actual question text
    // (In production this would call a cloud function to prevent API leak to mobile clients, 
    // but the quiz_data already has it if generated via our MaterialPreview flow)
    setTimeout(() => {
      // If the quiz generator attached hints, use them, otherwise give a generic hint
      setActiveHint(session.quiz_data.hints?.[session.current_question_index] || "Обиди се да ги елиминираш негативните вредности прво, и провери ја равенката.");
      setIsHintLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4">
      <div className="flex justify-between items-center mb-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
        <span className="font-bold text-slate-700 flex items-center gap-2">
          {me?.name}
        </span>
        <div className="flex items-center gap-3">
           {!activeHint && (
             <Button size="sm" variant="outline" onClick={requestHint} disabled={isHintLoading} className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 font-bold">
               {isHintLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-1" />}
               AI Помош
             </Button>
           )}
           <span className="font-black text-indigo-600 px-3 py-1 bg-indigo-50 rounded-lg">{me?.score} pts</span>
        </div>
      </div>
      
      {activeHint && (
        <div className="bg-amber-100 border border-amber-200 p-4 rounded-2xl mb-4 text-amber-900 font-medium text-sm shadow-sm animate-in zoom-in-95 duration-200 flex gap-3 items-start">
           <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
           <MathRenderer content={activeHint} />
        </div>
      )}

      {/* Optional: Show question text on student device too, good for accessibility */}
      <div className="bg-white p-6 rounded-3xl shadow-md mb-4 text-center font-bold text-lg md:text-xl text-slate-800 min-h-[100px] flex items-center justify-center border border-slate-100">
        <MathRenderer content={currentQ.question} />
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 pb-safe">
        {currentQ.options.map((opt: string, i: number) => (
          <button
            key={i}
            onClick={() => submitAnswer(i)}
            className={`${colors[i % colors.length]} rounded-2xl shadow-[0_6px_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[6px] transition-all flex flex-col items-center justify-center p-4 min-h-[120px]`}
          >
            <span className="text-white/50 font-black text-2xl mb-2">{String.fromCharCode(65+i)}</span>
            <span className="text-white font-bold text-lg leading-tight pointer-events-none">
              <MathRenderer content={opt} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
