import React, { useState, useEffect, useRef } from 'react';
import { MathRenderer } from './MathRenderer';
import { Card, CardContent } from './ui/Card';
import { 
  Download, X, FileText, CheckCircle2, Layout, BookOpen, Layers, 
  ClipboardList, GraduationCap, Target, Edit3, Save, RotateCcw, PlayCircle, Loader2
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
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  const launchKahoot = async () => {
    if (!user) {
      alert("Мора да сте најавени за да стартувате игра.");
      return;
    }
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

  const exportHighFidelityPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      // Create a temporary container for precision rendering without scrollbars
      const tempContainer = document.createElement('div');
      // Apply rigorous print styling
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm'; // A4 width strictly enforced
      tempContainer.style.backgroundColor = 'white';
      tempContainer.style.color = 'black'; // Force black text for contrast
      
      const clone = printRef.current.cloneNode(true) as HTMLElement;
      
      // Pre-process cloned node to ensure no unwanted elements (like inputs) remain in view state
      const textareas = clone.querySelectorAll('textarea');
      textareas.forEach(ta => {
         const div = document.createElement('div');
         // Use textContent (not innerHTML) to prevent XSS from user-authored form values
         div.textContent = ta.value;
         ta.parentNode?.replaceChild(div, ta);
      });
      
      const inputs = clone.querySelectorAll('input');
      inputs.forEach(input => {
         if(input.type === 'text') {
           const span = document.createElement('span');
           // Use textContent (not innerHTML) to prevent XSS from user-authored form values
           span.textContent = input.value;
           input.parentNode?.replaceChild(span, input);
         }
      });

      tempContainer.appendChild(clone);
      document.body.appendChild(tempContainer);

      // We wait for KaTeX to finish any asynchronous renders
      await new Promise(r => setTimeout(r, 600));

      const canvas = await html2canvas(tempContainer, {
        scale: 3, // Very high resolution for math formulas (Retina quality)
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794 // Approx pixels for 210mm
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      let pageHeight = pdf.internal.pageSize.getHeight();

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Handle multi-page math documents correctly by cutting the canvas
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`MathDigitizer_${editedData.title || type}.pdf`);
    } catch (error) {
      console.error("Грешка при генерирање PDF:", error);
      alert("Не успеав да го генерирам PDF документот. Ве молиме обидете се преку системскиот 'Print -> Save as PDF'.");
    } finally {
      setIsExporting(false);
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
        <div className="space-y-6" ref={printRef}>
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
                        title={`Прашање ${idx + 1}`}
                        aria-label={`Прашање ${idx + 1}`}
                        placeholder="Внеси прашање"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    ) : (
                      <div className="font-bold text-lg dark:text-white"><MathRenderer content={q.question} /></div>
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
                              title={`Опција ${String.fromCharCode(65 + optIdx)} за прашање ${idx + 1}`}
                              aria-label={`Опција ${String.fromCharCode(65 + optIdx)} за прашање ${idx + 1}`}
                              placeholder="Внеси опција"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref={printRef}>
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
                        title={`Предна страна на картичка ${idx + 1}`}
                        aria-label={`Предна страна на картичка ${idx + 1}`}
                        placeholder="Внеси прашање"
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
                        title={`Задна страна на картичка ${idx + 1}`}
                        aria-label={`Задна страна на картичка ${idx + 1}`}
                        placeholder="Внеси решение"
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
        <div className="space-y-12" ref={printRef}>
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
      <div ref={printRef} className="bg-white text-slate-900 p-10 rounded-2xl print:p-0">
        {/* HEADER SECTION FOR PRINT/PDF */}
        <div className="flex flex-col mb-12 border-b-2 border-slate-900 pb-4">
          <div className="flex justify-between items-end mb-4 gap-4">
            <div className="flex-1">
              {isEditing ? (
                <input
                  value={editedData.title}
                  onChange={(e) => updateNestedField('title', e.target.value)}
                  title="Наслов на документ"
                  aria-label="Наслов на документ"
                  className="text-3xl font-black text-slate-900 mb-2 border-b border-indigo-200 focus:border-indigo-500 outline-none w-full bg-indigo-50/50"
                  placeholder="Внесете наслов..."
                />
              ) : (
                <h1 className="text-3xl font-black text-slate-900">{editedData.title}</h1>
              )}
              <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest">{type} • MathDigitizer Pro</p>
            </div>
            <div className="text-right text-sm border-l-2 border-slate-200 pl-4">
              <p className="whitespace-nowrap">Освоени поени: _________ / 100</p>
              <p className="mt-2 whitespace-nowrap">Доделена оценка: _____________</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm mt-4 font-medium text-slate-700">
            <div className="flex items-end border-b border-slate-300 pb-1">
              <span className="w-24">Име:</span>
              <div className="flex-1"></div>
            </div>
            <div className="flex items-end border-b border-slate-300 pb-1">
              <span className="w-24">Одделение:</span>
              <div className="flex-1"></div>
            </div>
            <div className="flex items-end border-b border-slate-300 pb-1">
              <span className="w-24">Презиме:</span>
              <div className="flex-1"></div>
            </div>
            <div className="flex items-end border-b border-slate-300 pb-1">
              <span className="w-24">Датум:</span>
              <div className="flex-1"></div>
            </div>
          </div>
        </div>
        
        {/* MAIN CONTENT */}
        <div className="space-y-10">
          {editedData.sections.map((section: any, idx: number) => (
            <div key={idx} className="space-y-4 relative">
              
              <div className="flex items-start gap-4">
                 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                 </div>
                 <div className="flex-1 pt-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                       {isEditing ? (
                         <input
                           value={section.heading}
                           onChange={(e) => updateNestedField(`sections.${idx}.heading`, e.target.value)}
                           title={`Наслов на секција ${idx + 1}`}
                           aria-label={`Наслов на секција ${idx + 1}`}
                           placeholder="Внеси наслов на секција"
                           className="bg-indigo-50/50 border-b border-indigo-200 focus:border-indigo-500 outline-none font-bold w-full"
                         />
                       ) : (
                         section.heading
                       )}
                    </h3>
                    <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed text-lg">
                      {isEditing ? (
                        <textarea
                          value={section.content}
                          onChange={(e) => updateNestedField(`sections.${idx}.content`, e.target.value)}
                          title={`Содржина на секција ${idx + 1}`}
                          aria-label={`Содржина на секција ${idx + 1}`}
                          placeholder="Внеси содржина"
                          className="w-full bg-amber-50/50 border border-amber-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none h-40"
                        />
                      ) : (
                        <MathRenderer content={section.content} />
                      )}
                    </div>
                 </div>
              </div>
              
              {/* Added explicit spacing for worksheets */}
              {(type === 'worksheet' || type === 'test') && !isEditing && (
                <div className="mt-4 pb-24 border-b border-dashed border-slate-200">
                   {/* This creates physical space for the student to write */}
                </div>
              )}
            </div>
          ))}
        </div>

        {editedData.answerKey && (
          <div className="mt-16 pt-8 border-t-[3px] border-slate-900 page-break-before-always">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
               <Target className="w-5 h-5 text-rose-600" />
               Клуч со решенија (Само за Наставникот)
            </h3>
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl text-slate-800">
              {isEditing ? (
                <textarea
                  value={editedData.answerKey}
                  onChange={(e) => updateNestedField('answerKey', e.target.value)}
                  title="Клуч со решенија"
                  aria-label="Клуч со решенија"
                  placeholder="Внеси клуч со решенија"
                  className="w-full bg-white border border-slate-300 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none h-64"
                />
              ) : (
                <div className="prose prose-slate max-w-none prose-lg">
                  <MathRenderer content={editedData.answerKey} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-slate-100 dark:bg-slate-900 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-5xl my-8 border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Toolbar */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-800 sticky top-0 z-10 gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                type === 'worksheet' ? 'bg-blue-50 text-blue-600' :
                type === 'test' ? 'bg-rose-50 text-rose-600' :
                type === 'quiz' ? 'bg-purple-50 text-purple-600' :
                'bg-slate-100 text-slate-600'
            }`}>
              {getIcon()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Механика за уредување' : 'Документ - Матичен Преглед'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isEditing ? 'Модифицирајте ги полињата пред финалниот експорт.' : 'Прегледајте го генерираниот резултат.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
              className={`${isEditing ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600'} rounded-xl h-11`}
            >
              {isEditing ? <><Save className="w-4 h-4 mr-2" />Зачувај</> : <><Edit3 className="w-4 h-4 mr-2" />Уреди Текст</>}
            </Button>

            {type === 'quiz' && (
              <Button onClick={launchKahoot} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 rounded-xl h-11">
                <PlayCircle className="w-4 h-4 mr-2" />
                Live Quiz
              </Button>
            )}
            
            <Button
              onClick={exportHighFidelityPDF}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 rounded-xl h-11"
            >
              {isExporting ? (
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {isExporting ? 'Конвертирање...' : 'Зачувај како PDF'}
            </Button>
            
            <button onClick={onClose} title="Затвори преглед" aria-label="Затвори преглед" className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 rounded-xl transition-all ml-2 bg-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.02)_100%)] dark:bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.01)_100%)]">
          <div className="max-w-4xl mx-auto shadow-2xl rounded-2xl overflow-hidden ring-1 ring-slate-900/5">
            {renderContent()}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
