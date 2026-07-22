import React, { useState, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, CheckCircle2, AlertTriangle, FileWarning, Search,
  Brain, BrainCircuit, ScanLine, Calculator, ChevronRight, Image as ImageIcon, Camera, User, BookOpen
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { MathTask, GradedSubmission, GradeEntry, MKGrade, GradeCategory } from '../lib/schema';
import { useLibraryStore } from '../store/useLibraryStore';
import { MathRenderer } from './MathRenderer';
import { analyzeSolutionImage, generateTargetedPracticeTasks, analyzeBatchTestImage } from '../lib/gemini';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { addDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Helper: Convert score (0-100) to MK grade (1-5)
function scoreToMKGrade(score: number): MKGrade {
  if (score >= 90) return 5; // Одлично
  if (score >= 75) return 4; // Многу добро
  if (score >= 60) return 3; // Добро
  if (score >= 50) return 2; // Доволно
  return 1; // Недоволно
}

// Helper: Save grade to Gradebook
async function saveToGradebook(
  studentName: string,
  score: number,
  taskTitle: string,
  teacherUid: string,
  category: GradeCategory = 'test'
): Promise<void> {
  const gradeEntry: Omit<GradeEntry, 'id'> = {
    classroomId: 'default', // TODO: Get from context or selection
    studentId: studentName.toLowerCase().replace(/\s+/g, '-'),
    studentName,
    taskTitle,
    category,
    grade: scoreToMKGrade(score),
    maxPoints: 100,
    earnedPoints: score,
    feedback: `AI оценување: ${score}/100`,
    gradedAt: new Date().toISOString(),
    gradedBy: teacherUid,
    term: 'I', // TODO: Get current term
    schoolYear: '2026/2027', // TODO: Get current school year
  };

  await addDoc(collection(db, 'grade_entries'), gradeEntry);
}

export const SmartGrader: React.FC = () => {
  const { tasks } = useLibraryStore();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation('smartGrader');
  
  const [gradingMode, setGradingMode] = useState<'single' | 'batch'>('single');
  const [selectedTask, setSelectedTask] = useState<MathTask | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [studentIdentifier, setStudentIdentifier] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null); // For single mode
  const [batchResults, setBatchResults] = useState<any[] | null>(null); // For batch mode
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingPractice, setIsGeneratingPractice] = useState(false);
  const [practiceTasks, setPracticeTasks] = useState<Record<number, MathTask[]>>({}); // Keyed by batch task index, or 0 for single
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.original_text.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(t => t.type !== 'theory');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast(t('toasts.imageTooLarge'), 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setImageMimeType(file.type);
      setResult(null); // Clear previous results
      setBatchResults(null);
      setPracticeTasks({});
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePractice = async (taskResult: any, index: number = 0) => {
    if (!taskResult || !taskResult.identified_weaknesses || taskResult.identified_weaknesses.length === 0) return;
    
    // In batch mode we don't have a specific `selectedTask` to pass as originalTask.
    // We can pass a mock task with the extracted text.
    const mockTask: MathTask = selectedTask || {
      id: 'mock',
      type: 'task',
      title: 'Batch Extraction',
      original_text: taskResult.extracted_task_text || '',
      solution_steps: [],
      difficulty: 'medium',
      latex_formulas: [],
      source_url: '',
      tags: []
    };

    setIsGeneratingPractice(true);
    try {
      const generated = await generateTargetedPracticeTasks(taskResult.identified_weaknesses, mockTask, 3);
      setPracticeTasks(prev => ({...prev, [index]: generated}));
    } catch (e) {
       console.error("Failed to generate practice", e);
       showToast(t('toasts.practiceGenError'), 'error');
    } finally {
       setIsGeneratingPractice(false);
    }
  };

  const runAnalysis = async () => {
    if (gradingMode === 'single' && !selectedTask) return;
    if (!selectedImage) return;
    
    if (!studentIdentifier.trim()) {
       showToast(t('toasts.enterStudentId'), 'error');
       return;
    }

    setIsAnalyzing(true);
    try {
      let studentHistory = "";
      if (user) {
        try {
          const q = query(
            collection(db, 'graded_submissions'), 
            where('teacher_uid', '==', user.uid),
            where('student_identifier', '==', studentIdentifier.trim()),
            orderBy('created_at', 'desc'),
            limit(5)
          );
          const historySnapshot = await getDocs(q);
          const historyDocs = historySnapshot.docs.map(d => d.data() as GradedSubmission);
          
          if (historyDocs.length > 0) {
             studentHistory = historyDocs.map((doc, idx) => {
                return `Test ${idx + 1} (${new Date(doc.created_at).toLocaleDateString()}):
Score: ${doc.score}
Weaknesses: ${doc.identified_weaknesses?.join(', ')}
Feedback: ${doc.feedback_summary}`;
             }).join('\n\n');
          }
        } catch (historyErr) {
          console.error("Failed to fetch student history:", historyErr);
        }
      }

      const base64Data = selectedImage.split(',')[1];
      
      if (gradingMode === 'single') {
        const analysisResult = await analyzeSolutionImage(selectedTask!, base64Data, imageMimeType, studentHistory);
        setResult(analysisResult);

        // Save longitudinal analytics
        if (user) {
           try {
             const submission: Omit<GradedSubmission, 'id'> = {
                student_identifier: studentIdentifier.trim(),
                teacher_uid: user.uid,
                task_id: selectedTask!.id || '',
                score: analysisResult.score,
                pedagogical_evaluation: analysisResult.pedagogical_evaluation,
                bloom_level_assessed: analysisResult.pedagogical_evaluation?.framework === 'bloom' ? analysisResult.pedagogical_evaluation.level : undefined, // Legacy fallback
                identified_weaknesses: analysisResult.identified_weaknesses || [],
                rubric_breakdown: analysisResult.rubric_breakdown,
                feedback_summary: analysisResult.analysis,
                created_at: new Date().toISOString()
             };
             await addDoc(collection(db, 'graded_submissions'), submission);

             // Save to Gradebook
             if (studentIdentifier.trim()) {
               await saveToGradebook(
                 studentIdentifier.trim(),
                 analysisResult.score,
                 selectedTask!.title || 'AI Оценување',
                 user.uid,
                 'test'
               );
               showToast(t('toasts.gradeSaved'), 'success');
             }
           } catch (dbErr) {
             console.error("Failed to save student analytic profiling:", dbErr);
           }
        }
      } else {
        const batchAnalysis = await analyzeBatchTestImage(base64Data, imageMimeType, studentHistory);
        setBatchResults(batchAnalysis);

        // Save longitudinal analytics for each extracted task
        if (user) {
          for (let i = 0; i < batchAnalysis.length; i++) {
             const br = batchAnalysis[i];
             try {
               const submission: Omit<GradedSubmission, 'id'> = {
                  student_identifier: studentIdentifier.trim(),
                  teacher_uid: user.uid,
                  task_id: `batch-${Date.now()}-${i}`,
                  score: br.score,
                  pedagogical_evaluation: br.pedagogical_evaluation,
                  bloom_level_assessed: br.pedagogical_evaluation?.framework === 'bloom' ? br.pedagogical_evaluation.level : undefined,
                  identified_weaknesses: br.identified_weaknesses || [],
                  rubric_breakdown: br.rubric_breakdown,
                  feedback_summary: br.analysis,
                  created_at: new Date().toISOString()
               };
               await addDoc(collection(db, 'graded_submissions'), submission);

               // Save to Gradebook
               if (studentIdentifier.trim()) {
                 await saveToGradebook(
                   studentIdentifier.trim(),
                   br.score,
                   br.extracted_task_text?.substring(0, 50) || `Задача ${i + 1}`,
                   user.uid,
                   'test'
                 );
               }
             } catch (dbErr) {
               console.error("Failed to save student analytic profiling for batch task:", dbErr);
             }
          }
          if (studentIdentifier.trim()) {
            showToast(t('toasts.batchGradesSaved', { count: batchAnalysis.length }), 'success');
          }
        }
      }
      
    } catch (error) {
      console.error("Grader Analysis Error:", error);
      showToast(t('toasts.analysisError'), 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderBloomBadge = (level?: string) => {
    if (!level) return null;
    const colors: Record<string, string> = {
      remember: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      understand: 'bg-blue-100 text-blue-800 border-blue-200',
      apply: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      analyze: 'bg-purple-100 text-purple-800 border-purple-200',
      evaluate: 'bg-orange-100 text-orange-800 border-orange-200',
      create: 'bg-rose-100 text-rose-800 border-rose-200'
    };
    
    const colorClass = colors[level] || 'bg-slate-100 text-slate-800 border-slate-200';

    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${colorClass}`}>
        {t('bloom.label', { level: t(`bloom.${level}`, { defaultValue: level }) })}
      </span>
    );
  };

  const renderAnalysisResult = (res: any, index: number = 0) => {
    if (!res) return null;
    return (
      <div key={index} className="space-y-8 animate-in fade-in duration-500 mb-12 border-b border-slate-200 dark:border-slate-700 pb-12 last:border-0 last:pb-0">
        
        {gradingMode === 'batch' && (
          <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-xl mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-2">{t('result.detectedTask', { index: index + 1 })}</h3>
            <MathRenderer content={res.extracted_task_text || t('result.noTaskText')} />
          </div>
        )}

        {/* Score & Status */}
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2 ${
            res.score >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
            res.score >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' : 
            'bg-red-50 border-red-200 text-red-700'
          }`}>
            <span className="text-2xl font-black">{res.score}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">{t('result.outOf100')}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{t('result.solvingStatus')}</h3>
            {res.pedagogical_evaluation ? (
              <div className="flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  {res.pedagogical_evaluation.framework.toUpperCase()}: {res.pedagogical_evaluation.level}
                </div>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  <strong className="text-slate-700">{t('result.selectedMetric')}</strong> {res.pedagogical_evaluation.reason}
                </p>
              </div>
            ) : (
              selectedTask?.bloom_taxonomy && renderBloomBadge(selectedTask.bloom_taxonomy)
            )}
          </div>
        </div>

        {/* Errors */}
        {res.errorsFound?.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-bold text-red-600 flex items-center gap-2 text-sm uppercase tracking-wider">
              <FileWarning className="w-4 h-4" /> {t('result.identifiedErrors')}
            </h4>
            <ul className="space-y-2">
              {res.errorsFound.map((err: string, i: number) => (
                <li key={i} className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-3 rounded-xl text-sm leading-relaxed border border-red-100 dark:border-red-900/30">
                  <MathRenderer content={err} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl flex items-center gap-3 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium text-sm">{t('result.noErrors')}</span>
          </div>
        )}

        {/* Formative Rubric Breakdown */}
        {res.rubric_breakdown && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> {t('result.formativeRubric')}
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {/* Concept */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-shrink-0 text-center sm:text-left min-w-[80px]">
                   <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{res.rubric_breakdown.concept.score}</div>
                   <div className="text-[10px] uppercase font-bold text-slate-500">{t('result.concept')}</div>
                </div>
                <div className="w-full sm:w-auto h-px sm:h-auto sm:w-px bg-slate-200 dark:bg-slate-700 self-stretch"></div>
                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  <MathRenderer content={res.rubric_breakdown.concept.comment} inline />
                </div>
              </div>

              {/* Execution */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-shrink-0 text-center sm:text-left min-w-[80px]">
                   <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{res.rubric_breakdown.execution.score}</div>
                   <div className="text-[10px] uppercase font-bold text-slate-500">{t('result.execution')}</div>
                </div>
                <div className="w-full sm:w-auto h-px sm:h-auto sm:w-px bg-slate-200 dark:bg-slate-700 self-stretch"></div>
                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  <MathRenderer content={res.rubric_breakdown.execution.comment} inline />
                </div>
              </div>

              {/* Presentation */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-shrink-0 text-center sm:text-left min-w-[80px]">
                   <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{res.rubric_breakdown.presentation.score}</div>
                   <div className="text-[10px] uppercase font-bold text-slate-500">{t('result.communication')}</div>
                </div>
                <div className="w-full sm:w-auto h-px sm:h-auto sm:w-px bg-slate-200 dark:bg-slate-700 self-stretch"></div>
                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  <MathRenderer content={res.rubric_breakdown.presentation.comment} inline />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* General Feedback */}
        <div className="space-y-3">
          <h4 className="font-bold text-indigo-600 flex items-center gap-2 text-sm uppercase tracking-wider">
            <Brain className="w-4 h-4" /> {t('result.inspirationalMentor')}
          </h4>
          <div className="bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-900/20 dark:to-slate-900/20 p-5 rounded-2xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed border border-indigo-100 dark:border-indigo-800/30 shadow-inner">
             <MathRenderer content={res.analysis} inline/>
          </div>
        </div>

        {/* Good and Bad Sides Split View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Good Sides */}
          {res.good_sides && res.good_sides.length > 0 && (
            <div className="space-y-3 bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                {t('result.doneWell')}
              </h4>
              <ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-300">
                {res.good_sides.map((good: string, i: number) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-emerald-500 font-bold mt-0.5">•</span>
                    <span className="leading-relaxed"><MathRenderer content={good} inline /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bad Sides */}
          {res.bad_sides && res.bad_sides.length > 0 && (
            <div className="space-y-3 bg-rose-50 dark:bg-rose-900/10 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30">
              <h4 className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                {t('result.whereBreaks')}
              </h4>
              <ul className="space-y-2 text-sm text-rose-800 dark:text-rose-300">
                {res.bad_sides.map((bad: string, i: number) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-rose-500 font-bold mt-0.5">•</span>
                    <span className="leading-relaxed"><MathRenderer content={bad} inline /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {res.suggestions?.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-bold text-amber-600 flex items-center gap-2 text-sm uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" /> {t('result.suggestions')}
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {res.suggestions.map((sug: string, i: number) => (
                <li key={i} className="flex gap-2 items-start">
                  <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed"><MathRenderer content={sug} inline /></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Target Practice Gen */}
        {res.identified_weaknesses && res.identified_weaknesses.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
              <div>
                <h4 className="font-bold text-indigo-700 dark:text-indigo-400 text-sm uppercase tracking-wider mb-1">
                  {t('result.generatePractice')}
                </h4>
                <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80">
                  {t('result.createPersonalized')} <span className="font-bold">{res.identified_weaknesses.join(', ')}</span>
                </p>
              </div>
              <Button
                onClick={() => handleGeneratePractice(res, index)}
                disabled={isGeneratingPractice}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-lg shadow-indigo-500/20"
              >
                 {isGeneratingPractice ? t('result.generatingTasks') : t('result.generateHomework')}
              </Button>
            </div>

            {practiceTasks[index] && practiceTasks[index].length > 0 && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">{t('result.personalizedTasks')}</h4>
                {practiceTasks[index].map((pt, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase px-2 py-1 rounded">{t('result.taskNumber', { index: i + 1 })}</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-white">{pt.title}</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                       <MathRenderer content={pt.original_text} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900 text-white rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-4 border border-emerald-500/30">
            <BrainCircuit className="w-4 h-4" />
            {t('header.badge')}
          </div>
          <h1 className="text-4xl font-black mb-4">{t('header.title')}</h1>
          <p className="text-slate-400 text-lg">
            {t('header.subtitle')}
          </p>
        </div>
        <div className="relative z-10 bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
          <ScanLine className="w-16 h-16 text-emerald-400 mx-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step 1: Select Task */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
             <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
               <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">1</span>
               {t('mode.title')}
             </h2>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[600px]">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-6 flex-shrink-0">
               <button 
                 onClick={() => setGradingMode('single')}
                 className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${gradingMode === 'single' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
               >
                 {t('mode.singleTask')}
               </button>
               <button 
                 onClick={() => setGradingMode('batch')}
                 className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${gradingMode === 'batch' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
               >
                 {t('mode.batchWholeTest')}
               </button>
            </div>

            {gradingMode === 'single' ? (
              <>
                <div className="relative mb-4 shrink-0">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder={t('mode.searchLibrary')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-sm transition-all"
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {filteredTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-4 rounded-xl cursor-pointer border transition-all ${
                        selectedTask?.id === task.id 
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                          : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <p className="font-bold text-sm text-slate-800 dark:text-gray-200 line-clamp-2 mb-2">
                        {task.title}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-500">
                          {task.difficulty}
                        </span>
                        {task.bloom_taxonomy && renderBloomBadge(task.bloom_taxonomy)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center h-full px-4 text-slate-500">
                 <ScanLine className="w-16 h-16 mb-4 text-indigo-300 dark:text-indigo-700 opacity-50" />
                 <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">{t('mode.autoSegmenting')}</h3>
                 <p className="text-sm">
                   {t('mode.autoSegmentingDesc')}
                 </p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Upload Student Image */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">2</span>
            {t('upload.title')}
          </h2>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm h-[600px] flex flex-col items-center justify-center relative overflow-hidden">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleImageSelect}
              aria-label={t('upload.selectImageAria')}
              className="hidden" 
            />
            
            {selectedImage ? (
              <div className="relative w-full h-full flex flex-col group gap-4">
                <div className="relative w-full h-[85%]">
                  <img src={selectedImage} alt={t('upload.studentWorkAlt')} className="w-full h-full object-contain rounded-xl" />
                  <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <Button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 hover:bg-slate-100">
                      <Camera className="w-4 h-4 mr-2" /> {t('upload.changeImage')}
                    </Button>
                  </div>
                </div>
                
                {/* Identifier Input */}
                <div className="h-[15%] w-full flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                   <User className="text-indigo-400 w-5 h-5 shrink-0" />
                   <input
                     type="text"
                     placeholder={t('upload.enterStudentName')}
                     value={studentIdentifier}
                     onChange={e => setStudentIdentifier(e.target.value)}
                     className="w-full bg-transparent border-none outline-none text-sm font-semibold text-slate-700 dark:text-slate-200"
                   />
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ImageIcon className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{t('upload.attachHandwriting')}</h3>
                <p className="text-sm text-slate-500 max-w-[250px] mx-auto mb-6">{t('upload.attachDesc')}</p>
                <Button onClick={() => fileInputRef.current?.click()} size="lg" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                  <Upload className="w-5 h-5 mr-2" /> {t('upload.selectFile')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Analysis Results */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
              <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">3</span>
              {t('analysis.title')}
            </h2>
            <Button 
              onClick={runAnalysis}
              disabled={(!selectedTask && gradingMode === 'single') || !selectedImage || isAnalyzing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              {isAnalyzing ? <span className="flex items-center"><ScanLine className="w-4 h-4 mr-2 animate-pulse" /> {t('analysis.analyzing')}</span> : <span className="flex items-center"><Brain className="w-4 h-4 mr-2" /> {t('analysis.gradeHandwriting')}</span>}
            </Button>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm h-[600px] overflow-y-auto">
            {!result && !batchResults && !isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-6">
                <Calculator className="w-16 h-16 mb-4 opacity-20" />
                <p>{t('analysis.emptyState')}</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center space-y-6">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-700 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <BrainCircuit className="absolute inset-0 m-auto w-8 h-8 text-emerald-500 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-bold text-slate-700 dark:text-slate-200">{t('analysis.readingSteps')}</p>
                  <p className="text-sm text-slate-500">{t('analysis.comparingHandwriting')}</p>
                </div>
              </div>
            )}

            {!isAnalyzing && result && gradingMode === 'single' && renderAnalysisResult(result, 0)}
            
            {!isAnalyzing && batchResults && gradingMode === 'batch' && (
              <div>
                <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    {t('analysis.batchSuccess')}
                  </h3>
                  <p className="text-sm"><Trans i18nKey="analysis.batchDetected" ns="smartGrader" values={{ count: batchResults.length }} components={{ strong: <span className="font-bold" /> }} /></p>
                </div>
                {batchResults.map((res, index) => renderAnalysisResult(res, index))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
