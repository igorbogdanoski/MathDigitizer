import React from 'react';
import { MathTask } from '../../../lib/schema';
import { Button } from '../../ui/Button';
import { MathRenderer } from '../../MathRenderer';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { Brain } from 'lucide-react';
import { cosineSimilarity } from '../../../lib/ragContext';
import { useTranslation } from 'react-i18next';

type LibraryStore = ReturnType<typeof useLibraryStore.getState>;

interface RelatedTasksSectionProps {
  task: MathTask;
  store: LibraryStore;
}

export const RelatedTasksSection: React.FC<RelatedTasksSectionProps> = ({ task, store }) => {
  const { t } = useTranslation('library');

  if (!task.embedding || !store.tasks || store.tasks.length <= 1) return null;

  return (
    <div className="md:col-span-2 pt-6 mt-4 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-purple-500" />
        <h3 className="text-sm font-bold text-slate-800">{t('relatedTasksTitle')}</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full ml-2">
              {t('semanticSearchBadge')}
            </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {store.tasks
          .filter(t => t.id !== task.id && t.embedding) // Exclude current and non-embedded
          .map(t => ({
            task: t,
            score: cosineSimilarity(task.embedding!, t.embedding!)
          }))
          .filter(t => t.score > 0.4) // Threshold
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(({ task: relatedTask, score }) => (
            <div key={relatedTask.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 font-mono text-[10px] font-bold select-none pointer-events-none">
                {t('matchBadge', { percent: (score * 100).toFixed(1) })}
              </div>
              <h4 className="font-bold text-xs text-slate-700 mb-2 truncate pr-16">{relatedTask.title}</h4>
              <div className="text-[11px] text-slate-500 line-clamp-2 mb-3 h-8">
                <MathRenderer content={relatedTask.original_text} />
              </div>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex gap-1 overflow-hidden flex-wrap max-h-6">
                   {relatedTask.tags?.slice(0, 2).map(tag => (
                     <span key={tag} className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded truncate max-w-[60px]">{tag}</span>
                   ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                     e.stopPropagation();
                     store.setSelectedTaskId(relatedTask.id!);
                     document.getElementById(`task-card-${relatedTask.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="h-6 text-[10px] text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 shrink-0"
                >
                  {t('view')}
                </Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
