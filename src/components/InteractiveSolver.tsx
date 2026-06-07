import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Send, ArrowRight, Lightbulb, Sparkles, RotateCcw, X, Camera, AlertTriangle, PenTool, Eraser, Activity } from 'lucide-react';
import { Button } from './ui/Button';
import { MathRenderer } from './MathRenderer';
import { MathTask, CognitiveTelemetryStep, TaskAttempt, UserProfile } from '../lib/schema';
import { verifyUserStep, analyzeSolutionImage } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { InteractiveCanvas } from './InteractiveCanvas';
import { GeoGebraViewer } from './GeoGebraViewer';

interface InteractiveSolverProps {
  task: MathTask;
  onClose: () => void;
  onComplete: (xp: number) => void;
}

export const InteractiveSolver: React.FC<InteractiveSolverProps> = ({ task, onClose, onComplete }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [liveSyncId, setLiveSyncId] = useState<string | null>(null);

  useEffect(() => {
     if (user) {
        getDoc(doc(db, 'users', user.uid)).then(docSnap => {
           if (docSnap.exists()) {
               setUserProfile(docSnap.data() as UserProfile);
           }
        });
        
        // Generate a deterministic session ID for teacher to spectate
        const newSyncId = `${user.uid}_${task.id}`;
        setLiveSyncId(newSyncId);
        
        // Also register this active session for teachers to see
        // Assuming task might pass classroomIds or we just save it globally.
        setDoc(doc(db, 'active_user_sessions', newSyncId), {
           userId: user.uid,
           userName: userProfile?.displayName || user.email || 'Непознат',
           taskId: task.id,
           taskTitle: task.title || task.curriculum_topic,
           startedAt: new Date().toISOString(),
           lastActive: new Date().toISOString()
        });
     }
  }, [user, task.id]);

  const [userSteps, setUserSteps] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; hint?: string } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageFeedback, setImageFeedback] = useState<{ analysis: string; errorsFound: string[]; suggestions: string[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Telemetry Engine State
  const [attemptStartTime] = useState<Date>(new Date());
  const [stepStartTime, setStepStartTime] = useState<Date>(new Date());
  const [telemetrySteps, setTelemetrySteps] = useState<CognitiveTelemetryStep[]>([]);
  const [hintsRequested, setHintsRequested] = useState(0);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [ggbState, setGgbState] = useState<Record<string, {x:number, y:number}>>({});

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'geogebra_update') {
         const { objName, x, y } = event.data;
         setGgbState(prev => ({ ...prev, [objName]: { x: Math.round(x*100)/100, y: Math.round(y*100)/100 } }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const submitCanvasBase64 = async (base64Image: string) => {
    setIsAnalyzingImage(true);
    setImageFeedback(null);
    setFeedback(null);
    setIsDrawingMode(false);

    try {
      const result = await analyzeSolutionImage(task, base64Image, 'image/jpeg');
      setImageFeedback(result);
    } catch (err) {
      console.error("Error analyzing image:", err);
      setFeedback({ isCorrect: false, message: "Грешка при анализа на сликата." });
    } finally {
      setIsAnalyzingImage(false);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleVerifyStep = async (overrideInput?: string) => {
    let rawInput = overrideInput !== undefined ? overrideInput : currentInput;
    if (!rawInput.trim() && !overrideInput) return;
    if (isVerifying) return;

    setIsVerifying(true);
    setFeedback(null);
    setImageFeedback(null);
    const stepEndTime = new Date();
    const timeSpent = Math.max(0, Math.floor((stepEndTime.getTime() - stepStartTime.getTime()) / 1000));
    
    // Inject GeoGebra state silently for the AI context
    let inputToVerify = rawInput;
    const ggbKeys = Object.keys(ggbState);
    if (ggbKeys.length > 0 && !inputToVerify.includes("[GeoGebra")) {
       const ggbContext = ggbKeys.map(k => `${k}(${ggbState[k].x}, ${ggbState[k].y})`).join(", ");
       inputToVerify += `\n[GeoGebra Hidden Context: Student is currently viewing points at: ${ggbContext}]`;
    }

    try {
      const result = await verifyUserStep(task, userSteps, inputToVerify);
      
      // Build internal telemetry payload
      const stepData: CognitiveTelemetryStep = {
        step_text: rawInput,
        is_correct: result.isCorrect,
        time_spent_seconds: timeSpent,
        hints_requested: hintsRequested,
        ai_feedback: result.feedback,
        timestamp: stepEndTime.toISOString()
      };
      setTelemetrySteps(prev => [...prev, stepData]);
      
      // Reset step timers and counters
      setStepStartTime(new Date());
      setHintsRequested(0);
      
      if (result.isCorrect && !rawInput.includes("Сократска насока")) {
        setUserSteps(prev => [...prev, rawInput]);
        setCurrentInput('');
        setFeedback({ isCorrect: true, message: result.feedback });
        
        // Final completion logic
        if (result.feedback.toLowerCase().includes('заврши') || result.feedback.toLowerCase().includes('браво') || result.isFinished) {
           setIsFinished(true);
        }
      } else {
        setFeedback({ isCorrect: false, message: result.feedback, hint: result.hint });
      }
    } catch (err) {
      console.error("Error verifying step:", err);
      setFeedback({ isCorrect: false, message: "Настана грешка при верификација на чекорот." });
    } finally {
      setIsVerifying(false);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingImage(true);
    setImageFeedback(null);
    setFeedback(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const base64Image = base64Data.split(',')[1];
        
        try {
          const result = await analyzeSolutionImage(task, base64Image, file.type);
          setImageFeedback(result);
        } catch (err) {
          console.error("Error analyzing image:", err);
          setFeedback({ isCorrect: false, message: "Грешка при анализа на сликата." });
        } finally {
          setIsAnalyzingImage(false);
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error reading file:", err);
      setIsAnalyzingImage(false);
    }
  };

  const saveTelemetryToFirebase = async (status: 'completed' | 'abandoned') => {
    if (!user || userProfile?.role !== 'student' || !task.id) return;
    
    try {
      const endTime = new Date();
      const attemptData: TaskAttempt = {
        user_id: user.uid,
        task_id: task.id,
        start_time: attemptStartTime.toISOString(),
        end_time: endTime.toISOString(),
        status,
        steps_taken: telemetrySteps,
        total_time_spent: Math.floor((endTime.getTime() - attemptStartTime.getTime()) / 1000),
        total_hints_used: telemetrySteps.reduce((acc, step) => acc + step.hints_requested, 0),
        mistake_count: telemetrySteps.filter(s => !s.is_correct).length,
        curriculum_topic: task.curriculum_topic,
        tags: task.tags,
      };
      
      await addDoc(collection(db, 'task_attempts'), attemptData);
    } catch (err) {
      console.error("Failed to save attempt telemetry:", err);
    }
  };

  const handleFinish = async () => {
    await saveTelemetryToFirebase('completed');
    if (liveSyncId) {
      await deleteDoc(doc(db, 'active_user_sessions', liveSyncId));
    }
    onComplete(200); // Award 200 XP for interactive solving
    onClose();
  };

  const handleManualClose = async () => {
    if (telemetrySteps.length > 0 && !isFinished) {
       await saveTelemetryToFirebase('abandoned');
    }
    if (liveSyncId) {
      await deleteDoc(doc(db, 'active_user_sessions', liveSyncId));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Интерактивно Решавање</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Решавај чекор-по-чекор со AI верификација</p>
            </div>
          </div>
          <button onClick={handleManualClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Task Content */}
          <div className="w-full lg:w-1/3 p-6 border-r border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Текст на задачата</h4>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
              <MathRenderer content={task.original_text} className="text-slate-800 dark:text-slate-200 leading-relaxed" />
            </div>
            
            {task.geogebra_commands && task.geogebra_commands.length > 0 && (
               <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center mb-2 pl-2">
                     <span>Интерактивен График</span>
                     {Object.keys(ggbState).length > 0 && (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] normal-case animate-pulse flex items-center gap-1">
                           <Activity className="w-3 h-3" /> Живо читање на координати
                        </span>
                     )}
                  </h4>
                  <div className="w-full aspect-square border border-slate-100 rounded-xl overflow-hidden relative">
                     <GeoGebraViewer commands={task.geogebra_commands} inline={true} />
                  </div>
               </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <div className={`w-2 h-2 rounded-full ${task.difficulty === 'easy' ? 'bg-green-500' : task.difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                Тежина: <span className="capitalize">{task.difficulty}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Target className="w-3 h-3" />
                DoK Ниво: {task.dok_level}
              </div>
            </div>
          </div>

          {/* Right: Solving Area */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {userSteps.length === 0 && !feedback && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <ArrowRight className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500">Започнете со вашиот прв чекор подолу.</p>
                </div>
              )}

              {userSteps.map((step, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={idx} 
                  className="flex gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                    {idx + 1}
                  </div>
                  <div className="flex-1 p-4 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl">
                    <MathRenderer content={step} className="text-slate-800 dark:text-slate-200" />
                  </div>
                </motion.div>
              ))}

              {feedback && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border ${feedback.isCorrect ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30' : 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/30'}`}
                >
                  <div className="flex items-start gap-3">
                    {feedback.isCorrect ? <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                    <div className="space-y-2">
                      <p className={`text-sm font-medium ${feedback.isCorrect ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'}`}>
                        {feedback.message}
                      </p>
                      {feedback.hint && (
                        <div className="flex items-start gap-2 p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-red-100 dark:border-red-900/20">
                          <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5" />
                          <p className="text-xs text-slate-600 dark:text-slate-400 italic">{feedback.hint}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              {imageFeedback && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl border bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <Camera className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Анализа на ракописно решение</h4>
                      <MathRenderer content={imageFeedback.analysis} className="text-sm text-slate-700 dark:text-slate-300 mt-1" />
                    </div>
                  </div>
                  
                  {imageFeedback.errorsFound.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                      <h5 className="text-xs font-bold text-red-800 dark:text-red-400 flex items-center gap-1 mb-2">
                        <AlertTriangle className="w-3 h-3" /> Детектирани грешки
                      </h5>
                      <ul className="list-disc pl-5 text-sm text-red-700 dark:text-red-300 space-y-1">
                        {imageFeedback.errorsFound.map((err, i) => (
                          <li key={i}><MathRenderer content={err} /></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {imageFeedback.suggestions.length > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <h5 className="text-xs font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1 mb-2">
                        <Lightbulb className="w-3 h-3" /> Насоки за подобрување
                      </h5>
                      <ul className="list-disc pl-5 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        {imageFeedback.suggestions.map((sugg, i) => (
                          <li key={i}><MathRenderer content={sugg} /></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}

              <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              {isDrawingMode ? (
                <div className="h-[400px] w-full mb-4">
                  <InteractiveCanvas 
                    onSend={submitCanvasBase64} 
                    onCancel={() => setIsDrawingMode(false)}
                    isSubmitting={isAnalyzingImage}
                    liveSyncId={liveSyncId || undefined}
                  />
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleVerifyStep();
                        }
                      }}
                      placeholder="Внесете го вашиот следен чекор (пр. x + 5 = 10)..."
                      className="w-full p-4 pr-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 transition-all"
                      disabled={isVerifying || isAnalyzingImage}
                    />
                    <div className="absolute right-3 bottom-3 text-[10px] text-slate-400 font-mono flex items-center gap-2">
                      <button onClick={() => setIsDrawingMode(true)} className="hover:text-indigo-500 transition-colors flex items-center gap-1" disabled={isVerifying || isAnalyzingImage}>
                        <PenTool className="w-3 h-3" />
                        <span>Цртај</span>
                      </button>
                      <span>|</span>
                      <label className="cursor-pointer flex items-center gap-1 hover:text-indigo-500 transition-colors">
                        {isAnalyzingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                        <span>Слика</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isVerifying || isAnalyzingImage} />
                      </label>
                      <span>| LaTeX</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleVerifyStep()}
                    disabled={!currentInput.trim() || isVerifying || isAnalyzingImage}
                    className="h-20 w-20 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex flex-col items-center justify-center gap-1 shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    {isVerifying ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Провери</span>
                  </Button>
                </div>
              )}
              
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setUserSteps([])} className="text-xs text-slate-500">
                      <RotateCcw className="w-3 h-3 mr-1" /> Ресетирај
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setHintsRequested(prev => prev + 1);
                        const hintText = currentInput.trim() ? `${currentInput} (Те молам дај ми Сократска насока за ова)` : "(Те молам дај ми Сократска насока што да правам следно)";
                        handleVerifyStep(hintText);
                      }} 
                      className="text-xs text-amber-600 dark:text-amber-400"
                      disabled={isVerifying || isAnalyzingImage}
                    >
                      <Lightbulb className="w-3 h-3 mr-1" /> Побарај Насока
                    </Button>
                  </div>
                  <Button 
                    onClick={handleFinish}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                    disabled={!isFinished}
                  >
                    Заврши решавање
                  </Button>
                </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Target = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
