import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { motion } from 'motion/react';
import { 
  Globe, Wand2, ChevronUp, ChevronDown, Loader2, Sparkles, BookOpen, Download, 
  FileJson, CheckCircle, Save, Check, Link as LinkIcon, FileText, 
  PlayCircle, Image as ImageIcon, AlertTriangle, Quote, Microscope, BookOpen as BookOpenIcon, Zap, Layers,
  Activity, Clock, Printer, FileType2, BrainCircuit, Video
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MathTask } from '../lib/schema';
import { extractMathTasksFromUrl, generateImage, generateMathGraphicConfig, advancedMultimodalExtraction, enrichTaskPedagogy, generateTaskEmbedding, classifyTaskCurriculum } from '../lib/gemini';
import { PRO_MODEL, FLASH_36_MODEL, FAST_MODEL, LITE_MODEL } from '../lib/ai/models';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useGamification } from '../contexts/GamificationContext';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';
import { collection, addDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLibraryStore } from '../store/useLibraryStore';
import { useNavigate } from 'react-router-dom';
import { KahootMaker } from './KahootMaker';
import { MakedoTestGenerator } from './MakedoTestGenerator';
import { GeoGebraViewer } from './GeoGebraViewer';
import { SEO } from './SEO';
import { WorkflowSteps } from './WorkflowSteps';
import { ExtractionContext, TaskCard, ExportBar, ExtractionProgress } from './extraction';

interface ExtractionEngineProps {
  setActiveTutorTask: (task: MathTask) => void;
}

const FREE_EXTRACTION_LIMIT = 2;

