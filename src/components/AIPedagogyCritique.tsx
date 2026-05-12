import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Bug, CheckCircle2, ChevronRight, AlertTriangle, Lightbulb, UserCheck, Code, SplitSquareHorizontal, EyeOff, XOctagon, Save, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { generateFlawedMathProblem, generateTwoCritiques, generateHoaxProof } from '../lib/gemini';
import { MathRenderer } from './MathRenderer';
import { useToast } from '../contexts/ToastContext';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const AIPedagogyCritique: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bug' | 'critiques' | 'hoax'>('bug');
  
  return (
    <div className="max-w-5xl flex flex-col gap-8 pb-12 w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1 border border-violet-200 dark:border-violet-800">
              <Brain className="w-3 h-3" />
              aipedagogy.org Инспирирано
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            AI Педагогија & Критичко Размислување
          </h1>
          <p className="text-slate-500 mt-2 text-lg max-w-2xl">
            Колекција на алатки дизајнирани според "AI Pedagogy Project" за поттикнување на критичко размислување кај студентите преку анализа на одговори генерирани од ВИ.
          </p>
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('bug')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'bug' 
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Bug className="w-4 h-4" />
          A Bug in the System
        </button>
        <button
          onClick={() => setActiveTab('critiques')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'critiques' 
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <SplitSquareHorizontal className="w-4 h-4" />
          Спротиставени Објаснувања
        </button>
        <button
          onClick={() => setActiveTab('hoax')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'hoax' 
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <XOctagon className="w-4 h-4" />
          Илустрација на Апсурд
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'bug' && <BugInTheSystem key="bug" />}
        {activeTab === 'critiques' && <TwoCritiques key="critiques" />}
        {activeTab === 'hoax' && <HoaxIllustration key="hoax" />}
      </AnimatePresence>

    </div>
  );
};

const BugInTheSystem: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('средно');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTask, setGeneratedTask] = useState<any>(null);
  const [userCritique, setUserCritique] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const { showToast } = useToast();

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setGeneratedTask(null);
    setIsRevealed(false);
    setUserCritique('');
    
    try {
      const task = await generateFlawedMathProblem(topic, difficulty);
      setGeneratedTask(task);
    } catch (error) {
      console.error(error);
      showToast('Грешка при генерирање.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedTask) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `AI Педагогија: Грешка во ${topic}`,
        original_text: `**Задача:**\n${generatedTask.question}\n\n**ВИ Решение со грешка:**\n${generatedTask.flawed_solution}`,
        solution_steps: [
          `**Точно решение:**\n${generatedTask.correct_solution}`,
          `**Објаснување за грешката:**\n${generatedTask.error_explanation}`
        ],
        difficulty: difficulty === 'лесно' ? 1 : difficulty === 'средно' ? 2 : 3,
        type: 'ai_pedagogy_bug',
        author_uid: auth.currentUser?.uid || 'anonymous',
        created_at: serverTimestamp(),
      });
      showToast('Вежбата е зачувана во библиотеката на задачи!', 'success');
    } catch (e) {
       console.error(e);
       showToast('Грешка при зачувување.', 'error');
    } finally {
       setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
          <Bug className="w-5 h-5 text-violet-500" /> A Bug in the System
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Оваа алатка генерира интелигентно математичко решение кое навидум изгледа точно, но содржи суптилна логичка грешка. Дајте им го на учениците за да ја вежбаат нивната способност критички да го евалуираат излезот на ВИ.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Математичка тема (на пр. Интеграли, Низи...)"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-violet-500"
            >
              <option value="лесно">Лесно</option>
              <option value="средно">Средно</option>
              <option value="тешко">Тешко</option>
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={!topic.trim() || isGenerating} className="bg-violet-600 hover:bg-violet-700 text-white">
            {isGenerating ? 'Генерирање...' : 'Генерирај'}
          </Button>
        </div>
      </div>

      {generatedTask && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-500" /> ВИ Генерирано Решение (со грешка)
            </div>
            <div className="p-6 flex-1 drop-shadow-sm">
               <div className="mb-6"><MathRenderer content={generatedTask.question} /></div>
               <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                 <MathRenderer content={generatedTask.flawed_solution} />
               </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-500" /> Твоја Критика
            </div>
            <div className="p-6 flex-1 flex flex-col gap-4">
               <p className="text-slate-600 dark:text-slate-400 text-sm">Каде е грешката лево и зошто е направена?</p>
               <textarea value={userCritique} onChange={(e) => setUserCritique(e.target.value)} className="w-full flex-1 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Анализа..."/>
               <Button onClick={() => setIsRevealed(true)} variant="outline" className="w-full">Откриј ја точната анализа</Button>
            </div>
          </div>
        </div>
      )}

      {isRevealed && generatedTask && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
           <h3 className="font-bold flex items-center gap-2 mb-4 text-emerald-700 dark:text-emerald-400"><CheckCircle2/> Точното Решение</h3>
           <div className="grid md:grid-cols-2 gap-6">
             <div><MathRenderer content={generatedTask.correct_solution} /></div>
             <div>
                <div className="text-orange-800 dark:text-orange-300 bg-orange-100/50 dark:bg-orange-900/30 p-4 rounded-xl text-sm mb-4">
                  <strong>Локација на грешката:</strong><br/>{generatedTask.error_explanation}
                </div>
             </div>
           </div>
           <div className="mt-6 flex justify-end">
             <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
               {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
               Зачувај ја вежбата во Библиотека
             </Button>
           </div>
        </motion.div>
      )}
    </motion.div>
  );
};

