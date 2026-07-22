import React from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion, AnimatePresence } from 'motion/react';

interface StickyBottomCtaProps {
  isVisible: boolean;
  onDismiss: () => void;
  onSignUp: () => void;
}

export const StickyBottomCta: React.FC<StickyBottomCtaProps> = ({ isVisible, onDismiss, onSignUp }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ delay: 2.5, duration: 0.5, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-5 py-3.5 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-[0_-4px_30px_rgba(79,70,229,0.25)] sm:px-8"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm text-slate-200 font-medium truncate">
              <span className="text-white font-bold">Бесплатна регистрација</span> — пробај ги сите core функции веднаш.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={onSignUp}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl px-5 h-9"
            >
              Започни
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Затвори ја оваа порака"
              title="Затвори"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
