import React from 'react';
import { AlertTriangle, Quote, Activity, Plus, Trash2 } from 'lucide-react';
import { MathTask } from '../../../lib/schema';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

interface PedagogicalDNATabProps {
  localTask: MathTask;
  updateInsightField: (field: keyof NonNullable<MathTask['pedagogical_insights']>, value: any) => void;
}

export const PedagogicalDNATab: React.FC<PedagogicalDNATabProps> = ({
  localTask,
  updateInsightField
}) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              Target Misconceptions
            </label>
            <Button variant="ghost" size="sm" onClick={() => updateInsightField('common_pitfalls', [...(localTask.pedagogical_insights?.common_pitfalls || []), ""])}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-2">
            {localTask.pedagogical_insights?.common_pitfalls.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={p}
                  onChange={(e) => {
                    const next = [...(localTask.pedagogical_insights?.common_pitfalls || [])];
                    next[i] = e.target.value;
                    updateInsightField('common_pitfalls', next);
                  }}
                  className="bg-slate-900 border-white/5 text-slate-300"
                />
                <Button variant="ghost" onClick={() => {
                  const next = (localTask.pedagogical_insights?.common_pitfalls || []).filter((_, idx) => idx !== i);
                  updateInsightField('common_pitfalls', next);
                }}>
                  <Trash2 className="w-3 h-3 text-slate-600 hover:text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Quote className="w-3 h-3 text-indigo-500" />
              Socratic Scaffolding
            </label>
            <Button variant="ghost" size="sm" onClick={() => updateInsightField('socratic_questions', [...(localTask.pedagogical_insights?.socratic_questions || []), ""])}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-2">
            {localTask.pedagogical_insights?.socratic_questions.map((q, i) => (
              <div key={i} className="flex gap-2 group">
                <div className="w-6 h-6 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center shrink-0 text-[10px] text-slate-500 mt-2">
                  {i+1}
                </div>
                <textarea
                  value={q}
                  onChange={(e) => {
                    const next = [...(localTask.pedagogical_insights?.socratic_questions || [])];
                    next[i] = e.target.value;
                    updateInsightField('socratic_questions', next);
                  }}
                  className="flex-1 bg-slate-900 border border-white/5 text-slate-300 italic text-sm p-3 rounded-xl focus:border-indigo-500 outline-none min-h-[60px] resize-none overflow-hidden"
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  placeholder="Enter a Socratic question..."
                />
                <Button variant="ghost" size="sm" onClick={() => {
                  const next = (localTask.pedagogical_insights?.socratic_questions || []).filter((_, idx) => idx !== i);
                  updateInsightField('socratic_questions', next);
                }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4 text-slate-600 hover:text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-3 h-3 text-emerald-500" />
          Mathematical Modeling Scenario
        </label>
        <textarea
          value={localTask.pedagogical_insights?.modeling_scenario}
          onChange={(e) => updateInsightField('modeling_scenario', e.target.value)}
          className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-slate-300 text-sm leading-relaxed focus:border-indigo-500 outline-none h-40 resize-none transition-all"
          placeholder="Describe the real-world modeling application for this task..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Instructional Strategy Architect</label>
        <textarea
          value={localTask.pedagogical_insights?.teaching_strategy}
          onChange={(e) => updateInsightField('teaching_strategy', e.target.value)}
          className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-slate-300 text-sm leading-relaxed focus:border-indigo-500 outline-none h-40 resize-none transition-all"
          placeholder="Describe the optimal teaching sequence for this task..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Differentiated Support (Tier 2/3)</label>
          <textarea
            value={localTask.pedagogical_insights?.differentiated_learning?.support || ''}
            onChange={(e) => updateInsightField('differentiated_learning', { ...localTask.pedagogical_insights?.differentiated_learning, support: e.target.value })}
            className="w-full bg-slate-900 border border-amber-500/20 rounded-2xl p-6 text-slate-300 text-sm leading-relaxed focus:border-amber-500 outline-none h-32 resize-none transition-all"
            placeholder="How to support struggling learners..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-fuchsia-500 uppercase tracking-widest">Differentiated Extension (Gifted)</label>
          <textarea
            value={localTask.pedagogical_insights?.differentiated_learning?.extension || ''}
            onChange={(e) => updateInsightField('differentiated_learning', { ...localTask.pedagogical_insights?.differentiated_learning, extension: e.target.value })}
            className="w-full bg-slate-900 border border-fuchsia-500/20 rounded-2xl p-6 text-slate-300 text-sm leading-relaxed focus:border-fuchsia-500 outline-none h-32 resize-none transition-all"
            placeholder="How to extend and challenge advanced learners..."
          />
        </div>
      </div>
    </div>
  );
};
