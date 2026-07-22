import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink } from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { KnowledgeModelSolver } from './KnowledgeModelSolver';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useTranslation } from 'react-i18next';

interface Props {
  task: MathTask | null;
  onClose: () => void;
}

export const KnowledgeModelModal: React.FC<Props> = ({ task, onClose }) => {
  const modalRef = useModalA11y<HTMLDivElement>(onClose);
  const { t } = useTranslation('library');

  if (!task) return null;

  return (
    <AnimatePresence>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl h-[85vh] flex flex-col bg-slate-50 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={onClose}
              aria-label={t('close')}
              className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Make sure we pass the full task text or just use empty if we want to type it */}
            <KnowledgeModelSolver initialProblem={task.original_text} />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
