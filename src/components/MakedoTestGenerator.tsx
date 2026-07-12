import React, { useState } from 'react';
import { MathTask, MakedoTestDocument } from '../lib/schema';
import { generateMakedoTestFromTasks } from '../lib/gemini';
import { Button } from './ui/Button';
import { FileType2, Loader2, PlayCircle, Library } from 'lucide-react';
import { MakedoTestViewer } from './MakedoTestViewer';

interface MakedoTestGeneratorProps {
  tasks: MathTask[];
}

export const MakedoTestGenerator: React.FC<MakedoTestGeneratorProps> = ({ tasks }) => {
  const [instructions, setInstructions] = useState('Направи формален тест со различни типови прашања (multiple choice, true/false, short answer, equation solving). Подреди ги по тежина. Додај секции.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<MakedoTestDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (tasks.length === 0) {
      setError("Ве молиме прво извлечете или изберете задачи за да генерирате тест.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const testJson = await generateMakedoTestFromTasks(tasks, instructions);
      setGeneratedTest({
        ...testJson,
        created_at: new Date().toISOString(),
        author_uid: 'current_user' // Replace with real uid if needed
      });
    } catch (err: any) {
      console.error(err);
      setError("Грешка: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (generatedTest) {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-8">
        <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
           <p className="text-indigo-800 font-medium text-sm">Тестот е успешно генериран! Можете да го печатите („Ctrl+P“) директно од вашиот прелистувач.</p>
           <Button variant="outline" onClick={() => setGeneratedTest(null)} className="h-9 px-4 rounded-lg font-bold bg-white text-indigo-600 border-indigo-200">Врати се назад</Button>
        </div>
        <MakedoTestViewer test={generatedTest} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-xl mb-4">
          <FileType2 className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">МакедоТест Генератор</h2>
        <p className="text-slate-500 max-w-xl mx-auto text-lg leading-relaxed">
          Автоматски претворете ги вашите извлечени задачи во професионален тест спремен за печатење. AI-то ќе избере соодветна структура од сите 16 типови (multiple choice, true/false, поврзување итн.).
        </p>
      </div>

      <div className="bg-white rounded-5xl shadow-xl p-8 md:p-10 border border-slate-100">
        <div className="space-y-8">
          <div>
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
              <Library className="w-5 h-5 text-indigo-500" />
              1. Изворни Задачи
            </label>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
               <p className="text-slate-600 font-medium">Моментално има <strong className="text-indigo-600">{tasks.length}</strong> задачи извлечени од изворот спремни за вклучување во овој тест.</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-indigo-500" />
              2. Промпт и Структура (Инструкции)
            </label>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="w-full h-32 p-5 text-base bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium placeholder:text-slate-400 transition-all"
              placeholder="пр. Направи 4 секции: Повеќекратен избор, Точно/Неточно, Краток одговор и Есеј..."
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl font-bold border border-red-100 text-sm">
              {error}
            </div>
          )}

          <Button 
            onClick={handleGenerate}
            disabled={isGenerating || tasks.length === 0}
            className="w-full h-16 text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-500/30 transition-all transform hover:scale-[1.01] active:scale-[0.98]"
          >
            {isGenerating ? (
              <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Се генерира МакедоТест...</>
            ) : (
              <><FileType2 className="w-6 h-6 mr-3" /> Создај Тест</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
