import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion } from 'motion/react';

interface AddFlashcardModalProps {
  modalRef: React.RefObject<HTMLDivElement | null>;
  newFront: string;
  newBack: string;
  onFrontChange: (value: string) => void;
  onBackChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const AddFlashcardModal: React.FC<AddFlashcardModalProps> = ({
  modalRef,
  newFront,
  newBack,
  onFrontChange,
  onBackChange,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation('flashcards');
  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('createCard')}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700"
      >
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Plus className="w-6 h-6 text-indigo-600" />
            {t('createCard')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('close')} title={t('close')} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-white dark:bg-slate-800 shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Front Side */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div> {t('termQuestion')}
              </label>
              <textarea
                value={newFront}
                onChange={(e) => onFrontChange(e.target.value)}
                className="w-full h-40 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-500 outline-none resize-none text-base transition-all"
                placeholder={t('frontPlaceholder')}
              />
            </div>
            {/* Back Side */}
            <div className="space-y-2">
               <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> {t('definitionAnswer')}
              </label>
              <textarea
                value={newBack}
                onChange={(e) => onBackChange(e.target.value)}
                className="w-full h-40 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 focus:border-emerald-500 outline-none resize-none text-base transition-all"
                placeholder={t('backPlaceholder')}
              />
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-medium">{t('cancel')}</Button>
          <Button
            onClick={onSave}
            disabled={!newFront.trim() || !newBack.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 font-medium shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            {t('saveToCollection')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
