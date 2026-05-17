import React, { useState } from 'react';
import { BookOpen, X, Loader2, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MathTask } from '../lib/schema';
import { generateLessonPlan } from '../lib/gemini';
import { exportLessonPlanToWord } from '../lib/export';
import { useToast } from '../contexts/ToastContext';

interface LessonPlanGeneratorProps {
  selectedTasks: MathTask[];
  onClose: () => void;
}

export const LessonPlanGenerator: React.FC<LessonPlanGeneratorProps> = ({ selectedTasks, onClose }) => {
  const { showToast } = useToast();
  const [topicName, setTopicName] = useState('Анализа на функции');
  const [gradeLevel, setGradeLevel] = useState('1 година');
  const [isGenerating, setIsGenerating] = useState(false);
  const [planData, setPlanData] = useState<any>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const data = await generateLessonPlan(selectedTasks, gradeLevel, topicName);
      setPlanData(data);
    } catch (error) {
       console.error(error);
       showToast("Грешка при генерирање на подготовката.", 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    if (!planData) return;
    exportLessonPlanToWord(planData, `Подготовка_${topicName.replace(/\s+/g, '_')}.docx`);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shadow-inner">
              <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-xl">Наставна Подготовка</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Креирање план базиран на <span className="text-orange-600 font-bold">{selectedTasks.length}</span> избрани задачи според БРО</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Затвори" title="Затвори" className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 rounded-full shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-8 custom-scrollbar">
          {/* Settings */}
          <div className="space-y-6">
            <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500 tracking-wider uppercase">Автоматски наслов (Тема)</label>
                 <Input 
                   value={topicName} 
                   onChange={(e) => setTopicName(e.target.value)} 
                   placeholder="Внесете наслов на методската единица..." 
                   className="h-11 rounded-xl bg-white dark:bg-slate-800 shadow-inner"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500 tracking-wider uppercase">Одделение / Година</label>
                 <Input 
                   value={gradeLevel} 
                   onChange={(e) => setGradeLevel(e.target.value)} 
                   placeholder="Пр. 8мо одделение..." 
                   className="h-11 rounded-xl bg-white dark:bg-slate-800 shadow-inner"
                 />
              </div>
              
              <Button 
                onClick={handleGenerate} 
                disabled={selectedTasks.length === 0 || isGenerating}
                className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 font-bold mt-4"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                {isGenerating ? "Генерирање методички план..." : "Генерирај Подготовка"}
              </Button>
            </div>
            
            {planData && (
              <Button 
                onClick={handleExport} 
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg border-none font-bold text-lg"
              >
                 <FileText className="w-6 h-6 mr-2" />
                 Преземи како Word (.docx)
              </Button>
            )}
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 overflow-y-auto max-h-[60vh] shadow-inner text-sm text-slate-800 dark:text-slate-200">
            {!planData ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center opacity-60">
                 <BookOpen className="w-16 h-16 mb-4" />
                 <p>Пополнете ги податоците лево и кликнете<br/>"Генерирај Подготовка" за AI анализа.</p>
               </div>
            ) : (
               <div className="space-y-6 animate-in fade-in duration-500">
                 <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-700">
                    <h2 className="text-lg font-black uppercase">Дневна Подготовка</h2>
                    <p className="opacity-80">Тема: {planData.topic} | Одд: {planData.grade}</p>
                 </div>
                 
                 <div>
                    <h3 className="font-bold text-indigo-600 dark:text-indigo-400 mb-2">Цели на часот</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {planData.objectives?.map((obj: string, i: number) => <li key={i}>{obj}</li>)}
                    </ul>
                 </div>

                 <div>
                    <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">Очекувани исходи</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {planData.outcomes?.map((obj: string, i: number) => <li key={i}>{obj}</li>)}
                    </ul>
                 </div>

                 <div>
                    <h3 className="font-bold text-amber-600 dark:text-amber-400 mb-2">Тек на часот</h3>
                    <div className="space-y-3">
                       <p><strong className="opacity-80 block mb-1">Воведен дел:</strong> {planData.intro}</p>
                       <p><strong className="opacity-80 block mb-1">Главен дел:</strong> {planData.main}</p>
                       <p><strong className="opacity-80 block mb-1">Завршен дел:</strong> {planData.outro}</p>
                    </div>
                 </div>

                 <div>
                    <h3 className="font-bold text-purple-600 dark:text-purple-400 mb-2">Формативно оценување</h3>
                    <p>{planData.assessment}</p>
                 </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
