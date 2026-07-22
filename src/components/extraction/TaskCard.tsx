import React from 'react';
import { motion } from 'motion/react';
import {
  Wand2, Loader2, Sparkles, BookOpen, CheckCircle, Save, Check,
  Image as ImageIcon, AlertTriangle, Quote, Microscope, Zap, Layers,
  Activity, Clock, BrainCircuit, Video
} from 'lucide-react';
import { Button } from '../ui/Button';
import { MathTask } from '../../lib/schema';
import { MathRenderer } from '../MathRenderer';
import { VisualMathCanvas } from '../VisualMathCanvas';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useExtractionContext } from './ExtractionContext';

const hasValidMathConfig = (config: any): boolean => {
  if (!config) return false;
  const obj = typeof config === 'string'
    ? (() => { try { return JSON.parse(config); } catch { return null; } })()
    : config;
  return Array.isArray(obj?.elements) && obj.elements.length > 0;
};

const mathGraphicPrompt = (task: MathTask): string => {
  const clean = (task.original_text || '').replace(/\$+/g, ' ').substring(0, 350);
  return `Math geometry/function diagram for: "${task.title}". Topic: ${task.curriculum_topic || ''}. Problem: ${clean}`;
};

interface TaskCardProps {
  task: MathTask;
  index: number;
  onEnrich: (index: number) => void;
  onSave: (task: MathTask, index: number) => void;
  onGenerateGraphics: (prompt: string, index: number) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, onEnrich, onSave, onGenerateGraphics }) => {
  const { setEditingTask } = useLibraryStore();
  const {
    savedTasks, isEnriching, isGeneratingImage, expandedPrompts,
    setExpandedPrompts, setActiveGeogebraCmds, setTasks, tasks,
  } = useExtractionContext();

  const togglePrompt = () => {
    setExpandedPrompts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-5xl shadow-sm hover:shadow-xl border border-slate-200 overflow-hidden transition-all duration-500 flex flex-col group relative printable-task-card"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-indigo-600 no-print"></div>
      <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center ml-1">
        <div className="flex px-3 gap-3 items-center">
          <span className="font-bold text-slate-400 text-xs uppercase tracking-widest">
            {task.type === 'theory' ? `Теорија ${index + 1}` : `Задача ${index + 1}`}
          </span>
          {task.type === 'task' && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              task.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
              task.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-rose-100 text-rose-700'
            }`}>
              {task.difficulty}
            </span>
          )}
          {task.dok_level && (
            <span className="bg-blue-100 flex items-center gap-1 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              DoK {task.dok_level}
            </span>
          )}
          {task.bloom_taxonomy && (
            <span className="bg-pink-100 flex items-center gap-1 text-pink-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              {task.bloom_taxonomy}
            </span>
          )}
          <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${task.type === 'theory' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
            <BookOpen className="w-3 h-3" /> {task.type}
          </span>
          {task.source_timestamp && (() => {
            const isYT = task.source_url?.includes('youtube.com') || task.source_url?.includes('youtu.be');
            const m = task.source_timestamp.match(/(\d+):(\d+)(?::(\d+))?/);
            if (isYT && m && task.source_url) {
              const secs = m[3] ? +m[1]*3600 + +m[2]*60 + +m[3] : +m[1]*60 + +m[2];
              const deepLink = task.source_url.includes('?') ? `${task.source_url}&t=${secs}` : `${task.source_url}?t=${secs}`;
              return (
                <a href={deepLink} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  title={`Отвори YouTube на ${task.source_timestamp}`}
                  className="bg-amber-100 flex items-center gap-1 text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full hover:bg-amber-200 transition-colors">
                  <Clock className="w-3 h-3" /> {task.source_timestamp} ↗
                </a>
              );
            }
            return (
              <span className="bg-amber-100 flex items-center gap-1 text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full cursor-help" title="Проценето време во видеото">
                <Clock className="w-3 h-3" /> {task.source_timestamp}
              </span>
            );
          })()}
          {task.pedagogical_insights?.quality_score && (
            <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm ring-1 ring-emerald-500/10">
              <Zap className="w-3 h-3" />
              Quality: {task.pedagogical_insights.quality_score}%
            </div>
          )}
          {!task.pedagogical_insights && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEnrich(index)}
              disabled={isEnriching[index]}
              className="h-7 px-3 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold uppercase tracking-wider"
            >
              {isEnriching[index] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
              AI Педагошко Збогатување
            </Button>
          )}
        </div>
        <div className="pr-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingTask(task)}
            className="h-9 px-4 text-xs font-bold rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Layers className="w-4 h-4 mr-1.5" /> Уреди Архитектонски
          </Button>
          <Button
            variant={savedTasks.has(index) ? "default" : "outline"}
            size="sm"
            onClick={() => onSave(task, index)}
            disabled={savedTasks.has(index)}
            className={`h-9 px-4 text-xs font-bold rounded-xl ${savedTasks.has(index) ? 'bg-emerald-500 hover:bg-emerald-600 border-none' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}
          >
            {savedTasks.has(index) ? <><CheckCircle className="w-4 h-4 mr-1.5" /> Зачувано</> : <><Save className="w-4 h-4 mr-1.5" /> Зачувај в Библиотека</>}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row ml-1">
        <div className="p-8 flex-1">
          {task.evidence_quote && (
            <div className="mb-4 flex items-start gap-2 bg-slate-100/50 p-3 rounded-lg border-l-4 border-slate-300 text-slate-500 text-sm italic">
              <Quote className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />
              <p>"{task.evidence_quote}"</p>
            </div>
          )}
          <h3 className="text-2xl font-extrabold text-slate-900 mb-6 drop-shadow-sm">{task.title}</h3>

          <div className="prose prose-slate prose-lg max-w-none text-slate-700 mb-8 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
             <MathRenderer content={task.original_text} />
          </div>

          {(task.geogebra_commands?.length ?? 0) > 0 && (
            <div className="mb-6 bg-slate-900 rounded-2xl p-4 shadow-inner border border-slate-700 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  GeoGebra API Команди
                </h4>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-0 rounded-lg shadow-md"
                  onClick={() => setActiveGeogebraCmds(task.geogebra_commands || [])}
                >
                  Илустрирај во GeoGebra
                </Button>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-emerald-300 font-mono text-xs overflow-x-auto space-y-1">
                {task.geogebra_commands?.map((cmd, i) => (
                  <div key={i} className="whitespace-nowrap"><span className="text-slate-600">evalCommand:</span> {cmd}</div>
                ))}
              </div>
            </div>
          )}

          {task.illustration_prompt && (
            <div className="mb-6 bg-slate-800 rounded-2xl p-4 shadow-inner border border-slate-700 flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                Visual AI / NanoBanana Промпт
              </h4>
              <p className="text-xs text-blue-300 font-mono leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                {task.illustration_prompt}
              </p>
            </div>
          )}

          {/* Pedagogical Insights - Premium Glower */}
          {task.pedagogical_insights && (
            <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50/80 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <AlertTriangle className="w-12 h-12 text-red-600" />
                  </div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-400 mb-3 relative z-10">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                    Педагошка Аутопсија (Критични точки)
                  </h4>
                  <ul className="space-y-2 relative z-10">
                    {task.pedagogical_insights.common_pitfalls.map((p, i) => (
                      <li key={i} className="text-[11px] text-red-800 dark:text-red-300 leading-tight flex gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                         {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-indigo-50/80 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(79,70,229,0.05)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Quote className="w-12 h-12 text-indigo-600" />
                  </div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-400 mb-3 relative z-10">
                    <Quote className="w-3.5 h-3.5 text-indigo-600" />
                    Сократови прашања (Водичи)
                  </h4>
                  <ul className="space-y-2 relative z-10">
                    {task.pedagogical_insights.socratic_questions.map((q, i) => (
                      <li key={i} className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-tight italic flex gap-2">
                         <span className="text-indigo-400 font-bold">?</span>
                         {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {task.pedagogical_insights.modeling_scenario && (
                <div className="bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.05)] relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity className="w-12 h-12 text-emerald-600" />
                  </div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-400 mb-3 relative z-10">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    Математичко Моделирање (Реален Свет)
                  </h4>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium relative z-10">
                    {task.pedagogical_insights.modeling_scenario}
                  </p>
                </div>
              )}

              {(task.pedagogical_insights.teaching_strategy || (task.pedagogical_insights.prerequisites && task.pedagogical_insights.prerequisites.length > 0)) && (
                <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 shadow-2xl relative overflow-hidden border border-slate-800">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-10 -mt-10" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-3xl -ml-10 -mb-10" />
                  <h4 className="flex items-center gap-2 text-xs font-bold text-white mb-4 relative z-10">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Методолошки Клон (Invisible Knowledge Graph)
                  </h4>
                  <div className="space-y-4 relative z-10">
                    {task.pedagogical_insights.teaching_strategy && (
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-2">Наставна Архитектура</label>
                        <p className="text-[12px] text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                          {task.pedagogical_insights.teaching_strategy}
                        </p>
                      </div>
                    )}
                    {task.pedagogical_insights.prerequisites && task.pedagogical_insights.prerequisites.length > 0 && (
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-2">Предзнаења во Графот</label>
                        <div className="flex flex-wrap gap-2">
                          {task.pedagogical_insights.prerequisites.map((req, i) => (
                            <span key={i} className="text-[10px] font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full shadow-sm">
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {task.solution_steps && task.solution_steps.length > 0 && (
            <div className="mt-8">
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-6 flex items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3 shadow-sm border border-emerald-200">
                   <Check className="w-5 h-5" />
                </div>
                Решение чекор по чекор
              </h4>
              <div className="space-y-4">
                {task.solution_steps.map((step, i) => (
                   <div key={i} className="flex gap-4 items-start p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                     <div className="w-8 h-8 bg-indigo-50 text-indigo-600 font-bold rounded-full flex items-center justify-center shrink-0 border border-indigo-100">
                       {i + 1}
                     </div>
                     <div className="pt-1 text-slate-700 flex-1">
                       <MathRenderer content={step} />
                     </div>
                   </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-2">
            {task.tags?.map((tag, i) => (
              <span key={i} className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                #{tag}
              </span>
            ))}
            {task.grade_level && (
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center gap-1.5 inline-flex">
                <BookOpen className="w-3.5 h-3.5" /> БРО: {task.grade_level}
              </span>
            )}
            {task.curriculum_topic && (
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                ТЕМА: {task.curriculum_topic}
              </span>
            )}
          </div>

          {/* Pedagogical Insights - CoT */}
          {task.pedagogical_insights && (
            <div className="mt-8 p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                <BrainCircuit className="w-4 h-4 text-emerald-600" />
                Педагошки Увид (CoT)
              </label>
              <div className="space-y-4 text-sm text-slate-700">
                {task.pedagogical_insights.common_pitfalls?.length > 0 && (
                  <div>
                    <strong className="text-emerald-900 block mb-1">Чести грешки кај учениците:</strong>
                    <ul className="list-disc pl-5 space-y-1">
                      {task.pedagogical_insights.common_pitfalls.map((pitfall, pIdx) => (
                        <li key={pIdx}>{pitfall}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {task.pedagogical_insights.socratic_questions?.length > 0 && (
                  <div>
                    <strong className="text-emerald-900 block mb-1">Сократови прашања (За наставник):</strong>
                    <ul className="list-disc pl-5 space-y-1">
                      {task.pedagogical_insights.socratic_questions.map((q, qIdx) => (
                        <li key={qIdx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {task.pedagogical_insights.teaching_strategy && (
                  <div>
                    <strong className="text-emerald-900 block mb-1">Стратегија за предавање:</strong>
                    <p>{task.pedagogical_insights.teaching_strategy}</p>
                  </div>
                )}
                {task.pedagogical_insights.hints && task.pedagogical_insights.hints.length > 0 && (
                  <div>
                    <strong className="text-emerald-900 block mb-1">Прогресивни Hint-ови:</strong>
                    <ol className="list-none pl-0 space-y-1.5">
                      {task.pedagogical_insights.hints.map((h, hIdx) => (
                        <li key={hIdx} className="flex gap-2 items-start">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{hIdx + 1}</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {task.pedagogical_insights.modern_context_suggestion && (
                  <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                    <strong className="text-indigo-900 block mb-1">Модерен контекст:</strong>
                    <p className="italic text-indigo-800">{task.pedagogical_insights.modern_context_suggestion}</p>
                  </div>
                )}
                {task.pedagogical_insights.differentiated_learning && (
                  <div className="grid grid-cols-2 gap-3">
                    {task.pedagogical_insights.differentiated_learning.support && (
                      <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                        <strong className="text-green-900 block mb-1 text-xs uppercase tracking-wider">Поддршка:</strong>
                        <p className="text-green-800 text-sm">{task.pedagogical_insights.differentiated_learning.support}</p>
                      </div>
                    )}
                    {task.pedagogical_insights.differentiated_learning.extension && (
                      <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                        <strong className="text-purple-900 block mb-1 text-xs uppercase tracking-wider">Проширување:</strong>
                        <p className="text-purple-800 text-sm">{task.pedagogical_insights.differentiated_learning.extension}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teacher Notes */}
          <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Опсервација на Наставникот (Твој став)
            </label>
            <textarea
              value={task.teacher_notes || ''}
              onChange={(e) => {
                const newTasks = [...tasks];
                newTasks[index] = { ...task, teacher_notes: e.target.value };
                setTasks(newTasks);
              }}
              placeholder="Внесете свое мислење, забелешка или интервенција пред зачувување..."
              className="w-full h-24 p-4 text-sm bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-medium placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* NanoBanana Visualizer */}
        <div className="bg-slate-50/50 lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-100 p-8 flex flex-col items-center flex-grow relative overflow-hidden h-full">
          {hasValidMathConfig(task.math_graphic_config) ? (
            <div className="w-full h-full text-center space-y-6 z-10 flex flex-col justify-center">
              <VisualMathCanvas jsonConfig={task.math_graphic_config} />
              <Button
                     variant="outline"
                     className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-10 font-bold rounded-xl"
                     onClick={() => onGenerateGraphics(mathGraphicPrompt(task), index)}
                     disabled={isGeneratingImage[index]}
                   >
                     {isGeneratingImage[index] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                     Регенерирај Графика
                   </Button>
            </div>
          ) : (
            <div className="text-center z-10 space-y-5 w-full m-auto">
              <div className="w-20 h-20 bg-white rounded-5xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-2 text-indigo-300">
                <ImageIcon className="w-10 h-10 opacity-70" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-extrabold text-slate-800 text-base">Визуелизација</h4>
                <p className="text-xs text-slate-500 px-2 leading-relaxed">Генерирајте инстантен векторски геометриски графикон базиран на AI промпт.</p>
              </div>
              <Button
                onClick={() => onGenerateGraphics(mathGraphicPrompt(task), index)}
                disabled={isGeneratingImage[index]}
                variant="default"
                className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 shadow-md text-white border-0 h-12 font-bold rounded-xl"
              >
                {isGeneratingImage[index] ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Генерирање...</>
                ) : (
                  <><Wand2 className="w-5 h-5 mr-2" /> Создај 2D Графика</>
                )}
              </Button>
              {task.illustration_prompt && (
                <div className="mt-6 pt-6 border-t border-slate-200 w-full text-left">
                  <button
                    onClick={togglePrompt}
                    className="text-[10px] text-slate-400 uppercase tracking-widest font-bold hover:text-indigo-600 flex justify-between items-center w-full focus:outline-none"
                  >
                    Prompt Settings <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200">{expandedPrompts[index] ? '▲' : '▼'}</span>
                  </button>
                  {expandedPrompts[index] && (
                    <div className="mt-3 text-xs font-mono text-slate-600 bg-white p-3 rounded-xl border border-slate-200 h-28 overflow-y-auto leading-relaxed shadow-inner">
                      {task.illustration_prompt}
                    </div>
                  )}
                </div>
              )}
              <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none">
                 <ImageIcon className="w-64 h-64" />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
