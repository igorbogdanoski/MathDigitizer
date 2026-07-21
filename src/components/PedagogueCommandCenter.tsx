import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Maximize2, Minimize2, Cpu, Zap, Brain, Activity,
  Network, Target, MessageSquare, BookOpen, Layers,
  Compass, ShieldCheck, Microscope, Database, Sparkles,
  ChevronRight, ChevronLeft, Terminal, Play, Save, Share2,
  Loader2, RefreshCw, Check, User
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLibraryStore } from '../store/useLibraryStore';
import { MathTask, LessonArchitectScript } from '../lib/schema';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useModalA11y } from '../hooks/useModalA11y';

const SIM_PERSONAS: { id: string; label: string }[] = [
  { id: 'struggling_abstraction', label: 'Се бори со апстракција' },
  { id: 'quick_careless', label: 'Брз но невнимателен' },
  { id: 'math_anxious', label: 'Математичка анксиозност' },
];

interface SimMessage {
  role: 'student' | 'teacher';
  text: string;
}

const LazyMathRenderer = lazy(() => import('./MathRenderer').then(m => ({ default: m.MathRenderer })));

interface Node {
  id: string;
  title: string;
  type: 'task' | 'concept' | 'resource';
  x?: number; y?: number; fx?: number | null; fy?: number | null; vx?: number; vy?: number; index?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  value: number;
}

