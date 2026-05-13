import React, { useState } from 'react';
import { ALL_CURRICULUMS } from '../lib/curriculumData';
import { BookOpen, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateCurriculumTasks } from '../lib/gemini';
import { useToast } from '../contexts/ToastContext';

export const CurriculumTestGenerator: React.FC = () => {
  const [selectedCountry, setSelectedCountry] = useState(ALL_CURRICULUMS[0].country);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();

  const activeCurriculum = ALL_CURRICULUMS.find(c => c.country === selectedCountry);
  const activeGradeObj = activeCurriculum?.grades.find(g => g.level === selectedGrade);

  const handleGenerate = async () => {
    if (!selectedTopic || !activeGradeObj || !activeCurriculum) return;
    setIsGenerating(true);
    
    try {
      const prompt = `Генерирај 3 математички задачи соодветни за наставната програма: 
      Држава: ${activeCurriculum.country}
      Одделение: ${activeGradeObj.level}
      Тема: ${selectedTopic}
      
      Задачите треба да бидат соодветни на стандардите на државното биро за развој на образованието за оваа возраст.
      За секоја задача обезбеди чекор-по-чекор решение.
      `;
      
      const tasks = await generateCurriculumTasks(prompt, { strategy: 'tot' });
      
      let count = 0;
      for (const t of tasks) {
        if (!auth.currentUser) break;
        await addDoc(collection(db, 'tasks'), {
          ...t,
          authorId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          curriculum_topic: selectedTopic,
          curriculum_grade: activeGradeObj.level,
        });
        count++;
      }
      
      showToast(`Успешно генерирани и зачувани ${count} задачи по државен стандард.`, 'success');
      
    } catch (e) {
      console.error(e);
      showToast('Грешка при генерирање.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Тестови по Државни Стандарди</h1>
          <p className="text-slate-500">Генерирајте материјали усогласени со програмите на МОН/БРО</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        
        {/* Country Select */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Национална Програма</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CURRICULUMS.map((c) => (
              <Button
                key={c.country}
                onClick={() => { setSelectedCountry(c.country); setSelectedGrade(''); setSelectedTopic(''); }}
                variant={selectedCountry === c.country ? 'default' : 'outline'}
                className={selectedCountry === c.country ? 'bg-indigo-600 text-white' : 'text-slate-600'}
              >
                {c.country}
                {selectedCountry === c.country && <Check className="w-4 h-4 ml-2" />}
              </Button>
            ))}
          </div>
        </div>

        {/* Grade Select */}
        {activeCurriculum && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">Одделение / Разред</label>
            <div className="flex flex-wrap gap-2">
              {activeCurriculum.grades.map((g) => (
                <Button
                  key={g.level}
                  onClick={() => { setSelectedGrade(g.level); setSelectedTopic(''); }}
                  variant={selectedGrade === g.level ? 'default' : 'outline'}
                  className={selectedGrade === g.level ? 'bg-indigo-600 text-white' : 'text-slate-600'}
                >
                  {g.level}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Topic Select */}
        {activeGradeObj && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">Наставна Тема</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeGradeObj.topics.map((t) => (
                <div 
                  key={t.id}
                  onClick={() => setSelectedTopic(t.name)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedTopic === t.name ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-indigo-200 bg-slate-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedTopic === t.name ? 'border-indigo-600' : 'border-slate-300'}`}>
                      {selectedTopic === t.name && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                    </div>
                    <span className={`text-sm font-medium ${selectedTopic === t.name ? 'text-indigo-900' : 'text-slate-700'}`}>{t.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        {selectedTopic && (
          <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
            <Button 
               onClick={handleGenerate} 
               disabled={isGenerating}
               className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md h-12 text-lg"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
              {isGenerating ? 'Генерирање задачи со AI...' : 'Генерирај Задачи (бро.gov.mk)'}
            </Button>
            <p className="text-center text-xs text-slate-400 mt-3">Изгенерираните задачи автоматски ќе се додадат во колекцијата на задачи и ќе бидат достапни за учениците во Адаптивниот Тест.</p>
          </div>
        )}
      </div>
    </div>
  );
};
