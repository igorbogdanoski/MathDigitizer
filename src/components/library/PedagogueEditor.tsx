import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Save, Sparkles, Brain, Wand2, ArrowLeft, Eye, 
  Code, Info, AlertTriangle, Quote, Check, Plus, Trash2, 
  Layout, BookOpen, Layers, Compass, Zap, Activity,
  MessageSquare, Loader2, Sigma, Hash, Calculator
} from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent } from '../ui/Card';
import { MathRenderer } from '../MathRenderer';
import { useLibraryStore } from '../../store/useLibraryStore';
import { VoiceInputButton } from '../VoiceInputButton';
import { enhancePedagogueTask } from '../../lib/gemini';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const PedagogueEditor: React.FC = () => {
  const { editingTask, setEditingTask, tasks, setTasks, onTaskUpdated } = useLibraryStore();
  const [localTask, setLocalTask] = useState<MathTask | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'pedagogy' | 'ai'>('content');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setLocalTask({ ...editingTask });
    }
  }, [editingTask]);

  if (!editingTask || !localTask) return null;

  const handleSave = async () => {
    if (!localTask) return;
    
    // Call the callback if it exists (e.g. from ExtractionEngine)
    if (onTaskUpdated) {
      onTaskUpdated(localTask);
    }

    // If we have an ID, it's a library task, so we should update Firestore
    if (localTask.id) {
      try {
        const taskRef = doc(db, 'tasks', localTask.id);
        const { id, ...dataToSave } = localTask;
        await updateDoc(taskRef, dataToSave as any);
        
        // Update local store as well
        const updatedTasks = tasks.map(t => t.id === localTask.id ? localTask : t);
        setTasks(updatedTasks);
      } catch (err) {
        console.error("Failed to update task in Firestore:", err);
      }
    } else {
      // It's a new task (e.g. from ExtractionEngine), just return the edited version
      // We might need a way to communicate this back to the ExtractionEngine if it's currently showing it.
      // For now, let's assume we update the tasks list in store if it happens to be there
      // Note: ExtractionEngine currently uses its own local state 'tasks', not the store's 'tasks'. 
      // This is a disconnect we should fix.
    }
    
    setEditingTask(null);
  };

  const addStep = () => {
    updateField('solution_steps', [...(localTask.solution_steps || []), ""]);
  };

  const removeStep = (index: number) => {
    const next = (localTask.solution_steps || []).filter((_, i) => i !== index);
    updateField('solution_steps', next);
  };

  const updateStep = (index: number, value: string) => {
    const next = [...(localTask.solution_steps || [])];
    next[index] = value;
    updateField('solution_steps', next);
  };

  const addTag = (tag: string) => {
    if (!tag.trim()) return;
    if (localTask.tags?.includes(tag)) return;
    updateField('tags', [...(localTask.tags || []), tag]);
  };

  const removeTag = (tag: string) => {
    updateField('tags', (localTask.tags || []).filter(t => t !== tag));
  };

  const updateField = (field: keyof MathTask, value: any) => {
    setLocalTask(prev => prev ? { ...prev, [field]: value } : null);
  };

  const updateInsightField = (field: keyof NonNullable<MathTask['pedagogical_insights']>, value: any) => {
    setLocalTask(prev => {
      if (!prev) return null;
      const insights = prev.pedagogical_insights || { common_pitfalls: [], socratic_questions: [], teaching_strategy: '', prerequisites: [] };
      return {
        ...prev,
        pedagogical_insights: {
          ...insights,
          [field]: value
        }
      };
    });
  };

  const getDOKDescription = (level: number) => {
    switch(level) {
      case 1: return "Recall & Reproduction: Recalling facts, definitions, or simple procedures.";
      case 2: return "Skills & Concepts: Engagement of some mental processing beyond recalling.";
      case 3: return "Strategic Thinking: Reasoning, planning, and using evidence to solve problems.";
      case 4: return "Extended Thinking: Complex reasoning over time and multiple steps.";
      default: return "";
    }
  };

  const handleAIAction = async (action: 'refine_rigor' | 'modernize_context' | 'generate_socratic' | 'generate_modeling') => {
    setIsAILoading(true);
    try {
      // Construct prompt based on action
      let prompt = "";
      if (action === 'refine_rigor') {
        prompt = `Refine the following math task to increase its DoK level while maintaining core concepts. 
        Original Task: ${localTask.original_text}
        Target DOK: ${Math.min((localTask.dok_level || 1) + 1, 4)}`;
      } else if (action === 'modernize_context') {
        prompt = `Rewrite the context of this math task to be modern, engaging for Gen Z students, and real-world applicable.
        Original Task: ${localTask.original_text}`;
      } else if (action === 'generate_socratic') {
        prompt = `Generate 4-5 high-quality leading Socratic questions for this math task that a teacher can use in class.
        
        Requirements:
        1. DO NOT give away the answer.
        2. Focus on conceptual discovery (e.g., "If we change X, what happens to Y?").
        3. Include specific context-dependent examples related to the problem's narrative.
        4. Organize them in a logical instructional sequence: from observation to abstraction.
        
        Math Task: ${localTask.original_text}
        Target Student Level: Grade ${localTask.grade_level || 'Middle School'}
        `;
      } else if (action === 'generate_modeling') {
        prompt = `Transform this math task into a comprehensive real-life mathematical modeling scenario.
        
        Requirements:
        1. Connect it to a specific, realistic everyday situation (business, engineering, social sciences, sports, etc.).
        2. Explain the "Why" - why would someone need to model this in the real world?
        3. Describe the modeling process: what variables to identify, what assumptions to make, and what the final model would represent.
        
        Math Task: ${localTask.original_text}
        `;
      }

      const result = await enhancePedagogueTask(prompt, localTask.detected_language || 'mk');
      if (result.new_text) updateField('original_text', result.new_text);
      if (result.socratic_questions) {
        updateInsightField('socratic_questions', result.socratic_questions);
      }
      if (result.modeling_scenario) {
        updateInsightField('modeling_scenario', result.modeling_scenario);
      }
      if (result.dok_suggestion) updateField('dok_level', result.dok_suggestion);
      if (result.teaching_strategy) updateInsightField('teaching_strategy', result.teaching_strategy);
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsAILoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-[110] bg-slate-950 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setEditingTask(null)}
            className="border-white/10 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <h2 className="text-white font-bold tracking-tight flex items-center gap-2 uppercase text-xs tracking-[0.2em]">
            Pedagogical Architect Editor
            <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-mono">Expert Mode</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`transition-all ${isPreviewMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'border-white/10 text-slate-400'}`}
          >
            {isPreviewMode ? <Code className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {isPreviewMode ? 'Edit Source' : 'Vibe Preview'}
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 px-6"
          >
            <Save className="w-4 h-4 mr-2" />
            Integrate to Library
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tabs */}
        <aside className="w-64 border-r border-white/10 bg-slate-900/30 flex flex-col p-4 shrink-0">
          <div className="space-y-2 mb-8">
            {[
              { id: 'content', icon: Layout, label: 'Content Architecture' },
              { id: 'pedagogy', icon: Brain, label: 'Pedagogical DNA' },
              { id: 'ai', icon: Zap, label: 'AI Enhancement Hub' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-auto space-y-4">
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Depth of Knowledge (DoK)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(level => (
                  <button
                    key={level}
                    onClick={() => updateField('dok_level', level)}
                    className={`flex-1 aspect-square rounded-lg font-mono text-xs transition-all border ${
                      localTask.dok_level === level 
                        ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30' 
                        : 'bg-slate-900 border-white/5 text-slate-600 hover:border-white/20'
                    }`}
                  >
                    L{level}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500 leading-tight">
                {getDOKDescription(localTask.dok_level || 1)}
              </p>
            </div>
          </div>
        </aside>

        {/* Main Editor Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {!isPreviewMode ? (
              <motion.div 
                key="editor"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                {activeTab === 'content' && (
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
                )}

                {activeTab === 'pedagogy' && (
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
                )}

                {activeTab === 'ai' && (
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
                          onClick={() => handleAIAction(action.id as any)}
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
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-4xl mx-auto"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </motion.div>
  );
};

