import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Cpu, Network, Target, BookOpen, Microscope
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLibraryStore } from '../store/useLibraryStore';
import { LessonArchitectScript } from '../lib/schema';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  KnowledgeMapTab,
  CognitiveFingerprintTab,
  LessonArchitectTab,
  SocraticSimulationTab,
  CommandCenterSidebar,
} from './pedagogue-command-center';
import type { SimMessage, CognitiveFingerprint } from './pedagogue-command-center';
import { DEFAULT_MODEL } from '../lib/ai/models';

export const PedagogueCommandCenter: React.FC = () => {
  const { t } = useTranslation('pedagogue');
  const {
    isCommandCenterOpen,
    setIsCommandCenterOpen,
    selectedTaskId,
    tasks
  } = useLibraryStore();

  const [activeTab, setActiveTab] = useState<'map' | 'fingerprint' | 'architect' | 'simulation'>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [cognitiveFingerprint, setCognitiveFingerprint] = useState<CognitiveFingerprint | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [lessonScript, setLessonScript] = useState<LessonArchitectScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [scriptSaved, setScriptSaved] = useState(false);

  const [simPersona, setSimPersona] = useState<string>('struggling_abstraction');
  const [simMessages, setSimMessages] = useState<SimMessage[]>([]);
  const [simInput, setSimInput] = useState('');
  const [isSimLoading, setIsSimLoading] = useState(false);
  const [simStarted, setSimStarted] = useState(false);
  const simChatRef = useRef<any>(null);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  useEffect(() => {
    setCognitiveFingerprint(null);
    setLessonScript(selectedTask?.lesson_architect_script || null);
    setScriptSaved(false);
    setSimMessages([]);
    setSimStarted(false);
    simChatRef.current = null;
  }, [selectedTaskId]);

  const handleGenerateLessonScript = async () => {
    if (!selectedTask) return;
    const taskId = selectedTask.id;
    setIsGeneratingScript(true);
    setScriptSaved(false);
    try {
      const { generateLessonArchitectScript } = await import('../lib/gemini');
      const script = await generateLessonArchitectScript(selectedTask);
      if (useLibraryStore.getState().selectedTaskId !== taskId) return;
      setLessonScript(script);
    } catch (e) {
      console.error('Грешка при генерирање на методолошки скрипт:', e);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSaveLessonScript = async () => {
    if (!selectedTask?.id || !lessonScript) return;
    const taskId = selectedTask.id;
    setIsSavingScript(true);
    try {
      await updateDoc(doc(db, 'tasks', taskId), { lesson_architect_script: lessonScript });
      if (useLibraryStore.getState().selectedTaskId !== taskId) return;
      setScriptSaved(true);
      setTimeout(() => setScriptSaved(false), 2500);
    } catch (e) {
      console.error('Грешка при зачувување на скриптот:', e);
    } finally {
      setIsSavingScript(false);
    }
  };

  const handleStartSimulation = async () => {
    if (!selectedTask) return;
    setIsSimLoading(true);
    setSimMessages([]);
    try {
      const { getSocraticSimulationSession } = await import('../lib/gemini');
      const chat = await getSocraticSimulationSession(selectedTask, simPersona);
      simChatRef.current = chat;
      const response = await chat.sendMessage({ message: 'Започни.' });
      setSimMessages([{ role: 'student', text: response.text || '' }]);
      setSimStarted(true);
    } catch (e) {
      console.error('Грешка при стартување на симулацијата:', e);
    } finally {
      setIsSimLoading(false);
    }
  };

  const handleSendSimMessage = async () => {
    const message = simInput.trim();
    if (!message || !simChatRef.current || isSimLoading) return;
    setSimInput('');
    setSimMessages(prev => [...prev, { role: 'teacher', text: message }]);
    setIsSimLoading(true);
    try {
      const response = await simChatRef.current.sendMessage({ message });
      setSimMessages(prev => [...prev, { role: 'student', text: response.text || '' }]);
    } catch (e) {
      console.error('Грешка во симулацијата:', e);
    } finally {
      setIsSimLoading(false);
    }
  };

  const generateAnalyzeFingerprint = async () => {
    if (!selectedTask) return;
    setIsAnalyzing(true);
    try {
      const [{ ai }, { Type }] = await Promise.all([import('../lib/gemini'), import('@google/genai')]);
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Analyze this math task and provide a cognitive fingerprint (scores 0-100):
        Title: ${selectedTask.title}
        Text: ${selectedTask.original_text}

        Provide: rigor, abstraction, connectivity, contextuality, effort.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rigor: { type: Type.NUMBER },
              abstraction: { type: Type.NUMBER },
              connectivity: { type: Type.NUMBER },
              contextuality: { type: Type.NUMBER },
              effort: { type: Type.NUMBER }
            },
            required: ['rigor', 'abstraction', 'connectivity', 'contextuality', 'effort']
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      setCognitiveFingerprint(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const modalRef = useModalA11y<HTMLDivElement>(() => setIsCommandCenterOpen(false), isCommandCenterOpen);

  if (!isCommandCenterOpen) return null;

  return (
    <motion.div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pedagogue Command Center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans overflow-hidden"
    >
      {/* HUD Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 shadow-2xl relative z-20">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-slate-100 font-bold tracking-tight flex items-center gap-2">
              {t('header.title')}
              <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-mono">{t('header.version')}</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">{t('header.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700">
            {[
              { id: 'map', icon: Network, label: t('tabs.knowledgeMap') },
              { id: 'fingerprint', icon: Target, label: t('tabs.cognitiveFingerprint') },
              { id: 'architect', icon: BookOpen, label: t('tabs.lessonArchitect') },
              { id: 'simulation', icon: Microscope, label: t('tabs.socraticSim') }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-slate-800 mx-2" />

          <button
            onClick={() => setIsCommandCenterOpen(false)}
            aria-label={t('close')}
            title={t('close')}
            className="p-2 text-slate-400 hover:text-white hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Viewport */}
        <main className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:40px_40px]" />

          <AnimatePresence mode="wait">
            {activeTab === 'map' && (
              <KnowledgeMapTab
                task={selectedTask}
                tasks={tasks}
                selectedTaskId={selectedTaskId}
              />
            )}

            {activeTab === 'fingerprint' && (
              <CognitiveFingerprintTab
                task={selectedTask}
                cognitiveFingerprint={cognitiveFingerprint}
                isAnalyzing={isAnalyzing}
                onAnalyze={generateAnalyzeFingerprint}
              />
            )}

            {activeTab === 'architect' && (
              <LessonArchitectTab
                task={selectedTask}
                lessonScript={lessonScript}
                isGeneratingScript={isGeneratingScript}
                isSavingScript={isSavingScript}
                scriptSaved={scriptSaved}
                onGenerate={handleGenerateLessonScript}
                onSave={handleSaveLessonScript}
              />
            )}

            {activeTab === 'simulation' && (
              <SocraticSimulationTab
                task={selectedTask}
                simPersona={simPersona}
                simMessages={simMessages}
                simInput={simInput}
                isSimLoading={isSimLoading}
                simStarted={simStarted}
                onPersonaChange={setSimPersona}
                onInputChange={setSimInput}
                onStartSimulation={handleStartSimulation}
                onSendMessage={handleSendSimMessage}
              />
            )}
          </AnimatePresence>
        </main>

        {/* HUD Sidebar (Task Details) */}
        <CommandCenterSidebar
          task={selectedTask}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </motion.div>
  );
};