export const PedagogueCommandCenter: React.FC = () => {
  const { 
    isCommandCenterOpen, 
    setIsCommandCenterOpen, 
    selectedTaskId,
    tasks 
  } = useLibraryStore();
  
  const [activeTab, setActiveTab] = useState<'map' | 'fingerprint' | 'architect' | 'simulation'>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [cognitiveFingerprint, setCognitiveFingerprint] = useState<{
    rigor: number;
    abstraction: number;
    connectivity: number;
    contextuality: number;
    effort: number;
  } | null>(null);
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
  const simMessagesEndRef = useRef<HTMLDivElement>(null);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);

  useEffect(() => {
    if (activeTab === 'map' && isCommandCenterOpen && selectedTask) {
      renderKnowledgeMap();
    }
    return () => {
      simulationRef.current?.stop();
    };
  }, [activeTab, isCommandCenterOpen, selectedTaskId]);

  useEffect(() => {
    setCognitiveFingerprint(null);
    setLessonScript(selectedTask?.lesson_architect_script || null);
    setScriptSaved(false);
    setSimMessages([]);
    setSimStarted(false);
    simChatRef.current = null;
  }, [selectedTaskId]);

  useEffect(() => {
    simMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages]);

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

  const renderKnowledgeMap = async () => {
    if (!svgRef.current || !selectedTask) return;
    const d3 = await import('d3');

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const nodes: Node[] = [
      { id: selectedTask.id as string, title: selectedTask.title, type: 'task' },
      ...(selectedTask.related_task_ids || []).map(id => {
        const t = tasks.find(task => task.id === id);
        return { id, title: t?.title || 'Related Task', type: 'task' } as Node;
      }),
      ...(selectedTask.prerequisite_task_ids || []).map(id => {
        const t = tasks.find(task => task.id === id);
        return { id, title: t?.title || 'Prerequisite', type: 'task' } as Node;
      })
    ];

    const links: Link[] = [
      ...(selectedTask.related_task_ids || []).map(id => ({ source: selectedTask.id as string, target: id, value: 1 })),
      ...(selectedTask.prerequisite_task_ids || []).map(id => ({ source: id, target: selectedTask.id as string, value: 2 }))
    ];

    simulationRef.current?.stop();
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2));
    simulationRef.current = simulation;

    const svg = d3.select(svgRef.current);

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value) * 2)
      .attr("stroke-dasharray", d => d.value === 2 ? "5,5" : "0");

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    node.append("circle")
      .attr("r", d => d.id === selectedTaskId ? 12 : 8)
      .attr("fill", d => d.id === selectedTaskId ? "#6366f1" : "#94a3b8")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2);

    node.append("text")
      .text(d => d.title)
      .attr("x", 15)
      .attr("y", 5)
      .attr("fill", "#f8fafc")
      .style("font-size", "10px")
      .style("font-family", "JetBrains Mono");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  };

  const generateAnalyzeFingerprint = async () => {
    if (!selectedTask) return;
    setIsAnalyzing(true);
    try {
      const [{ ai }, { Type }] = await Promise.all([import('../lib/gemini'), import('@google/genai')]);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
              PEDAGOGUE COMMAND CENTER
              <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-mono">v4.0.0</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">Mastery Layer Activation Ready</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700">
            {[
              { id: 'map', icon: Network, label: 'Knowledge Map' },
              { id: 'fingerprint', icon: Target, label: 'Cognitive Fingerprint' },
              { id: 'architect', icon: BookOpen, label: 'Lesson Architect' },
              { id: 'simulation', icon: Microscope, label: 'Socratic Sim' }
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
            aria-label="Close command center"
            title="Close command center"
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
              <motion.div 
                key="map"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full h-full relative"
              >
                <svg ref={svgRef} className="w-full h-full" />
                <div className="absolute bottom-8 left-8 p-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl max-w-sm">
                  <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2 mb-2">
                    <Database className="w-3 h-3 text-indigo-400" />
                    GRAPH LEGEND
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>PRIMARY TASK NODE</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>RELATIONSHIP CONNECTION</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <div className="w-6 h-px bg-slate-600 border-dashed border-t" />
                      <span>PREREQUISITE DEPENDENCY</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'fingerprint' && (
              <motion.div 
                key="fingerprint"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full h-full flex items-center justify-center p-12"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-6xl">
                  <div className="flex flex-col justify-center gap-8">
                    <div>
                      <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-4">
                        Cognitive Fingerprint Analysis
                      </h2>
                      <p className="text-slate-400 max-w-md leading-relaxed">
                        Every task has a unique pedagogical signature. Our AI engine decodes the multi-dimensional complexity of abstract reasoning.
                      </p>
                    </div>
                    
                    {!cognitiveFingerprint ? (
                      <Button 
                        size="lg" 
                        onClick={generateAnalyzeFingerprint}
                        disabled={isAnalyzing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white w-fit group px-8"
                      >
                        {isAnalyzing ? <Activity className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 group-hover:animate-pulse" />}
                        {isAnalyzing ? 'Decoding DNA...' : 'Perform Cognitive Autopsy'}
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Rigor', value: cognitiveFingerprint.rigor, color: 'indigo' },
                          { label: 'Abstraction', value: cognitiveFingerprint.abstraction, color: 'purple' },
                          { label: 'Connectivity', value: cognitiveFingerprint.connectivity, color: 'blue' },
                          { label: 'Context', value: cognitiveFingerprint.contextuality, color: 'emerald' },
                          { label: 'Effort', value: cognitiveFingerprint.effort, color: 'orange' }
                        ].map(stat => (
                          <div key={stat.label} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                            <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">{stat.label}</div>
                            <div className="text-2xl font-mono text-white flex items-end gap-1">
                              {stat.value}
                              <span className="text-[10px] text-slate-600 mb-1.5">%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${stat.value}%` }}
                                className={`h-full bg-${stat.color}-500 shadow-[0_0_10px_rgba(var(--tw-gradient-to-r))]`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center bg-slate-900/30 rounded-7xl border border-slate-800/50 p-8 backdrop-blur-sm">
                    {cognitiveFingerprint ? (
                      <svg width="400" height="400" viewBox="0 0 400 400">
                        {/* Radar Chart Lines */}
                        {[20, 40, 60, 80, 100].map(r => (
                          <circle key={r} cx="200" cy="200" r={r * 1.5} fill="none" stroke="#1e293b" strokeWidth="1" />
                        ))}
                        {/* Radar Data */}
                        <motion.path 
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          d={(() => {
                            const center = 200;
                            const scale = 1.5;
                            const points = [
                              { a: 0, r: cognitiveFingerprint.rigor },
                              { a: (Math.PI * 2) / 5, r: cognitiveFingerprint.abstraction },
                              { a: (Math.PI * 2 * 2) / 5, r: cognitiveFingerprint.connectivity },
                              { a: (Math.PI * 2 * 3) / 5, r: cognitiveFingerprint.contextuality },
                              { a: (Math.PI * 2 * 4) / 5, r: cognitiveFingerprint.effort }
                            ];
                            return points.map((p, i) => {
                              const x = center + Math.cos(p.a - Math.PI / 2) * p.r * scale;
                              const y = center + Math.sin(p.a - Math.PI / 2) * p.r * scale;
                              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                            }).join(' ') + ' Z';
                          })()}
                          fill="rgba(99, 102, 241, 0.2)"
                          stroke="#6366f1"
                          strokeWidth="2"
                        />
                      </svg>
                    ) : (
                      <div className="text-center">
                        <Compass className="w-48 h-48 text-slate-800 animate-spin-slow mb-4 mx-auto" strokeWidth={0.5} />
                        <p className="text-slate-600 font-mono text-xs uppercase tracking-widest">Awaiting Analysis...</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'architect' && (
              <motion.div
                key="architect"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full p-8 overflow-y-auto"
              >
                <div className="max-w-4xl mx-auto space-y-8">
                  <header className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">Lesson Architect</h2>
                      <p className="text-slate-400">AI-генериран методолошки скрипт специфичен за избраната задача.</p>
                    </div>
                    {selectedTask && (
                      <Button
                        onClick={handleGenerateLessonScript}
                        disabled={isGeneratingScript || !selectedTask}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                      >
                        {isGeneratingScript ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        {lessonScript ? 'Регенерирај' : 'Генерирај скрипт'}
                      </Button>
                    )}
                  </header>

                  {!selectedTask ? (
                    <div className="text-center py-24 opacity-50">
                      <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500 text-sm uppercase tracking-widest">Изберете задача за да генерирате методолошки скрипт</p>
                    </div>
                  ) : !lessonScript ? (
                    <div className="text-center py-24">
                      {isGeneratingScript ? (
                        <>
                          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
                          <p className="text-slate-400 text-sm">Составувам методолошки скрипт...</p>
                        </>
                      ) : (
                        <p className="text-slate-500 text-sm">Кликнете „Генерирај скрипт" за да добиете Socratic hook, аналогија и инструкциска секвенца за оваа задача.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-slate-900 border-slate-800">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <MessageSquare className="w-5 h-5 text-indigo-400" />
                              <h3 className="font-bold text-slate-100">Socratic Hook</h3>
                            </div>
                            <p className="text-sm text-slate-400 italic">"{lessonScript.socratic_hook}"</p>
                          </CardContent>
                        </Card>

                        <Card className="bg-slate-900 border-slate-800">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <Zap className="w-5 h-5 text-amber-400" />
                              <h3 className="font-bold text-slate-100">Metaphoric Bridge</h3>
                            </div>
                            <p className="text-sm text-slate-400">{lessonScript.metaphoric_bridge}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <Layers className="w-5 h-5 text-purple-400" />
                            <h3 className="text-lg font-bold text-white">Instructional Sequence</h3>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveLessonScript}
                            disabled={isSavingScript || !selectedTask?.id}
                            className="border-slate-700 text-slate-300"
                          >
                            {isSavingScript ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : scriptSaved ? <Check className="w-4 h-4 mr-2 text-emerald-400" /> : <Save className="w-4 h-4 mr-2" />}
                            {scriptSaved ? 'Зачувано' : 'Save Script'}
                          </Button>
                        </div>

                        <div className="space-y-6">
                          {lessonScript.instructional_sequence.map((step, i) => (
                            <div key={i} className="flex gap-4 group">
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-mono text-slate-400 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-colors">
                                  {i + 1}
                                </div>
                                <div className="flex-1 w-px bg-slate-800 group-last:bg-transparent my-2" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1 rounded">{step.time}</span>
                                  <h4 className="text-sm font-bold text-slate-200">{step.title}</h4>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'simulation' && (
              <motion.div
                key="simulation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full flex flex-col p-8"
              >
                <div className="flex-1 bg-slate-950/50 rounded-7xl border border-slate-800/50 overflow-hidden flex flex-col shadow-inner">
                  <header className="px-8 py-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${simStarted ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                      <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Socratic AI Student: SIM-01</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono">PERSONA:</span>
                        <select
                          title="Student persona"
                          aria-label="Student persona"
                          value={simPersona}
                          onChange={(e) => setSimPersona(e.target.value)}
                          disabled={isSimLoading}
                          className="bg-slate-800 border-none text-[10px] text-slate-300 rounded px-2 py-1 outline-none"
                        >
                          {SIM_PERSONAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                      </div>
                      {simStarted && (
                        <button
                          onClick={handleStartSimulation}
                          disabled={isSimLoading}
                          title="Рестартирај симулација"
                          aria-label="Рестартирај симулација"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </header>

                  <div className="flex-1 p-8 overflow-y-auto space-y-6">
                    {!selectedTask ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <Microscope className="w-12 h-12 text-slate-600 mb-4" />
                        <p className="text-xs text-slate-500 uppercase tracking-widest">Изберете задача за да ја стартувате симулацијата</p>
                      </div>
                    ) : !simStarted ? (
                      <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                        <p className="text-slate-400 text-sm max-w-md">Вежбајте Сократовско пренасочување со виртуелен ученик кој ја „решава" избраната задача, со избраната персона.</p>
                        <Button onClick={handleStartSimulation} disabled={isSimLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          {isSimLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                          Започни симулација
                        </Button>
                      </div>
                    ) : (
                      <>
                        {simMessages.map((msg, i) => (
                          <div key={i} className={`flex gap-4 max-w-2xl ${msg.role === 'teacher' ? 'ml-auto flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'teacher' ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                              {msg.role === 'teacher' ? <User className="w-4 h-4 text-white" /> : <Brain className="w-4 h-4 text-slate-400" />}
                            </div>
                            <div className={`rounded-2xl p-4 ${msg.role === 'teacher' ? 'bg-indigo-600 rounded-tr-none' : 'bg-slate-900 border border-slate-800 rounded-tl-none'}`}>
                              <p className={`text-sm ${msg.role === 'teacher' ? 'text-white' : 'text-slate-300'}`}>{msg.text}</p>
                            </div>
                          </div>
                        ))}
                        {isSimLoading && (
                          <div className="flex gap-4 max-w-2xl">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                              <Brain className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4">
                              <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                            </div>
                          </div>
                        )}
                        <div ref={simMessagesEndRef} />
                      </>
                    )}
                  </div>

                  <div className="p-6 bg-slate-900/80 backdrop-blur-md border-t border-slate-800">
                    <div className="relative">
                      <input
                        value={simInput}
                        onChange={(e) => setSimInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendSimMessage(); } }}
                        disabled={!simStarted || isSimLoading}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 transition-colors outline-none pr-12 disabled:opacity-40"
                        placeholder="Practice your Socratic redirection here..."
                      />
                      <button
                        onClick={handleSendSimMessage}
                        disabled={!simStarted || isSimLoading || !simInput.trim()}
                        title="Send response"
                        aria-label="Send response"
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                      >
                        <Play className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 text-center uppercase tracking-tighter">Enter your response to guide the virtual student's intuition</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* HUD Sidebar (Task Details) */}
        <aside 
          className={`h-full border-l border-slate-800 bg-slate-900/30 backdrop-blur-2xl transition-all duration-500 ease-in-out relative z-10 flex flex-col ${
            isSidebarOpen ? 'w-[450px]' : 'w-0'
          }`}
        >
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? 'Collapse details panel' : 'Expand details panel'}
            title={isSidebarOpen ? 'Collapse details panel' : 'Expand details panel'}
            className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            {isSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {selectedTask ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-mono uppercase tracking-widest mb-1">
                    <Sparkles className="w-3 h-3" />
                    TARGET DATA SOURCE
                  </div>
                  <h1 className="text-2xl font-bold text-white leading-tight">{selectedTask.title}</h1>
                </div>

                <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <Suspense fallback={<span className="text-slate-400 text-xs">Loading...</span>}>
                    <LazyMathRenderer content={selectedTask.original_text} />
                  </Suspense>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-300">Pedagogical Fidelity</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">98.4%</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-300">Cognitive Load Factor</span>
                    </div>
                    <span className="text-xs font-mono text-blue-400">High</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Metadata Stream</h3>
                  <div className="space-y-2">
                    {selectedTask.tags.map(tag => (
                      <div key={tag} className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-500 uppercase">{tag}</span>
                        <span className="text-indigo-400">ACTIVE</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <Microscope className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-xs text-slate-500 uppercase tracking-widest">Select task to initialize<br/>neural mapping</p>
              </div>
            )}
          </div>
          
          <div className="p-6 bg-slate-900 border-t border-slate-800">
            <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl h-12">
              <Share2 className="w-4 h-4 mr-2" />
              Intelligence Broadcast
            </Button>
          </div>
        </aside>
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
