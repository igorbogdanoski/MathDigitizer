import React, { useState, useEffect } from 'react';
import { readStoredJson, removeStored, writeStoredJson } from '../../lib/safeStorage';
import { db, auth } from '../../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SummativeExam as SummativeExamType, SummativeAttempt } from '../../lib/schema';
import { MathRenderer } from '../MathRenderer';
import { Button } from '../ui/Button';
import { Loader2, CheckCircle, Save, Clock, HelpCircle, FileType2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { evaluateExamAvailability, shuffleWithinSections } from '../../lib/exams/shuffle';

export const SummativeExam = ({ examId }: { examId: string }) => {
  const { t } = useTranslation('exams');
  const { showToast } = useToast();
  const [exam, setExam] = useState<SummativeExamType | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentUid, setStudentUid] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isFired, setIsFired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Anti-cheat & Telemetry states
  const [tabSwitches, setTabSwitches] = useState(0);
  const [examStartTime, setExamStartTime] = useState<number | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    // Use Firebase anonymous auth so student_uid is a real Firebase UID
    // tied to this device. Replaces the insecure localStorage guest UID.
    const getFirebaseUid = async (): Promise<string> => {
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    };

    // Auto-load saved answers. Reading through the safe layer because a browser
    // with site data blocked throws here, and an exception in this effect takes
    // the exam screen down with it — for a student who is part way through a
    // graded test.
    const savedAnswers = readStoredJson<Record<number, string> | null>(
      `dugga_answers_${examId}`,
      null,
    );
    if (savedAnswers) setAnswers(savedAnswers);

    const fetchExam = async () => {
      try {
        const uid = await getFirebaseUid();
        setStudentUid(uid);

        const docRef = doc(db, 'summative_exams', examId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const examData = snap.data() as SummativeExamType;

          // Status and deadline are enforced here for the UI and mirrored in
          // Firestore rules, which are the actual gate.
          const availability = evaluateExamAvailability(examData);
          if (!availability.open) {
            setError(t(`closed.${availability.reason}`));
            return;
          }

          setExam(examData);

          // Check if already submitted
          const attemptRef = doc(db, 'summative_attempts', `${examId}_${uid}`);
          const attemptSnap = await getDoc(attemptRef);
          if (attemptSnap.exists()) {
             setIsSubmitted(true);
             setIsStarted(true);
          }
        } else {
          setError(t('errors.notFound'));
        }
      } catch (err) {
        console.error(err);
        setError(t('errors.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    if (examId) fetchExam();
  }, [examId]);

  // Anti-Cheat: Track window blur/visibility
  useEffect(() => {
     if (!isStarted || isSubmitted) return;

     const handleVisibility = () => {
        if (document.hidden) {
           setTabSwitches(prev => prev + 1);
           alert(t('antiCheatWarning'));
        }
     };

     const handleBlur = () => {
        setTabSwitches(prev => prev + 1);
     };

     document.addEventListener('visibilitychange', handleVisibility);
     window.addEventListener('blur', handleBlur);
     
     return () => {
       document.removeEventListener('visibilitychange', handleVisibility);
       window.removeEventListener('blur', handleBlur);
     };
  }, [isStarted, isSubmitted]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    setIsStarted(true);
    setExamStartTime(Date.now());
  };

  const handleAnswerChange = (questionIndex: number, value: any) => {
    setAnswers(prev => {
      const updated = { ...prev, [questionIndex]: value };
      // Auto-save
      writeStoredJson(`dugga_answers_${examId}`, updated);
      return updated;
    });
  };

  const submitExam = async () => {
     if (!window.confirm(t('confirmSubmit'))) return;
     
     setIsSubmitting(true);
     try {
        const attemptId = `${examId}_${studentUid}`;
        const timeSpent = examStartTime ? Math.floor((Date.now() - examStartTime) / 1000) : 0;
        
        const attemptData: SummativeAttempt = {
           id: attemptId,
           exam_id: examId,
           student_name: studentName,
           student_uid: studentUid,
           answers: answers,
           submitted_at: Date.now(),
           anti_cheat: {
              tab_switches: tabSwitches,
              time_spent_seconds: timeSpent
           }
        };
        await setDoc(doc(db, 'summative_attempts', attemptId), attemptData);
        setIsSubmitted(true);
        // Clear autosave
        removeStored(`dugga_answers_${examId}`);
     } catch (err) {
        console.error(err);
        showToast(t('errors.submitFailed'), 'error');
     } finally {
        setIsSubmitting(false);
     }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;
  if (error || !exam) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center"><div className="bg-white p-8 rounded-2xl shadow-xl max-w-md"><h2 className="text-red-500 font-bold text-xl mb-4">{error || t('errors.unknown')}</h2><Button onClick={() => navigate('/')}>{t('backHome')}</Button></div></div>;

  // Screen 1: Start / Join screen
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-800">
         <Helmet>
           <title>{t('joinTitle')} | {exam.test_data.title}</title>
           <meta name="description" content={t('joinDescription')} />
           <meta name="robots" content="noindex, nofollow" />
         </Helmet>
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white p-10 rounded-5xl shadow-xl max-w-xl w-full border border-slate-200"
         >
            <div className="flex justify-center mb-6">
               <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                 <FileType2 className="w-8 h-8" />
               </div>
            </div>
            <h1 className="text-3xl font-black text-center mb-2">{exam.test_data.title}</h1>
            <p className="text-center text-slate-500 font-medium mb-8 uppercase tracking-widest text-sm">{t('officialExamMode')}</p>
            
            <form onSubmit={handleStart} className="space-y-6">
              <div>
                <label htmlFor="student-name" className="block text-sm font-bold text-slate-700 mb-2">{t('nameLabel')}</label>
                <input 
                  id="student-name"
                  type="text" 
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="w-full h-14 px-4 text-lg font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-14 text-lg font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/30">
                 {t('startSolving')}
              </Button>
            </form>
         </motion.div>
         <p className="mt-8 text-slate-400 font-medium text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" aria-hidden="true" /> {t('blurNotice')}
         </p>
      </div>
    );
  }

  // Screen 3: Already Submitted
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6 text-center">
         <motion.div 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-white p-10 rounded-5xl shadow-xl border border-emerald-100 max-w-md w-full"
         >
            <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
            <h2 className="text-3xl font-black text-slate-800 mb-4">{t('submittedTitle')}</h2>
            <p className="text-slate-600 font-medium text-lg">{t('submittedBody')}</p>
         </motion.div>
      </div>
    );
  }

  // Screen 2: Test taking view (Dugga like layout)
  // Per-student paper: questions shuffled inside their section and options
  // shuffled per question. Deterministic, so a reload never reorders it.
  const questions = shuffleWithinSections(exam.test_data.questions || [], examId, studentUid);
  let questionNumber = 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
       <Helmet>
         <title>{exam.test_data.title} | {t('officialExam')}</title>
         <meta name="description" content={t('examDescription')} />
         <meta name="robots" content="noindex, nofollow" />
       </Helmet>
       {/* Top Lockdown Header */}
       <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 sticky top-0 z-50">
          <div className="font-bold flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             {exam.test_data.title}
          </div>
          <div className="flex border border-white/20 rounded-lg overflow-hidden">
             <div className="bg-white/10 px-4 py-2 font-bold text-sm">{t('studentLabel', { name: studentName })}</div>
             <div className="hidden md:flex bg-indigo-600 px-4 py-2 font-bold text-sm items-center gap-2">
               <HelpCircle className="w-4 h-4" aria-hidden="true" /> {t('examMode')}
             </div>
          </div>
       </header>

       <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 pb-32">
          <div className="space-y-8">
             {questions.map((q: any, idx: number) => {
                const answerKey = q.originalIndex;
                if (q.type === 'section') {
                  return (
                     <div key={idx} className="pt-8 pb-4 border-b-2 border-indigo-100">
                        <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-widest"><MathRenderer content={q.text} /></h2>
                     </div>
                  );
                }

                return (
                  <div key={idx} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                     <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 border border-indigo-100">
                           {++questionNumber}
                        </div>
                        <div className="flex-1 space-y-6">
                           <div className="text-lg font-medium text-slate-800 leading-relaxed">
                              <MathRenderer content={q.text} />
                           </div>

                           {/* Render Interactive Inputs Based on Type */}
                           <div className="pl-2">
                              {q.type === 'multiple' && q.options && (
                                <div className="space-y-3">
                                   {q.options.map((opt: string, optIdx: number) => (
                                     <label key={optIdx} className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${answers[answerKey] === (q.optionOrder?.[optIdx] ?? optIdx) ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                       <input 
                                         type="radio" 
                                         name={`q_${answerKey}`} 
                                         checked={answers[answerKey] === (q.optionOrder?.[optIdx] ?? optIdx)}
                                         onChange={() => handleAnswerChange(answerKey, q.optionOrder?.[optIdx] ?? optIdx)}
                                         aria-label={opt}
                                         className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                       />
                                       <span className="font-medium text-slate-700 text-lg"><MathRenderer content={opt} /></span>
                                     </label>
                                   ))}
                                </div>
                              )}

                              {q.type === 'true-false' && (
                                <div className="flex flex-wrap md:flex-nowrap gap-4">
                                   {[t('true'), t('false')].map((opt, optIdx) => (
                                     <label key={optIdx} className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-xl cursor-pointer border-2 transition-all ${answers[answerKey] === (q.optionOrder?.[optIdx] ?? optIdx) ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                       <input 
                                         type="radio" 
                                         name={`tf_${answerKey}`} 
                                         checked={answers[answerKey] === optIdx}
                                         onChange={() => handleAnswerChange(answerKey, optIdx)}
                                         className="hidden" // Hiding native radio for big button feel
                                       />
                                       <span className={`font-bold text-xl ${answers[answerKey] === optIdx ? 'text-indigo-700' : 'text-slate-600'}`}>{opt}</span>
                                     </label>
                                   ))}
                                </div>
                              )}

                              {q.type === 'short-answer' && (
                                <textarea 
                                  value={answers[answerKey] || ''}
                                  onChange={e => handleAnswerChange(answerKey, e.target.value)}
                                  placeholder={t('placeholderShort')}
                                  className="w-full h-32 p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 text-lg font-medium text-slate-800 resize-y"
                                />
                              )}

                              {q.type === 'essay' && (
                                <textarea 
                                  value={answers[answerKey] || ''}
                                  onChange={e => handleAnswerChange(answerKey, e.target.value)}
                                  placeholder={t('placeholderEssay')}
                                  className="w-full h-64 p-5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 text-lg font-medium text-slate-800 resize-y leading-relaxed"
                                />
                              )}
                              
                              {q.type === 'fill-blanks' && (
                                <input 
                                  type="text"
                                  value={answers[answerKey] || ''}
                                  onChange={e => handleAnswerChange(answerKey, e.target.value)}
                                  placeholder={t('placeholderFill')}
                                  className="w-full max-w-sm h-14 px-4 bg-slate-50 border-b-4 border-slate-300 focus:border-indigo-500 rounded-t-xl text-xl font-bold text-slate-800 outline-none transition-colors"
                                />
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
                );
             })}
          </div>
       </main>

       {/* Floating Submit Footer */}
       <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
             <div className="text-slate-500 font-bold text-sm hidden md:block">
                {t('answeredCount', { answered: Object.keys(answers).length, total: questions.filter((q: any) => q.type !== 'section').length })}
             </div>
             <Button onClick={submitExam} disabled={isSubmitting} size="lg" className="w-full md:w-auto px-12 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 text-lg font-black">
                {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" /> {t('submitting')}</> : <><Save className="w-5 h-5 mr-2" aria-hidden="true" /> {t('submit')}</>}
             </Button>
          </div>
       </div>
    </div>
  );
};
