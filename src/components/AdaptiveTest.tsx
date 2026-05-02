import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { MathTask, UserStats } from '../lib/schema';
import { MathRenderer } from './MathRenderer';
import { Button } from './ui/Button';
import { Brain, Trophy, Loader2, ArrowRight, Zap, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useGamification } from '../contexts/GamificationContext';
import { autoGradeSubmission } from '../lib/gemini';
import { calculateSM2 } from '../lib/srsAlgorithm';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';

export const AdaptiveTest: React.FC = () => {
  const [tasks, setTasks] = useState<MathTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ score: number, feedback: string, socratic_hint?: string, error_detected?: string } | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [showCombo, setShowCombo] = useState(false);
  
  const [trajectory, setTrajectory] = useState<{score: number, difficulty: string}[]>([]);
  const [adaptationState, setAdaptationState] = useState<'neutral' | 'hardening' | 'softening'>('neutral');

  const { awardXP, updateQuestProgress } = useGamification();
  const { showToast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      let tasksToLoad: MathTask[] = [];
      const user = auth.currentUser;
      
      const tasksQuery = query(collection(db, 'tasks'));
      const tasksSnapshot = await getDocs(tasksQuery);
      const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MathTask));

      if (user) {
        // Fetch mastery for current user
        const masteryQuery = query(collection(db, 'user_mastery'));
        const masterySnapshot = await getDocs(masteryQuery);
        const userMastery = masterySnapshot.docs
          .map(doc => doc.data())
          .filter(d => d.uid === user.uid);

        const now = new Date().toISOString();
        // Topics due for review
        const dueTopics = userMastery
          .filter(m => m.next_review && m.next_review <= now)
          .map(m => m.topic);

        // Separate tasks by topic
        const tasksByTopic = allTasks.reduce((acc, task) => {
          const topic = task.curriculum_topic || 'Општо';
          if (!acc[topic]) acc[topic] = [];
          acc[topic].push(task);
          return acc;
        }, {} as Record<string, MathTask[]>);

        if (dueTopics.length > 0) {
          // Grab tasks from due topics
          for (const topic of dueTopics) {
            if (tasksByTopic[topic]) {
              // Shuffle and take a few from this topic
              const shuffledTopicTasks = tasksByTopic[topic].sort(() => Math.random() - 0.5);
              tasksToLoad.push(...shuffledTopicTasks.slice(0, 2));
            }
          }
        }

        // Fill up to 5 tasks total with random other tasks or new tasks
        if (tasksToLoad.length < 5) {
          const remainingTasks = allTasks.filter(t => !tasksToLoad.find(loaded => loaded.id === t.id));
          const fillTasks = remainingTasks.sort(() => Math.random() - 0.5).slice(0, 5 - tasksToLoad.length);
          tasksToLoad.push(...fillTasks);
        }
      } else {
        // Fallback for unauthenticated
        tasksToLoad = allTasks.sort(() => Math.random() - 0.5).slice(0, 5);
      }
      
      setTasks(tasksToLoad.slice(0, 5).sort(() => Math.random() - 0.5)); // Randomize display order
      setCurrentTaskIndex(0);
      setSessionScore(0);
      setSessionCount(0);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      showToast('Грешка при вчитување на задачи.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrade = async () => {
    if (!studentAnswer.trim()) return;
    setIsGrading(true);
    const task = tasks[currentTaskIndex];
    try {
      // Create a mock question format for autoGradeSubmission
      const mockQuestion = {
        text: task.original_text,
        solution: task.solution_steps.join('\n'),
        points: 100
      };

      const result = await autoGradeSubmission(mockQuestion, studentAnswer);
      setFeedback(result);
      
      // SM-2 Algorithm mapping
      // score >= 90: Q=5, >=70: Q=4, >=50: Q=3, >=30: Q=2, else 1
      let quality = 1;
      if (result.score >= 90) quality = 5;
      else if (result.score >= 70) quality = 4;
      else if (result.score >= 50) quality = 3;
      else if (result.score >= 30) quality = 2;

      // Streak and gamification logic
      let currentStreak = streak;
      if (result.score >= 70) {
        currentStreak += 1;
        setStreak(currentStreak);
        setShowCombo(true);
        setTimeout(() => setShowCombo(false), 3000);
      } else if (result.score < 50) {
        currentStreak = 0;
        setStreak(0);
      }
      
      const newMultiplier = Math.min(3, 1 + currentStreak * 0.2);
      setMultiplier(newMultiplier);

      const xpEarned = Math.round(result.score * newMultiplier);

      // Award XP
      if (xpEarned > 0) {
        setSessionScore(prev => prev + xpEarned);
        await awardXP(xpEarned);
      }
      
      setTrajectory(prev => [...prev, { score: result.score, difficulty: task.difficulty || 'medium' }]);
      
      // Update SRS data for this topic
      if (auth.currentUser && task.curriculum_topic) {
        await updateMastery(auth.currentUser.uid, task.curriculum_topic, quality);
      }
      
      // Computerized Adaptive Testing (CAT) Logic: Inject tasks based on performance
      setAdaptationState('neutral');
      if (task.curriculum_topic) {
        if (result.score < 50 && ['medium', 'hard'].includes(task.difficulty || 'medium')) {
           // Target easier task
           setAdaptationState('softening');
           injectAdaptiveTask('easy', task.curriculum_topic);
        } else if (result.score >= 80 && ['easy', 'medium'].includes(task.difficulty || 'medium')) {
           // Target harder task
           setAdaptationState('hardening');
           injectAdaptiveTask('hard', task.curriculum_topic);
        }
      }
      
      updateQuestProgress('solve');
      setSessionCount(prev => prev + 1);
    } catch (err) {
      console.error("Grading error:", err);
      showToast('Настана грешка при оценувањето.', 'error');
    } finally {
      setIsGrading(false);
    }
  };

  const updateMastery = async (uid: string, topic: string, quality: number) => {
    const masteryRef = doc(db, 'user_mastery', `${uid}_${topic}`);
    const snap = await getDoc(masteryRef);
    let previousInterval = 0;
    let previousEaseFactor = 2.5;
    
    if (snap.exists()) {
      const data = snap.data();
      previousInterval = data.interval || 0;
      previousEaseFactor = data.ease_factor || 2.5;
    }
    
    const { interval, easeFactor, nextReview } = calculateSM2(quality, previousInterval, previousEaseFactor);
    
    await setDoc(masteryRef, {
      uid,
      topic,
      interval,
      ease_factor: easeFactor,
      next_review: nextReview,
      last_quality: quality,
      updated_at: new Date().toISOString()
    }, { merge: true });
  };

  const injectAdaptiveTask = async (targetDifficulty: 'easy'|'medium'|'hard', topic: string) => {
     try {
        const tasksQuery = query(collection(db, 'tasks'));
        const tasksSnapshot = await getDocs(tasksQuery);
        // Find one matching task not already in list
        const pool = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MathTask));
        const candidate = pool.find(t => 
           t.curriculum_topic === topic && 
           t.difficulty === targetDifficulty &&
           !tasks.some(existing => existing.id === t.id)
        );
        if (candidate) {
           setTasks(prev => {
              const newArr = [...prev];
              newArr.splice(currentTaskIndex + 1, 0, candidate);
              return newArr;
           });
           showToast(`Адаптивен Агент: Додадена е ${targetDifficulty === 'easy' ? 'полесна' : 'потешка'} задача.`, 'info');
        }
     } catch(e) {
        console.error("Adaptive fetch error", e);
     }
  };

  const nextTask = () => {
    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
      setStudentAnswer('');
      setFeedback(null);
    } else {
      // Session finished
      setCurrentTaskIndex(tasks.length);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500">Алгоритмите подготвуваат адаптивен тест...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <Brain className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Нема достапни задачи</h3>
        <p className="text-slate-500">Сè уште нема задачи во базата. Побарајте од наставникот да додаде материјали.</p>
      </div>
    );
  }

  if (currentTaskIndex >= tasks.length) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 transform rotate-12">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">Сесијата е завршена!</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
          Одлична работа. Ја зголемивте вашата мајсторија преку SRS алгоритмот. <br/>
          Освоени поени: <span className="font-bold text-indigo-600">{sessionScore} XP</span>
        </p>
        <Button onClick={fetchTasks} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-lg rounded-full">
          Започни нова сесија <RefreshCw className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  const currentTask = tasks[currentTaskIndex];

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
            Адаптивен Тест
          </h2>
          <p className="text-sm text-slate-500">Систем за просторно повторување (SRS)</p>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
             {streak > 1 && (
               <motion.div
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className={`flex items-center gap-1 font-bold ${showCombo ? 'text-rose-500 scale-110' : 'text-amber-500'} transition-all`}
               >
                 🔥 {streak} Комбо! (x{multiplier.toFixed(1)})
               </motion.div>
             )}
          </AnimatePresence>
          <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 font-bold px-4 py-2 rounded-full text-sm">
            Задача {currentTaskIndex + 1} од {tasks.length}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-700">
          <div 
            className="h-1 bg-indigo-600 transition-all duration-500"
            style={{ width: `${((currentTaskIndex) / tasks.length) * 100}%` }}
          />
        </div>
        
        {trajectory.length > 0 && (
           <div className="absolute top-4 right-4 flex items-center gap-2">
              <div className="flex gap-1">
                 {trajectory.map((t, idx) => (
                    <div 
                       key={idx} 
                       className={`w-2 h-6 rounded-full ${t.score >= 80 ? 'bg-emerald-500' : t.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                       title={`Задача ${idx+1}: ${t.score}%`}
                    ></div>
                 ))}
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
              <div title="Тековна Траекторија на Алгоритамот" className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${
                 adaptationState === 'hardening' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 
                 adaptationState === 'softening' ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' : 
                 'text-slate-500 bg-slate-100 dark:bg-slate-800'
              }`}>
                 {adaptationState === 'hardening' ? <TrendingUp className="w-3 h-3" /> : 
                  adaptationState === 'softening' ? <TrendingDown className="w-3 h-3" /> : 
                  <Target className="w-3 h-3" />}
                 {adaptationState === 'hardening' ? 'Потешкотино Ниво ↑' : 
                  adaptationState === 'softening' ? 'Потешкотино Ниво ↓' : 'Стабилно'}
              </div>
           </div>
        )}

        <div className="mb-8 mt-6">
          <h3 className="font-semibold text-slate-500 uppercase tracking-wider text-xs mb-2 hidden sm:block">Тема: {currentTask.curriculum_topic || 'Општо'}</h3>
          <div className="text-xl md:text-2xl font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
            <MathRenderer content={currentTask.original_text} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!feedback ? (
            <motion.div 
              key="input-phase"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <textarea
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                placeholder="Внесете го вашето решение тука (може да користите текст и чекори)..."
                className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all"
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleGrade} 
                  disabled={!studentAnswer.trim() || isGrading}
                  className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 rounded-full"
                >
                  {isGrading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Оценување...</>
                  ) : (
                    <>Провери <Brain className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="feedback-phase"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-6 rounded-2xl ${
                feedback.score >= 80 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' :
                feedback.score >= 50 ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' :
                'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800'
              } border`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className={`text-lg font-bold mb-2 ${
                    feedback.score >= 80 ? 'text-emerald-700 dark:text-emerald-400' :
                    feedback.score >= 50 ? 'text-amber-700 dark:text-amber-400' :
                    'text-rose-700 dark:text-rose-400'
                  }`}>
                    Резултат: {feedback.score} / 100
                  </h4>
                  <div className="text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert">
                    <MathRenderer content={feedback.feedback} />
                  </div>
                  
                  {feedback.error_detected && (
                    <div className="mt-4 p-4 bg-rose-100/50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                      <strong className="text-rose-800 dark:text-rose-300 block mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Детектирана грешка
                      </strong>
                      <p className="text-rose-700 dark:text-rose-400 text-sm">
                        <MathRenderer content={feedback.error_detected} />
                      </p>
                    </div>
                  )}

                  {feedback.socratic_hint && (
                    <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-inner">
                      <strong className="text-indigo-800 dark:text-indigo-300 block mb-2 flex items-center gap-2">
                        <Brain className="w-4 h-4" /> Ваш ред (Сократски хинт)
                      </strong>
                      <p className="text-indigo-700 dark:text-indigo-200 font-medium">
                        <MathRenderer content={feedback.socratic_hint} />
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                {feedback.score < 100 && (
                  <Button 
                    onClick={() => setFeedback(null)} // Reset feedback to let them try again
                    className="bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 dark:text-amber-300 rounded-full px-6"
                  >
                    Тестирај ја поправката <RefreshCw className="w-4 h-4 ml-2" />
                  </Button>
                )}
                <Button 
                  onClick={nextTask}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-full px-6"
                >
                  Следна Задча <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
