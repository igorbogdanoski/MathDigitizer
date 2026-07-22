import React from 'react';
import { MathTask } from '../../../lib/schema';
import { Button } from '../../ui/Button';
import { MathRenderer } from '../../MathRenderer';
import { useLibraryStore } from '../../../store/useLibraryStore';
import {
  ChevronDown, ChevronUp, Check, Copy, Play, Pause, RotateCcw, Plus, Loader2
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

type LibraryStore = ReturnType<typeof useLibraryStore.getState>;

interface SolutionStepsViewProps {
  task: MathTask;
  taskId: string;
  store: LibraryStore;
}

export const SolutionStepsView: React.FC<SolutionStepsViewProps> = ({ task, taskId, store }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useTranslation('library');

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleStepSelection = (taskId: string, stepIdx: number) => {
    const current = store.selectedSteps[taskId] ? new Set(store.selectedSteps[taskId]) : new Set<number>();
    if (current.has(stepIdx)) {
      current.delete(stepIdx);
    } else {
      current.add(stepIdx);
    }
    store.setSelectedSteps({ ...store.selectedSteps, [taskId]: current });
  };

  const showSelectedSteps = (taskId: string) => {
    const selected = store.selectedSteps[taskId];
    if (!selected || selected.size === 0) return;

    const next = { ...store.collapsedSteps };
    selected.forEach(idx => {
      next[`${taskId}-${idx}`] = false;
    });
    store.setCollapsedSteps(next);
    store.setSelectedSteps({ ...store.selectedSteps, [taskId]: new Set() });
  };

  const toggleStep = (stepKey: string) => {
    store.setCollapsedSteps({ ...store.collapsedSteps, [stepKey]: !store.collapsedSteps[stepKey] });
  };

  const togglePracticeMode = (taskId: string, task: MathTask) => {
    const isNowPractice = !store.practiceMode[taskId];
    if (isNowPractice) {
      const newCollapsed = { ...store.collapsedSteps };
      task.solution_steps.forEach((_, idx) => {
        newCollapsed[`${taskId}-${idx}`] = true;
      });
      store.setCollapsedSteps(newCollapsed);
      store.setPracticeTimer({ ...store.practiceTimer, [taskId]: 0 });
      store.setTimerActive({ ...store.timerActive, [taskId]: true });
    } else {
      store.setTimerActive({ ...store.timerActive, [taskId]: false });
    }
    store.setPracticeMode({ ...store.practiceMode, [taskId]: isNowPractice });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {task.type === 'theory' ? t('keyPoints') : t('csvSolution')}
        </h3>

        <div className="flex items-center gap-2">
            <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              const allSteps = task.solution_steps.map((step, i) => `${t('stepNumber', { number: i + 1 })}:\n${step}`).join('\n\n');
              navigator.clipboard.writeText(allSteps);
              store.setCopiedText('steps-' + taskId);
              setTimeout(() => store.setCopiedText(null), 2000);
            }}
            className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
          >
            {store.copiedText === 'steps-' + taskId ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
            {store.copiedText === 'steps-' + taskId ? t('copied') : t('copySteps')}
          </Button>
          {store.practiceMode[taskId] && (
            <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-md">
              <span className="text-xs font-mono font-bold text-slate-700 w-10 text-center">
                {formatTime(store.practiceTimer[taskId] || 0)}
              </span>
              <button type="button" title={t('pauseResumeTimer')} aria-label={t('pauseResumeTimer')} onClick={(e) => { e.stopPropagation(); store.setTimerActive({ ...store.timerActive, [taskId]: !store.timerActive[taskId] }); }} className="text-slate-500 hover:text-blue-600">
                {store.timerActive[taskId] ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button type="button" title={t('resetTimer')} aria-label={t('resetTimer')} onClick={(e) => { e.stopPropagation(); store.setPracticeTimer({ ...store.practiceTimer, [taskId]: 0 }); }} className="text-slate-500 hover:text-blue-600">
                <RotateCcw className="w-3 h-3" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const newCollapsed = { ...store.collapsedSteps };
                  task.solution_steps.forEach((_, idx) => {
                    newCollapsed[`${taskId}-${idx}`] = true;
                  });
                  store.setCollapsedSteps(newCollapsed);
                }}
                className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
              >
                {t('resetSteps')}
              </Button>
            </div>
          )}
          <Button
            variant={store.practiceMode[taskId] ? "default" : "outline"}
            size="sm"
            onClick={(e) => { e.stopPropagation(); togglePracticeMode(taskId, task); }}
            className={`h-7 text-xs ${store.practiceMode[taskId] ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-slate-600'}`}
          >
            {t('practiceMode')}
          </Button>
        </div>
      </div>

      {/* Step Navigation */}
      {task.solution_steps.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {task.solution_steps.map((_, stepIdx) => (
            <button
              type="button"
              key={stepIdx}
              onClick={(e) => {
                e.stopPropagation();
                const stepKey = `${taskId}-${stepIdx}`;
                store.setCollapsedSteps({ ...store.collapsedSteps, [stepKey]: false });
                document.getElementById(`step-${stepKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center text-xs font-bold transition-colors"
              title={t('goToStep', { number: stepIdx + 1 })}
            >
              {stepIdx + 1}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {task.solution_steps.map((step, stepIdx) => {
          const stepKey = `${taskId}-${stepIdx}`;
          const isCollapsed = store.collapsedSteps[stepKey];
          const isSelected = store.selectedSteps[taskId]?.has(stepIdx);

          return (
            <div key={stepIdx} id={`step-${stepKey}`} className={`border rounded-lg overflow-hidden transition-all duration-300 ${isSelected ? 'border-blue-300 ring-2 ring-blue-100 bg-blue-50/30' : 'border-slate-100'}`}>
              <div className="flex items-center w-full bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="pl-3 py-2 flex items-center">
                  <input
                    type="checkbox"
                    aria-label={t('selectStep', { number: stepIdx + 1 })}
                    title={t('selectStep', { number: stepIdx + 1 })}
                    checked={isSelected || false}
                    onChange={(e) => { e.stopPropagation(); toggleStepSelection(taskId, stepIdx); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleStep(stepKey); }}
                  className="flex-1 flex items-center justify-between p-2 pl-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                      {stepIdx + 1}
                    </span>
                    <span className="text-xs font-medium text-slate-600">{t('stepNumber', { number: stepIdx + 1 })}</span>
                  </div>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
              {!isCollapsed && (
                <div className="p-3 bg-white border-t border-slate-100">
                  <MathRenderer content={step} className="text-sm text-slate-800" />
                </div>
              )}
            </div>
          );
        })}

        {store.selectedSteps[taskId]?.size > 0 && (
          <div className="pt-2 pb-1 animate-in fade-in slide-in-from-bottom-2">
            <Button
              variant="default"
              size="sm"
              className="w-full text-xs"
              onClick={(e) => { e.stopPropagation(); showSelectedSteps(taskId); }}
            >
              {t('showSelectedSteps', { count: store.selectedSteps[taskId].size })}
            </Button>
          </div>
        )}

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50"
            onClick={async (e) => {
              e.stopPropagation();
              const newStep = window.prompt(t('addStepPrompt'));
              if (newStep && newStep.trim()) {
                try {
                  const { doc, updateDoc } = await import('firebase/firestore');
                  await updateDoc(doc(db, 'tasks', taskId), {
                    solution_steps: [...task.solution_steps, newStep.trim()]
                  });
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
                } catch (err) {
                  console.error("Грешка при додавање чекор:", err);
                  showToast(t('addStepError'), 'error');
                }
              }
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> {t('addStep')}
          </Button>
        </div>
      </div>
    </>
  );
};
