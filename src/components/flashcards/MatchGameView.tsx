import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Trophy } from 'lucide-react';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { motion, AnimatePresence } from 'motion/react';
import { MatchItem } from './types';

interface MatchGameViewProps {
  matchItems: MatchItem[];
  selectedMatch: string | null;
  matchTimeElapsed: number;
  isMatchFinished: boolean;
  onMatchClick: (item: MatchItem) => void;
  onRestart: () => void;
  onExit: () => void;
}

export const MatchGameView: React.FC<MatchGameViewProps> = ({
  matchItems,
  selectedMatch,
  matchTimeElapsed,
  isMatchFinished,
  onMatchClick,
  onRestart,
  onExit,
}) => {
  const { t } = useTranslation('flashcards');
  return (
    <div className="max-w-4xl mx-auto pt-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-sky-500" />
          {t('matchGameTitle')}
        </h2>
        <div className="text-xl font-mono text-slate-600 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl">
          {matchTimeElapsed.toFixed(1)}s
        </div>
      </div>

      {isMatchFinished ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-slate-800 p-10 rounded-3xl text-center shadow-xl border border-slate-200 dark:border-slate-700 mt-8"
        >
          <div className="w-24 h-24 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-12 h-12 text-sky-500" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{t('bravo')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm mx-auto">
            {t('matchComplete', { time: matchTimeElapsed.toFixed(1) })}
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={onRestart} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl h-12 px-8">
              {t('playAgain')}
            </Button>
            <Button variant="outline" onClick={onExit} className="rounded-xl h-12 px-8">
              {t('toCollection')}
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {matchItems.map(item => (
              !item.isMatched && (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  onClick={() => onMatchClick(item)}
                  className={`cursor-pointer p-4 h-32 flex items-center justify-center text-center rounded-2xl border-2 transition-all duration-200 shadow-sm
                    ${selectedMatch === item.id
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 ring-4 ring-sky-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
                    }
                  `}
                >
                  <div className="text-sm font-medium">
                    <MathRenderer content={item.text} inline />
                  </div>
                </motion.div>
              )
            ))}
          </AnimatePresence>
        </div>
      )}
      <div className="flex justify-center mt-8">
        <Button variant="ghost" onClick={onExit} className="text-slate-500">
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
};