export const ExtractionEngine: React.FC<ExtractionEngineProps> = ({ setActiveTutorTask }) => {
  const { t } = useTranslation('extraction');
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();
  const isPro = hasProAccess(userProfile);
  const { awardXP, updateQuestProgress } = useGamification();
  const [sessionExtractionCount, setSessionExtractionCount] = useState(0);
  const { setEditingTask, setOnTaskUpdated } = useLibraryStore();
  const navigate = useNavigate();
  
  const [engineMode, setEngineMode] = useState<'extract' | 'kahoot' | 'makedotest'>('extract');
  
  const [url, setUrl] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sourceType, setSourceType] = useState<'url' | 'file' | 'text'>('url');
  const [fileData, setFileData] = useState<{base64: string, mimeType: string, name: string} | null>(null);
  const [model, setModel] = useState(PRO_MODEL);
  
  // Progress States
  const [statusText, setStatusText] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [interpretativeLevel, setInterpretativeLevel] = useState<number>(1);
  
  const [tasks, setTasks] = useState<MathTask[]>([]);
  const [isEnriching, setIsEnriching] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedTasks, setSavedTasks] = useState<Set<number>>(new Set());
  const [activeGeogebraCmds, setActiveGeogebraCmds] = useState<string[] | null>(null);
  
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [outputLanguage, setOutputLanguage] = useState('mk');

  const OUTPUT_LANGUAGES: { value: string; label: string; instruction: string }[] = [
    { value: 'mk', label: '🇲🇰 Македонски', instruction: 'Output the extracted content entirely in Macedonian language (Македонски).' },
    { value: 'en', label: '🇬🇧 English',    instruction: 'Output the extracted content entirely in English language.' },
    { value: 'sq', label: '🇦🇱 Shqip',      instruction: 'Output the extracted content entirely in Albanian language (Shqip).' },
    { value: 'tr', label: '🇹🇷 Türkçe',     instruction: 'Output the extracted content entirely in Turkish language (Türkçe).' },
    { value: 'ru', label: '🇷🇺 Русский',    instruction: 'Output the extracted content entirely in Russian language (Русский).' },
  ];

  React.useEffect(() => {
    setOnTaskUpdated((updatedTask: MathTask) => {
      // Find the task by some identifier or just rely on object reference if possible
      // Since it's a new task without ID, we can use title and text as temporary fingerprint
      setTasks(prev => prev.map(t => (t.title === updatedTask.title || t.original_text === updatedTask.original_text) ? updatedTask : t));
    });
    return () => setOnTaskUpdated(undefined);
  }, []);
  
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<number, boolean>>({});
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [targetFolder, setTargetFolder] = useState('');

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isYoutube = url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be') || url.toLowerCase().includes('vimeo.com');

  const handleEnrich = async (index: number) => {
    const task = tasks[index];
    if (!task) return;

    setIsEnriching(prev => ({ ...prev, [index]: true }));
    try {
      const insights = await enrichTaskPedagogy(task, model, outputLanguage !== 'auto' ? outputLanguage : undefined);
      setTasks(prev => prev.map((t, i) => i === index ? { ...t, pedagogical_insights: insights } : t));
    } catch (error: any) {
      console.error("Грешка при збогатување:", error);
      showToast(error.message || t('errorEnrichment'), 'error');
    } finally {
      setIsEnriching(prev => ({ ...prev, [index]: false }));
    }
  };

  const simulateProgress = () => {
    setProgress(10);
    setStatusText(t('progressConnecting'));
    
    setTimeout(() => {
      setProgress(40);
      const msg = 
        sourceType === 'url' ? (isYoutube ? t('progressAnalyzingVideo') : t('progressScanningWeb')) :
        sourceType === 'file' ? t('progressOcr') :
        t('progressTextProcessing');
      setStatusText(msg);
    }, 1500);

    setTimeout(() => {
      setProgress(70);
      setStatusText(t('progressIsolating'));
    }, 3500);
    
    setTimeout(() => {
      setProgress(90);
      setStatusText(t('progressFinalizing'));
    }, 6000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = async (file: File) => {
    setError(null);
    if (file.size > 20 * 1024 * 1024) {
      setError(t('errorFileTooLarge'));
      return;
    }

    if (file.type.includes('wordprocessingml.document') || file.name.endsWith('.docx')) {
      try {
        const _mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await _mammoth.extractRawText({ arrayBuffer });
        setTextInput(result.value);
        setSourceType('text');
        setFileData({ base64: '', mimeType: 'text/plain', name: file.name });
      } catch (err) {
        console.error("Грешка при читање", err);
        setError(t('errorWordRead'));
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setFileData({
        base64,
        mimeType: file.type,
        name: file.name
      });
      setSourceType('file');
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.includes('pdf') || file.type.includes('image') || file.type.includes('video') || file.name.endsWith('.docx'))) {
      processFile(file);
    } else {
      setError(t('errorInvalidFile'));
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPro && sessionExtractionCount >= FREE_EXTRACTION_LIMIT) return;

    if (sourceType === 'url' && !url.trim()) return;
    if (sourceType === 'text' && !textInput.trim()) return;
    if (sourceType === 'file' && !fileData) return;

    const urls = sourceType === 'url' ? url.split('\n').map(u => u.trim()).filter(Boolean) : [];

    if (sourceType === 'url') {
       const invalidUrls = urls.filter(u => !isValidUrl(u));
       if (invalidUrls.length > 0) {
         setError(t('errorInvalidUrls'));
         return;
       }
    }

    setIsLoading(true);
    setError(null);
    setSavedTasks(new Set());
    setTasks([]);
    setProgress(0);
    
    simulateProgress();
    
    try {
      let extractedTasks: MathTask[] = [];
      const timeRange = (startTime || endTime) ? { start: startTime, end: endTime } : undefined;
      
      if (sourceType === 'url') {
        let textInstructions = customInstructions;
        switch(interpretativeLevel) {
          case 0: textInstructions += " Извлечи го материјалот 100% буквално и верно на оригиналот(Faithful)."; break;
          case 1: textInstructions += " Исчисти го материјалот од пелтечења и неважни зборови(Clean)."; break;
          case 2: textInstructions += " Реформулирај го овој материјал како професионална лекција или задачи од учебник(Reformulate)."; break;
          case 3: textInstructions += " Извлечи го материјалот и нужно додади свои слични примери за да се разјасни концептот(Examples)."; break;
          case 4: textInstructions += " Направи само кратко резиме и најважни клучни точки/задачи(Summary)."; break;
        }
        for (let i = 0; i < urls.length; i++) {
            setStatusText(t('progressProcessingLink', { current: i + 1, total: urls.length }));
            try {
              const singleTasks = await extractMathTasksFromUrl(urls[i], model, timeRange, urls.length === 1 ? manualTranscript : '', textInstructions, outputLanguage);
              extractedTasks = [...extractedTasks, ...singleTasks];
            } catch (urlErr) {
              console.error(`Failed to extract from URL ${i + 1}:`, urlErr);
            }
            setProgress(Math.max(10, Math.min(90, Math.floor(((i + 1) / urls.length) * 100))));
        }
      } else {
        const sourcePayload = sourceType === 'file' ? 
          { type: 'file' as const, data: fileData!.base64, mimeType: fileData!.mimeType } :
          { type: 'text' as const, data: textInput };
        
        let textInstructions = customInstructions;
        switch(interpretativeLevel) {
          case 0: textInstructions += " Извлечи го материјалот 100% буквално и верно на оригиналот(Faithful)."; break;
          case 1: textInstructions += " Исчисти го материјалот од пелтечења и неважни зборови(Clean)."; break;
          case 2: textInstructions += " Реформулирај го овој материјал како професионална лекција или задачи од учебник(Reformulate)."; break;
          case 3: textInstructions += " Извлечи го материјалот и нужно додади свои слични примери за да се разјасни концептот(Examples)."; break;
          case 4: textInstructions += " Направи само кратко резиме и најважни клучни точки/задачи(Summary)."; break;
        }

        const langEntryMM = OUTPUT_LANGUAGES.find(l => l.value === outputLanguage);
        if (langEntryMM) textInstructions += ` ${langEntryMM.instruction}`;
        extractedTasks = await advancedMultimodalExtraction(sourcePayload, model, textInstructions);
      }

      setProgress(100);
      setStatusText(t('progressSuccess'));
      setTasks(extractedTasks);
      setSessionExtractionCount((n) => n + 1);
      
      // Auto-save logic
      if (user && extractedTasks.length > 0) {
        setStatusText(t('progressSaving'));
        const newSavedSet = new Set<number>();
        
        // Save simultaneously but manage errors
        await Promise.all(extractedTasks.map(async (task, idx) => {
          try {
            const taskToSave: MathTask = {
              ...task,
              author_uid: user.uid,
              created_at: new Date().toISOString()
            };

            try {
              const textToEmbed = `${task.title} ${task.original_text} ${(task.solution_steps || []).join(' ')} ${(task.tags || []).join(' ')} ${task.curriculum_topic || ''}`;
              taskToSave.embedding = await generateTaskEmbedding(textToEmbed);
            } catch (embedError) {
              console.warn("Failed to generate embedding for newly extracted task", embedError);
            }

            if (targetFolder.trim()) {
              taskToSave.folder_name = targetFolder.trim();
              taskToSave.folder_id = targetFolder.trim().toLowerCase().replace(/\s+/g, '-');
            }
            const docRef = await addDoc(collection(db, 'tasks'), taskToSave);
            newSavedSet.add(idx);

            // Curriculum classification — NON-BLOCKING: runs after the save and
            // must never fail the extraction flow. Updates the doc in-place.
            classifyTaskCurriculum(taskToSave)
              .then(async (curriculumRefs) => {
                if (curriculumRefs.length === 0) return;
                await updateDoc(docRef, { curriculum_refs: curriculumRefs });
                setTasks(prev => prev.map((t, i) => (i === idx ? { ...t, curriculum_refs: curriculumRefs } : t)));
              })
              .catch(classifyErr => console.warn(`Curriculum classification failed for task ${idx}:`, classifyErr));
          } catch (err) {
            console.error(`Error saving task ${idx}:`, err);
          }
        }));
        setSavedTasks(newSavedSet);
        if (newSavedSet.size > 0) {
          awardXP(100);
          updateQuestProgress('extract');
        }
      }
    } catch (err) {
      setProgress(0);
      const errorMessage = err instanceof Error ? err.message : t('errorExtractionGeneric');
      setError(errorMessage.includes('Надминат е лимитот') ? errorMessage : `${t('error')}: ${errorMessage}`);
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  const handleSaveToDb = async (task: MathTask, index: number) => {
    if (!user) {
      setError(t('errorMustLogin'));
      return;
    }

    try {
      const taskToSave = {
        ...task,
        author_uid: user.uid,
        created_at: new Date().toISOString()
      };
      
      try {
        const textToEmbed = `${task.title} ${task.original_text} ${(task.solution_steps || []).join(' ')} ${(task.tags || []).join(' ')} ${task.curriculum_topic || ''}`;
        taskToSave.embedding = await generateTaskEmbedding(textToEmbed);
      } catch (embedError) {
        console.warn("Failed to generate embedding for newly extracted task", embedError);
      }
      
      await addDoc(collection(db, 'tasks'), taskToSave);
      
      setSavedTasks(prev => {
        const newSet = new Set(prev);
        newSet.add(index);
        return newSet;
      });
    } catch (err) {
      console.error("Грешка при зачувување:", err);
      setError(err instanceof Error ? t('errorSavingPrefix', { message: err.message }) : t('errorSavingDb'));
    }
  };
  
  const handleGenerateGraphics = async (prompt: string, index: number) => {
    setIsGeneratingImage(prev => ({ ...prev, [index]: true }));
    try {
      const configJson = await generateMathGraphicConfig(prompt);
      const updatedTasks = [...tasks];
      updatedTasks[index] = { ...updatedTasks[index], math_graphic_config: configJson };
      setTasks(updatedTasks);
    } catch (err) {
      console.error("Грешка при генерирање графика:", err);
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [index]: false }));
    }
  };

  const togglePrompt = (index: number) => {
    setExpandedPrompts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const extractionContextValue = {
    tasks, setTasks, model, outputLanguage,
    isLoading, setIsLoading, statusText, setStatusText,
    progress, setProgress, error, setError,
    savedTasks, setSavedTasks, isEnriching, setIsEnriching,
    activeGeogebraCmds, setActiveGeogebraCmds,
    isGeneratingImage, setIsGeneratingImage,
    expandedPrompts, setExpandedPrompts,
    generatedImages, setGeneratedImages,
    sessionExtractionCount, setSessionExtractionCount,
  };

  return (
    <ExtractionContext.Provider value={extractionContextValue}>
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <SEO 
        title={t('heroTitle')} 
        description={t('seoDescription')} 
        keywords={t('seoKeywords')}
      />
      
      <WorkflowSteps current="extract" />

      {/* Top Level Mode Selector */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-slate-100 p-1 rounded-2xl shadow-inner border border-slate-200">
          <button
            onClick={() => setEngineMode('extract')}
            className={`px-8 py-3 rounded-xl text-sm font-black tracking-wide transition-all ${
              engineMode === 'extract'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            {t('modeExtract')}
          </button>
          <button
            onClick={() => setEngineMode('kahoot')}
            className={`px-8 py-3 rounded-xl text-sm font-black tracking-wide transition-all ${
              engineMode === 'kahoot'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            {t('modeKahoot')}
          </button>
        </div>
      </div>

      {!isPro && sessionExtractionCount >= FREE_EXTRACTION_LIMIT ? (
        <div className="py-8">
          <ProFeatureGate
            featureName="Unlimited AI Extraction"
            description={t('proGateDescription', { limit: FREE_EXTRACTION_LIMIT })}
          />
        </div>
      ) : engineMode === 'kahoot' ? (
        <KahootMaker />
      ) : engineMode === 'makedotest' ? (
        <MakedoTestGenerator tasks={tasks} />
      ) : (
        <>
          {!isPro && (
            <div className={`rounded-2xl border px-5 py-3 flex items-center justify-between gap-4 text-sm ${
              sessionExtractionCount >= FREE_EXTRACTION_LIMIT - 1
                ? 'border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
            }`}>
              <span className={`font-medium ${sessionExtractionCount >= FREE_EXTRACTION_LIMIT - 1 ? 'text-amber-800 dark:text-amber-200' : 'text-slate-600 dark:text-slate-300'}`}>
                {t('freeTierBanner', { used: sessionExtractionCount, limit: FREE_EXTRACTION_LIMIT })}
              </span>
              <a href="/pricing" className={`font-bold underline underline-offset-2 whitespace-nowrap ${sessionExtractionCount >= FREE_EXTRACTION_LIMIT - 1 ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-600 dark:text-indigo-400'}`}>
                {t('upgradeToPro')}
              </a>
            </div>
          )}
          {/* Premium Hero Section for URL Extractor */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 rounded-5xl overflow-hidden shadow-2xl border border-indigo-500/20">
        <div className="px-6 py-12 md:py-16 relative">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-white/5 backdrop-blur-md rounded-2xl mb-2 border border-white/10 shadow-inner">
              <PlayCircle className="w-8 h-8 text-red-500 mr-2 drop-shadow-md" />
              <div className="h-6 w-px bg-white/20 mx-2"></div>
              <FileText className="w-7 h-7 text-emerald-400 mx-2 drop-shadow-md" />
              <div className="h-6 w-px bg-white/20 mx-2"></div>
              <Globe className="w-7 h-7 text-blue-400 ml-2 drop-shadow-md" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              {t('heroTitle')}
            </h1>
            <p className="text-lg text-indigo-200 font-medium max-w-2xl mx-auto">
              {t('heroDescription')}
            </p>

            <div className="mt-8 flex justify-center gap-2">
              {(['url', 'file', 'text'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSourceType(type)}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                    sourceType === type 
                    ? 'bg-white text-indigo-900 shadow-lg' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {type === 'url' ? t('tabUrl') : type === 'file' ? t('tabFile') : t('tabText')}
                </button>
              ))}
            </div>

            <form onSubmit={handleExtract} className="mt-6 bg-white/5 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-white/10 shadow-2xl text-left transition-all hover:bg-white/10">
              <div className="flex flex-col gap-4">
                {/* Dynamic Inputs Based on Source Type */}
                {sourceType === 'url' && (
                  <div className="flex flex-col gap-3">
                    <div className="relative group">
                      <div className="absolute top-4 left-0 pl-5 flex items-start pointer-events-none">
                        {url.toLowerCase().includes('youtube') || url.toLowerCase().includes('youtu.be') || url.toLowerCase().includes('vimeo') ? <PlayCircle className="w-6 h-6 text-red-400" /> : <LinkIcon className="w-6 h-6 text-indigo-400" />}
                      </div>
                      <textarea
                        placeholder={t('urlInputPlaceholder')}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isLoading}
                        className="pl-14 pt-4 min-h-[5rem] text-lg bg-white/90 border-white/40 focus:bg-white text-slate-800 placeholder-slate-400 rounded-2xl shadow-inner transition-all w-full resize-y"
                      />
                    </div>

                    <div className="relative group mt-1">
                      <textarea
                        placeholder={t('transcriptPlaceholder')}
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        disabled={isLoading}
                        className="w-full h-24 p-4 text-sm bg-white/10 text-white border border-white/20 rounded-xl focus:border-indigo-400 focus:bg-white/20 focus:ring-1 focus:ring-indigo-400 resize-none font-medium placeholder:text-slate-300 transition-all font-mono"
                      />
                    </div>

                    <div className="bg-emerald-900/30 border border-emerald-400/30 rounded-2xl p-4 mt-2">
                       <h4 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                          <Globe className="w-5 h-5 text-emerald-400" />
                          {t('scraperTitle')}
                       </h4>
                       <p className="text-xs text-emerald-100/90 mb-3">
                          {t('scraperDescription')}
                       </p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-emerald-100/80">
                          <div className="space-y-2">
                             <p className="font-semibold text-emerald-100">{t('howItWorks')}</p>
                             <ul className="list-disc pl-4 space-y-1">
                               <li>{t('howItWorks1')}</li>
                               <li>{t('howItWorks2')}</li>
                               <li>{t('howItWorks3')}</li>
                               <li>{t('howItWorks4')}</li>
                             </ul>
                          </div>
                          <div className="space-y-2">
                             <p className="font-semibold text-emerald-100">{t('processingMethod')}</p>
                             <ul className="list-disc pl-4 space-y-1">
                               <li>{t('processingMethod1')}</li>
                               <li>{t('processingMethod2')}</li>
                               <li>{t('processingMethod3')}</li>
                             </ul>
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {sourceType === 'file' && (
                  <div className="relative group">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept="application/pdf,image/*,video/mp4,video/mpeg,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    />
                    <label 
                      htmlFor="file-upload"
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      className={`flex flex-col items-center justify-center h-32 w-full border-2 border-dashed rounded-2xl transition-all cursor-pointer group ${
                        isDragOver 
                          ? 'border-emerald-400 bg-emerald-500/20 scale-105 shadow-xl shadow-emerald-900/20' 
                          : 'border-white/30 bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      {fileData ? (
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-8 h-8 text-emerald-400" />
                          <div className="text-left">
                            <p className="text-white font-bold">{fileData.name}</p>
                            <p className="text-indigo-300 text-xs">{(fileData.mimeType)} • {t('fileReady')}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className={`w-8 h-8 mb-2 transition-transform ${isDragOver ? 'text-emerald-400 scale-125' : 'text-indigo-300 group-hover:scale-110'}`} />
                          <p className={`font-medium tracking-tight ${isDragOver ? 'text-emerald-200' : 'text-indigo-200'}`}>
                            {isDragOver ? t('fileDropHere') : t('fileClickOrDrag')}
                          </p>
                          <p className="text-[10px] text-indigo-400 uppercase mt-1">{t('fileSupportNote')}</p>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {sourceType === 'text' && (
                   <div className="relative group flex flex-col gap-2">
                    <textarea
                      placeholder={t('textInputPlaceholder')}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={isLoading}
                      className="w-full h-40 p-5 text-base bg-white/90 border-white/40 focus:bg-white text-slate-800 placeholder-slate-400 rounded-2xl shadow-inner transition-all resize-none font-sans"
                    />
                    <div className="bg-indigo-900/30 border border-indigo-400/30 rounded-xl p-3 flex items-start gap-3">
                       <Zap className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                       <p className="text-xs text-indigo-100 leading-relaxed">
                         <strong>{t('proTip')}</strong> {t('proTipText')}
                       </p>
                    </div>
                   </div>
                )}

                <div className="flex justify-between items-center mt-2 px-2">
                   <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={isLoading}
                      title={t('model')}
                      aria-label={t('model')}
                      className="h-10 px-3 rounded-xl bg-white/10 border border-white/20 text-indigo-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 [&>option]:text-slate-800 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      <option value={PRO_MODEL}>Gemini 3.1 Pro (World-Class)</option>
                      <option value={FLASH_36_MODEL}>Gemini 3.6 Flash (Newest)</option>
                      <option value={FAST_MODEL}>Gemini 3 Flash (Fast)</option>
                      <option value={LITE_MODEL}>Gemini 3.5 Flash Lite (Economy)</option>
                    </select>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-indigo-300 shrink-0" />
                      <select
                        value={outputLanguage}
                        onChange={(e) => setOutputLanguage(e.target.value)}
                        disabled={isLoading}
                        title={t('targetLanguage')}
                        aria-label={t('targetLanguage')}
                        className="h-10 px-3 rounded-xl bg-white/10 border border-white/20 text-indigo-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 [&>option]:text-slate-800 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors"
                      >
                        {OUTPUT_LANGUAGES.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                   </div>

                   <Button 
                      type="submit" 
                      disabled={isLoading || (sourceType === 'url' && !url.trim()) || (sourceType === 'file' && !fileData) || (sourceType === 'text' && !textInput.trim())} 
                      className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 rounded-xl transition-all font-bold tracking-wide"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <><Sparkles className="w-5 h-5 mr-2" /> {t('processButton')}</>
                      )}
                    </Button>
                </div>

                {/* Advanced Options Toggle */}
                <div className="flex items-center justify-end px-2 mt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-indigo-300 hover:text-white flex items-center gap-1.5 font-medium transition-colors bg-white/5 py-1.5 px-3 rounded-full hover:bg-white/10"
                  >
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {t('advancedParams')}
                  </button>
                </div>

                {/* Advanced Options Panel */}
                {showAdvanced && (
                  <div className="pt-5 pb-2 mt-2 border-t border-white/10 grid shadow-inner md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="md:col-span-2 bg-indigo-900/40 border border-indigo-400/20 p-4 rounded-2xl">
                       <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                           {t('interpretativeLevel')}
                           <div className="w-4 h-4 rounded-full border border-indigo-300 flex items-center justify-center text-[10px] font-bold text-indigo-300" title={t('interpretativeLevelTooltip')}>?</div>
                       </label>
                       
                       <div className="flex items-center gap-4 relative isolate">
                          {/* Slider Track */}
                          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-700/50 -translate-y-1/2 rounded-full -z-10"></div>
                          <input 
                            type="range" 
                            min="0" max="4" step="1" 
                            value={interpretativeLevel} 
                            onChange={(e) => setInterpretativeLevel(parseInt(e.target.value))}
                            title={t('interpretativeLevel')}
                            aria-label={t('interpretativeLevel')}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50" 
                          />
                       </div>
                       
                       <div className="flex justify-between mt-3 text-[10px] sm:text-xs font-medium text-slate-400">
                         <span className={`text-center ${interpretativeLevel === 0 ? 'text-red-400 font-bold' : ''}`}>Faithful</span>
                         <span className={`text-center ${interpretativeLevel === 1 ? 'text-red-400 font-bold' : ''}`}>Clean</span>
                         <span className={`text-center ${interpretativeLevel === 2 ? 'text-red-400 font-bold' : ''}`}>Reformulate</span>
                         <span className={`text-center ${interpretativeLevel === 3 ? 'text-red-400 font-bold' : ''}`}>Examples</span>
                         <span className={`text-center hidden sm:block ${interpretativeLevel === 4 ? 'text-red-400 font-bold' : ''}`}>Summary</span>
                       </div>
                    </div>
                  
                    <div className="space-y-3">
                      <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">{t('saveToFolder')}</label>
                      <Input
                        type="text"
                        placeholder={t('folderPlaceholder')}
                        value={targetFolder}
                        onChange={(e) => setTargetFolder(e.target.value)}
                        disabled={isLoading}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder-indigo-300/30 rounded-xl focus:bg-white/10 transition-all font-medium"
                      />
                    </div>
                    
                    {sourceType === 'url' && (
                      <div className="space-y-3">
                        <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">{t('timeRange')}</label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder={t('startTimePlaceholder')}
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            disabled={isLoading}
                            className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20"
                          />
                          <Input
                            type="text"
                            placeholder={t('endTimePlaceholder')}
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            disabled={isLoading}
                            className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 md:col-span-2">
                       <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">{t('specificInstructions')}</label>
                       <Input
                          type="text"
                          placeholder={t('instructionsPlaceholder')}
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          disabled={isLoading}
                          className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20 w-full"
                        />
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* YouTube Iframe Preview & Bulk Link Cards (ReClip Inspired) */}
            {sourceType === 'url' && url.trim().length > 0 && (
              <div className="mt-8 mb-4">
                 {(() => {
                   const urls = url.split('\n').filter(u => u.trim().length > 0);
                   const isMulti = urls.length > 1;
                   const firstYoutube = urls.find(u => u.toLowerCase().includes('youtube.com') || u.toLowerCase().includes('youtu.be'));
                   const yId = firstYoutube?.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/)?.[1];
                   
                   return (
                     <div className="flex flex-col gap-4">
                       {isMulti && (
                         <div className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-bold p-3 rounded-xl flex items-center justify-center gap-2 animate-in fade-in">
                           <Layers className="w-5 h-5 text-emerald-400" />
                           {t('bulkModeActive', { count: urls.length })}
                         </div>
                       )}
                       {yId && (
                         <div className="border border-indigo-200/30 rounded-2xl overflow-hidden shadow-2xl relative z-10 mx-auto w-full max-w-4xl bg-black">
                           <div className="bg-indigo-900/50 p-2 flex items-center justify-between text-indigo-200 text-xs font-bold border-b border-indigo-500/30">
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4 text-red-500" />
                                {isMulti ? t('youtubePreviewFirst') : t('youtubePreview')}
                              </div>
                              <span className="text-white/50">{isMulti ? `(1 ${t('of')} ${urls.length})` : 'Local Bypass Enabled'}</span>
                           </div>
                           <div className="aspect-video w-full">
                              <iframe 
                                src={`https://www.youtube.com/embed/${yId}`}
                                title="YouTube preview"
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })()}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-6 border border-red-500/30 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-900/10 text-red-200 text-sm font-medium backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <AlertTriangle className="w-32 h-32 text-red-500" />
                </div>
                <div className="p-6 relative z-10">
                   <div className="flex items-start gap-4">
                     <div className="p-3 bg-red-500/20 rounded-xl shrink-0">
                       <AlertTriangle className="w-6 h-6 text-red-400" />
                     </div>
                     <div className="flex-1">
                       <h3 className="text-red-300 font-bold text-base mb-1">
                         {error.includes("транскрипт") || error.includes("NO_TRANSCRIPT") 
                           ? t('errorTranscriptTitle') 
                           : t('errorProcessingTitle')}
                       </h3>
                       <p className="text-red-200/80 leading-relaxed mb-4">
                         {error.replace("Грешка: ", "").replace("NO_TRANSCRIPT: ", "")}
                       </p>
                       
                       {/* Actionable Fallbacks for YouTube Errors */}
                       {(error.includes("транскрипт") || error.includes("NO_TRANSCRIPT")) && (
                         <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-red-500/20">
                           <button 
                             onClick={() => setSourceType('file')}
                             className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-colors text-xs font-bold"
                           >
                             <ImageIcon className="w-4 h-4" />
                             {t('errorAttachImagePdf')}
                           </button>
                           <button 
                             onClick={() => setSourceType('text')}
                             className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors text-xs font-bold"
                           >
                             <FileText className="w-4 h-4" />
                             {t('errorCopyTranscript')}
                           </button>
                           <button 
                             onClick={() => {
                               setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Example working one, or just clear
                               setError(null);
                             }}
                             className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors text-xs font-bold"
                           >
                             <Video className="w-4 h-4" />
                             {t('errorTryAnotherVideo')}
                           </button>
                         </div>
                       )}
                     </div>
                   </div>
                </div>
              </div>
            )}
            
            {/* Elegant Progress Indicator */}
            {isLoading && (
              <ExtractionProgress statusText={statusText} progress={progress} />
            )}
          </div>
        </div>
      </div>

      {/* Stunning Empty State */}
      {!isLoading && tasks.length === 0 && !error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 text-center max-w-3xl mx-auto space-y-8"
        >
          <div className="relative inline-flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-[100px] rounded-full mix-blend-multiply"></div>
            <div className="relative z-10 w-32 h-32 rounded-3xl bg-white border border-slate-100 shadow-2xl flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-500">
               <BrainCircuit className="w-16 h-16 text-indigo-500 drop-shadow-md" />
            </div>
          </div>
          <div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4 mb-2">{t('emptyStateTitle')}<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">{t('emptyStateTitleHighlight')}</span></h2>
            <p className="text-slate-500 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-medium">
              {t('emptyStateDescription')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 max-w-4xl mx-auto text-left">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
                <Video className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">{t('featureVideoTitle')}</h4>
              <p className="text-sm text-slate-500">{t('featureVideoDesc')}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Microscope className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">{t('featureOcrTitle')}</h4>
              <p className="text-sm text-slate-500">{t('featureOcrDesc')}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">{t('featureQuizTitle')}</h4>
              <p className="text-sm text-slate-500">{t('featureQuizDesc')}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Results Section */}
      {!isLoading && tasks.length > 0 && (
        <div className="space-y-6 pt-4 animate-in slide-in-from-bottom-8 duration-700">
          
          {/* Auto-Save Notification */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl flex items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-full">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-800 dark:text-emerald-400 leading-none mb-1">{t('autoSaveTitle')}</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">{t('autoSaveDescription', { count: tasks.length })}</p>
              </div>
            </div>
            <Button onClick={() => navigate('/library')} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm rounded-xl font-bold">
              <BookOpen className="w-4 h-4 mr-2" /> {t('goToLibrary')}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-200 pb-4 px-2">
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{t('extractedTasks')}</h2>
              <p className="text-slate-500 text-sm mt-1"><Trans i18nKey="foundTasks" ns="extraction" values={{ count: tasks.length }} components={{ strong: <strong className="text-indigo-600" /> }} /></p>
              
              {/* Success Actions */}
              <div className="flex flex-wrap gap-2 mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 w-full">
                 <Button onClick={async () => {
                   if(tasks.length === 0) return;
                   setIsLoading(true);
                   setStatusText(t('kahootPreparing'));
                   try {
                     // Get high quality real generation using gemini.ts Kahoot function from files
                     const pin = Math.floor(100000 + Math.random() * 900000).toString();
                     
                     // We just fallback to mapping if generating dynamically takes too long
                     const kahootData = {
                       title: t('kahootQuickQuiz') + (tasks[0].title || t('kahootMathFallback')),
                       questions: tasks.map(tk => ({
                         question: tk.original_text,
                         options: [
                          (tk.solution_steps?.[0] || t('kahootCorrectAnswer')),
                          (tk.solution_steps?.[1] || t('kahootWrongStep')),
                          t('kahootUnknownValue'),
                          t('kahootNoSolution')
                         ],
                         correctIndex: 0
                       })),
                       hints: tasks.map((tk, i) => tk.hints?.[0] || tk.pedagogical_insights?.socratic_questions?.[0] || t('kahootThinkCarefully'))
                     };

                     await setDoc(doc(db, 'live_sessions', pin), {
                       id: pin,
                       teacher_uid: user?.uid || 'anonymous',
                       quiz_data: kahootData,
                       status: 'lobby',
                       current_question_index: 0,
                       participants: {},
                       created_at: Date.now()
                     });
                     navigate(`/live/${pin}/host`);
                   } catch(e) {
                     console.error(e);
                   } finally {
                     setIsLoading(false);
                   }
                 }} className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md flex-1">
                   🚀 MathKahoot
                 </Button>

                 <Button onClick={() => setEngineMode('makedotest')} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md flex-1 px-2">
                   <FileType2 className="w-4 h-4 mr-2" /> {t('makedoTestPro')}
                 </Button>
              </div>
            </div>

            <ExportBar tasks={tasks} />
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.15 }}
            className="grid grid-cols-1 gap-8 printable-tasks-container"
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={index}
                task={task}
                index={index}
                onEnrich={handleEnrich}
                onSave={handleSaveToDb}
                onGenerateGraphics={handleGenerateGraphics}
              />
            ))}
          </motion.div>
        </div>
      )}
      </>
      )}

      {activeGeogebraCmds && (
        <GeoGebraViewer commands={activeGeogebraCmds} onClose={() => setActiveGeogebraCmds(null)} />
      )}
    </div>
    </ExtractionContext.Provider>
  );
};
