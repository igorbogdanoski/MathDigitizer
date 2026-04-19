import React, { useState, useEffect } from 'react';
import { MathRenderer } from './MathRenderer';
import { Card, CardContent } from './ui/Card';
import { 
  Download, X, FileText, CheckCircle2, Layout, BookOpen, Layers, 
  ClipboardList, GraduationCap, Target, Edit3, Save, RotateCcw, PlayCircle
} from 'lucide-react';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialType } from '../lib/gemini';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface MaterialPreviewProps {
  type: MaterialType;
  data: any;
  onClose: () => void;
  onDownload: (finalData: any) => void;
}

export const MaterialPreview: React.FC<MaterialPreviewProps> = ({ type, data, onClose, onDownload }) => {
  const [editedData, setEditedData] = useState<any>(JSON.parse(JSON.stringify(data)));
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const launchKahoot = async () => {
    if (!user) {
      alert("Мора да сте најавени за да стартувате игра.");
      return;
    }
    // Generate 6 digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      await setDoc(doc(db, 'live_sessions', pin), {
        id: pin,
        teacher_uid: user.uid,
        quiz_data: editedData,
        status: 'lobby',
        current_question_index: 0,
        participants: {},
        created_at: Date.now()
      });
      navigate(`/live/${pin}/host`);
    } catch (e) {
      console.error(e);
      alert("Грешка при стартување на сесијата.");
    }
  };

  useEffect(() => {
    setEditedData(JSON.parse(JSON.stringify(data)));
  }, [data]);

  const updateNestedField = (path: string, value: any) => {
    const newData = JSON.parse(JSON.stringify(editedData));
    const parts = path.split('.');
    let current = newData;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    setEditedData(newData);
  };
  const getIcon = () => {
    switch (type) {
      case 'worksheet': return <FileText className="w-6 h-6 text-blue-600" />;
      case 'test': return <Target className="w-6 h-6 text-red-600" />;
      case 'collection': return <BookOpen className="w-6 h-6 text-green-600" />;
      case 'quiz': return <CheckCircle2 className="w-6 h-6 text-purple-600" />;
      case 'presentation': return <Layout className="w-6 h-6 text-orange-600" />;
      case 'flashcards': return <Layers className="w-6 h-6 text-pink-600" />;
      case 'homework': return <ClipboardList className="w-6 h-6 text-teal-600" />;
      case 'study_guide': return <GraduationCap className="w-6 h-6 text-yellow-600" />;
    }
  };

  const renderContent = () => {
    if (type === 'quiz') {
      return (
        <div className="space-y-6">
          {editedData.questions.map((q: any, idx: number) => (
            <Card key={idx} className="border-slate-200 dark:border-slate-700 dark:bg-slate-800">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-4">
                    {isEditing ? (
                      <textarea
                        value={q.question}
                        onChange={(e) => updateNestedField(`questions.${idx}.question`, e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    ) : (
                      <p className="font-bold text-lg dark:text-white"><MathRenderer content={q.question} /></p>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt: string, optIdx: number) => (
                        <div 
                          key={optIdx} 
                          className={`p-3 rounded-lg border flex items-center gap-3 ${
                            optIdx === q.correctIndex 
                              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="font-bold uppercase text-xs opacity-50">{String.fromCharCode(65 + optIdx)})</span>
                          {isEditing ? (
                            <input
                              value={opt}
                              onChange={(e) => updateNestedField(`questions.${idx}.options.${optIdx}`, e.target.value)}
                              className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
                            />
                          ) : (
                            <MathRenderer content={opt} />
                          )}
                          {optIdx === q.correctIndex && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (type === 'flashcards') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {editedData.cards.map((card: any, idx: number) => (
            <div key={idx} className="group h-80 [perspective:1000px]">
              <div className="relative h-full w-full transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                {/* Front */}
                <Card className="absolute inset-0 h-full w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 [backface-visibility:hidden]">
                  <CardContent className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Предна страна</span>
                    {isEditing ? (
                      <textarea
                        value={card.front}
                        onChange={(e) => updateNestedField(`cards.${idx}.front`, e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                      />
                    ) : (
                      <div className="text-lg font-medium dark:text-white">
                        <MathRenderer content={card.front} />
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* Back */}
                <Card className="absolute inset-0 h-full w-full bg-indigo-600 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <CardContent className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-4">Задна страна (Решение)</span>
                    {isEditing ? (
                      <textarea
                        value={card.back}
                        onChange={(e) => updateNestedField(`cards.${idx}.back`, e.target.value)}
                        className="w-full bg-indigo-700 border border-indigo-500 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-white/30 outline-none h-32"
                      />
                    ) : (
                      <div className="text-lg">
                        <MathRenderer content={card.back} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (type === 'presentation') {
      return (
        <div className="space-y-12">
          {data.slides.map((slide: any, idx: number) => (
            <Card key={idx} className="overflow-hidden border-slate-200 shadow-xl max-w-3xl mx-auto aspect-video flex flex-col bg-white">
              <div className={`h-2 ${
                slide.type === 'theory' ? 'bg-blue-500' : 
                slide.type === 'example' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></div>
              <CardContent className="p-10 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">{slide.title}</h3>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    Слајд {idx + 1} • {slide.type === 'theory' ? 'Теорија' : slide.type === 'example' ? 'Пример' : 'Задачa'}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center text-xl text-slate-700">
                  <MathRenderer content={slide.content} />
                </div>
                <div className="mt-8 text-[10px] text-slate-300 font-mono text-center">
                  MathDigitizer Pro • {new Date().toLocaleDateString('mk-MK')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // Default rendering for worksheet, test, collection, homework, study_guide, quiz
    return (
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm relative print:shadow-none print:border-none print:w-[210mm] print:mx-auto">
        {/* PRINT ONLY HEADER */}
        <div className="hidden print:flex flex-col mb-12 border-b-2 border-slate-900 pb-4">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900">{editedData.title}</h1>
              <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest">{type} • MathDigitizer Pro</p>
            </div>
            <div className="text-right text-sm">
              <p>Освоени поени: ______ / 100</p>
              <p className="mt-1">Оценка: ____________</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm mt-4 font-medium text-slate-700">
            <div className="space-y-4">
              <div className="flex items-end border-b border-slate-300 pb-1">
                <span className="w-24">Име:</span>
                <div className="flex-1"></div>
              </div>
              <div className="flex items-end border-b border-slate-300 pb-1">
                <span className="w-24">Презиме:</span>
                <div className="flex-1"></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-end border-b border-slate-300 pb-1">
                <span className="w-24">Одделение:</span>
                <div className="flex-1"></div>
              </div>
              <div className="flex items-end border-b border-slate-300 pb-1">
                <span className="w-24">Датум:</span>
                <div className="flex-1"></div>
              </div>
            </div>
          </div>
        </div>
        
        <CardContent className="p-10 print:p-0 space-y-8">
          <div className="text-center border-b border-slate-100 dark:border-slate-700 pb-8 print:hidden">
            {isEditing ? (
              <input
                value={editedData.title}
                onChange={(e) => updateNestedField('title', e.target.value)}
                className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 text-center bg-transparent border-none focus:ring-0 w-full"
              />
            ) : (
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{editedData.title}</h2>
            )}
            <p className="text-slate-500 dark:text-slate-400">Алгоритмички генериран {type} • MathDigitizer Pro</p>
          </div>

          <div className="space-y-8">
            {editedData.sections.map((section: any, idx: number) => (
              <div key={idx} className="space-y-4">
                <h3 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                   {isEditing ? (
                     <input
                       value={section.heading}
                       onChange={(e) => updateNestedField(`sections.${idx}.heading`, e.target.value)}
                       className="bg-transparent border-none focus:ring-0 font-bold"
                     />
                   ) : (
                     section.heading
                   )}
                </h3>
                <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed">
                  {isEditing ? (
                    <textarea
                      value={section.content}
                      onChange={(e) => updateNestedField(`sections.${idx}.content`, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-40"
                    />
                  ) : (
                    <MathRenderer content={section.content} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {editedData.answerKey && (
            <div className="mt-12 pt-8 border-t border-dashed border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-400 mb-4 uppercase tracking-widest">Клуч со решенија (За наставникот)</h3>
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl text-sm italic text-slate-600 dark:text-slate-400">
                {isEditing ? (
                  <textarea
                    value={editedData.answerKey}
                    onChange={(e) => updateNestedField('answerKey', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 outline-none h-32 italic"
                  />
                ) : (
                  <MathRenderer content={editedData.answerKey} />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-slate-50 dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl my-8 border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Уредување на материјалот' : 'Преглед на материјалот'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isEditing ? 'Направете ги крајните корекции' : 'Проверете го изгледот пред преземање'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
              className={`${isEditing ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Зачувај
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Уреди
                </>
              )}
            </Button>

            {type === 'quiz' && (
              <Button onClick={launchKahoot} className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
                <PlayCircle className="w-4 h-4 mr-2" />
                Start Live MathKahoot
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="text-slate-600 dark:text-slate-300 hidden md:flex"
            >
              <FileText className="w-4 h-4 mr-2" />
              Печати / PDF
            </Button>
            
            <Button onClick={() => onDownload(editedData)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
              <Download className="w-4 h-4 mr-2" />
              Преземи JSON
            </Button>
            
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-8 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
          <div className="max-w-4xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
