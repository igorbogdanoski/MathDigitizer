import React from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, CheckCircle2, XCircle, RotateCcw, Trophy, X, Undo2, Volume2, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { Flashcard } from '../../lib/schema';
import { motion, AnimatePresence } from 'motion/react';
import { SessionStats } from './types';
import { ReviewGrade } from '../../lib/fsrsLite';

interface FlashcardStudyViewProps {
  studyCards: Flashcard[];
  currentIndex: number;
  isFlipped: boolean;
  onFlip: () => void;
  onReview: (grade: ReviewGrade) => void;
  onExit: () => void;
  /** Reads the visible side aloud; omitted where TTS is unavailable. */
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
}

export const FlashcardStudyView: React.FC<FlashcardStudyViewProps> = ({
  studyCards,
  currentIndex,
  isFlipped,
  onFlip,
  onReview,
  onExit,
  onSpeak,
  isSpeaking,
}) => {
  const { t } = useTranslation('flashcards');
  return (
    <div className="max-w-3xl mx-auto relative pt-4">
      {/* Study Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center text-sm font-medium text-slate-400 dark:text-slate-500 mb-3">
          <span className="flex items-center gap-2">
            <Brain className="w-4 h-4" /> {t('studySession')}
          </span>
          <span>{currentIndex + 1} / {studyCards.length}</span>
        </div>
        <div className="flex gap-1 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300 [width:var(--progress-width)]"
            style={{ '--progress-width': `${(currentIndex / studyCards.length) * 100}%` } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Flashcard 3D Scene */}
      <div
        className="relative h-[400px] perspective-1000 cursor-pointer"
        onClick={onFlip}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full h-full absolute inset-0"
          >
            <motion.div
              className="w-full h-full relative transition-all duration-500 preserve-3d"
              animate={{ rotateX: isFlipped ? 180 : 0 }}
            >
              {/* Front Face */}
              <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-8 sm:p-12 text-center overflow-auto">
                <div className="absolute top-6 left-6 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400"></div> {t('question')}
                </div>
                <div className="text-2xl sm:text-3xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed mt-4">
                  <MathRenderer content={studyCards[currentIndex].front} />
                </div>
                <div className="absolute bottom-6 text-slate-400 font-medium text-sm flex items-center gap-2 animate-pulse bg-slate-50 dark:bg-slate-800/80 px-4 py-2 rounded-full">
                  {t('clickOrSpace')}
                </div>
              </div>

              {/* Back Face */}
              <div className="absolute inset-0 backface-hidden bg-indigo-50 dark:bg-indigo-950/20 rounded-3xl shadow-xl border-2 border-indigo-200 dark:border-indigo-800 flex flex-col items-center justify-center p-8 sm:p-12 text-center rotate-x-180 overflow-auto">
                <div className="absolute top-6 left-6 text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div> {t('answer')}
                </div>
                <div className="text-xl sm:text-2xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed mt-4">
                  <MathRenderer content={studyCards[currentIndex].back} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        {!isFlipped ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('tryAnswerFirst')}</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReview('again'); }}
              className="flex-1 sm:flex-none flex flex-col items-center justify-center px-5 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 transition-colors group"
            >
              <Undo2 className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" aria-hidden="true" />
              <span className="text-xs font-bold">{t('again1')}</span>
            </button>
            <div className="w-px h-10 bg-slate-100 dark:bg-slate-700 mx-2"></div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReview('hard'); }}
              className="flex-1 sm:flex-none flex flex-col items-center justify-center px-5 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors group"
            >
              <XCircle className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" aria-hidden="true" />
              <span className="text-xs font-bold">{t('hard2')}</span>
            </button>
            <div className="w-px h-10 bg-slate-100 dark:bg-slate-700 mx-2"></div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReview('good'); }}
              className="flex-1 sm:flex-none flex flex-col items-center justify-center px-5 py-3 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 transition-colors group"
            >
              <RotateCcw className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" aria-hidden="true" />
              <span className="text-xs font-bold">{t('good3')}</span>
            </button>
            <div className="w-px h-10 bg-slate-100 dark:bg-slate-700 mx-2"></div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReview('easy'); }}
              className="flex-1 sm:flex-none flex flex-col items-center justify-center px-5 py-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors group"
            >
              <CheckCircle2 className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" aria-hidden="true" />
              <span className="text-xs font-bold">{t('easy4')}</span>
            </button>
          </motion.div>
        )}
      </div>

      <div className="absolute top-0 right-[-60px] hidden lg:flex flex-col gap-2">
         {onSpeak && studyCards[currentIndex] && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('speakCard')}
              title={t('speakCard')}
              disabled={isSpeaking}
              className="rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              onClick={() => onSpeak(isFlipped ? studyCards[currentIndex].back : studyCards[currentIndex].front)}
            >
              {isSpeaking
                ? <Loader2 className="w-5 h-5 text-slate-500 animate-spin" aria-hidden="true" />
                : <Volume2 className="w-5 h-5 text-slate-500" aria-hidden="true" />}
            </Button>
         )}
         <Button variant="ghost" size="sm" aria-label={t('cancelSession')} className="rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100" onClick={onExit}>
            <X className="w-5 h-5 text-slate-500" aria-hidden="true" />
         </Button>
      </div>
      <div className="mt-8 flex justify-center lg:hidden">
         <Button variant="ghost" className="text-slate-500" onClick={onExit}>{t('cancelSession')}</Button>
      </div>
    </div>
  );
};

interface StudyCompletionViewProps {
  sessionStats: SessionStats;
  onBackToLibrary: () => void;
}

export const StudyCompletionView: React.FC<StudyCompletionViewProps> = ({
  sessionStats,
  onBackToLibrary,
}) => {
  const { t } = useTranslation('flashcards');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-gradient-to-b from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 p-10 rounded-3xl border border-indigo-100 dark:border-slate-700 shadow-xl text-center mt-8"
    >
      <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
        <Trophy className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{t('excellentSession')}</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm mx-auto">
        {t('sessionCompleteDesc')}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{sessionStats.reviewed}</div>
          <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">{t('reviewed')}</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-800/50">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{sessionStats.easy + sessionStats.good}</div>
          <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest font-bold mt-1">{t('learned')}</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-800/50">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{sessionStats.hard}</div>
          <div className="text-xs text-amber-600/70 dark:text-amber-400/70 uppercase tracking-widest font-bold mt-1">{t('hardCards')}</div>
        </div>
      </div>

      <Button
        onClick={onBackToLibrary}
        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 h-12"
      >
        {t('backToLibrary')}
      </Button>
    </motion.div>
  );
};
