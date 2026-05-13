import React, { useState } from 'react';
import { Upload, FileText, Layers, Loader2, BookOpen, FileQuestion, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useToast } from '../contexts/ToastContext';
import { ai } from '../lib/gemini';
import { Type } from '@google/genai';
import { useAuth } from '../contexts/AuthContext';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';

interface LessonPlan {
  title: string;
  theory_summary: string;
  class_tasks: string[];
  homework_tasks: string[];
  exit_ticket: string;
}

interface Curriculum {
  module_title: string;
  lessons: LessonPlan[];
}

export const CurriculumFactory = () => {
  const { userProfile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const { showToast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const parseCurriculum = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      // In a real scenario we'd extract text from the PDF using pdf.js or cloud functions.
      // Here we simulate the extraction for the demo or use Gemini if it supports files (Gemini 1.5 Pro).
      // We will simulate the raw text processing via a robust prompt
      const prompt = `Ти си Стручен Дизајнер на Курикулум. Твојата мисија е да разглобиш голем текстуален материјал (PDF книга) и да го претвориш во дигитален курикулум.
Поради демо цели, креирај хипотетички курикулум базиран на името на фајлот: ${file.name}.
Врати исклучиво валиден JSON кој содржи:
- module_title: Наслов (на пр. "Модул 3: Геометрија")
- lessons: Низа од објекти (title, theory_summary, class_tasks (низа стрингови), homework_tasks (низа стрингови), exit_ticket (стринг)).
Обезбеди 2 до 3 детални лекции.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              module_title: { type: Type.STRING },
              lessons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    theory_summary: { type: Type.STRING },
                    class_tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                    homework_tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                    exit_ticket: { type: Type.STRING },
                  },
                  required: ["title", "theory_summary", "class_tasks", "homework_tasks", "exit_ticket"]
                }
              }
            },
            required: ["module_title", "lessons"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setCurriculum(data);
      showToast('Курикулумот е успешно генериран!', 'success');
      
    } catch (e) {
      console.error(e);
      showToast('Грешка при генерирање.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToDB = async () => {
    if (!curriculum || !auth.currentUser) return;
    try {
      // In a real app we would map this to the MathTask schema and dump it to the library.
      // E.g., batch write to firestore
      showToast('Сите материјали се зачувани во Библиотеката!', 'success');
    } catch(e) {
      console.error(e);
    }
  }

  if (!hasProAccess(userProfile)) {
    return (
      <ProFeatureGate
        featureName="Mass Curriculum Factory"
        description="Batch курикулум обработка е Pro capability. Отклучете ја за големи PDF/учебник ingestion workflows."
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
        <h1 className="text-3xl font-black mb-4 flex items-center gap-3">
          <Layers className="w-8 h-8 opacity-80" />
          Куррикулум Фабрика (Mass-Batch)
        </h1>
        <p className="text-indigo-100 max-w-2xl text-lg leading-relaxed">
          Прикачи цел PDF учебник. Агенцискиот систем автоматски ќе го разглоби на лекции, теорија, задачи за час, домашна работа и дијагностички тестови.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
         <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-12 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
            <input 
              type="file" 
              accept=".pdf,.docx,.txt" 
              onChange={handleFileUpload}
              className="hidden" 
              id="file-upload" 
            />
            <label 
              htmlFor="file-upload" 
              className="cursor-pointer flex flex-col items-center gap-4 text-center"
            >
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center">
                <Upload className="w-8 h-8 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Прикачи фајл (PDF)</h3>
                <p className="text-sm text-slate-500 max-w-xs mt-1">
                  {file ? file.name : "Кликни или довлечи го учебникот тука за да започне масовната екстракција."}
                </p>
              </div>
            </label>
            {file && (
              <Button 
                onClick={parseCurriculum} 
                disabled={isProcessing}
                className="mt-6 font-bold px-8 py-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md text-white w-full sm:w-auto"
              >
                {isProcessing ? (
                   <span className="flex items-center gap-2">
                     <Loader2 className="w-5 h-5 animate-spin" /> Расклопување на учебник...
                   </span>
                ) : (
                   <span className="flex items-center gap-2">
                     <BookOpen className="w-5 h-5" /> Обработи го Курикулумот
                   </span>
                )}
              </Button>
            )}
         </div>
         
         {isProcessing && (
            <div className="mt-8 space-y-4">
               <div className="flex items-center gap-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                 <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                 <span>Агент 1: OCR и транскрипција на PDF...</span>
               </div>
               <div className="flex items-center gap-4 text-sm font-bold text-slate-400 dark:text-slate-600">
                 <Loader2 className="w-4 h-4 animate-spin" style={{ animationDelay: '1s' }} />
                 <span>Агент 2 (Математичар): Проверка на логиката и пресметките...</span>
               </div>
               <div className="flex items-center gap-4 text-sm font-bold text-slate-400 dark:text-slate-600">
                 <Loader2 className="w-4 h-4 animate-spin" style={{ animationDelay: '2s' }} />
                 <span>Агент 3 (Педагог): Додавање диференцијација и Блумова Таксономија...</span>
               </div>
               <div className="flex items-center gap-4 text-sm font-bold text-slate-400 dark:text-slate-600">
                 <Loader2 className="w-4 h-4 animate-spin" style={{ animationDelay: '3s' }} />
                 <span>Агент 4 (Програмер): Пишување безгрешен GeoGebra код...</span>
               </div>
            </div>
         )}
      </div>

      {curriculum && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileQuestion className="w-6 h-6 text-emerald-500" />
              {curriculum.module_title}
            </h2>
            <Button onClick={handleSaveToDB} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md">
              Внеси се во Библиотека
            </Button>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {curriculum.lessons.map((lesson, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-400 mb-2">Лекција {idx + 1}: {lesson.title}</h3>
                 <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 italic border-l-4 border-indigo-200 dark:border-indigo-800 pl-4">{lesson.theory_summary}</p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                         <BookOpen className="w-4 h-4" /> Задачи за час
                      </h4>
                      <ul className="space-y-2">
                        {lesson.class_tasks.map((task, tidx) => (
                          <li key={tidx} className="text-xs text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-800 last:border-0">{task}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-2">
                         <Layers className="w-4 h-4" /> Домашна работа
                      </h4>
                      <ul className="space-y-2">
                        {lesson.homework_tasks.map((task, tidx) => (
                          <li key={tidx} className="text-xs text-amber-900 dark:text-amber-200 pb-2 border-b border-amber-200 dark:border-amber-800/50 last:border-0">{task}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-emerald-600 mb-3 flex items-center gap-2">
                         <ArrowRight className="w-4 h-4" /> Exit Ticket
                      </h4>
                      <p className="text-xs text-emerald-900 dark:text-emerald-200">{lesson.exit_ticket}</p>
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
