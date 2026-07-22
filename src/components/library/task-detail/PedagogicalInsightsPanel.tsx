import React from 'react';
import { MathTask } from '../../../lib/schema';
import { Button } from '../../ui/Button';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { useTaskActions } from '../../../hooks/useTaskActions';
import {
  AlertTriangle, Quote, Activity, Zap, Microscope, Brain, Loader2,
  PlayCircle, Network, ChevronUp, ChevronDown, Link2, Share2, CheckCircle
} from 'lucide-react';

type LibraryStore = ReturnType<typeof useLibraryStore.getState>;
type TaskActions = ReturnType<typeof useTaskActions>;

interface PedagogicalInsightsPanelProps {
  task: MathTask;
  taskId: string;
  store: LibraryStore;
  actions: TaskActions;
}

export const PedagogicalInsightsPanel: React.FC<PedagogicalInsightsPanelProps> = ({ task, taskId, store, actions }) => {
  if (!task.pedagogical_insights) return null;

  return (
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

      {task.misconceptions && task.misconceptions.length > 0 && (
        <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mt-6">
          <h4 className="flex items-center gap-2 text-sm font-bold text-red-900 mb-3">
            <Activity className="w-4 h-4 text-red-600 animate-pulse" />
            Детекција на Анатомски Грешки (Misconceptions)
          </h4>
          <div className="space-y-4">
            {task.misconceptions.map((mc, idx) => (
               <div key={idx} className="bg-white p-3 rounded-lg border border-red-200">
                  <p className="text-xs font-bold text-red-800 line-through decoration-red-400 mb-2">Грешка: {mc.mistake}</p>
                  <div className="bg-indigo-50 p-2 rounded text-xs text-indigo-800 border-l-2 border-indigo-500">
                     <span className="font-bold flex items-center gap-1 mb-1"><CheckCircle className="w-3 h-3"/> Реакција:</span>
                     {mc.teacher_reaction}
                  </div>
               </div>
            ))}
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
                     <PlayCircle className="w-3.5 h-3.5 text-red-400" />
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
  );
};
