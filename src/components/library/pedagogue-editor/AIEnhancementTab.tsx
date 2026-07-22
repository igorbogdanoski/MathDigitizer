import React from 'react';
import { Wand2, Layers, Compass, MessageSquare, Activity, Loader2 } from 'lucide-react';

interface AIEnhancementTabProps {
  onAIAction: (action: 'refine_rigor' | 'modernize_context' | 'generate_socratic' | 'generate_modeling') => void;
  isAILoading: boolean;
}

export const AIEnhancementTab: React.FC<AIEnhancementTabProps> = ({
  onAIAction,
  isAILoading
}) => {
  return (
    <div className="space-y-12">
      <header className="text-center">
        <Wand2 className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-white">Neural Pedagogical Copilot</h2>
        <p className="text-slate-500 mt-2">Iterate on task architecture using specialized AI protocols.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { id: 'refine_rigor', label: 'Escalate Rigor', icon: Layers, desc: 'Increases complexity and strategic thinking requirements.', color: 'indigo' },
          { id: 'modernize_context', label: 'Evolve Context', icon: Compass, desc: 'Re-frames task in a contemporary/Gen-Z scenario.', color: 'emerald' },
          { id: 'generate_socratic', label: 'Synthesize Socratic Guidance', icon: MessageSquare, desc: 'Generates non-giving, context-rich Socratic scaffolds.', color: 'purple' },
          { id: 'generate_modeling', label: 'Architect Modeling Path', icon: Activity, desc: 'Creates a real-world modeling scenario for the concept.', color: 'amber' }
        ].map(action => (
          <button
            key={action.id}
            onClick={() => onAIAction(action.id as any)}
            disabled={isAILoading}
            className="bg-slate-900 border border-white/5 rounded-5xl p-8 text-center hover:border-indigo-500 transition-all hover:bg-slate-900/50 group"
          >
            <div className={`w-12 h-12 rounded-2xl bg-${action.color}-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform`}>
              <action.icon className={`w-6 h-6 text-${action.color}-400`} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{action.label}</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">{action.desc}</p>
            <div className={`text-[10px] font-bold text-${action.color}-400 uppercase tracking-widest`}>Run Protocol</div>
          </button>
        ))}
      </div>

      {isAILoading && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest animate-pulse">Running Neural Protocol...</span>
        </div>
      )}
    </div>
  );
};
