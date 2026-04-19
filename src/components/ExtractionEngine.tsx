import React, { useState } from 'react';
import { 
  Globe, Wand2, ChevronUp, ChevronDown, Loader2, Sparkles, BookOpen, Download, 
  FileJson, CheckCircle, Save, Check, Youtube, Link as LinkIcon, FileText, 
  PlayCircle, Image as ImageIcon, AlertTriangle, Quote, Microscope, BookOpen as BookOpenIcon, Zap, Layers,
  Activity
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MathTask } from '../lib/schema';
import { extractMathTasksFromUrl, generateImage, advancedMultimodalExtraction } from '../lib/gemini';
import { exportToJson, exportToMarkdown } from '../lib/export';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLibraryStore } from '../store/useLibraryStore';
import { MathRenderer } from './MathRenderer';

interface ExtractionEngineProps {
  setActiveTutorTask: (task: MathTask) => void;
}

export const ExtractionEngine: React.FC<ExtractionEngineProps> = ({ setActiveTutorTask }) => {
  const { user } = useAuth();
  const { awardXP, updateQuestProgress } = useGamification();
  const { setEditingTask, setOnTaskUpdated } = useLibraryStore();
  
  const [url, setUrl] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sourceType, setSourceType] = useState<'url' | 'file' | 'text'>('url');
  const [fileData, setFileData] = useState<{base64: string, mimeType: string, name: string} | null>(null);
  const [model, setModel] = useState('gemini-3.1-pro-preview');
  
  // Progress States
  const [statusText, setStatusText] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [tasks, setTasks] = useState<MathTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedTasks, setSavedTasks] = useState<Set<number>>(new Set());
  
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

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isYoutube = url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be');

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

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (sourceType === 'url' && !url.trim()) return;
    if (sourceType === 'text' && !textInput.trim()) return;
    if (sourceType === 'file' && !fileData) return;

    if (sourceType === 'url' && !isValidUrl(url)) {
      setError('Внесете валиден URL линк.');
      return;
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
        extractedTasks = await extractMathTasksFromUrl(url + (timeRange ? ` (Range: ${timeRange.start}-${timeRange.end})` : ''), model, timeRange);
      } else {
        const sourcePayload = sourceType === 'file' ? 
          { type: 'file' as const, data: fileData!.base64, mimeType: fileData!.mimeType } :
          { type: 'text' as const, data: textInput };
        
        extractedTasks = await advancedMultimodalExtraction(sourcePayload, model, customInstructions);
      }

      setProgress(100);
      setStatusText('Екстракцијата е успешна!');
      setTasks(extractedTasks);
      awardXP(100);
      updateQuestProgress('extract');
    } catch (err) {
      setProgress(0);
      setError(err instanceof Error ? `Грешка: ${err.message}` : 'Настана грешка при екстракцијата. Проверете го изворот или обидете се повторно.');
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
  
  const handleGenerateImage = async (prompt: string, index: number) => {
    setIsGeneratingImage(prev => ({ ...prev, [index]: true }));
    try {
      const imageUrl = await generateImage(prompt);
      setGeneratedImages(prev => ({ ...prev, [index]: imageUrl }));
    } catch (err) {
      console.error("Грешка при слика:", err);
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [index]: false }));
    }
  };

  const togglePrompt = (index: number) => {
    setExpandedPrompts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      
      {/* Premium Hero Section for URL Extractor */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 rounded-[2rem] overflow-hidden shadow-2xl border border-indigo-500/20">
        <div className="px-6 py-12 md:py-16 relative">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-white/5 backdrop-blur-md rounded-2xl mb-2 border border-white/10 shadow-inner">
              <Youtube className="w-8 h-8 text-red-500 mr-2 drop-shadow-md" />
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
                  {type === 'url' ? 'URL / YouTube' : type === 'file' ? 'Документ / Слика' : 'Слободен Текст'}
                </button>
              ))}
            </div>

            <form onSubmit={handleExtract} className="mt-6 bg-white/5 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-white/10 shadow-2xl text-left transition-all hover:bg-white/10">
              <div className="flex flex-col gap-4">
                {/* Dynamic Inputs Based on Source Type */}
                {sourceType === 'url' && (
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      {isYoutube ? <PlayCircle className="w-6 h-6 text-red-400" /> : <LinkIcon className="w-6 h-6 text-indigo-400" />}
                    </div>
                    <Input
                      type="url"
                      placeholder="Вметнете линк (YouTube, Wikipedia, Блог...)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isLoading}
                      className="pl-14 h-16 text-lg bg-white/90 border-white/40 focus:bg-white text-slate-800 placeholder-slate-400 rounded-2xl shadow-inner transition-all"
                    />
                  </div>
                )}

                {sourceType === 'file' && (
                  <div className="relative group">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept="application/pdf,image/*"
                    />
                    <label 
                      htmlFor="file-upload"
                      className="flex flex-col items-center justify-center h-32 w-full border-2 border-dashed border-white/30 rounded-2xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer group"
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
                          <ImageIcon className="w-8 h-8 text-indigo-300 mb-2 group-hover:scale-110 transition-transform" />
                          <p className="text-indigo-200 font-medium tracking-tight">Кликни за аплоуд на PDF или Слика</p>
                          <p className="text-[10px] text-indigo-400 uppercase mt-1">Поддршка за стари OCR книги и ракопис</p>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {sourceType === 'text' && (
                   <div className="relative group">
                    <textarea
                      placeholder="Напишете или залепете суров текст со задачи овде..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={isLoading}
                      className="w-full h-32 p-4 text-base bg-white/90 border-white/40 focus:bg-white text-slate-800 placeholder-slate-400 rounded-2xl shadow-inner transition-all resize-none font-sans"
                    />
                   </div>
                )}

                <div className="flex justify-between items-center mt-2 px-2">
                   <div className="flex items-center gap-3">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={isLoading}
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
                <div className="flex items-center justify-between px-2 mt-2">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={isLoading}
                    className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-indigo-50 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 [&>option]:text-slate-800 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors"
                  >
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (World-Class)</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                  </select>
                  
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
                    <div className="space-y-3">
                      <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">Временски Опсег (Опционално)</label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="Почеток (пр. 02:15)"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20"
                        />
                        <Input
                          type="text"
                          placeholder="Крај (пр. 45:00)"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                       <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider ml-1">Специфични Инструкции</label>
                       <Input
                          type="text"
                          placeholder="пр. Фокусирај се само на алгебра, игнорирај геометрија..."
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          className="bg-white/10 border-white/10 text-white placeholder-indigo-300/50 h-11 rounded-xl focus:bg-white/20 w-full"
                        />
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-200 text-sm font-medium backdrop-blur-md animate-in slide-in-from-bottom-2">
                {error}
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
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 h-full rounded-full transition-all duration-700 ease-out relative" 
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 w-full animate-pulse"></div>
                  </div>
                </div>
                
                <p className="mt-6 text-indigo-300/80 text-xs md:text-sm leading-relaxed max-w-2xl">
                  Gemini визуелно и аудитивно ги анализира сите математички изрази, графикони и текстуални насоки во овој момент. Процесот е комплексен за да понуди максимална 100% прецизност.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {!isLoading && tasks.length > 0 && (
        <div className="space-y-6 pt-4 animate-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-200 pb-4 px-2">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Екстрахирани Задачи</h2>
              <p className="text-slate-500 text-sm mt-1">Пронајдовме <strong className="text-indigo-600">{tasks.length}</strong> интерактивни задачи од изворот.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exportToJson(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm">
                <FileJson className="w-4 h-4 mr-2" /> JSON
              </Button>
              <Button variant="outline" onClick={() => exportToMarkdown(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm">
                <FileText className="w-4 h-4 mr-2" /> Markdown
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {tasks.map((task, index) => (
              <div key={index} className="bg-white rounded-[2rem] shadow-sm hover:shadow-xl border border-slate-200 overflow-hidden transition-all duration-500 flex flex-col group relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-indigo-600"></div>
                <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center ml-1">
                  <div className="flex px-3 gap-3 items-center">
                    <span className="font-bold text-slate-400 text-xs uppercase tracking-widest">Задача {index + 1}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      task.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                      task.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {task.difficulty}
                    </span>
                    <span className="bg-indigo-100 flex items-center gap-1 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                      <BookOpen className="w-3 h-3" /> {task.type}
                    </span>
                    {task.pedagogical_insights?.quality_score && (
                      <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm ring-1 ring-emerald-500/10">
                        <Zap className="w-3 h-3" /> 
                        Quality: {task.pedagogical_insights.quality_score}%
                      </div>
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
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-6 drop-shadow-sm">{task.title}</h3>
                    
                    <div className="prose prose-slate prose-lg max-w-none text-slate-700 mb-8 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                       <MathRenderer content={task.original_text} />
                    </div>

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
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                          {task.grade_level}
                        </span>
                      )}
                      {task.curriculum_topic && (
                        <span className="text-[11px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                          {task.curriculum_topic}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* NanoBanana Visualizer AI Box inside the card */}
                  <div className="bg-slate-50/50 lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-100 p-8 flex flex-col items-center justify-center relative overflow-hidden">
                    {generatedImages[index] ? (
                      <div className="w-full text-center space-y-6 z-10">
                        <img 
                          src={generatedImages[index]} 
                          alt={`Илустрација за ${task.title}`} 
                          className="w-full rounded-2xl shadow-md border border-slate-200"
                        />
                        <Button 
                          variant="outline" 
                          className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-12 font-bold rounded-xl"
                          onClick={() => window.open(generatedImages[index], '_blank')}
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Симни Визуелизација
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center z-10 space-y-5 w-full">
                        <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-2 text-indigo-300">
                          <ImageIcon className="w-10 h-10 opacity-70" />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="font-extrabold text-slate-800 text-base">NanoBanana Визуелизација</h4>
                          <p className="text-xs text-slate-500 px-2 leading-relaxed">Генерирајте точен графикон или геометриска фигура за оваа задача преку prompt-to-image AI.</p>
                        </div>
                        
                        <Button 
                          onClick={() => handleGenerateImage(task.nanobanana_prompt || `Math diagram for: ${task.title}`, index)}
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

                        {task.nanobanana_prompt && (
                          <div className="mt-6 pt-6 border-t border-slate-200 w-full text-left">
                            <button 
                              onClick={() => togglePrompt(index)}
                              className="text-[10px] text-slate-400 uppercase tracking-widest font-bold hover:text-indigo-600 flex justify-between items-center w-full focus:outline-none"
                            >
                              Prompt Settings <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200">{expandedPrompts[index] ? '▲' : '▼'}</span>
                            </button>
                            {expandedPrompts[index] && (
                              <div className="mt-3 text-xs font-mono text-slate-600 bg-white p-3 rounded-xl border border-slate-200 h-28 overflow-y-auto leading-relaxed shadow-inner">
                                {task.nanobanana_prompt}
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
