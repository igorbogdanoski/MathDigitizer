import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, limit, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { MathTask, UserStats } from '../lib/schema';
import { MathRenderer } from './MathRenderer';
import { Button } from './ui/Button';
import { Brain, Trophy, Loader2, ArrowRight, Zap, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Target, Timer, CheckCircle } from 'lucide-react';
import { useGamification } from '../contexts/GamificationContext';
import { autoGradeSubmission, generateTargetedPracticeTasks } from '../lib/gemini';
import { calculateSM2 } from '../lib/srsAlgorithm';
import {
  AbilityEstimate,
  Difficulty,
  createAbilityEstimate,
  foldObservation,
  selectNextDifficulty,
  shouldStopSession,
  weakestTopics,
} from '../lib/adaptive/ability';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';

/** Items in one session before the confidence rule gets a say. */
const SESSION_TASK_COUNT = 5;
/** Upper bound on documents read per query — never scan the whole collection. */
const TASK_FETCH_LIMIT = 40;

const shuffle = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);

export const AdaptiveTest: React.FC = () => {
  const { t } = useTranslation('adaptiveTest');
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

  // Running per-topic ability estimates — difficulty now follows accumulated
  // evidence instead of the single most recent answer.
  const [abilities, setAbilities] = useState<Record<string, AbilityEstimate>>({});
  const [stopReason, setStopReason] = useState<'confident' | 'max-items' | null>(null);

  // Kahoot (Time Race) Mode
  const [isKahootMode, setIsKahootMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Weakness Tracking
  const [detectedErrors, setDetectedErrors] = useState<string[]>([]);
  const [targetedTasks, setTargetedTasks] = useState<MathTask[]>([]);
  const [isGeneratingTargeted, setIsGeneratingTargeted] = useState(false);

  const { awardXP, updateQuestProgress } = useGamification();
  const { showToast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (isKahootMode &&!feedback && currentTaskIndex < tasks.length) {
      setTimeLeft(60);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isKahootMode, currentTaskIndex, feedback, tasks.length]);

  const handleTimeUp = async () => {
    setIsGrading(true);
    const task = tasks[currentTaskIndex];
    try {
      const mockQuestion = {
        text: task.original_text,
        solution: task.solution_steps.join('\n'),
        points: 100
      };
      const result = await autoGradeSubmission(mockQuestion, studentAnswer || "Нема одговор - истече времето");
      processGradingResult(result, task);
    } catch (err) {
      showToast(t('toasts.timeUpGradeError'), 'error');
      setIsGrading(false);
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      let tasksToLoad: MathTask[] = [];
      const user = auth.currentUser;

      if (user) {
        // Mastery for THIS user only — previously the whole collection was read
        // and filtered in the browser.
        const masterySnapshot = await getDocs(
          query(collection(db, 'user_mastery'), where('uid', '==', user.uid))
        );
        const userMastery = masterySnapshot.docs.map(d => d.data());

        const now = new Date().toISOString();
        // Firestore allows at most 10 values in an `in` filter.
        const dueTopics = userMastery
          .filter(m => m.next_review && m.next_review <= now)
          .map(m => m.topic)
          .filter(Boolean)
          .slice(0, 10);

        if (dueTopics.length > 0) {
          const dueSnapshot = await getDocs(
            query(collection(db, 'tasks'), where('curriculum_topic', 'in', dueTopics), limit(TASK_FETCH_LIMIT))
          );
          tasksToLoad.push(...dueSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as MathTask)));
        }

        // Top up with a bounded page of other tasks rather than the whole collection.
        if (tasksToLoad.length < SESSION_TASK_COUNT) {
          const fillSnapshot = await getDocs(query(collection(db, 'tasks'), limit(TASK_FETCH_LIMIT)));
          const fill = fillSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as MathTask))
            .filter(t => !tasksToLoad.some(loaded => loaded.id === t.id));
          tasksToLoad.push(...shuffle(fill).slice(0, SESSION_TASK_COUNT - tasksToLoad.length));
        }
      } else {
        const snapshot = await getDocs(query(collection(db, 'tasks'), limit(TASK_FETCH_LIMIT)));
        tasksToLoad = shuffle(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MathTask)));
      }

      setAbilities({});
      setStopReason(null);
      setTasks(shuffle(tasksToLoad).slice(0, SESSION_TASK_COUNT));
      setCurrentTaskIndex(0);
      setSessionScore(0);
      setSessionCount(0);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      showToast(t('toasts.loadTasksError'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const processGradingResult = async (result: any, task: MathTask) => {
      setFeedback(result);
      if (result.error_detected) {
         setDetectedErrors(prev => [...prev, result.error_detected]);
      }
      
      // SM-2 Algorithm mapping
      // score >= 90: Q=5, >=70: Q=4, >=50: Q=3, >=30: Q=2, else 1
      let quality = 1;
      if (result.score >= 90) quality = 5;
      else if (result.score >= 70) quality = 4;
      else if (result.score >= 50) quality = 3;
      else if (result.score >= 30) quality = 2;

      // Streak and gamification logic
      let currentStreak = streak;
      let multiplierBonus = isKahootMode ? 1.5 : 1; // 50% XP bonus for Kahoot Mode
      if (result.score >= 70) {
        currentStreak += 1;
        setStreak(currentStreak);
        setShowCombo(true);
        setTimeout(() => setShowCombo(false), 3000);
      } else if (result.score < 50) {
        currentStreak = 0;
        setStreak(0);
      }
      
      const newMultiplier = Math.min(3, (1 + currentStreak * 0.2) * multiplierBonus);
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

      const answered = sessionCount + 1;
      const topic = task.curriculum_topic;
      const difficulty = (task.difficulty || 'medium') as Difficulty;

      // Computerized Adaptive Testing: fold this answer into the topic estimate,
      // then aim the next task at the ability the evidence now supports.
      let updatedAbilities = abilities;
      setAdaptationState('neutral');

      if (topic) {
        const previous = abilities[topic] ?? createAbilityEstimate(topic);
        const estimate = foldObservation(previous, result.score, difficulty);
        updatedAbilities = { ...abilities, [topic]: estimate };
        setAbilities(updatedAbilities);

        const target = selectNextDifficulty(estimate.ability);
        if (target !== difficulty) {
          setAdaptationState(target === 'easy' || (target === 'medium' && difficulty === 'hard') ? 'softening' : 'hardening');
          injectAdaptiveTask(target, topic);
        }
      }

      // Confidence-based stop: end the session once every topic under test is
      // measured precisely enough, rather than always running a fixed count.
      const decision = shouldStopSession(Object.values(updatedAbilities), answered, {
        minItems: SESSION_TASK_COUNT,
        maxItems: SESSION_TASK_COUNT * 3,
      });
      setStopReason(decision.stop ? decision.reason as 'confident' | 'max-items' : null);

      updateQuestProgress('solve');
      setSessionCount(answered);
      setIsGrading(false);
  };

  const handleGrade = async () => {
    if (!studentAnswer.trim()) return;
    if (timerRef.current) clearInterval(timerRef.current);
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
      await processGradingResult(result, task);
    } catch (err) {
      // No grade is recorded when grading fails. The alternative — writing the
      // zero the grader used to return — moved a student's ability estimate on
      // the strength of a parse error.
      console.error("Grading error:", err);
      showToast(t('toasts.gradeError'), 'error');
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

  const injectAdaptiveTask = async (targetDifficulty: Difficulty, topic: string) => {
     try {
        // Ask Firestore for the matching tasks instead of scanning the collection.
        const tasksSnapshot = await getDocs(query(
           collection(db, 'tasks'),
           where('curriculum_topic', '==', topic),
           where('difficulty', '==', targetDifficulty),
           limit(10)
        ));
        const pool = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MathTask));
        const candidate = pool.find(t => !tasks.some(existing => existing.id === t.id));
        if (candidate) {
           setTasks(prev => {
              const newArr = [...prev];
              newArr.splice(currentTaskIndex + 1, 0, candidate);
              return newArr;
           });
           showToast(t(targetDifficulty === 'hard' ? 'toasts.adaptiveAddedHard' : 'toasts.adaptiveAddedEasy'), 'info');
        }
     } catch(e) {
        console.error("Adaptive fetch error", e);
     }
  };

  const nextTask = () => {
    // The confidence rule can end the session before the queue runs out —
    // there is no point asking more once the estimate has settled.
    if (stopReason || currentTaskIndex >= tasks.length - 1) {
      setCurrentTaskIndex(tasks.length);
      return;
    }
    setCurrentTaskIndex(prev => prev + 1);
    setStudentAnswer('');
    setFeedback(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500">{t('loading')}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <Brain className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">{t('noTasksTitle')}</h3>
        <p className="text-slate-500">{t('noTasksDesc')}</p>
      </div>
    );
  }

  const handleGenerateTargetedTasks = async () => {
     if (detectedErrors.length === 0) {
        showToast(t('toasts.noErrorsDetected'), "info");
        return;
     }
     setIsGeneratingTargeted(true);
     try {
        const lastTask = tasks[tasks.length - 1]; // Use as context base
        const newTasks = await generateTargetedPracticeTasks(detectedErrors, lastTask, 2);
        setTargetedTasks(newTasks);
        showToast(t('toasts.targetedCreated'), "success");
     } catch (e) {
        console.error(e);
        showToast(t('toasts.targetedError'), "error");
     } finally {
        setIsGeneratingTargeted(false);
     }
  };

  if (currentTaskIndex >= tasks.length) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 transform rotate-12">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">{t('finish.sessionFinished')}</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
          {t('finish.sessionDone')} <br/>
          {t('finish.pointsEarned')} <span className="font-bold text-indigo-600">{sessionScore} XP</span>
        </p>

        {/* Measured ability per topic — an estimate with its own uncertainty,
            not a raw score, so a short session is not read as a verdict. */}
        {Object.values(abilities).some(a => a.samples > 0) && (
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-6 text-left border border-slate-200 dark:border-slate-700 mb-8 max-w-2xl mx-auto">
            <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200 mb-1">
              <Target className="w-5 h-5 text-indigo-600" /> {t('finish.abilityTitle')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {stopReason === 'confident' ? t('finish.stopConfident') : t('finish.stopMaxItems')}
            </p>
            <ul className="space-y-3">
              {Object.values(abilities).filter(a => a.samples > 0).map(estimate => (
                <li key={estimate.topic}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{estimate.topic}</span>
                    <span className="text-slate-500">
                      {t('finish.abilityValue', {
                        value: Math.round(estimate.ability),
                        error: Math.round(estimate.standardError),
                        count: estimate.samples,
                      })}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      role="progressbar"
                      aria-label={estimate.topic}
                      aria-valuenow={Math.round(estimate.ability)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ width: `${Math.round(estimate.ability)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {weakestTopics(Object.values(abilities), 1).map(weakest => (
              <a
                key={weakest.topic}
                href={`/adaptive-test?topic=${encodeURIComponent(weakest.topic)}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-400 hover:underline"
              >
                {t('finish.practiceWeakest', { topic: weakest.topic })} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}


        {detectedErrors.length > 0 && targetedTasks.length === 0 && (
           <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 text-left border border-amber-200 dark:border-amber-800 mb-8 max-w-2xl mx-auto">
              <h3 className="font-bold flex items-center gap-2 text-amber-800 dark:text-amber-400 mb-2">
                 <AlertTriangle className="w-5 h-5" /> {t('finish.errorAnalysis')}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                 {t('finish.errorAnalysisDesc')}
              </p>
              <ul className="list-disc list-inside text-sm text-amber-800/80 dark:text-amber-200 mb-4 space-y-1 pl-4">
                 {detectedErrors.map((err, i) => (
                    <li key={i}>{typeof err === 'string' ? err.substring(0, 100) + '...' : t('finish.conceptualError')}</li>
                 ))}
              </ul>
              <Button onClick={handleGenerateTargetedTasks} disabled={isGeneratingTargeted} className="w-full bg-amber-600 hover:bg-amber-700 text-white shadow-sm border-0 font-bold h-10">
                 {isGeneratingTargeted ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Zap className="w-4 h-4 mr-2"/>} 
                 {t('finish.generateTargeted')}
              </Button>
           </div>
        )}
        
        {targetedTasks.length > 0 && (
           <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 text-left border border-indigo-200 dark:border-indigo-800 mb-8">
              <h3 className="font-bold flex items-center gap-2 text-indigo-800 dark:text-indigo-400 mb-4">
                 <Target className="w-5 h-5" /> {t('finish.focusedTraining')} 
              </h3>
              <div className="grid gap-4">
                 {targetedTasks.map((tt, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                       <MathRenderer content={tt.original_text} />
                    </div>
                 ))}
              </div>
           </div>
        )}

        <Button onClick={fetchTasks} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-all">
          {t('finish.startNewSession')} <RefreshCw className="w-5 h-5 ml-2" />
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
            {t('header.title')}
          </h2>
          <p className="text-sm text-slate-500">{t('header.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={isKahootMode ? "default" : "outline"}
            className={`rounded-full shadow-sm text-xs h-8 px-4 font-bold border transition-colors ${
              isKahootMode 
                ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 ring-4 ring-rose-500/20" 
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
            onClick={() => setIsKahootMode(!isKahootMode)}
            title={t('header.kahootTitle')}
          >
            <Timer className={`w-4 h-4 mr-1.5 ${isKahootMode ? "animate-pulse" : ""}`} />
            Kahoot Mode
          </Button>

          <AnimatePresence>
             {streak > 1 && (
               <motion.div
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className={`flex items-center gap-1 font-bold ${showCombo ? 'text-rose-500 scale-110' : 'text-amber-500'} transition-all`}
               >
                 🔥 {streak} {t('header.combo')} (x{multiplier.toFixed(1)})
               </motion.div>
             )}
          </AnimatePresence>
          <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 font-bold px-4 py-2 rounded-full text-sm">
            {t('header.taskProgress', { current: currentTaskIndex + 1, total: tasks.length })}
          </div>
        </div>
      </div>

      {isKahootMode && !feedback && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-rose-200 dark:border-rose-900 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 ${timeLeft <= 10 ? 'animate-bounce' : ''}`}>
                 <Timer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('timer.timeRace')}</h4>
                <div className={`text-2xl font-black ${timeLeft <= 10 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'}`}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              </div>
            </div>
            <div className="w-1/2 bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
               <div className={`h-full ${timeLeft <= 10 ? 'bg-rose-500' : 'bg-emerald-500'} transition-all duration-1000 ease-linear`} style={{ width: `${(timeLeft/60)*100}%` }}></div>
            </div>
        </div>
      )}

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
                 {trajectory.map((point, idx) => (
                    <div
                       key={idx}
                       className={`w-2 h-6 rounded-full ${point.score >= 80 ? 'bg-emerald-500' : point.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                       title={t('trajectory.taskTitle', { index: idx + 1, score: point.score })}
                    ></div>
                 ))}
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
              <div title={t('trajectory.title')} className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${
                 adaptationState === 'hardening' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 
                 adaptationState === 'softening' ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' : 
                 'text-slate-500 bg-slate-100 dark:bg-slate-800'
              }`}>
                 {adaptationState === 'hardening' ? <TrendingUp className="w-3 h-3" /> : 
                  adaptationState === 'softening' ? <TrendingDown className="w-3 h-3" /> : 
                  <Target className="w-3 h-3" />}
                 {adaptationState === 'hardening' ? t('trajectory.levelUp') :
                  adaptationState === 'softening' ? t('trajectory.levelDown') : t('trajectory.stable')}
              </div>
           </div>
        )}

        <div className="mb-8 mt-6">
          <h3 className="font-semibold text-slate-500 uppercase tracking-wider text-xs mb-2 hidden sm:block">{t('task.topicLabel')} {currentTask.curriculum_topic || 'Општо'}</h3>
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
                placeholder={t('input.answerPlaceholder')}
                className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all"
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleGrade} 
                  disabled={!studentAnswer.trim() || isGrading}
                  className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 rounded-full"
                >
                  {isGrading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {t('input.grading')}</>
                  ) : (
                    <>{t('input.check')} <Brain className="w-5 h-5 ml-2" /></>
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
                    {t('feedback.result', { score: feedback.score })}
                  </h4>
                  <div className="text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert">
                    <MathRenderer content={feedback.feedback} />
                  </div>
                  
                  {feedback.error_detected && (
                    <div className="mt-4 p-4 bg-rose-100/50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                      <strong className="text-rose-800 dark:text-rose-300 block mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {t('feedback.errorDetected')}
                      </strong>
                      <p className="text-rose-700 dark:text-rose-400 text-sm">
                        <MathRenderer content={feedback.error_detected} />
                      </p>
                    </div>
                  )}

                  {feedback.socratic_hint && (
                    <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-inner">
                      <strong className="text-indigo-800 dark:text-indigo-300 block mb-2 flex items-center gap-2">
                        <Brain className="w-4 h-4" /> {t('feedback.yourTurn')}
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
                    {t('feedback.testCorrection')} <RefreshCw className="w-4 h-4 ml-2" />
                  </Button>
                )}
                <Button 
                  onClick={nextTask}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-full px-6"
                >
                  {t('feedback.nextTask')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
