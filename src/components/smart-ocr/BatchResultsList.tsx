import React from 'react';
import {
  Copy, Check, Loader2, Save, Images
} from 'lucide-react';
import { Button } from '../ui/Button';
import { MathTask } from '../../lib/schema';

interface BatchResultsListProps {
  batchTasks: MathTask[];
  batchProgress: { done: number; total: number } | null;
  batchCopied: number | null;
  isSaving: boolean;
  onCopyTask: (task: MathTask, index: number) => void;
  onSaveAll: () => void;
}

export const BatchResultsList: React.FC<BatchResultsListProps> = ({
  batchTasks,
  batchCopied,
  isSaving,
  onCopyTask,
  onSaveAll,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="w-5 h-5 text-indigo-500" />
          <span className="font-bold text-slate-800 dark:text-slate-200">Batch резултати: {batchTasks.length} задачи</span>
        </div>
        <Button
          size="sm"
          onClick={onSaveAll}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Зачувај ги сите
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {batchTasks.map((t, i) => (
          <div key={i} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 line-clamp-2 flex-1">{t.title}</span>
              <button
                type="button"
                onClick={() => onCopyTask(t, i)}
                className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${batchCopied === i ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}`}
                title="Копирај LaTeX"
                aria-label="Копирај LaTeX"
              >
                {batchCopied === i ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${t.difficulty === 'easy' ? 'bg-green-100 text-green-700' : t.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{t.difficulty}</span>
              {t.tags?.slice(0, 2).map((tag, ti) => (
                <span key={ti} className="text-[9px] font-medium uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{t.original_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
