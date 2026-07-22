import React from 'react';
import { useTranslation } from 'react-i18next';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { GeoGebraViewer } from '../GeoGebraViewer';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useTaskActions } from '../../hooks/useTaskActions';
import {
  Loader2, ChevronDown, ChevronUp, Image as ImageIcon,
  Check, Copy, Info, AlertTriangle, Brain, Compass,
  Zap, LayoutDashboard
} from 'lucide-react';
import { TaskActionToolbar, PedagogicalInsightsPanel, SolutionStepsView, RelatedTasksSection } from './task-detail';

interface TaskDetailViewProps {
  task: MathTask;
  taskId: string;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task, taskId }) => {
  const { t } = useTranslation(['library', 'common']);
  const store = useLibraryStore();
  const actions = useTaskActions();

  const togglePrompt = (id: string) => {
    store.setExpandedPrompts({ ...store.expandedPrompts, [id]: !store.expandedPrompts[id] });
  };

  const handleCopyFormula = (formula: string) => {
    navigator.clipboard.writeText(`$$${formula}$$`);
    store.setCopiedFormula(formula);
    setTimeout(() => store.setCopiedFormula(null), 2000);
  };

  return (
    <div className="grid md:grid-cols-2 gap-8" data-testid={`task-detail-${taskId}`}>
      {/* Left Column: Original Text */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {task.type === 'theory' ? 'Теоретско Објаснување' : 'Текст на задачата'}
            </h3>

            {/* World-Class DoK Indicator */}
            <div className="flex items-center gap-1.5 ml-4 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">DoK Level</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(l => (
                  <div
                    key={l}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      l <= (task.dok_level || 1)
                        ? (task.dok_level === 4 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-emerald-500')
                        : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-700 ml-1">L{task.dok_level || 1}</span>
            </div>

            <div className="flex-1" />

            <TaskActionToolbar task={task} taskId={taskId} store={store} actions={actions} />
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-2 mb-3">
            {task.grade_level && (
              <span className="text-[10px] font-medium uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                Одделение: {task.grade_level}
              </span>
            )}
            {task.curriculum_topic && (
              <span className="text-[10px] font-medium uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                Тема: {task.curriculum_topic}
              </span>
            )}
          </div>

          <div className="text-slate-700 text-sm leading-relaxed">
            <MathRenderer content={task.original_text} />
          </div>

          {/* Pedagogical Insights (Cognitive Autopsy) */}
          <PedagogicalInsightsPanel task={task} taskId={taskId} store={store} actions={actions} />

          {/* Hints */}
          {task.hints && task.hints.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Помош (Hints)</h4>
              <div className="flex flex-col gap-2">
                {task.hints.map((hint, hIdx) => (
                  <div key={hIdx} className="bg-amber-50 border border-amber-100 p-2 rounded text-xs text-amber-800">
                    <span className="font-bold mr-1">{hIdx + 1}.</span>
                    <MathRenderer content={hint} inline />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags and Formulas */}
          {task.tags && task.tags.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Тагови</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); actions.handleGenerateTagFormulas(task, taskId); }}
                  disabled={actions.isGeneratingTagFormulas[taskId]}
                  className="h-6 px-2 text-[10px] text-blue-600 hover:bg-blue-50"
                >
                  {actions.isGeneratingTagFormulas[taskId] ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Се генерираат формули...</>
                  ) : (
                    'Прикажи формули за тагови'
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag, tIdx) => (
                  <div key={tIdx} className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-center">
                      {tag}
                    </span>
                    {actions.tagFormulas[taskId] && actions.tagFormulas[taskId][tag] && (
                      <div className="bg-slate-50 border border-slate-200 p-1 rounded text-center min-w-[60px]">
                        <MathRenderer content={`$$${actions.tagFormulas[taskId][tag]}$$`} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instructor Scaffolding Section */}
        {((task.pedagogical_insights?.common_pitfalls.length || 0) > 0 || (task.pedagogical_insights?.socratic_questions.length || 0) > 0) && (
          <div className="bg-indigo-50/30 border border-indigo-100 rounded-2xl overflow-hidden mt-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); togglePrompt(`scaffolding-${taskId}`); }}
              className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-indigo-500" />
                <div className="text-left">
                  <h3 className="text-sm font-bold text-indigo-900 leading-tight">Педагошка Поддршка (Инструктор)</h3>
                  <p className="text-[10px] text-indigo-500 uppercase font-bold tracking-wider">Сократови прашања и вообичаени грешки</p>
                </div>
              </div>
              {store.expandedPrompts[`scaffolding-${taskId}`] ? (
                <ChevronUp className="w-4 h-4 text-indigo-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-indigo-400" />
              )}
            </button>

            {store.expandedPrompts[`scaffolding-${taskId}`] && (
              <div className="p-5 border-t border-indigo-100 space-y-6 bg-white/50">
                {task.pedagogical_insights?.common_pitfalls.length! > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] flex items-center gap-2">
                       <AlertTriangle className="w-3 h-3 text-red-500" />
                       Вообичаени заблуди
                    </h4>
                    <div className="grid gap-2">
                      {task.pedagogical_insights?.common_pitfalls.map((p, i) => (
                        <div key={i} className="flex gap-3 text-xs text-slate-600 bg-red-50/30 p-2 rounded-lg border border-red-100">
                          <span className="text-red-400 font-bold">•</span>
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {task.pedagogical_insights?.socratic_questions.length! > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] flex items-center gap-2">
                       <Compass className="w-3 h-3 text-indigo-500" />
                       Сократови (водечки) прашања
                    </h4>
                    <div className="space-y-2">
                      {task.pedagogical_insights?.socratic_questions.map((q, i) => (
                        <div key={i} className="relative pl-4 py-1">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500/20 rounded-full" />
                          <p className="text-xs text-indigo-800 italic leading-relaxed">
                            "{q}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {task.pedagogical_insights?.differentiated_learning && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 print:block print:space-y-4">
                    {task.pedagogical_insights.differentiated_learning.support && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.1em] flex items-center gap-2">
                           <LayoutDashboard className="w-3 h-3 text-amber-500" />
                           Поддршка (Tier 2/3)
                        </h4>
                        <div className="text-xs text-slate-700 bg-amber-50/50 p-3 rounded-xl border border-amber-200 leading-relaxed font-medium">
                          {task.pedagogical_insights.differentiated_learning.support}
                        </div>
                      </div>
                    )}
                    {task.pedagogical_insights.differentiated_learning.extension && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-fuchsia-600 uppercase tracking-[0.1em] flex items-center gap-2">
                           <Zap className="w-3 h-3 text-fuchsia-500" />
                           Проширување (Напредни)
                        </h4>
                        <div className="text-xs text-slate-700 bg-fuchsia-50/50 p-3 rounded-xl border border-fuchsia-200 leading-relaxed font-medium">
                          {task.pedagogical_insights.differentiated_learning.extension}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(task.geogebra_commands?.length ?? 0) > 0 && (
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden p-2 bg-white">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">GeoGebra Интерактивен Приказ</div>
            <GeoGebraViewer commands={task.geogebra_commands!} inline={true} />
          </div>
        )}

        {task.illustration_prompt && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); togglePrompt(taskId); }}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">NanoBanana Визуелизација (Prompt)</h3>
              {store.expandedPrompts[taskId] ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {store.expandedPrompts[taskId] && (
              <div className="p-3 border-t border-slate-200">
                <div className="flex justify-end mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); actions.handleGenerateImage(task.illustration_prompt!, task); }}
                    disabled={actions.isGeneratingImage[taskId]}
                    className="h-7 text-xs"
                  >
                    {actions.isGeneratingImage[taskId] ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Генерирање...</>
                    ) : (
                      <><ImageIcon className="w-3 h-3 mr-1" /> Генерирај Слика</>
                    )}
                  </Button>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg text-green-400 font-mono text-xs leading-relaxed overflow-x-auto mb-4">
                  {task.illustration_prompt}
                </div>
                {actions.generatedImages[taskId] && (
                  <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-xs font-medium text-slate-600 flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      Генерирана Визуелизација
                    </div>
                    <div className="p-2 flex justify-center cursor-zoom-in" onClick={() => store.setZoomedImage(actions.generatedImages[taskId])}>
                      <img
                        src={actions.generatedImages[taskId]}
                        alt={t('library:ariaGeneratedVisualization')}
                        className="max-w-full h-auto rounded shadow-sm hover:shadow-md transition-shadow"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Solution */}
      <div className="space-y-6" id={`solution-${taskId}`}>
        <div>
          <SolutionStepsView task={task} taskId={taskId} store={store} />

          {/* LaTeX Explanation */}
          <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              Како се користи LaTeX?
            </h4>
            <div className="text-xs text-slate-600 mb-2 leading-relaxed">
              LaTeX е стандарден јазик за запишување на математички формули. Во нашата апликација, формулите се прикажуваат користејќи <code>$</code> за inline формули (пр. <code className="bg-white px-1 border border-slate-200 rounded text-blue-600">$x^2$</code> се прикажува како <MathRenderer content="$x^2$" inline />) и <code>$$</code> за блок формули во посебен ред. Ова овозможува беспрекорен и професионален приказ на комплексни математички изрази.
            </div>
          </div>
        </div>

        {task.latex_formulas && task.latex_formulas.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Издвоени Формули</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const allFormulas = task.latex_formulas!.map(f => `$$${f}$$`).join('\n');
                  navigator.clipboard.writeText(allFormulas);
                  store.setCopiedFormula('all-' + taskId);
                  setTimeout(() => store.setCopiedFormula(null), 2000);
                }}
                className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
              >
                {store.copiedFormula === 'all-' + taskId ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                {store.copiedFormula === 'all-' + taskId ? 'Копирано' : 'Копирај сите'}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {task.latex_formulas.map((formula, fIdx) => (
                <div key={fIdx} className="group relative bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[60px] overflow-x-auto">
                  <MathRenderer content={`$$${formula}$$`} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleCopyFormula(formula); }}
                    className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title={t('common:ariaCopyFormula')}
                  >
                    {store.copiedFormula === formula ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RAG Semantic Related Tasks - Full Width Bottom Section */}
      <RelatedTasksSection task={task} store={store} />
    </div>
  );
};
