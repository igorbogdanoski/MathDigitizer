import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Button } from '../ui/Button';

export interface InterventionPlanModalProps {
  plan: string | null;
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  modalRef: React.RefObject<HTMLDivElement | null>;
}

export const InterventionPlanModal: React.FC<InterventionPlanModalProps> = ({ plan, isOpen, onClose, studentId, modalRef }) => {
  const { t } = useTranslation('analytics');
  return (
    <AnimatePresence>
      {isOpen && plan && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('modal.title')}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
        >
          <motion.div
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
             onClick={onClose}
          />
          <motion.div
             initial={{ opacity: 0, scale: 0.95, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.95, y: 20 }}
             className="relative w-full max-w-5xl bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-5xl shadow-2xl flex flex-col h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10"
          >
            <div className="px-8 py-6 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-500/10 backdrop-blur-sm flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-2xl font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-3">
                  <Compass className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  {t('modal.title')}
                </h3>
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-sm">
                    {t('modal.subject')} <span className="text-indigo-900 dark:text-indigo-100 border-b border-indigo-300 dark:border-indigo-700 ml-1">{studentId}</span>
                  </p>
                  <p className="text-[10px] font-mono text-white bg-indigo-600 px-2.5 py-1.5 rounded uppercase tracking-widest shadow-sm">
                    {t('modal.didacticScript')}
                  </p>
                </div>
              </div>
               <button onClick={onClose} aria-label={t('modal.closeAria')} title={t('modal.closeAria')} className="p-3 bg-white dark:bg-white/5 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-transparent text-slate-800 dark:text-slate-200 text-sm md:text-base markdown-body prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-indigo-950 dark:prose-headings:text-indigo-300 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-strong:text-indigo-900 dark:prose-strong:text-indigo-100 prose-ul:marker:text-indigo-500 dark:prose-ul:marker:text-indigo-400 prose-li:pl-2">
               <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                 {plan}
               </ReactMarkdown>
            </div>
            <div className="px-8 py-6 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex justify-between items-center shrink-0 rounded-b-5xl">
               <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden md:block uppercase tracking-widest font-medium">
                 <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                 {t('modal.methodologyEngine')}
               </div>
               <div className="flex justify-end gap-4 w-full md:w-auto">
                 <Button onClick={onClose} variant="outline" className="rounded-xl font-bold px-6 h-12 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200 dark:border-white/15 dark:text-slate-200">{t('modal.closePlan')}</Button>
                 <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-6 h-12 shadow-[0_4px_14px_rgba(79,70,229,0.39)] transition-transform hover:scale-105 active:scale-95">
                   {t('modal.exportPdf')}
                 </Button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
