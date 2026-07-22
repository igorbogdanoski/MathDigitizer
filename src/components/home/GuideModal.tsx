import React from 'react';
import { Info, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'motion/react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Како функционира MathDigitizer Pro?
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Затвори модал"
                title="Затвори"
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Екстракција на задачи</h3>
                  <p className="text-slate-600 dark:text-slate-300">Одете во табулаторот "Екстракција" и внесете линк од YouTube видео со математичко предавање. Нашата вештачка интелигенција ќе ги анализира и извлече сите задачи и теоретски концепти.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Зачувување во Библиотека</h3>
                  <p className="text-slate-600 dark:text-slate-300">Откако задачите ќе бидат извлечени, можете да ги прегледате, да генерирате визуелизации за нив и да ги зачувате во вашата лична "Библиотека" за понатамошна употреба.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Креирање Материјали</h3>
                  <p className="text-slate-600 dark:text-slate-300">Во "Фабрика", изберете ги задачите што ви се потребни и автоматски генерирајте работни листови, тестови или збирки. Можете да ги експортирате во PDF, Word или JSON формат.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Организација (To-Do)</h3>
                  <p className="text-slate-600 dark:text-slate-300">Користете ја секцијата "Задачи (To-Do)" за да ги планирате вашите лекции, да следите кои материјали треба да ги подготвите и да поставувате рокови.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white">
                Разбрав, започни!
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
