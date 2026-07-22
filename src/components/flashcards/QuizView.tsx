import React from 'react';
import { Trophy, Play, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { motion } from 'motion/react';
import { QuizQuestion } from './types';

interface QuizViewProps {
  quizQuestions: QuizQuestion[];
  quizIndex: number;
  quizScore: number;
  selectedAnswer: string | null;
  isFinished: boolean;
  onAnswer: (answer: string) => void;
  onCancel: () => void;
  onRestart: () => void;
  onBackToLibrary: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  quizQuestions,
  quizIndex,
  quizScore,
  selectedAnswer,
  isFinished,
  onAnswer,
  onCancel,
  onRestart,
  onBackToLibrary,
}) => {
  if (isFinished) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center mt-8"
      >
        <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-12 h-12 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Квизот е завршен!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Освоивте {quizScore} од {quizQuestions.length} поени.
        </p>
        <div className="space-y-3">
          <Button onClick={onRestart} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12">
            <Play className="w-4 h-4 mr-2" /> Обиди се повторно
          </Button>
          <Button variant="outline" onClick={onBackToLibrary} className="w-full rounded-xl h-12">
            Врати се во колекција
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-500 font-medium mb-2">
          <span>Прашање {quizIndex + 1} од {quizQuestions.length}</span>
          <span>Резултат: {quizScore}</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-amber-500"
            initial={{ width: 0 }}
            animate={{ width: `${((quizIndex) / quizQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      <motion.div
        key={quizIndex}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 md:p-12 mb-6"
      >
        <h3 className="text-xl md:text-2xl font-medium text-slate-900 dark:text-white mb-10 text-center">
          <MathRenderer content={quizQuestions[quizIndex].question} />
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizQuestions[quizIndex].options.map((option: string, i: number) => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === quizQuestions[quizIndex].correctAnswer;

            let optionClasses = "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30";

            if (selectedAnswer) {
              if (isSelected && isCorrect) optionClasses = "bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 dark:border-emerald-500 text-emerald-900 dark:text-emerald-100";
              else if (isSelected && !isCorrect) optionClasses = "bg-red-100 dark:bg-red-900/50 border-red-500 dark:border-red-500 text-red-900 dark:text-red-100";
              else if (isCorrect) optionClasses = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"; // highlight right answer
              else optionClasses = "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-50";
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => onAnswer(option)}
                disabled={!!selectedAnswer}
                className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 text-slate-700 dark:text-slate-300 ${optionClasses}`}
              >
                <MathRenderer content={option} inline />
                {selectedAnswer && isCorrect && <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
                {selectedAnswer && isSelected && !isCorrect && <X className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />}
              </button>
            )
          })}
        </div>
      </motion.div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onCancel} className="text-slate-500">
          Откажи квиз
        </Button>
      </div>
    </div>
  );
};
