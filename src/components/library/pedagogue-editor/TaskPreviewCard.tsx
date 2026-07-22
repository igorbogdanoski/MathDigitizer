import React from 'react';
import { Activity, AlertTriangle, Compass } from 'lucide-react';
import { MathTask } from '../../../lib/schema';
import { Card, CardContent } from '../../ui/Card';
import { MathRenderer } from '../../MathRenderer';

interface TaskPreviewCardProps {
  localTask: MathTask;
}

export const TaskPreviewCard: React.FC<TaskPreviewCardProps> = ({ localTask }) => {
  return (
    <Card className="bg-slate-900 border-indigo-500/20 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
      <CardContent className="p-12 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded font-mono font-bold uppercase">DOK L{localTask.dok_level}</span>
             <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${
              localTask.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-400' :
              localTask.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
             }`}>{localTask.difficulty}</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight">{localTask.title}</h1>
        </div>

        <div className="bg-slate-950/50 p-8 rounded-3xl border border-white/5 min-h-[200px]">
          <MathRenderer content={localTask.original_text} />
        </div>

        <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
          {localTask.pedagogical_insights?.modeling_scenario && (
            <div className="md:col-span-2 space-y-4 mb-4">
               <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Математичко Моделирање (Реален Свет)</h3>
              </div>
              <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {localTask.pedagogical_insights.modeling_scenario}
                </p>
              </div>
            </div>
          )}

          {(localTask.pedagogical_insights?.common_pitfalls.length || 0) > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Target Misconceptions</h3>
              </div>
              <div className="space-y-2">
                 {localTask.pedagogical_insights?.common_pitfalls.map((p, i) => (
                   <div key={i} className="flex gap-3 items-start p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">{p}</p>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {(localTask.pedagogical_insights?.socratic_questions.length || 0) > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Compass className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Socratic Discovery</h3>
              </div>
              <div className="space-y-3">
                {localTask.pedagogical_insights?.socratic_questions.map((q, i) => (
                  <div key={i} className="group relative p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl hover:border-indigo-500/30 transition-all">
                    <div className="absolute -left-2 top-4 w-1 h-8 bg-indigo-500 rounded-full" />
                    <p className="text-slate-300 italic text-sm leading-relaxed pl-2">
                      "{q}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
