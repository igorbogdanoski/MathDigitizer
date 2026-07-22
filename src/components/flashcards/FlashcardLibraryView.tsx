import React from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Calendar, BookOpen, Layers, Trophy, ArrowRight, Plus, Trash2, Activity } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { MathRenderer } from '../MathRenderer';
import { Flashcard } from '../../lib/schema';

interface FlashcardLibraryViewProps {
  flashcards: Flashcard[];
  dueCount: number;
  onStartStudy: () => void;
  onStartQuiz: () => void;
  onShowAddModal: () => void;
  onDeleteFlashcard: (id: string) => void;
}

export const FlashcardLibraryView: React.FC<FlashcardLibraryViewProps> = ({
  flashcards,
  dueCount,
  onStartStudy,
  onStartQuiz,
  onShowAddModal,
  onDeleteFlashcard,
}) => {
  const { t } = useTranslation('flashcards');
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
          <Brain className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
          <p className="text-indigo-100 text-sm font-medium mb-1">{t('yourCollection')}</p>
          <h3 className="text-4xl font-extrabold">{flashcards.length}</h3>
          <p className="text-indigo-100 text-sm mt-4">{t('totalCardsCreated')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
          <Calendar className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 text-emerald-500 transition-transform group-hover:scale-110" />
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t('dueForReviewToday')}</p>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{dueCount}</h3>
          {dueCount > 0 && (
            <Button
              onClick={onStartStudy}
              className="mt-4 w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
              variant="outline"
            >
              {t('startSession')} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
          <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 text-amber-500 transition-transform group-hover:scale-110" />
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
            <BookOpen className="w-5 h-5" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t('interactiveQuiz')}</p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('testKnowledge')}</h3>
          <Button
            onClick={onStartQuiz}
            disabled={flashcards.length < 4}
            className="mt-2 w-full bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 disabled:opacity-50 border border-amber-200 dark:border-amber-800"
            variant="outline"
          >
            {t('quizModeBtn')} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-slate-400" />
          {t('allCards', { count: flashcards.length })}
        </h3>

        {flashcards.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('noSavedCards')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{t('createFirstCard')}</p>
            <Button onClick={onShowAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-6">
              <Plus className="w-5 h-5 mr-2" /> {t('addCard')}
            </Button>
          </div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {flashcards.map((card) => (
              <div key={card.id} className="break-inside-avoid shadow-none">
                <Card className="group hover:-translate-y-1 transition-all duration-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] uppercase font-bold px-2 py-1 rounded">Q&A</div>
                      <button
                        type="button"
                        onClick={() => card.id && onDeleteFlashcard(card.id)}
                        aria-label={t('deleteCard')}
                        title={t('deleteCard')}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        <MathRenderer content={card.front} inline={true} />
                      </div>
                      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">
                        <MathRenderer content={card.back} inline={true} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
