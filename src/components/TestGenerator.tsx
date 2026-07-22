import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, X, Loader2, CheckCircle2, Settings2, Shuffle, Printer } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MathTask } from '../lib/schema';
import { MathRenderer } from './MathRenderer';
import { useReactToPrint } from 'react-to-print';
import { useModalA11y } from '../hooks/useModalA11y';
import { useTranslation } from 'react-i18next';

interface TestGeneratorProps {
  selectedTasks: MathTask[];
  allTasks?: MathTask[];
  onClose: () => void;
}

export const TestGenerator: React.FC<TestGeneratorProps> = ({ selectedTasks: initialSelectedTasks, allTasks = [], onClose }) => {
  const modalRef = useModalA11y<HTMLDivElement>(onClose);
  const { t } = useTranslation('testGenerator');
  const [selectedTasks, setSelectedTasks] = useState<MathTask[]>(initialSelectedTasks);
  const [title, setTitle] = useState(t('defaults.testTitle'));
  const [schoolName, setSchoolName] = useState('');
  const [teacherName, setTeacherName] = useState(t('defaults.teacherName'));
  const [includeSolutions, setIncludeSolutions] = useState(false);
  const [isDone, setIsDone] = useState(false);
  
  // Layout settings
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [taskSpacing, setTaskSpacing] = useState<'sm' | 'md' | 'lg'>('md');
  
  // Random generation filters
  const [randomCount, setRandomCount] = useState(5);
  const [randomDifficulty, setRandomDifficulty] = useState('all');
  const [randomGrade, setRandomGrade] = useState('all');

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedTasks(initialSelectedTasks);
  }, [initialSelectedTasks]);

  const generateRandomTest = () => {
    let pool = [...allTasks];
    
    if (randomDifficulty !== 'all') {
      pool = pool.filter(t => t.difficulty === randomDifficulty);
    }
    if (randomGrade !== 'all') {
      pool = pool.filter(t => t.grade_level === randomGrade);
    }
    
    // Shuffle array
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    setSelectedTasks(pool.slice(0, randomCount));
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: title.replace(/\s+/g, '_'),
    onAfterPrint: () => setIsDone(true),
  });

  // Get unique grades for the dropdown
  const uniqueGrades = Array.from(new Set(allTasks.map(t => t.grade_level).filter(Boolean))).sort();

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shadow-inner">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-xl">{t('title')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('selectedTasks')} <span className="text-purple-600 font-bold">{selectedTasks.length}</span></p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('closeAriaLabel')} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 rounded-full shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-12 gap-8">
          {/* Settings - Left Column */}
          <div className="md:col-span-4 space-y-6">
            {allTasks.length > 0 && (
              <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl shadow-sm">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 text-sm tracking-wide uppercase">
                  <Shuffle className="w-4 h-4 text-purple-500" />
                  {t('randomTest.title')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">{t('randomTest.taskCount')}</label>
                    <Input 
                      type="number" 
                      min="1" 
                      max="20" 
                      value={randomCount} 
                      onChange={(e) => setRandomCount(parseInt(e.target.value) || 5)}
                      className="h-10 text-sm font-medium bg-white/80 dark:bg-slate-900/80 border-indigo-200/50 shadow-inner rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">{t('randomTest.difficulty')}</label>
                    <select
                      value={randomDifficulty}
                      onChange={(e) => setRandomDifficulty(e.target.value)}
                      className="w-full h-10 rounded-xl border border-indigo-200/50 bg-white/80 dark:bg-slate-900/80 px-3 py-1 text-sm font-medium text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">{t('randomTest.allDifficulties')}</option>
                      <option value="easy">{t('randomTest.easy')}</option>
                      <option value="medium">{t('randomTest.medium')}</option>
                      <option value="hard">{t('randomTest.hard')}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">{t('randomTest.grade')}</label>
                    <select
                      value={randomGrade}
                      onChange={(e) => setRandomGrade(e.target.value)}
                      className="w-full h-10 rounded-xl border border-indigo-200/50 bg-white/80 dark:bg-slate-900/80 px-3 py-1 text-sm font-medium text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">{t('randomTest.allGrades')}</option>
                      {uniqueGrades.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button 
                  onClick={generateRandomTest}
                  variant="default"
                  className="w-full h-10 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md border-none font-bold"
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  {t('randomTest.selectRandom')}
                </Button>
              </div>
            )}

            <div className="space-y-5 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wide text-sm mb-2">
                <Settings2 className="w-4 h-4 text-emerald-500" />
                {t('documentParams.title')}
              </h4>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{t('documentParams.testTitle')}</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('documentParams.testTitlePlaceholder')}
                  className="h-11 rounded-xl bg-white dark:bg-slate-900 shadow-inner font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{t('documentParams.school')}</label>
                <Input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder={t('documentParams.schoolPlaceholder')}
                  className="h-11 rounded-xl bg-white dark:bg-slate-900 shadow-inner font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{t('documentParams.teacher')}</label>
                <Input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder={t('documentParams.teacherPlaceholder')}
                  className="h-11 rounded-xl bg-white dark:bg-slate-900 shadow-inner font-medium"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-2">
                <input 
                  type="checkbox" 
                  id="include-solutions"
                  checked={includeSolutions}
                  onChange={(e) => setIncludeSolutions(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="include-solutions" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  {t('documentParams.includeSolutions')}
                </label>
              </div>

              <div className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{t('documentParams.fontSize')}</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as any)}
                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="sm">{t('documentParams.fontSmall')}</option>
                    <option value="base">{t('documentParams.fontMedium')}</option>
                    <option value="lg">{t('documentParams.fontLarge')}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{t('documentParams.taskSpacing')}</label>
                  <select
                    value={taskSpacing}
                    onChange={(e) => setTaskSpacing(e.target.value as any)}
                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="sm">{t('documentParams.spacingSmall')}</option>
                    <option value="md">{t('documentParams.spacingMedium')}</option>
                    <option value="lg">{t('documentParams.spacingLarge')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                onClick={() => handlePrint()} 
                disabled={selectedTasks.length === 0}
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg font-bold shadow-xl shadow-indigo-900/20 border-none rounded-xl"
              >
                {isDone ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 mr-2" />
                    {t('actions.printed')}
                  </>
                ) : (
                  <>
                    <Printer className="w-6 h-6 mr-2" />
                    {t('actions.savePdf')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Preview - Right Column (Real-time layout preview) */}
          <div className="md:col-span-8 bg-slate-100 dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[60vh] flex justify-center shadow-inner">
            {/* The actual content to be printed */}
            <div 
              ref={printRef}
              className="bg-white w-full max-w-[210mm] shadow-2xl p-10 text-black font-serif print:shadow-none print:p-0 rounded-sm" 
              style={{ minHeight: '297mm' }}
            >
              <div className="border-b-2 border-black pb-4 mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold m-0 mb-1">{title || t('preview.defaultTitle')}</h1>
                    <p className="text-sm m-0">{schoolName || t('preview.defaultSchool')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm m-0">{t('preview.date')}</p>
                    <p className="text-sm m-0 mt-2">{t('preview.student')}</p>
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-600">
                  {t('preview.teacher')} {teacherName || t('documentParams.teacherPlaceholder')} | {t('preview.points')}
                </div>
              </div>

              <div className="flex flex-col gap-8">
                {selectedTasks.length === 0 ? (
                  <div className="text-center text-gray-400 py-10 italic print:hidden">
                    {t('preview.noTasks')}
                  </div>
                ) : (
                  selectedTasks.map((task, i) => (
                    <div key={i} className="break-inside-avoid">
                      <div className={`font-bold mb-2 ${fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'}`}>
                        {t('preview.task', { index: i + 1 })} {task.title}
                      </div>
                      <div className={`leading-relaxed mb-4 ${fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base' : 'text-sm'}`}>
                        <MathRenderer content={task.original_text} />
                      </div>
                      <div className={`border border-dashed border-gray-300 rounded ${taskSpacing === 'sm' ? 'h-16' : taskSpacing === 'lg' ? 'h-40' : 'h-24'}`}></div>
                    </div>
                  ))
                )}
              </div>

              {includeSolutions && selectedTasks.length > 0 && (
                <div className="mt-12 pt-8 border-t-2 border-dashed border-black break-before-page">
                  <h2 className="text-xl font-bold mb-6 text-center">{t('preview.solutionKey')}</h2>
                  <div className="flex flex-col gap-6">
                    {selectedTasks.map((task, i) => (
                      <div key={`sol-${i}`} className="break-inside-avoid">
                        <div className="font-bold text-sm">{t('preview.solution', { index: i + 1 })}</div>
                        <div className="text-sm text-gray-800 mt-2">
                          {task.solution_steps.map((step, sIdx) => (
                            <div key={sIdx} className="mb-1">
                              <MathRenderer content={step} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-10 text-center text-[10px] text-gray-400 print:block hidden">
                {t('preview.footer')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
