import React from 'react';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useTaskActions } from '../../hooks/useTaskActions';
import { 
  MessageCircleQuestion, RotateCcw, ArrowUpDown, Sparkles, Brain, Activity, 
  Check, Copy, Loader2, ChevronDown, ChevronUp, Image as ImageIcon, 
  Play, Pause, Plus, Info, AlertTriangle, Quote, Zap, Microscope, BookOpen, Compass,
  Share2, Network, Link2, PlayCircle, Youtube, Cpu, ShieldCheck, Layers
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useQueryClient } from '@tanstack/react-query';

interface TaskDetailViewProps {
  task: MathTask;
  taskId: string;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task, taskId }) => {
  const store = useLibraryStore();
  const actions = useTaskActions();
  const queryClient = useQueryClient();

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

  const togglePrompt = (id: string) => {
    store.setExpandedPrompts({ ...store.expandedPrompts, [id]: !store.expandedPrompts[id] });
  };

  const handleCopyFormula = (formula: string) => {
    navigator.clipboard.writeText(`$$${formula}$$`);
    store.setCopiedFormula(formula);
    setTimeout(() => store.setCopiedFormula(null), 2000);
  };

  const handleCopyAllText = (task: MathTask, taskId: string) => {
    let fullText = `Задача: ${task.title}\n\n`;
    if (task.grade_level) fullText += `Одделение: ${task.grade_level}\n`;
    if (task.curriculum_topic) fullText += `Тема: ${task.curriculum_topic}\n`;
    fullText += `\nТекст:\n${task.original_text}\n\n`;
    if (task.hints && task.hints.length > 0) {
      fullText += `Помош:\n${task.hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
    }
    fullText += `Решение:\n${task.solution_steps.map((s, i) => `Чекор ${i + 1}:\n${s}`).join('\n\n')}`;
    
    navigator.clipboard.writeText(fullText);
    store.setCopiedAllText(taskId);
    setTimeout(() => store.setCopiedAllText(null), 2000);
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
            
            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); store.setActiveTutorTask(task); }}
                className="h-6 px-2 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
              >
                <MessageCircleQuestion className="w-3 h-3 mr-1" />
                AI Тутор
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); actions.handleGenerateSimilar(task); }}
                disabled={actions.isGeneratingSimilar[taskId]}
                className="h-6 px-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              >
                {actions.isGeneratingSimilar[taskId] ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Генерирање...</>
                ) : (
                  <><RotateCcw className="w-3 h-3 mr-1" /> Вежбај слична</>
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
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Генерирање...</>
                ) : (
                  <><ArrowUpDown className="w-3 h-3 mr-1" /> Диференцирај</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); store.setActiveSolverTask(task); }}
                className="h-6 px-2 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Реши Интерактивно
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); actions.handleCreateFlashcard(task); }}
                className="h-6 px-2 text-xs bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              >
                <Brain className="w-3 h-3 mr-1" />
                Креирај Картичка
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); store.setIsCommandCenterOpen(true); }}
                className="h-6 px-2 text-xs bg-slate-900 text-slate-100 border-slate-700 hover:bg-slate-800 shadow-lg shadow-indigo-500/10 border-indigo-500/30"
              >
                <Cpu className="w-3 h-3 mr-1 text-indigo-400" />
                Command Center
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); store.setEditingTask(task); }}
                className="h-6 px-2 text-xs bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
              >
                <Layers className="w-3 h-3 mr-1" />
                Architect Editor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); store.setActiveGraphTask(task); }}
                className="h-6 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                <Activity className="w-3 h-3 mr-1" />
                График
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); actions.handleGenerateSimilar(task); }}
                disabled={store.isGeneratingSimilar[taskId]}
                className="h-6 px-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              >
                {store.isGeneratingSimilar[taskId] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                Клонирај (Слична)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); actions.handleGenerateDifferentiated(task); }}
                disabled={store.isGeneratingDifferentiated[taskId]}
                className="h-6 px-2 text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
              >
                {store.isGeneratingDifferentiated[taskId] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ArrowUpDown className="w-3 h-3 mr-1" />}
                Група А/Б
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); actions.handleModernizeContext(task); }}
                disabled={store.isModernizingContext[taskId]}
                className="h-6 px-2 text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
              >
                {store.isModernizingContext[taskId] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                Модернизирај (Gen-Z)
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); handleCopyAllText(task, taskId); }}
                className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
              >
                {store.copiedAllText === taskId ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                {store.copiedAllText === taskId ? 'Копирано сè' : 'Копирај сè'}
              </Button>
            </div>
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
          {task.pedagogical_insights && (
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pitfalls */}
                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-red-900 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Критични точки (Student Pitfalls)
                  </h4>
                  <ul className="space-y-2">
                    {task.pedagogical_insights.common_pitfalls.map((pitfall, pIdx) => (
                      <li key={pIdx} className="flex gap-2 text-xs text-red-800 leading-relaxed font-medium">
                        <span className="text-red-400 mt-1 flex-shrink-0">•</span>
                        {pitfall}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Socratic Scaffolding */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-900 mb-3">
                    <Quote className="w-4 h-4 text-indigo-600" />
                    Сократов Разговор (Scaffolding)
                  </h4>
                  <ul className="space-y-2">
                    {task.pedagogical_insights.socratic_questions.map((question, qIdx) => (
                      <li key={qIdx} className="flex gap-2 text-xs text-indigo-800 leading-relaxed italic">
                        <span className="text-indigo-400 mt-1 flex-shrink-0">?</span>
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {task.pedagogical_insights.modeling_scenario && (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-900 mb-3">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Математичко Моделирање (Реален Свет)
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    {task.pedagogical_insights.modeling_scenario}
                  </p>
                </div>
              )}

              {task.pedagogical_insights.modern_context_suggestion && (
                <div className="bg-orange-50/30 border border-orange-100/50 rounded-lg p-3 flex items-start gap-3">
                  <Zap className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block mb-1">Предлог за модернизација</span>
                    <p className="text-xs text-orange-800 italic">"{task.pedagogical_insights.modern_context_suggestion}"</p>
                  </div>
                </div>
              )}

              {/* Methodological Cloning & Knowledge Graph (Invisible Engine) */}
              {(task.pedagogical_insights?.teaching_strategy || (task.pedagogical_insights?.prerequisites && task.pedagogical_insights.prerequisites.length > 0)) && (
                <div className="mt-8 space-y-6">
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                  
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Microscope className="w-4 h-4 text-indigo-600" />
                      Методолошки Архитект
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); actions.handleGenerateConsistency(task); }}
                        disabled={store.isGeneratingConsistency[taskId]}
                        className="h-7 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      >
                        {store.isGeneratingConsistency[taskId] ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1.5" />}
                        Клонирај Метода
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); actions.handleGeneratePrerequisites(task); }}
                        disabled={store.isGeneratingPrerequisites[taskId]}
                        className="h-7 text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                      >
                        {store.isGeneratingPrerequisites[taskId] ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Brain className="w-3 h-3 mr-1.5" />}
                        Генерирај Пред-тест
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                      <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        Наставна Стратегија (Methodology)
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">
                        {task.pedagogical_insights?.teaching_strategy}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                      <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                         Потребни Предзнаења
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {task.pedagogical_insights?.prerequisites?.map((pre, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200">
                            {pre}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Knowledge Graph Connections Panel */}
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] -ml-32 -mb-32" />
                    
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <h4 className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-[0.2em]">
                        <Network className="w-4 h-4 text-indigo-400" />
                        Граф на Знаење (Invisible Engine)
                      </h4>
                      <span className="text-[10px] font-bold px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                        AI SEMANTIC MAPPING
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Вертикална Хиерархија</label>
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 group cursor-help">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center transition-transform group-hover:scale-110">
                              <ChevronUp className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-white">Предуслов за:</p>
                              <p className="text-[10px] text-slate-400 italic">Следно ниво: Квадратни равенки</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 group cursor-help">
                            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center transition-transform group-hover:scale-110">
                              <ChevronDown className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-white">Произлегува од:</p>
                              <p className="text-[10px] text-slate-400 italic">База: Својства на степени</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Хоризонтална Мрежа</label>
                        <div className="flex flex-wrap gap-2">
                           <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                             <Youtube className="w-3.5 h-3.5 text-red-400" />
                             <span className="text-[10px] text-slate-300">Видео Упатство</span>
                           </div>
                           <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                             <Link2 className="w-3.5 h-3.5 text-blue-400" />
                             <span className="text-[10px] text-slate-300">Интерактивни Плочки</span>
                           </div>
                           <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                             <Share2 className="w-3.5 h-3.5 text-purple-400" />
                             <span className="text-[10px] text-slate-300">Поврзани Задачи</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
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
              </div>
            )}
          </div>
        )}

        {task.nanobanana_prompt && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button 
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
                    onClick={(e) => { e.stopPropagation(); actions.handleGenerateImage(task.nanobanana_prompt!, taskId); }}
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
                  {task.nanobanana_prompt}
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
                        alt="Генерирана визуелизација за задачата" 
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {task.type === 'theory' ? 'Клучни Точки' : 'Решение'}
            </h3>
            <div className="flex items-center gap-2">
                <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const allSteps = task.solution_steps.map((step, i) => `Чекор ${i + 1}:\n${step}`).join('\n\n');
                  navigator.clipboard.writeText(allSteps);
                  store.setCopiedText('steps-' + taskId);
                  setTimeout(() => store.setCopiedText(null), 2000);
                }}
                className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
              >
                {store.copiedText === 'steps-' + taskId ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                {store.copiedText === 'steps-' + taskId ? 'Копирано' : 'Копирај чекори'}
              </Button>
              {store.practiceMode[taskId] && (
                <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-md">
                  <span className="text-xs font-mono font-bold text-slate-700 w-10 text-center">
                    {formatTime(store.practiceTimer[taskId] || 0)}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); store.setTimerActive({ ...store.timerActive, [taskId]: !store.timerActive[taskId] }); }} className="text-slate-500 hover:text-blue-600">
                    {store.timerActive[taskId] ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); store.setPracticeTimer({ ...store.practiceTimer, [taskId]: 0 }); }} className="text-slate-500 hover:text-blue-600">
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
                    Ресетирај чекори
                  </Button>
                </div>
              )}
              <Button 
                variant={store.practiceMode[taskId] ? "default" : "outline"} 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); togglePracticeMode(taskId, task); }}
                className={`h-7 text-xs ${store.practiceMode[taskId] ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-slate-600'}`}
              >
                Практика Мод
              </Button>
            </div>
          </div>
          
          {/* Step Navigation */}
          {task.solution_steps.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {task.solution_steps.map((_, stepIdx) => (
                <button
                  key={stepIdx}
                  onClick={(e) => {
                    e.stopPropagation();
                    const stepKey = `${taskId}-${stepIdx}`;
                    store.setCollapsedSteps({ ...store.collapsedSteps, [stepKey]: false });
                    document.getElementById(`step-${stepKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center text-xs font-bold transition-colors"
                  title={`Оди на чекор ${stepIdx + 1}`}
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
                        checked={isSelected || false}
                        onChange={(e) => { e.stopPropagation(); toggleStepSelection(taskId, stepIdx); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleStep(stepKey); }}
                      className="flex-1 flex items-center justify-between p-2 pl-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                          {stepIdx + 1}
                        </span>
                        <span className="text-xs font-medium text-slate-600">Чекор {stepIdx + 1}</span>
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
                  Прикажи ги избраните чекори ({store.selectedSteps[taskId].size})
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
                  const newStep = window.prompt("Внесете го новиот чекор (може да користите LaTeX):");
                  if (newStep && newStep.trim()) {
                    try {
                      const { doc, updateDoc } = await import('firebase/firestore');
                      await updateDoc(doc(db, 'tasks', taskId), {
                        solution_steps: [...task.solution_steps, newStep.trim()]
                      });
                      queryClient.invalidateQueries({ queryKey: ['tasks'] });
                    } catch (err) {
                      console.error("Грешка при додавање чекор:", err);
                      alert("Настана грешка при зачувување на чекорот.");
                    }
                  }
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Додади чекор
              </Button>
            </div>
          </div>

          {/* LaTeX Explanation */}
          <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              Како се користи LaTeX?
            </h4>
            <p className="text-xs text-slate-600 mb-2 leading-relaxed">
              LaTeX е стандарден јазик за запишување на математички формули. Во нашата апликација, формулите се прикажуваат користејќи <code>$</code> за inline формули (пр. <code className="bg-white px-1 border border-slate-200 rounded text-blue-600">$x^2$</code> се прикажува како <MathRenderer content="$x^2$" inline />) и <code>$$</code> за блок формули во посебен ред. Ова овозможува беспрекорен и професионален приказ на комплексни математички изрази.
            </p>
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
                    onClick={(e) => { e.stopPropagation(); handleCopyFormula(formula); }}
                    className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Копирај формула"
                  >
                    {store.copiedFormula === formula ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
