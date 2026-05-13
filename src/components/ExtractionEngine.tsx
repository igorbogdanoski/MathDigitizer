import React, { useState } from 'react';
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
import { extractMathTasksFromUrl, generateImage, generateMathGraphicConfig, advancedMultimodalExtraction, enrichTaskPedagogy, generateTaskEmbedding } from '../lib/gemini';
import { exportToJson, exportToLatex, exportToMarkdown, exportToTxt } from '../lib/export';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLibraryStore } from '../store/useLibraryStore';
import { MathRenderer } from './MathRenderer';
import { VisualMathCanvas } from './VisualMathCanvas';
import { useNavigate } from 'react-router-dom';
import { KahootMaker } from './KahootMaker';
import { MakedoTestGenerator } from './MakedoTestGenerator';
import { GeoGebraViewer } from './GeoGebraViewer';
import { SEO } from './SEO';

interface ExtractionEngineProps {
  setActiveTutorTask: (task: MathTask) => void;
}

export const ExtractionEngine: React.FC<ExtractionEngineProps> = ({ setActiveTutorTask }) => {
  const { user } = useAuth();
  const { awardXP, updateQuestProgress } = useGamification();
  const { setEditingTask, setOnTaskUpdated } = useLibraryStore();
  const navigate = useNavigate();
  
  const [engineMode, setEngineMode] = useState<'extract' | 'kahoot' | 'makedotest'>('extract');
  
  const [url, setUrl] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sourceType, setSourceType] = useState<'url' | 'file' | 'text'>('url');
  const [fileData, setFileData] = useState<{base64: string, mimeType: string, name: string} | null>(null);
  const [model, setModel] = useState('gemini-3.1-pro-preview');
  
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
      const insights = await enrichTaskPedagogy(task, model);
      setTasks(prev => prev.map((t, i) => i === index ? { ...t, pedagogical_insights: insights } : t));
    } catch (error: any) {
      console.error("Грешка при збогатување:", error);
      alert(error.message || "Настана грешка при збогатувањето");
    } finally {
      setIsEnriching(prev => ({ ...prev, [index]: false }));
    }
  };

  const simulateProgress = () => {
    setProgress(10);
    setStatusText('Поврзување со серверите...');
    
    setTimeout(() => {
      setProgress(40);
      const msg = 
        sourceType === 'url' ? (isYoutube ? 'Анализа на транскрипт и визуелни кадри од видеото...' : 'Скенирање на веб-содржината...') :
        sourceType === 'file' ? 'OCR Анализа и структурна обработка на документот...' :
        'Јазична обработка на внесениот текст...';
      setStatusText(msg);
    }, 1500);

    setTimeout(() => {
      setProgress(70);
      setStatusText('Gemini AI: Изолација на математички задачи и реконструкција во LaTeX...');
    }, 3500);
    
    setTimeout(() => {
      setProgress(90);
      setStatusText('Финализирање на податоци и структурирање...');
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
      setError('Датотеката е преголема. Ве молиме прикачете датотека до 20MB.');
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
        setError("Грешка со читање на Word документ. Користете PDF.");
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
      setError('Ве молиме прикачете валиден PDF, Слика, Видео или Word документ.');
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (sourceType === 'url' && !url.trim()) return;
    if (sourceType === 'text' && !textInput.trim()) return;
    if (sourceType === 'file' && !fileData) return;

    const urls = sourceType === 'url' ? url.split('\n').map(u => u.trim()).filter(Boolean) : [];

    if (sourceType === 'url') {
       const invalidUrls = urls.filter(u => !isValidUrl(u));
       if (invalidUrls.length > 0) {
         setError('Внесете валиден URL линк за сите ставки.');
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
            setStatusText(`Процесирање на линк ${i + 1} од ${urls.length}...`);
            const singleTasks = await extractMathTasksFromUrl(urls[i], model, timeRange, urls.length === 1 ? manualTranscript : '', textInstructions);
            extractedTasks = [...extractedTasks, ...singleTasks];
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

        extractedTasks = await advancedMultimodalExtraction(sourcePayload, model, textInstructions);
      }

      setProgress(100);
      setStatusText('Екстракцијата е успешна! Зачувување во Библиотека...');
      setTasks(extractedTasks);
      
      // Auto-save logic
      if (user && extractedTasks.length > 0) {
        setStatusText('Се зачувува во Вашата Библиотека...');
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
            await addDoc(collection(db, 'tasks'), taskToSave);
            newSavedSet.add(idx);
          } catch (err) {
            console.error(`Error saving task ${idx}:`, err);
          }
        }));
        setSavedTasks(newSavedSet);
      }

      awardXP(100);
      updateQuestProgress('extract');
    } catch (err) {
      setProgress(0);
      const errorMessage = err instanceof Error ? err.message : 'Настана грешка при екстракцијата. Проверете го изворот или обидете се повторно.';
      setError(errorMessage.includes('Надминат е лимитот') ? errorMessage : `Грешка: ${errorMessage}`);
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  const handleSaveToDb = async (task: MathTask, index: number) => {
    if (!user) {
      setError('Мора да се најавите за да зачувате задачи.');
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
      setError(err instanceof Error ? `Грешка при зачувување: ${err.message}` : 'Настана грешка при зачувување во базата.');
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <SEO 
        title="Multimodal AI Екстракција" 
        description="Внесете YouTube линк, слика или PDF за да извлечете математички задачи со AI дигитализација и LaTeX." 
        keywords="ai екстракција, математика, youtube математика, pdf ocr"
      />
      
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
            Извлекување на Задачи
          </button>
          <button
            onClick={() => setEngineMode('kahoot')}
            className={`px-8 py-3 rounded-xl text-sm font-black tracking-wide transition-all ${
              engineMode === 'kahoot'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            MathKahoot Креатор
          </button>
        </div>
      </div>

      {engineMode === 'kahoot' ? (
        <KahootMaker />
      ) : engineMode === 'makedotest' ? (
        <MakedoTestGenerator tasks={tasks} />
      ) : (
        <>
          {/* Premium Hero Section for URL Extractor */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 rounded-[2rem] overflow-hidden shadow-2xl border border-indigo-500/20">
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
              Multimodal AI Екстрактор
            </h1>
            <p className="text-lg text-indigo-200 font-medium max-w-2xl mx-auto">
              Претворете каков било Youtube туторијал, PDF книга, слика од табла или текст во дигитални задачи.
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
                  {type === 'url' ? 'URL / YouTube' : type === 'file' ? 'PDF / Word / Видео / Слика' : 'Текст / Рачен Транскрипт'}
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
                        placeholder="Вметнете еден или повеќе линкови (YouTube, Vimeo...). Секој линк во нов ред. (Bulk Mode - инспирирано од ReClip)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isLoading}
                        className="pl-14 pt-4 min-h-[5rem] text-lg bg-white/90 border-white/40 focus:bg-white text-slate-800 placeholder-slate-400 rounded-2xl shadow-inner transition-all w-full resize-y"
                      />
                    </div>
                    
                    <div className="relative group mt-1">
                      <textarea
                        placeholder="Опционално: Овде залепете рачен транскрипт доколку системот не успее да го симне..."
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        disabled={isLoading}
                        className="w-full h-24 p-4 text-sm bg-white/10 text-white border border-white/20 rounded-xl focus:border-indigo-400 focus:bg-white/20 focus:ring-1 focus:ring-indigo-400 resize-none font-medium placeholder:text-slate-300 transition-all font-mono"
                      />
                    </div>

                    <div className="bg-emerald-900/30 border border-emerald-400/30 rounded-2xl p-4 mt-2">
                       <h4 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                          <PlayCircle className="w-5 h-5 text-emerald-400" />
                          Вграден YouTube Scraper (Бесплатно / Не е потребна ScraperAPI екстензија)
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-emerald-100/80">
                          <div className="space-y-2">
                             <p className="font-semibold text-emerald-100">Како функционира?</p>
                             <ul className="list-disc pl-4 space-y-1">
                               <li>Нема потреба од надворешни Edge/Chrome алатки ниту претплати од $50 за ScraperAPI.</li>
                               <li>Вметнете обичен YouTube линк во полето погоре.</li>
                               <li>Нашиот нов интерен Express.js мотор директно го извлекува скриениот транскрипт (CC) бесплатно.</li>
                               <li>Отворете ги <strong>Напредните параметри</strong> подолу за прецизно подесување (по угледот на оригиналната екстензија).</li>
                             </ul>
                          </div>
                          <div className="space-y-2">
                             <p className="font-semibold text-emerald-100">Начин на обработка:</p>
                             <ul className="list-disc pl-4 space-y-1">
                               <li>Изберете го посакуваното нијансирање од новото <strong>Интерпретативно ниво</strong> (Faithful, Clean, Reformulate, Examples, Summary).</li>
                               <li>Системот автоматски ќе ги процесира сите математички изрази во LaTeX формат.</li>
                               <li>Извлечените резултати потоа може да се експортираат во Markdown, LaTeX, TXT или Word/PDF форми.</li>
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
                            <p className="text-indigo-300 text-xs">{(fileData.mimeType)} • Подготвено за скенирање</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className={`w-8 h-8 mb-2 transition-transform ${isDragOver ? 'text-emerald-400 scale-125' : 'text-indigo-300 group-hover:scale-110'}`} />
                          <p className={`font-medium tracking-tight ${isDragOver ? 'text-emerald-200' : 'text-indigo-200'}`}>
                            {isDragOver ? 'Спуштете го документот овде' : 'Кликни или довлечи (Drag & Drop) PDF/Слика'}
                          </p>
                          <p className="text-[10px] text-indigo-400 uppercase mt-1">Поддршка за стари OCR книги и ракопис</p>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {sourceType === 'text' && (
                   <div className="relative group flex flex-col gap-2">
                    <textarea
                      placeholder="Напишете или залепете суров транскрипт (на пр. од WayinVideo или YouTube Summary) овде..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={isLoading}
                      className="w-full h-40 p-5 text-base bg-white/90 border-white/40 focus:bg-white text-slate-800 placeholder-slate-400 rounded-2xl shadow-inner transition-all resize-none font-sans"
                    />
                    <div className="bg-indigo-900/30 border border-indigo-400/30 rounded-xl p-3 flex items-start gap-3">
                       <Zap className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                       <p className="text-xs text-indigo-100 leading-relaxed">
                         <strong>Про Совет:</strong> Доколку YouTube пребарувачот не работи или видеото нема превод, искористете Chrome екстензии како <span className="text-white font-bold">WayinVideo</span> или <span className="text-white font-bold">YouTube Summary with AI</span>. Копирајте го транскриптот оттаму на англиски јазик и залепете го овде. Системот автоматски ќе го преведе и форматира на македонски јазик!
                       </p>
                    </div>
                   </div>
                )}

                <div className="flex justify-between items-center mt-2 px-2">
                   <div className="flex items-center gap-3">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={isLoading}
                      title="AI модел"
                      aria-label="AI модел"
                      className="h-10 px-3 rounded-xl bg-white/10 border border-white/20 text-indigo-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 [&>option]:text-slate-800 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (World-Class)</option>
                      <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                    </select>
                   </div>

                   <Button 
                      type="submit" 
                      disabled={isLoading || (sourceType === 'url' && !url.trim()) || (sourceType === 'file' && !fileData) || (sourceType === 'text' && !textInput.trim())} 
                      className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 rounded-xl transition-all font-bold tracking-wide"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <><Sparkles className="w-5 h-5 mr-2" /> Процесирај</>
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
                    Напредни параметри
                  </button>
                </div>

                {/* Advanced Options Panel */}
                {showAdvanced && (
                  <div className="pt-5 pb-2 mt-2 border-t border-white/10 grid shadow-inner md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="md:col-span-2 bg-indigo-900/40 border border-indigo-400/20 p-4 rounded-2xl">
                       <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                           Интерпретативно ниво (Interpretative Level)
                           <div className="w-4 h-4 rounded-full border border-indigo-300 flex items-center justify-center text-[10px] font-bold text-indigo-300" title="Одредува колку AI моделот ќе ја промени оригиналната содржина.">?</div>
                       </label>
                       
                       <div className="flex items-center gap-4 relative isolate">
                          {/* Slider Track */}
                          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-700/50 -translate-y-1/2 rounded-full -z-10"></div>
                          <input 
                            type="range" 
                            min="0" max="4" step="1" 
                            value={interpretativeLevel} 
                            onChange={(e) => setInterpretativeLevel(parseInt(e.target.value))}
                            title="Интерпретативно ниво"
                            aria-label="Интерпретативно ниво"
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
                      <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">Зачувај директно во папка (опционално)</label>
                      <Input
                        type="text"
                        placeholder="Пр. Писмена за 8мо, Матура..."
                        value={targetFolder}
                        onChange={(e) => setTargetFolder(e.target.value)}
                        disabled={isLoading}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder-indigo-300/30 rounded-xl focus:bg-white/10 transition-all font-medium"
                      />
                    </div>
                    
                    {sourceType === 'url' && (
                      <div className="space-y-3">
                        <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">Временски Опсег (Опционално)</label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="Почеток (пр. 02:15)"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            disabled={isLoading}
                            className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20"
                          />
                          <Input
                            type="text"
                            placeholder="Крај (пр. 45:00)"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            disabled={isLoading}
                            className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 md:col-span-2">
                       <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">Специфични Инструкции</label>
                       <Input
                          type="text"
                          placeholder="пр. Фокусирај се само на алгебра, игнорирај геометрија..."
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
                           Bulk Мод Активиран: Ќе се излечат задачи од {urls.length} линкови последователно!
                         </div>
                       )}
                       {yId && (
                         <div className="border border-indigo-200/30 rounded-2xl overflow-hidden shadow-2xl relative z-10 mx-auto w-full max-w-4xl bg-black">
                           <div className="bg-indigo-900/50 p-2 flex items-center justify-between text-indigo-200 text-xs font-bold border-b border-indigo-500/30">
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4 text-red-500" />
                                {isMulti ? 'YOUTUBE ПРЕГЛЕД (Прво Видео)' : 'YOUTUBE PREVIEW'}
                              </div>
                              <span className="text-white/50">{isMulti ? `(1 од ${urls.length})` : 'Local Bypass Enabled'}</span>
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
                           ? "Не можеме да го вчитаме транскриптот од ова видео" 
                           : "Настана грешка при процесирањето"}
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
                             Прикачи Слика/PDF наместо тоа
                           </button>
                           <button 
                             onClick={() => setSourceType('text')}
                             className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors text-xs font-bold"
                           >
                             <FileText className="w-4 h-4" />
                             Копирај транскрипт рачно
                           </button>
                           <button 
                             onClick={() => {
                               setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Example working one, or just clear
                               setError(null);
                             }}
                             className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors text-xs font-bold"
                           >
                             <Video className="w-4 h-4" />
                             Пробај со друго видео
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
              <div className="mt-8 bg-white/5 rounded-3xl p-6 md:p-8 border border-white/10 backdrop-blur-xl text-left animate-in fade-in shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Sparkles className="w-32 h-32 text-indigo-300 animate-pulse" />
                </div>
                
                <h3 className="text-white font-bold text-xl mb-6 flex items-center">
                   <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center mr-3">
                     <Loader2 className="w-4 h-4 text-indigo-300 animate-spin" />
                   </div>
                   Анализирање преку AI технологија...
                </h3>
                
                <div className="flex justify-between text-sm text-indigo-200 font-medium mb-3">
                  <span className="flex items-center">{statusText}</span>
                  <span className="font-mono text-indigo-300">{progress}%</span>
                </div>
                
                <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5 shadow-inner">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 h-full rounded-full transition-all duration-700 ease-out relative" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  >
                    <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 w-full animate-pulse"></div>
                  </motion.div>
                </div>
                
                <p className="mt-6 text-indigo-300/80 text-xs md:text-sm leading-relaxed max-w-2xl">
                  Gemini визуелно и аудитивно ги анализира сите математички изрази, графикони и текстуални насоки во овој момент. Процесот е комплексен за да понуди максимална 100% прецизност.
                </p>
              </div>
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
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4 mb-2">Дигитализација на<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Следно Ниво</span></h2>
            <p className="text-slate-500 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-medium">
              Не трошете време на препишување. Внесете YouTube линк или прикачете фотографија од зададена задача и препуштете го процесирањето на MathDigitizer.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 max-w-4xl mx-auto text-left">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
                <Video className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">Анализа на Видеа</h4>
              <p className="text-sm text-slate-500">Влечеме транскрипти директно од YouTube и креираме текстуален преглед на предавањето.</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Microscope className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">Напреден OCR</h4>
              <p className="text-sm text-slate-500">Скенираме PDF/слики и ги претвораме во чист LaTeX код заедно со систем за решавање.</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">Генерација на квизови</h4>
              <p className="text-sm text-slate-500">Од секоја екстракција, можете да креирате Kahoot квиз или МакедоТест со еден клик.</p>
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
                <h3 className="font-bold text-emerald-800 dark:text-emerald-400 leading-none mb-1">Сè е зачувано во вашата Библиотека!</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">Сите {tasks.length} извлечени ресурси се веќе синхронизирани. Можете да продолжите да ги уредувате овде или преку Библиотека.</p>
              </div>
            </div>
            <Button onClick={() => navigate('/library')} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm rounded-xl font-bold">
              <BookOpen className="w-4 h-4 mr-2" /> Оди во Библиотека
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-200 pb-4 px-2">
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Екстрахирани Задачи</h2>
              <p className="text-slate-500 text-sm mt-1">Пронајдовме <strong className="text-indigo-600">{tasks.length}</strong> интерактивни задачи од изворот.</p>
              
              {/* Success Actions */}
              <div className="flex flex-wrap gap-2 mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 w-full">
                 <Button onClick={async () => {
                   if(tasks.length === 0) return;
                   setIsLoading(true);
                   setStatusText("Gemini AI: Подготовка на MathKahoot квиз од екстрахираните задачи...");
                   try {
                     // Get high quality real generation using gemini.ts Kahoot function from files
                     const pin = Math.floor(100000 + Math.random() * 900000).toString();
                     
                     // We just fallback to mapping if generating dynamically takes too long
                     const kahootData = {
                       title: "Брз Квиз: " + (tasks[0].title || "Математика"),
                       questions: tasks.map(t => ({
                         question: t.original_text,
                         options: [
                          (t.solution_steps?.[0] || 'A) Точен одговор'), 
                          (t.solution_steps?.[1] || 'B) Погрешен чекор'), 
                          'C) Непозната бредност', 
                          'D) Нема решение'
                         ],
                         correctIndex: 0
                       })),
                       hints: tasks.map((t, i) => t.hints?.[0] || t.pedagogical_insights?.socratic_questions?.[0] || "Размисли внимателно!")
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
                   <FileType2 className="w-4 h-4 mr-2" /> МакедоТест Pro
                 </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0 max-w-sm justify-end">
              <span className="w-full text-right text-xs font-bold text-slate-400 mb-1">Експорт Опции:</span>
              <Button variant="outline" onClick={() => exportToMarkdown(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
                Markdown
              </Button>
              <Button variant="outline" onClick={() => {
                exportToLatex(tasks);
              }} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
                LaTeX
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="bg-slate-900 border-slate-800 hover:bg-slate-800 text-white shadow-sm text-xs h-8 px-3">
                A4 PDF
              </Button>
              <Button variant="outline" onClick={() => {
                exportToTxt(tasks);
              }} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
                TXT
              </Button>
              <Button variant="outline" onClick={() => exportToJson(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
                JSON
              </Button>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.15 }}
            className="grid grid-cols-1 gap-8 printable-tasks-container"
          >
            {tasks.map((task, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                key={index} 
                className="bg-white rounded-[2rem] shadow-sm hover:shadow-xl border border-slate-200 overflow-hidden transition-all duration-500 flex flex-col group relative printable-task-card"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-indigo-600 no-print"></div>
                <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center ml-1">
                  <div className="flex px-3 gap-3 items-center">
                    <span className="font-bold text-slate-400 text-xs uppercase tracking-widest">
                      {task.type === 'theory' ? `Теорија ${index + 1}` : `Задача ${index + 1}`}
                    </span>
                    {task.type === 'task' && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        task.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                        task.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {task.difficulty}
                      </span>
                    )}
                    {task.dok_level && (
                      <span className="bg-blue-100 flex items-center gap-1 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                        DoK {task.dok_level}
                      </span>
                    )}
                    {task.bloom_taxonomy && (
                      <span className="bg-pink-100 flex items-center gap-1 text-pink-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                        {task.bloom_taxonomy}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${task.type === 'theory' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      <BookOpen className="w-3 h-3" /> {task.type}
                    </span>
                    {task.source_timestamp && (
                      <span className="bg-amber-100 flex items-center gap-1 text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full cursor-help" title="Проценето време во видеото">
                        <Clock className="w-3 h-3" /> {task.source_timestamp}
                      </span>
                    )}
                    {task.pedagogical_insights?.quality_score && (
                      <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm ring-1 ring-emerald-500/10">
                        <Zap className="w-3 h-3" /> 
                        Quality: {task.pedagogical_insights.quality_score}%
                      </div>
                    )}
                    {!task.pedagogical_insights && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEnrich(index)}
                        disabled={isEnriching[index]}
                        className="h-7 px-3 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold uppercase tracking-wider"
                      >
                        {isEnriching[index] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                        AI Педагошко Збогатување
                      </Button>
                    )}
                  </div>
                  <div className="pr-2 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTask(task)}
                      className="h-9 px-4 text-xs font-bold rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Layers className="w-4 h-4 mr-1.5" /> Уреди Архитектонски
                    </Button>
                    <Button
                      variant={savedTasks.has(index) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSaveToDb(task, index)}
                      disabled={savedTasks.has(index)}
                      className={`h-9 px-4 text-xs font-bold rounded-xl ${savedTasks.has(index) ? 'bg-emerald-500 hover:bg-emerald-600 border-none' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                    >
                      {savedTasks.has(index) ? <><CheckCircle className="w-4 h-4 mr-1.5" /> Зачувано</> : <><Save className="w-4 h-4 mr-1.5" /> Зачувај в Библиотека</>}
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col lg:flex-row ml-1">
                  <div className="p-8 flex-1">
                    {task.evidence_quote && (
                      <div className="mb-4 flex items-start gap-2 bg-slate-100/50 p-3 rounded-lg border-l-4 border-slate-300 text-slate-500 text-sm italic">
                        <Quote className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />
                        <p>"{task.evidence_quote}"</p>
                      </div>
                    )}
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-6 drop-shadow-sm">{task.title}</h3>
                    
                    <div className="prose prose-slate prose-lg max-w-none text-slate-700 mb-8 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                       <MathRenderer content={task.original_text} />
                    </div>

                    {(task.geogebra_commands?.length ?? 0) > 0 && (
                      <div className="mb-6 bg-slate-900 rounded-2xl p-4 shadow-inner border border-slate-700 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <h4 className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                            <Activity className="w-3.5 h-3.5 text-emerald-400" />
                            GeoGebra API Команди
                          </h4>
                          <Button 
                            size="sm" 
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-0 rounded-lg shadow-md"
                            onClick={() => setActiveGeogebraCmds(task.geogebra_commands || [])}
                          >
                            Илустрирај во GeoGebra
                          </Button>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-emerald-300 font-mono text-xs overflow-x-auto space-y-1">
                          {task.geogebra_commands?.map((cmd, i) => (
                            <div key={i} className="whitespace-nowrap"><span className="text-slate-600">evalCommand:</span> {cmd}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {task.illustration_prompt && (
                      <div className="mb-6 bg-slate-800 rounded-2xl p-4 shadow-inner border border-slate-700 flex flex-col gap-2">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                          Visual AI / NanoBanana Промпт
                        </h4>
                        <p className="text-xs text-blue-300 font-mono leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                          {task.illustration_prompt}
                        </p>
                      </div>
                    )}

                    {/* Pedagogical Insights - Premium Glower */}
                    {task.pedagogical_insights && (
                      <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-red-50/80 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <AlertTriangle className="w-12 h-12 text-red-600" />
                            </div>
                            <h4 className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-400 mb-3 relative z-10">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                              Педагошка Аутопсија (Критични точки)
                            </h4>
                            <ul className="space-y-2 relative z-10">
                              {task.pedagogical_insights.common_pitfalls.map((p, i) => (
                                <li key={i} className="text-[11px] text-red-800 dark:text-red-300 leading-tight flex gap-2">
                                   <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                                   {p}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-indigo-50/80 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(79,70,229,0.05)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Quote className="w-12 h-12 text-indigo-600" />
                            </div>
                            <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-400 mb-3 relative z-10">
                              <Quote className="w-3.5 h-3.5 text-indigo-600" />
                              Сократови прашања (Водичи)
                            </h4>
                            <ul className="space-y-2 relative z-10">
                              {task.pedagogical_insights.socratic_questions.map((q, i) => (
                                <li key={i} className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-tight italic flex gap-2">
                                   <span className="text-indigo-400 font-bold">?</span>
                                   {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {task.pedagogical_insights.modeling_scenario && (
                          <div className="bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.05)] relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Activity className="w-12 h-12 text-emerald-600" />
                            </div>
                            <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-400 mb-3 relative z-10">
                              <Activity className="w-3.5 h-3.5 text-emerald-600" />
                              Математичко Моделирање (Реален Свет)
                            </h4>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium relative z-10">
                              {task.pedagogical_insights.modeling_scenario}
                            </p>
                          </div>
                        )}

                        {/* Methodology Box - Glowing Purple */}
                        {(task.pedagogical_insights.teaching_strategy || (task.pedagogical_insights.prerequisites && task.pedagogical_insights.prerequisites.length > 0)) && (
                          <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 shadow-2xl relative overflow-hidden border border-slate-800">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-10 -mt-10" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-3xl -ml-10 -mb-10" />
                            
                            <h4 className="flex items-center gap-2 text-xs font-bold text-white mb-4 relative z-10">
                              <Sparkles className="w-4 h-4 text-indigo-400" />
                              Методолошки Клон (Invisible Knowledge Graph)
                            </h4>
                            
                            <div className="space-y-4 relative z-10">
                              {task.pedagogical_insights.teaching_strategy && (
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-2">Наставна Архитектура</label>
                                  <p className="text-[12px] text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                                    {task.pedagogical_insights.teaching_strategy}
                                  </p>
                                </div>
                              )}
                              {task.pedagogical_insights.prerequisites && task.pedagogical_insights.prerequisites.length > 0 && (
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-2">Предзнаења во Графот</label>
                                  <div className="flex flex-wrap gap-2">
                                    {task.pedagogical_insights.prerequisites.map((req, i) => (
                                      <span key={i} className="text-[10px] font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full shadow-sm">
                                        {req}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {task.solution_steps && task.solution_steps.length > 0 && (
                      <div className="mt-8">
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-6 flex items-center">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3 shadow-sm border border-emerald-200">
                             <Check className="w-5 h-5" />
                          </div>
                          Решение чекор по чекор
                        </h4>
                        <div className="space-y-4">
                          {task.solution_steps.map((step, i) => (
                             <div key={i} className="flex gap-4 items-start p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                               <div className="w-8 h-8 bg-indigo-50 text-indigo-600 font-bold rounded-full flex items-center justify-center shrink-0 border border-indigo-100">
                                 {i + 1}
                               </div>
                               <div className="pt-1 text-slate-700 flex-1">
                                 <MathRenderer content={step} />
                               </div>
                             </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-2">
                      {task.tags?.map((tag, i) => (
                        <span key={i} className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                          #{tag}
                        </span>
                      ))}
                      {task.grade_level && (
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center gap-1.5 inline-flex">
                          <BookOpen className="w-3.5 h-3.5" /> БРО: {task.grade_level}
                        </span>
                      )}
                      {task.curriculum_topic && (
                        <span className="text-[11px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                          ТЕМА: {task.curriculum_topic}
                        </span>
                      )}
                    </div>

                    {/* Pedagogical Insights */}
                    {task.pedagogical_insights && (
                      <div className="mt-8 p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                        <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <BrainCircuit className="w-4 h-4 text-emerald-600" />
                          Педагошки Увид (CoT)
                        </label>
                        
                        <div className="space-y-4 text-sm text-slate-700">
                          {task.pedagogical_insights.common_pitfalls?.length > 0 && (
                            <div>
                              <strong className="text-emerald-900 block mb-1">Чести грешки кај учениците:</strong>
                              <ul className="list-disc pl-5 space-y-1">
                                {task.pedagogical_insights.common_pitfalls.map((pitfall, pIdx) => (
                                  <li key={pIdx}>{pitfall}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {task.pedagogical_insights.socratic_questions?.length > 0 && (
                            <div>
                              <strong className="text-emerald-900 block mb-1">Сократови прашања (За наставник):</strong>
                              <ul className="list-disc pl-5 space-y-1">
                                {task.pedagogical_insights.socratic_questions.map((q, qIdx) => (
                                  <li key={qIdx}>{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {task.pedagogical_insights.teaching_strategy && (
                            <div>
                              <strong className="text-emerald-900 block mb-1">Стратегија за предавање:</strong>
                              <p>{task.pedagogical_insights.teaching_strategy}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Teacher Notes / Manual Intervention */}
                    <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-emerald-500" /> 
                        Опсервација на Наставникот (Твој став)
                      </label>
                      <textarea
                        value={task.teacher_notes || ''}
                        onChange={(e) => {
                          const newTasks = [...tasks];
                          newTasks[index] = { ...task, teacher_notes: e.target.value };
                          setTasks(newTasks);
                        }}
                        placeholder="Внесете свое мислење, забелешка или интервенција пред зачувување..."
                        className="w-full h-24 p-4 text-sm bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-medium placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  
                  {/* NanoBanana Visualizer AI Box inside the card */}
                  <div className="bg-slate-50/50 lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-100 p-8 flex flex-col items-center flex-grow relative overflow-hidden h-full">
                    {task.math_graphic_config ? (
                      <div className="w-full h-full text-center space-y-6 z-10 flex flex-col justify-center">
                        <VisualMathCanvas jsonConfig={task.math_graphic_config} />
                        {task.illustration_prompt && (
                             <Button 
                               variant="outline" 
                               className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-10 font-bold rounded-xl"
                               onClick={() => {
                                  // Trigger regen
                                  handleGenerateGraphics(task.illustration_prompt || `Math diagram for: ${task.title}`, index);
                               }}
                               disabled={isGeneratingImage[index]}
                             >
                               {isGeneratingImage[index] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                               Регенерирај Графика
                             </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center z-10 space-y-5 w-full m-auto">
                        <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-2 text-indigo-300">
                          <ImageIcon className="w-10 h-10 opacity-70" />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="font-extrabold text-slate-800 text-base">Визуелизација</h4>
                          <p className="text-xs text-slate-500 px-2 leading-relaxed">Генерирајте инстантен векторски геометриски графикон базиран на AI промпт.</p>
                        </div>
                        
                        <Button 
                          onClick={() => handleGenerateGraphics(task.illustration_prompt || `Math diagram for: ${task.title}`, index)}
                          disabled={isGeneratingImage[index]}
                          variant="default"
                          className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 shadow-md text-white border-0 h-12 font-bold rounded-xl"
                        >
                          {isGeneratingImage[index] ? (
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Генерирање...</>
                          ) : (
                            <><Wand2 className="w-5 h-5 mr-2" /> Создај 2D Графика</>
                          )}
                        </Button>

                        {task.illustration_prompt && (
                          <div className="mt-6 pt-6 border-t border-slate-200 w-full text-left">
                            <button 
                              onClick={() => togglePrompt(index)}
                              className="text-[10px] text-slate-400 uppercase tracking-widest font-bold hover:text-indigo-600 flex justify-between items-center w-full focus:outline-none"
                            >
                              Prompt Settings <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200">{expandedPrompts[index] ? '▲' : '▼'}</span>
                            </button>
                            {expandedPrompts[index] && (
                              <div className="mt-3 text-xs font-mono text-slate-600 bg-white p-3 rounded-xl border border-slate-200 h-28 overflow-y-auto leading-relaxed shadow-inner">
                                {task.illustration_prompt}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* NanoBanana Logo Watermark */}
                        <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none">
                           <ImageIcon className="w-64 h-64" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
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
  );
};
