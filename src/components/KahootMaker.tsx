import React, { useState } from 'react';
import { generateKahootFromFiles } from '../lib/gemini';
import { LiveKahootSession } from '../lib/schema';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, PlayCircle, ImageIcon, PlusCircle, CheckCircle, Smartphone } from 'lucide-react';
import { Button } from './ui/Button';

export const KahootMaker = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('Направи математички квиз од 10 прашања базиран на материјалот.');
  const [files, setFiles] = useState<{base64: string, mimeType: string, name: string}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftQuiz, setDraftQuiz] = useState<any | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setFiles(prev => [...prev, {
          base64,
          mimeType: file.type,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGenerateAndHost = async () => {
    if (!user) {
      setError('Мора да сте најавени како наставник за да хостирате квиз.');
      return;
    }
    if (files.length === 0) {
      setError('Ве молиме прикачете барем еден документ или слика.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const quizJson = await generateKahootFromFiles(files, prompt);
      
      // Default time limit to 60s if not provided by gemini
      const normalizedQuiz = {
        ...quizJson,
        questions: quizJson.questions.map((q: any) => ({
          ...q,
          timeLimit: q.timeLimit || 60
        }))
      }
      
      setDraftQuiz(normalizedQuiz);
    } catch (err: any) {
      console.error(err);
      setError('Грешка при генерирање: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartHost = async () => {
    if (!draftQuiz || !user) return;
    try {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const sessionData: LiveKahootSession = {
        id: pin,
        teacher_uid: user.uid,
        quiz_data: draftQuiz,
        status: 'lobby',
        current_question_index: 0,
        participants: {},
        created_at: Date.now()
      };
      
      await setDoc(doc(db, 'live_sessions', pin), sessionData);
      navigate(`/live/${pin}/host`);
    } catch (err: any) {
      console.error(err);
      setError('Грешка при пуштање во живо: ' + err.message);
    }
  };
  
  const updateQuestionTime = (index: number, time: number) => {
    if (!draftQuiz) return;
    const updated = { ...draftQuiz };
    updated.questions[index].timeLimit = time;
    setDraftQuiz(updated);
  };

  if (draftQuiz) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-8">
         <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100">
             <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                <div>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tight">Преглед на Квизот</h2>
                   <p className="text-slate-500 font-medium mt-1">Овде можете да го прилагодите точното време за решавање на секое прашање.</p>
                </div>
                <Button onClick={handleStartHost} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-emerald-500/30">
                  <PlayCircle className="w-5 h-5 mr-2" /> Започни Игра
                </Button>
             </div>
             
             <div className="space-y-6">
               {draftQuiz.questions.map((q: any, i: number) => (
                 <div key={i} className="flex gap-6 items-start p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-4">
                      <p className="font-bold text-slate-800 text-lg leading-relaxed">{q.question}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt: string, optIdx: number) => (
                          <div key={optIdx} className={`p-3 rounded-lg text-sm font-medium border ${optIdx === q.correctIndex ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="w-40 shrink-0">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Време (секунди)</label>
                      <select 
                        value={q.timeLimit} 
                        onChange={(e) => updateQuestionTime(i, Number(e.target.value))}
                        className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                         <option value={15}>15 сек</option>
                         <option value={30}>30 сек</option>
                         <option value={60}>1 минута</option>
                         <option value={90}>1.5 минути</option>
                         <option value={120}>2 минути</option>
                         <option value={300}>5 минути</option>
                      </select>
                    </div>
                 </div>
               ))}
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-xl mb-4">
          <Smartphone className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">MathKahoot Генератор</h2>
        <p className="text-slate-500 max-w-xl mx-auto text-lg leading-relaxed">
          Прикачете скрипти, тестови или книги. AI-то ќе ги прочита, ќе извлече задачи и веднаш ќе креира интерактивен квиз за вашите ученици.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl p-8 md:p-10 border border-slate-100">
        <div className="space-y-8">
          <div>
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-500" />
              1. Извори за Квизот
            </label>
            <div className="flex gap-4 flex-wrap">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl text-indigo-700 text-sm font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {f.name}
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-slate-50 px-6 py-2 rounded-xl cursor-pointer transition-colors text-sm font-bold text-slate-500">
                <PlusCircle className="w-4 h-4" />
                <span>Додај Фајл</span>
                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-indigo-500" />
              2. Промпт и Правила
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="w-full h-32 p-5 text-base bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium placeholder:text-slate-400 transition-all"
              placeholder="пр. Направи 5 прашања од областа на линеарни функции..."
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl font-bold border border-red-100 text-sm">
              {error}
            </div>
          )}

          <Button 
            onClick={handleGenerateAndHost}
            disabled={isGenerating || files.length === 0}
            className="w-full h-16 text-lg font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-500/30 transition-all transform hover:scale-[1.01] active:scale-[0.98]"
          >
            {isGenerating ? (
              <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Се генерира MathKahoot...</>
            ) : (
              <><PlayCircle className="w-6 h-6 mr-3" /> Генерирај и Започни Игра!</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
