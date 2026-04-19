import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, CheckCircle2, AlertTriangle, FileWarning, Search, 
  Brain, BrainCircuit, ScanLine, Calculator, ChevronRight, Image as ImageIcon, Camera
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { MathTask } from '../lib/schema';
import { useLibraryStore } from '../store/useLibraryStore';
import { MathRenderer } from './MathRenderer';
import { analyzeSolutionImage } from '../lib/gemini';

export const SmartGrader: React.FC = () => {
  const { tasks } = useLibraryStore();
  const [selectedTask, setSelectedTask] = useState<MathTask | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.original_text.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(t => t.type !== 'theory');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Сликата е премногу голема. Ве молиме прикачете слика помала од 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setImageMimeType(file.type);
      setResult(null); // Clear previous results
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async () => {
    if (!selectedTask || !selectedImage) return;

    setIsAnalyzing(true);
    try {
      const base64Data = selectedImage.split(',')[1];
      const analysisResult = await analyzeSolutionImage(selectedTask, base64Data, imageMimeType);
      setResult(analysisResult);
    } catch (error) {
      console.error("Grader Analysis Error:", error);
      alert("Настана грешка при анализата. Обидете се повторно.");
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
    
    const mkLabels: Record<string, string> = {
      remember: 'Запомнување', understand: 'Разбирање', apply: 'Примена',
      analyze: 'Анализирање', evaluate: 'Евалуација', create: 'Креирање'
    };

    const colorClass = colors[level] || 'bg-slate-100 text-slate-800 border-slate-200';
    
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${colorClass}`}>
        Bloom: {mkLabels[level] || level}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900 text-white rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-4 border border-emerald-500/30">
            <BrainCircuit className="w-4 h-4" />
            AI Систем за Оценување
          </div>
          <h1 className="text-4xl font-black mb-4">Smart Grader & Bloom Analysis</h1>
          <p className="text-slate-400 text-lg">
            Автоматска визуелна анализа на студентски ракописи. АИ ги пронаоѓа грешките, го детектира когнитивното ниво според Блум каде ученикот наишол на проблем и генерира формат за поени.
          </p>
        </div>
        <div className="relative z-10 bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
          <ScanLine className="w-16 h-16 text-emerald-400 mx-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step 1: Select Task */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">1</span>
            Избери Задача
          </h2>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[600px]">
            <div className="relative mb-4 shrink-0">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Пребарувај во библиотека..."
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
          </div>
        </div>

        {/* Step 2: Upload Student Image */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">2</span>
            Слика од ракопис
          </h2>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm h-[600px] flex flex-col items-center justify-center relative overflow-hidden">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden" 
            />
            
            {selectedImage ? (
              <div className="relative w-full h-full flex flex-col group">
                <img src={selectedImage} alt="Student Work" className="w-full h-full object-contain rounded-xl" />
                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <Button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 hover:bg-slate-100">
                    <Camera className="w-4 h-4 mr-2" /> Промени Слика
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ImageIcon className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Прикачете ракопис</h3>
                <p className="text-sm text-slate-500 max-w-[250px] mx-auto mb-6">Сликајте го тестот или тетратката на ученикот за автоматска проверка.</p>
                <Button onClick={() => fileInputRef.current?.click()} size="lg" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                  <Upload className="w-5 h-5 mr-2" /> Избери Фајл
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
              Анализа
            </h2>
            <Button 
              onClick={runAnalysis}
              disabled={!selectedTask || !selectedImage || isAnalyzing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              {isAnalyzing ? <span className="flex items-center"><ScanLine className="w-4 h-4 mr-2 animate-pulse" /> Анализирам...</span> : <span className="flex items-center"><Brain className="w-4 h-4 mr-2" /> Оцени ракопис</span>}
            </Button>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm h-[600px] overflow-y-auto">
            {!result && !isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-6">
                <Calculator className="w-16 h-16 mb-4 opacity-20" />
                <p>Изберете задача и слика за да генерирате автоматски фидбек и оценка базирана на Блумовата Таксономија.</p>
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
                  <p className="font-bold text-slate-700 dark:text-slate-200">Ги читам чекорите...</p>
                  <p className="text-sm text-slate-500">Го споредувам ракописот со алгоритмот</p>
                </div>
              </div>
            )}

            {result && !isAnalyzing && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {/* Score & Status */}
                <div className="flex items-center gap-4">
                  <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2 ${
                    result.score >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                    result.score >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                    'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <span className="text-2xl font-black">{result.score}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide">на 100</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Статус на решавање</h3>
                    {selectedTask?.bloom_taxonomy && renderBloomBadge(selectedTask.bloom_taxonomy)}
                  </div>
                </div>

                {/* Errors */}
                {result.errorsFound?.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-bold text-red-600 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <FileWarning className="w-4 h-4" /> Идентификувани Грашки
                    </h4>
                    <ul className="space-y-2">
                      {result.errorsFound.map((err: string, i: number) => (
                        <li key={i} className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-3 rounded-xl text-sm leading-relaxed border border-red-100 dark:border-red-900/30">
                          <MathRenderer content={err} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl flex items-center gap-3 border border-emerald-100 dark:border-emerald-900/30">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium text-sm">Не се најдени грешки. Задачта е точно решена.</span>
                  </div>
                )}

                {/* Socratic Feedback */}
                <div className="space-y-3">
                  <h4 className="font-bold text-indigo-600 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Brain className="w-4 h-4" /> Фидбек за ученикот
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-700">
                     <MathRenderer content={result.analysis} inline/>
                  </div>
                </div>

                {/* Suggestions */}
                {result.suggestions?.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-amber-600 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" /> Препораки
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      {result.suggestions.map((sug: string, i: number) => (
                        <li key={i} className="flex gap-2 items-start">
                          <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="leading-relaxed"><MathRenderer content={sug} inline /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
