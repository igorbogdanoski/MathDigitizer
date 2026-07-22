import React from 'react';
import { MathTask } from '../../../lib/schema';
import { Button } from '../../ui/Button';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { useTaskActions } from '../../../hooks/useTaskActions';
import {
  MessageCircleQuestion, RotateCcw, ArrowUpDown, Sparkles, Brain, Activity,
  Loader2, Plus, Check, Copy, Zap, Cpu, Layers, LayoutDashboard
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type LibraryStore = ReturnType<typeof useLibraryStore.getState>;
type TaskActions = ReturnType<typeof useTaskActions>;

interface TaskActionToolbarProps {
  task: MathTask;
  taskId: string;
  store: LibraryStore;
  actions: TaskActions;
}

export const TaskActionToolbar: React.FC<TaskActionToolbarProps> = ({ task, taskId, store, actions }) => {
  const { t } = useTranslation('library');

  const handleCopyAllText = (task: MathTask, taskId: string) => {
    let fullText = `${t('copyTaskLabel')} ${task.title}\n\n`;
    if (task.grade_level) fullText += `${t('copyGradeLabel')} ${task.grade_level}\n`;
    if (task.curriculum_topic) fullText += `${t('copyTopicLabel')} ${task.curriculum_topic}\n`;
    fullText += `\n${t('copyTextLabel')}\n${task.original_text}\n\n`;
    if (task.hints && task.hints.length > 0) {
      fullText += `${t('copyHintsLabel')}\n${task.hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
    }
    fullText += `${t('solutionLabel')}\n${task.solution_steps.map((s, i) => `${t('stepNumber', { number: i + 1 })}:\n${s}`).join('\n\n')}`;

    navigator.clipboard.writeText(fullText);
    store.setCopiedAllText(taskId);
    setTimeout(() => store.setCopiedAllText(null), 2000);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); store.setActiveTutorTask(task); }}
        className="h-6 px-2 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
      >
        <MessageCircleQuestion className="w-3 h-3 mr-1" />
        {t('aiTutor')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); store.setActiveKnowledgeModelTask(task); }}
        className="h-6 px-2 text-xs bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100"
      >
        <Brain className="w-3 h-3 mr-1" />
        {t('knowledgeModel')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); actions.handleGenerateSimilar(task); }}
        disabled={actions.isGeneratingSimilar[taskId]}
        className="h-6 px-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
      >
        {actions.isGeneratingSimilar[taskId] ? (
          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t('generating')}</>
        ) : (
          <><RotateCcw className="w-3 h-3 mr-1" /> {t('practiceSimilar')}</>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); actions.handleGenerateDifferentiated(task); }}
        disabled={actions.isGeneratingDifferentiated[taskId]}
        className="h-6 px-2 text-xs bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
      >
        {actions.isGeneratingDifferentiated[taskId] ? (
          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t('generating')}</>
        ) : (
          <><ArrowUpDown className="w-3 h-3 mr-1" /> {t('differentiate')}</>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); store.setActiveSolverTask(task); }}
        className="h-6 px-2 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
      >
        <Sparkles className="w-3 h-3 mr-1" />
        {t('solveInteractively')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); actions.handleCreateFlashcard(task); }}
        className="h-6 px-2 text-xs bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
      >
        <Brain className="w-3 h-3 mr-1" />
        {t('createFlashcard')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); store.setIsCommandCenterOpen(true); }}
        className="h-6 px-2 text-xs bg-slate-900 text-slate-100 border-slate-700 hover:bg-slate-800 shadow-lg shadow-indigo-500/10 border-indigo-500/30"
      >
        <Cpu className="w-3 h-3 mr-1 text-indigo-400" />
        {t('commandCenter')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); store.setEditingTask(task); }}
        className="h-6 px-2 text-xs bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
      >
        <Layers className="w-3 h-3 mr-1" />
        {t('architectEditor')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); store.setActiveGraphTask(task); }}
        className="h-6 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
      >
        <Activity className="w-3 h-3 mr-1" />
        {t('graph')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
           e.stopPropagation();
           document.dispatchEvent(new CustomEvent('open-manipulatives', { detail: { type: 'geogebra-3d', task }}));
        }}
        className="h-6 px-2 text-xs bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
      >
        <Layers className="w-3 h-3 mr-1" />
        {t('geometry3d')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
           e.stopPropagation();
           document.dispatchEvent(new CustomEvent('open-manipulatives', { detail: { type: 'algebra-tiles', task }}));
        }}
        className="h-6 px-2 text-xs bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100"
      >
        <LayoutDashboard className="w-3 h-3 mr-1" />
        {t('algebraTilesBtn')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); actions.handleGenerateSimilar(task); }}
        disabled={store.isGeneratingSimilar[taskId]}
        className="h-6 px-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
      >
        {store.isGeneratingSimilar[taskId] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
        {t('cloneSimilar')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); actions.handleGenerateDifferentiated(task); }}
        disabled={store.isGeneratingDifferentiated[taskId]}
        className="h-6 px-2 text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
      >
        {store.isGeneratingDifferentiated[taskId] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ArrowUpDown className="w-3 h-3 mr-1" />}
        {t('groupAB')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); actions.handleModernizeContext(task); }}
        disabled={store.isModernizingContext[taskId]}
        className="h-6 px-2 text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
      >
        {store.isModernizingContext[taskId] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
        {t('modernizeGenZ')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); handleCopyAllText(task, taskId); }}
        className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
      >
        {store.copiedAllText === taskId ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
        {store.copiedAllText === taskId ? t('copiedAll') : t('copyAll')}
      </Button>
    </div>
  );
};
