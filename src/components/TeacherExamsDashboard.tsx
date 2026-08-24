import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { pointsToGrade } from '../lib/exams/shuffle';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { SummativeExam, SummativeAttempt } from '../lib/schema';
import { Button } from './ui/Button';
import { Loader2, Users, Clock, AlertTriangle, CheckCircle, FileText, ChevronRight, Wand2 } from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { autoGradeSubmission } from '../lib/gemini';
import { useToast } from '../contexts/ToastContext';

export const TeacherExamsDashboard = () => {
  const { t } = useTranslation('common');
  const { t: tExams } = useTranslation('exams');
  const { user } = useAuth();
  const { showToast } = useToast();
  const [exams, setExams] = useState<SummativeExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<SummativeExam | null>(null);
  const [attempts, setAttempts] = useState<SummativeAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState<SummativeAttempt | null>(null);
  /**
   * A per-question suggestion, or the note that one could not be produced.
   *
   * The two are kept apart on purpose: a question the grader could not read is
   * not a question the student got wrong, and must not be scored zero.
   */
  const [aiFeedbacks, setAiFeedbacks] = useState<
    Record<number, { score?: number; feedback: string; failed?: boolean }>
  >({});
  const [isAIGrading, setIsAIGrading] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  const uniqueGrades = Array.from(new Set(exams.map(e => e.test_data?.grade_level).filter(Boolean))).sort();

  const filteredExams = gradeFilter === 'all' 
     ? exams 
     : exams.filter(e => e.test_data?.grade_level === gradeFilter);

  useEffect(() => {
    if (!user) return;
    const fetchExams = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, 'summative_exams'), where('teacher_uid', '==', user.uid), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data() as SummativeExam);
        setExams(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExams();
  }, [user]);

  const loadAttempts = async (exam: SummativeExam) => {
    setSelectedExam(exam);
    setIsGrading(null);
    setAiFeedbacks({});
    try {
       const q = query(collection(db, 'summative_attempts'), where('exam_id', '==', exam.id));
       const snap = await getDocs(q);
       setAttempts(snap.docs.map(d => d.data() as SummativeAttempt));
    } catch (err) {
       console.error(err);
    }
  };

  /** Points available on this exam — the denominator for the 1–5 grade. */
  const examTotalPoints = (exam: any): number => {
    if (typeof exam?.total_points === 'number' && exam.total_points > 0) return exam.total_points;
    const questions: any[] = exam?.test_data?.questions || [];
    const summed = questions.reduce((sum, q) => sum + (Number(q?.points) || 0), 0);
    return summed > 0 ? summed : 100;
  };

  const handleUpdateScore = async (attemptId: string, score: number) => {
     try {
       // Points and the Macedonian 1–5 grade are stored together, so the
       // gradebook does not have to re-derive the mapping.
       const grade = pointsToGrade(score, examTotalPoints(selectedExam));
       await updateDoc(doc(db, 'summative_attempts', attemptId), { score, grade });
       setAttempts(prev => prev.map(a => a.id === attemptId ? { ...a, score, grade } : a));
       setIsGrading(null);
     } catch(e) {
       console.error(e);
       showToast(tExams('errors.saveScoreFailed'), 'error');
     }
  };

  const runAIGrading = async () => {
     if (!selectedExam || !isGrading) return;
     setIsAIGrading(true);
     setAiFeedbacks({});

     let totalRecommended = 0;
     const newFeedbacks: Record<number, any> = {};

     try {
       const filteredQs = selectedExam.test_data.questions.filter((q: any) => q.type !== 'section');
       
       // Run auto grade for each question
       for (const q of filteredQs) {
          const originalIndex = selectedExam.test_data.questions.indexOf(q);
          const studentAns = isGrading.answers[originalIndex];
          
          if (studentAns === undefined || studentAns === null || studentAns === '') {
             // A real zero: the student did not answer. Distinct from the case
             // below, where the grader could not produce a result at all.
             newFeedbacks[originalIndex] = { score: 0, feedback: tExams('dashboard.noAnswerGiven') };
          } else {
             try {
               const result = await autoGradeSubmission(q, studentAns);
               newFeedbacks[originalIndex] = result;
               totalRecommended += (result.score || 0);
             } catch (questionError) {
               // Caught per question, so one failed suggestion does not lose the
               // other nineteen. The question is marked as ungraded rather than
               // scored zero — the teacher grades it, and the recommended total
               // does not silently count it as failed.
               console.error('AI grading failed for one question:', questionError);
               newFeedbacks[originalIndex] = {
                 failed: true,
                 feedback: tExams('dashboard.questionNotGraded'),
               };
             }
          }
       }
       setAiFeedbacks(newFeedbacks);
       // We can optionally auto-fill the target total score.
       const input = document.getElementById('final-score') as HTMLInputElement;
       if(input) input.value = totalRecommended.toString();
     } catch(e) {
        showToast(tExams('dashboard.aiGradingFailed'), 'error');
     } finally {
        setIsAIGrading(false);
     }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
         <div>
            <h1 className="text-3xl font-black text-slate-800">{tExams('dashboard.title')}</h1>
            <p className="text-slate-500">{tExams('dashboard.subtitle')}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* EXAM LIST */}
         <div className="lg:col-span-1 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 mb-2 gap-2">
               <h2 className="text-xl font-bold text-slate-700">{tExams('dashboard.yourExams')}</h2>
               {uniqueGrades.length > 0 && (
                 <select
                   value={gradeFilter}
                   onChange={(e) => setGradeFilter(e.target.value)}
                   title={t('ariaFilterByGrade')}
                   aria-label={t('ariaFilterByGrade')}
                   className="h-9 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                 >
                   <option value="all">{tExams('dashboard.allGrades')}</option>
                   {uniqueGrades.map(grade => (
                     <option key={grade as string} value={grade as string}>{grade as string}</option>
                   ))}
                 </select>
               )}
            </div>
            {filteredExams.length === 0 && (
               <div className="p-6 bg-slate-50 border border-slate-200 text-center rounded-xl text-slate-500">
                  Нема испити за овој критериум. Одете во "Материјали" {'->'} "МакедоТест Pro" за да креирате.
               </div>
            )}
            {filteredExams.map(exam => (
              <button
                type="button"
                key={exam.id}
                onClick={() => loadAttempts(exam)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${selectedExam?.id === exam.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
              >
                 <div className="font-bold text-slate-800 text-lg mb-1 truncate">{exam.test_data.title}</div>
                 <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">{new Date(exam.created_at).toLocaleDateString('mk-MK')}</div>
              </button>
            ))}
         </div>

         {/* SUBMISSIONS LIST / GRADING VIEW */}
         <div className="lg:col-span-2">
            {!selectedExam && (
               <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 h-96 flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-16 h-16 mb-4 opacity-50" />
                  <p className="font-medium text-lg">{tExams('dashboard.pickExam')}</p>
               </div>
            )}

            {selectedExam && !isGrading && (
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-900 p-6 text-white">
                     <h2 className="text-2xl font-black">{selectedExam.test_data.title}</h2>
                     <p className="text-slate-300 font-medium">{tExams('dashboard.totalSubmissions', { count: attempts.length })}</p>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                     {attempts.length === 0 && <div className="p-8 text-center text-slate-500">{tExams('dashboard.noSubmissions')}</div>}
                     {attempts.map(attempt => (
                        <div key={attempt.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4 items-center justify-between">
                           <div className="flex-1 w-full">
                              <h3 className="text-xl font-bold text-slate-800">{attempt.student_name}</h3>
                              <div className="flex flex-wrap gap-4 mt-2 text-sm font-medium text-slate-600">
                                 <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {attempt.anti_cheat?.time_spent_seconds ? Math.floor(attempt.anti_cheat.time_spent_seconds / 60) : 0} мин.</span>
                                 {attempt.anti_cheat && attempt.anti_cheat.tab_switches > 0 ? (
                                    <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 rounded-md"><AlertTriangle className="w-4 h-4" /> {tExams('dashboard.tabSwitches', { count: attempt.anti_cheat.tab_switches })}</span>
                                 ) : (
                                    <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 rounded-md"><CheckCircle className="w-4 h-4" /> {tExams('dashboard.cleanFocus')}</span>
                                 )}
                                 <span className="text-slate-400">{tExams('dashboard.submittedAt', { time: new Date(attempt.submitted_at).toLocaleTimeString('mk-MK') })}</span>
                              </div>
                           </div>
                           <div className="flex items-center gap-4 w-full md:w-auto">
                              {attempt.score !== undefined ? (
                                 <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <div className="text-xs font-bold text-emerald-600 uppercase">
                                       {tExams('dashboard.points', { earned: attempt.score, total: examTotalPoints(selectedExam) })}
                                    </div>
                                    <div className="text-2xl font-black text-emerald-700">
                                       {tExams('dashboard.grade')} {attempt.grade ?? pointsToGrade(attempt.score, examTotalPoints(selectedExam))}
                                    </div>
                                 </div>
                              ) : (
                                 <div className="text-center px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
                                    <div className="text-xs font-bold text-amber-600 uppercase">{tExams('dashboard.notGraded')}</div>
                                 </div>
                              )}
                              <a
                                 href={`/gradebook?student=${encodeURIComponent(attempt.student_uid)}`}
                                 className="text-sm font-bold text-indigo-700 hover:underline whitespace-nowrap"
                              >
                                 {tExams('dashboard.openGradebook')}
                              </a>
                              <Button onClick={() => setIsGrading(attempt)} className="bg-indigo-600 hover:bg-indigo-700">{tExams('dashboard.openAttempt')} <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" /></Button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* DETAILED GRADING VIEW */}
            {selectedExam && isGrading && (
               <div className="space-y-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-4 z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                     <div>
                        <Button variant="ghost" className="mb-2 text-slate-500 -ml-2" onClick={() => setIsGrading(null)}>{tExams('dashboard.backToList')}</Button>
                        <h2 className="text-2xl font-black text-slate-800">{isGrading.student_name}</h2>
                        <div className="flex gap-2 mt-1">
                           {isGrading.anti_cheat && isGrading.anti_cheat.tab_switches > 0 ? (
                              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {tExams('dashboard.warnSwitches', { count: isGrading.anti_cheat.tab_switches })}</span>
                           ) : (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {tExams('dashboard.noSwitches')}</span>
                           )}
                           <Button onClick={runAIGrading} disabled={isAIGrading} size="sm" className="ml-4 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 h-6 px-2 text-xs">
                              {isAIGrading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />} AI Сугестија
                           </Button>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          id="final-score"
                          defaultValue={isGrading.score ?? ''}
                          placeholder={tExams('dashboard.pointsPlaceholder')} 
                          className="w-24 h-12 text-center text-xl font-black border-2 border-slate-300 rounded-xl focus:border-indigo-500"
                        />
                        <Button 
                          onClick={() => {
                             const input = document.getElementById('final-score') as HTMLInputElement;
                             if(input && input.value) handleUpdateScore(isGrading.id, Number(input.value));
                          }}
                          className="h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 rounded-xl"
                        >{tExams('dashboard.saveGrade')}</Button>
                     </div>
                  </div>

                  {selectedExam.test_data.questions.filter((q: any) => q.type !== 'section').map((q: any, qIndex: number) => {
                     const ans = isGrading.answers[qIndex]; // The index mapping isn't 100% matched to filtered list if there are sections, 
                     // Wait, in SummativeExam we used the raw `idx` from the `questions` array. We should use standard mapping.
                     // Let's find the original index.
                     const originalIndex = selectedExam.test_data.questions.indexOf(q);
                     const studentAns = isGrading.answers[originalIndex];

                     return (
                        <div key={originalIndex} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                           <div className="flex gap-4 mb-4">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center shrink-0">
                                 {originalIndex + 1}
                              </div>
                              <div className="text-slate-800 font-medium pt-1">
                                 <MathRenderer content={q.text} />
                              </div>
                           </div>
                           
                           <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 ml-12">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{tExams('dashboard.studentAnswer')}</h4>
                              {studentAns === undefined || studentAns === null || studentAns === '' ? (
                                 <span className="text-red-500 font-bold italic">{tExams('dashboard.noAnswer')}</span>
                              ) : (
                                 <div className="text-lg font-bold text-indigo-900">
                                    {q.type === 'multiple' || q.type === 'true-false' ? (
                                       q.type === 'multiple' ? <MathRenderer content={q.options?.[studentAns] || String(studentAns)} /> :
                                       (studentAns === 0 ? 'Точно' : 'Неточно')
                                    ) : (
                                       <div className="whitespace-pre-wrap">{String(studentAns)}</div>
                                    )}
                                 </div>
                              )}
                              {aiFeedbacks[originalIndex] && (
                                 <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center mb-1">
                                       <span className="text-xs font-bold text-indigo-500 uppercase flex items-center gap-1"><Wand2 className="w-3 h-3" /> {tExams('dashboard.aiAnalysis')}</span>
                                       <span className="text-sm font-black text-indigo-700">
                                          {aiFeedbacks[originalIndex].failed
                                            ? tExams('dashboard.notGraded')
                                            : tExams('dashboard.pointsOf', { score: aiFeedbacks[originalIndex].score, max: q.points || 0 })}
                                       </span>
                                    </div>
                                    <p className="text-sm text-indigo-900 leading-relaxed font-medium">{aiFeedbacks[originalIndex].feedback}</p>
                                 </div>
                              )}
                           </div>
                           <div className="ml-12 mt-3 flex justify-between items-center text-sm">
                               <div className="text-slate-500 font-medium">{tExams('dashboard.maxPoints')} <span className="font-bold text-slate-800">{q.points || 0}</span></div>
                           </div>
                        </div>
                     );
                  })}
               </div>
            )}
         </div>
      </div>
    </div>
  );
};