const TwoCritiques: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { showToast } = useToast();

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setResult(null);
    try {
      const data = await generateTwoCritiques(topic);
      setResult(data);
    } catch (error) {
      console.error(error);
      showToast('Грешка при генерирање.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `A Tale of Two Critiques: ${result.concept_name}`,
        original_text: `**Концепт:** ${result.concept_name}\n\n**Академско Објаснување:**\n${result.explanation_academic}\n\n**Интуитивно Објаснување:**\n${result.explanation_intuitive}`,
        solution_steps: [
          `**Педагошка Цeл:**\n${result.pedagogical_goal}`
        ],
        difficulty: 2,
        type: 'ai_pedagogy_critiques',
        author_uid: auth.currentUser?.uid || 'anonymous',
        created_at: serverTimestamp(),
      });
      showToast('Ситуацијата е зачувана во библиотеката на задачи!', 'success');
    } catch (e) {
       console.error(e);
       showToast('Грешка при зачувување.', 'error');
    } finally {
       setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
          <SplitSquareHorizontal className="w-5 h-5 text-blue-500" /> Спротиставени Објаснувања (A Tale of Two Critiques)
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Внесете математички концепт. Алатката ќе генерира две објаснувања: едното строго формално, а другото интуитивно со метафора. Учениците треба да ги споредат и да одредат кое објаснување за каква намена е подобро.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Математички концепт (на пр. Извод, Граница, Векторски производ...)"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={handleGenerate} disabled={!topic.trim() || isGenerating} className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto">
            {isGenerating ? 'Генерирање...' : 'Генерирај'}
          </Button>
        </div>
      </div>

      {result && (
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-center mt-4">Концепт: {result.concept_name}</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                🎓 Строг Академик
              </div>
              <div className="p-6 flex-1">
                 <MathRenderer content={result.explanation_academic} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                🤝 Пријателски Ентузијаст
              </div>
              <div className="p-6 flex-1">
                 <MathRenderer content={result.explanation_intuitive} />
              </div>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-blue-700 dark:text-blue-400"><Lightbulb className="w-5 h-5"/> Педагошка Цел</h3>
            <p className="text-slate-700 dark:text-slate-300">{result.pedagogical_goal}</p>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Зачувај ја вежбата во Библиотека
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const HoaxIllustration: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const { showToast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);
    setIsRevealed(false);
    setSelectedStep(null);
    try {
      const data = await generateHoaxProof();
      setResult(data);
    } catch (error) {
      console.error(error);
      showToast('Грешка при генерирање.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `Илустрација на Апсурд: ${result.hoax_title}`,
        original_text: `**Доказ:**\n\n${(result.hoax_steps || []).join('\n\n')}`,
        solution_steps: [
          `**Скриена Измама (чекор ${result.flawed_step_index + 1}):**\n${result.hidden_fallacy}`,
          `**Педагошка Цeл:**\n${result.pedagogical_goal}`
        ],
        difficulty: 3,
        type: 'ai_pedagogy_hoax',
        author_uid: auth.currentUser?.uid || 'anonymous',
        created_at: serverTimestamp(),
      });
      showToast('Апсурдот е зачуван во библиотеката на задачи!', 'success');
    } catch (e) {
       console.error(e);
       showToast('Грешка при зачувување.', 'error');
    } finally {
       setIsSaving(false);
    }
  };

  const checkStep = (index: number) => {
    if (isRevealed) return;
    setSelectedStep(index);
    // If they clicked any step, we can auto-reveal, or we can just show them if they are right.
    setIsRevealed(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col sm:flex-row gap-6 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white mb-2">
            <XOctagon className="w-5 h-5 text-rose-500" /> Илустрација на Апсурд (Illustrate a Hoax)
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Генерирајте математички доказ кој води кон апсурд (на пр. $1 = 0$). Овие мајтапи содржат суптилна нелегална математичка операција. Студентите се предизвикани да го најдат скриениот измамнички чекор.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap shadow-md">
          {isGenerating ? 'Создавање Илузија...' : 'Генерирај Апсурд'}
        </Button>
      </div>

      {result && (
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-center text-lg">
              🎭 {result.hoax_title}
            </div>
            <div className="p-6">
               <p className="text-slate-500 mb-6 text-center">Прочитај го доказот внимателно чекор по чекор. Кликни на чекорот каде што мислиш дека е направена забранета математичка операција.</p>
               <div className="flex flex-col gap-3 max-w-3xl mx-auto">
                 {result.hoax_steps?.map((step: string, idx: number) => {
                    const isSelected = selectedStep === idx;
                    const isCorrectError = result.flawed_step_index === idx;
                    
                    let bgColor = "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-slate-200 dark:border-slate-700";
                    if (isRevealed) {
                        if (isCorrectError) {
                            bgColor = "bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700";
                        } else if (isSelected && !isCorrectError) {
                            bgColor = "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 opacity-50";
                        } else {
                            bgColor = "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-50";
                        }
                    }

                    return (
                      <div 
                        key={idx} 
                        onClick={() => checkStep(idx)}
                        className={`p-4 rounded-xl border transition-all ${bgColor}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500">
                             {idx + 1}
                          </div>
                          <div className="flex-1 text-lg">
                             <MathRenderer content={step} />
                          </div>
                          {isRevealed && isCorrectError && (
                             <XOctagon className="w-6 h-6 text-rose-500 shrink-0" />
                          )}
                        </div>
                      </div>
                    )
                 })}
               </div>
            </div>
          </div>
          
          <AnimatePresence>
             {isRevealed && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 shadow-sm max-w-3xl mx-auto w-full">
                 <div className="flex items-center gap-2 mb-4">
                     {selectedStep === result.flawed_step_index ? (
                         <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Браво, ја откри измамата!</span>
                     ) : (
                         <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-bold flex items-center gap-1"><XOctagon className="w-4 h-4"/> Не е тој чекор. Грешката лежи во чекор {result.flawed_step_index + 1}.</span>
                     )}
                 </div>
                 <h4 className="font-bold text-rose-800 dark:text-rose-400 mb-2">🚨 Скриената Замка</h4>
                 <p className="text-slate-700 dark:text-slate-300 mb-4">{result.hidden_fallacy}</p>
                 <hr className="border-rose-200 dark:border-rose-800/50 my-4" />
                 <h4 className="font-bold text-rose-800 dark:text-rose-400 mb-2 flex items-center gap-2">
                   <Lightbulb className="w-4 h-4" /> Педагошка Цел
                 </h4>
                 <p className="text-slate-700 dark:text-slate-300 text-sm">{result.pedagogical_goal}</p>
                 <div className="mt-6 flex justify-end">
                   <Button onClick={handleSave} disabled={isSaving} className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm">
                     {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                     Зачувај ја вежбата во Библиотека
                   </Button>
                 </div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};
