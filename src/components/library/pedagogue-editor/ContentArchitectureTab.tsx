import React from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { MathTask } from '../../../lib/schema';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { MathRenderer } from '../../MathRenderer';
import { VoiceInputButton } from '../../VoiceInputButton';

interface ContentArchitectureTabProps {
  localTask: MathTask;
  updateField: (field: keyof MathTask, value: any) => void;
  addStep: () => void;
  removeStep: (index: number) => void;
  updateStep: (index: number, value: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
}

export const ContentArchitectureTab: React.FC<ContentArchitectureTabProps> = ({
  localTask,
  updateField,
  addStep,
  removeStep,
  updateStep,
  addTag,
  removeTag
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Task Title</label>
        <Input
          value={localTask.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="bg-slate-900 border-white/5 text-white h-12 text-lg focus:border-indigo-500"
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
            Mathematical Narrative (LaTeX support)
            <VoiceInputButton
              onResult={(text) => {
                const newText = localTask.original_text + text;
                updateField('original_text', newText);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Fraction', tex: '\\frac{a}{b}' },
              { label: 'Sqrt', tex: '\\sqrt{x}' },
              { label: 'Power', tex: 'x^{n}' },
              { label: 'Sub', tex: 'x_{i}' },
              { label: 'Vector', tex: '\\vec{v}' },
              { label: 'Matrix', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
              { label: 'Sum', tex: '\\sum_{i=1}^{n}' },
              { label: 'Int', tex: '\\int_{a}^{b} f(x) dx' },
              { label: 'Limit', tex: '\\lim_{x \\to \\infty}' },
              { label: 'Pi', tex: '\\pi' },
              { label: 'Alpha', tex: '\\alpha' },
              { label: 'Theta', tex: '\\theta' },
              { label: 'Approx', tex: '\\approx' },
              { label: 'NotEq', tex: '\\neq' },
              { label: 'Leq', tex: '\\leq' },
              { label: 'Geq', tex: '\\geq' }
            ].map(sym => (
              <button
                key={sym.label}
                onClick={() => {
                  const textarea = document.getElementById('task-narrative') as HTMLTextAreaElement;
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const text = localTask.original_text;
                  const before = text.substring(0, start);
                  const after = text.substring(end);
                  const newText = before + sym.tex + after;
                  updateField('original_text', newText);
                  setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start + sym.tex.length, start + sym.tex.length);
                  }, 0);
                }}
                className="px-2 py-1 bg-slate-900 border border-white/5 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-indigo-500 transition-all font-mono"
              >
                {sym.tex}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
          <div className="relative">
            <textarea
              id="task-narrative"
              value={localTask.original_text}
              onChange={(e) => updateField('original_text', e.target.value)}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-slate-200 font-mono text-sm leading-relaxed focus:border-indigo-500 outline-none h-80 resize-none transition-all"
              placeholder="Write your math problem here. Use $$ for display math and $ for inline math..."
            />
            <VoiceInputButton
              className="absolute bottom-4 right-4 !bg-slate-800 !border-slate-700 !text-slate-300 hover:!bg-indigo-600 hover:!text-white shadow-xl"
              onResult={(text) => {
                  const textarea = document.getElementById('task-narrative') as HTMLTextAreaElement;
                  const start = textarea.selectionStart || localTask.original_text.length;
                  const before = localTask.original_text.substring(0, start);
                  const after = localTask.original_text.substring(start);
                  updateField('original_text', before + text + after);
              }}
            />
          </div>
          <div className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-6 overflow-y-auto h-80">
            <label className="text-[10px] font-black text-indigo-500/50 uppercase tracking-widest block mb-4">Live Visual Sync</label>
            <div className="prose prose-invert max-w-none">
              <MathRenderer content={localTask.original_text || '*Type something to see preview...*'} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Difficulty</label>
          <select
            value={localTask.difficulty}
            onChange={(e) => updateField('difficulty', e.target.value)}
            title="Difficulty"
            aria-label="Difficulty"
            className="w-full h-12 bg-slate-900 border border-white/5 rounded-xl text-slate-300 px-4 outline-none focus:border-indigo-500"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Instructional Type</label>
          <select
            value={localTask.type}
            onChange={(e) => updateField('type', e.target.value)}
            title="Instructional type"
            aria-label="Instructional type"
            className="w-full h-12 bg-slate-900 border border-white/5 rounded-xl text-slate-300 px-4 outline-none focus:border-indigo-500"
          >
            <option value="task">Problem Solving</option>
            <option value="theory">Theoretic Explanation</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bloom's Taxonomy</label>
          <select
            value={localTask.bloom_taxonomy || ''}
            onChange={(e) => updateField('bloom_taxonomy', e.target.value || undefined)}
            title="Bloom taxonomy"
            aria-label="Bloom taxonomy"
            className="w-full h-12 bg-slate-900 border border-white/5 rounded-xl text-slate-300 px-4 outline-none focus:border-purple-500"
          >
            <option value="">Неодредено</option>
            <option value="remember">Запомнување (Remember)</option>
            <option value="understand">Разбирање (Understand)</option>
            <option value="apply">Примена (Apply)</option>
            <option value="analyze">Анализирање (Analyze)</option>
            <option value="evaluate">Евалуација (Evaluate)</option>
            <option value="create">Креирање (Create)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">DoK Level (1-4)</label>
          <input
            type="number"
            min="1"
            max="4"
            value={localTask.dok_level || ''}
            onChange={(e) => updateField('dok_level', parseInt(e.target.value) || undefined)}
            className="w-full h-12 bg-slate-900 border border-white/5 rounded-xl text-slate-300 px-4 outline-none focus:border-purple-500"
            placeholder="Пр. 2"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
            Solution Architecture (Steps)
            <VoiceInputButton
              onResult={(text) => {
                // If there are no steps, append a new step, else append to the last step
                const steps = [...(localTask.solution_steps || [])];
                if (steps.length === 0) {
                  steps.push(text);
                } else {
                  steps[steps.length - 1] = steps[steps.length - 1] + text;
                }
                updateField('solution_steps', steps);
              }}
             />
          </label>
          <Button variant="outline" size="sm" onClick={addStep} className="border-white/10 text-slate-400">
            <Plus className="w-3 h-3 mr-2" /> Add Step
          </Button>
        </div>
        <div className="space-y-3">
          {localTask.solution_steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center shrink-0 text-slate-500 font-mono text-xs">
                {i+1}
              </div>
              <div className="relative flex-1">
                <textarea
                  id={`step-textarea-${i}`}
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  title={`Solution step ${i + 1}`}
                  aria-label={`Solution step ${i + 1}`}
                  placeholder="Опиши го чекорот..."
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-slate-300 text-sm focus:border-indigo-500 outline-none min-h-[80px] resize-none pr-10"
                />
                <VoiceInputButton
                  className="absolute bottom-2 right-2 !bg-slate-800 !border-slate-700 !text-slate-300 hover:!bg-indigo-600 hover:!text-white"
                  onResult={(text) => {
                    const textarea = document.getElementById(`step-textarea-${i}`) as HTMLTextAreaElement;
                    const start = textarea?.selectionStart || step.length;
                    const before = step.substring(0, start);
                    const after = step.substring(start);
                    updateStep(i, before + text + after);
                  }}
                />
              </div>
              <Button variant="ghost" onClick={() => removeStep(i)} className="shrink-0">
                 <Trash2 className="w-4 h-4 text-slate-600 hover:text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">GeoGebra Visualization Commands</label>
        <p className="text-xs text-slate-400 mb-2">Each line represents a GeoGebra command to render a geometric shape or graph (e.g. `f(x) = x^2` or `A = (2, 3)`).</p>
        <textarea
          value={(localTask.geogebra_commands || []).join('\n')}
          onChange={(e) => updateField('geogebra_commands', e.target.value.split('\n').filter(l => l.trim() !== ''))}
          className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-emerald-400 font-mono text-xs focus:border-indigo-500 outline-none resize-y min-h-[100px]"
          placeholder={"A = (1, 1)\nB = (4, 1)\nPolygon(A, B, 4)"}
        />
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Ontology & Search (Tags)</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {localTask.tags?.map(tag => (
            <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-lg text-xs font-bold">
              #{tag}
              <button onClick={() => removeTag(tag)} aria-label={`Избриши таг ${tag}`} title={`Избриши таг ${tag}`} className="hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a tag..."
            id="new-tag-input"
            className="bg-slate-900 border-white/5 text-white h-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addTag((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          <Button onClick={() => {
            const input = document.getElementById('new-tag-input') as HTMLInputElement;
            addTag(input.value);
            input.value = '';
          }} className="bg-slate-800 hover:bg-slate-700">Add</Button>
        </div>
      </div>
    </div>
  );
};
