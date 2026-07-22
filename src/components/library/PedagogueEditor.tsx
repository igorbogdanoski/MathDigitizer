import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Eye, Code, Save,
  Layout, Brain, Zap
} from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';
import { useLibraryStore } from '../../store/useLibraryStore';
import { enhancePedagogueTask } from '../../lib/gemini';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useModalA11y } from '../../hooks/useModalA11y';
import { ContentArchitectureTab, PedagogicalDNATab, AIEnhancementTab, TaskPreviewCard } from './pedagogue-editor';

export const PedagogueEditor: React.FC = () => {
  const { editingTask, setEditingTask, tasks, setTasks, onTaskUpdated } = useLibraryStore();
  const [localTask, setLocalTask] = useState<MathTask | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'pedagogy' | 'ai'>('content');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

  const modalRef = useModalA11y<HTMLDivElement>(() => setEditingTask(null), !!(editingTask && localTask));

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
      ref={modalRef}
      role="dialog"
      aria-modal="true"
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
                  <ContentArchitectureTab
                    localTask={localTask}
                    updateField={updateField}
                    addStep={addStep}
                    removeStep={removeStep}
                    updateStep={updateStep}
                    addTag={addTag}
                    removeTag={removeTag}
                  />
                )}

                {activeTab === 'pedagogy' && (
                  <PedagogicalDNATab
                    localTask={localTask}
                    updateInsightField={updateInsightField}
                  />
                )}

                {activeTab === 'ai' && (
                  <AIEnhancementTab
                    onAIAction={handleAIAction}
                    isAILoading={isAILoading}
                  />
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
                <TaskPreviewCard localTask={localTask} />
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
