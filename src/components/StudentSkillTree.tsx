import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Lock, Zap, BookOpen, BrainCircuit, Star, X } from 'lucide-react';
import { Card, CardContent } from './ui/Card';

interface SkillNode {
  id: string;
  label: string;
  x: number;
  y: number;
  description: string;
  requiredXP: number;
  dependsOn: string[];
}

const KNOWLEDGE_NODES: SkillNode[] = [
  { id: 'math_basics', label: 'Основи на Математика', x: 50, y: 10, description: 'Аритметика, операции, основни равенки.', requiredXP: 0, dependsOn: [] },
  { id: 'algebra_1', label: 'Алгебра 1', x: 25, y: 30, description: 'Линеарни равенки, полиноми, системи.', requiredXP: 500, dependsOn: ['math_basics'] },
  { id: 'geometry_1', label: 'Геометрија', x: 75, y: 30, description: 'Планиметрија, агли, многуаголници.', requiredXP: 500, dependsOn: ['math_basics'] },
  { id: 'functions', label: 'Функции', x: 15, y: 55, description: 'Квадратни, експоненцијални функции.', requiredXP: 1000, dependsOn: ['algebra_1'] },
  { id: 'trigonometry', label: 'Тригонометрија', x: 50, y: 55, description: 'Синус, косинус, тригонометриски равенки.', requiredXP: 1200, dependsOn: ['algebra_1', 'geometry_1'] },
  { id: 'solid_geometry', label: 'Стереометрија', x: 85, y: 55, description: 'Просторни фигури, волумен и плоштина.', requiredXP: 1000, dependsOn: ['geometry_1'] },
  { id: 'calculus', label: 'Калкулус (Изводи)', x: 30, y: 80, description: 'Изводи, граници, примена на изводи.', requiredXP: 2000, dependsOn: ['functions', 'trigonometry'] },
  { id: 'statistics', label: 'Веројатност & Стат.', x: 70, y: 80, description: 'Анализа на податоци, комбинаторика.', requiredXP: 1500, dependsOn: ['trigonometry'] },
  { id: 'integrals', label: 'Интеграли', x: 50, y: 100, description: 'Определени и неопределени интеграли.', requiredXP: 3000, dependsOn: ['calculus'] },
];

export const StudentSkillTree: React.FC<{ currentXP: number }> = ({ currentXP }) => {
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);

  // Check if a node is unlocked based on XP and dependencies
  const isNodeUnlocked = (node: SkillNode) => {
    if (currentXP < node.requiredXP) return false;
    if (node.dependsOn.length === 0) return true;
    
    // Simplification: just check XP since tech tree strictly increases required XP down the graph
    return true; 
  };

  const isNodeCompleted = (node: SkillNode) => {
    // If you have more than enough XP, treat as completed
    return currentXP >= node.requiredXP + 500;
  };

  return (
    <div className="w-full relative bg-slate-950 rounded-[3rem] p-8 md:p-12 overflow-hidden shadow-2xl border border-slate-800 min-h-[800px] flex items-center justify-center">
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] bg-blue-600/20 rounded-full blur-[120px]" />
      
      {/* Title */}
      <div className="absolute top-10 left-10 z-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono uppercase tracking-[0.2em] mb-4 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <BrainCircuit className="w-4 h-4" />
          Зрно на Знаење (Knowledge Graph)
        </div>
        <h2 className="text-4xl font-black text-white tracking-tight">Твојата Траекторија</h2>
        <p className="text-slate-400 mt-2 max-w-sm">Отклучувај нови математички концепти преку решавање на дневени предизвици и собирање на XP.</p>
      </div>

      <div className="relative w-full max-w-4xl h-[700px] mt-20">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
           <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.8" />
                 <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
              </linearGradient>
           </defs>
          {KNOWLEDGE_NODES.map(node => (
            node.dependsOn.map(depId => {
              const depNode = KNOWLEDGE_NODES.find(n => n.id === depId);
              if (!depNode) return null;
              
              const unlocked = isNodeUnlocked(node);
              
              return (
                <motion.line
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  key={`${depId}-${node.id}`}
                  x1={`${depNode.x}%`}
                  y1={`${depNode.y}%`}
                  x2={`${node.x}%`}
                  y2={`${node.y}%`}
                  stroke={unlocked ? "url(#lineGrad)" : "#1e293b"}
                  strokeWidth="3"
                  className={unlocked ? "animate-pulse" : ""}
                />
              );
            })
          ))}
        </svg>

        {KNOWLEDGE_NODES.map((node) => {
          const unlocked = isNodeUnlocked(node);
          const completed = isNodeCompleted(node);
          const isSelected = selectedNode?.id === node.id;
          
          return (
            <motion.div
              key={node.id}
              whileHover={unlocked ? { scale: 1.1 } : {}}
              onClick={() => setSelectedNode(node)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 
                          ${unlocked ? 'drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'opacity-60'}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div className={`
                flex items-center justify-center rounded-2xl w-14 h-14 border-2 transition-all
                ${completed ? 'bg-indigo-600 border-indigo-400 text-white' : 
                  unlocked ? 'bg-slate-800 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-600'}
                ${isSelected ? 'ring-4 ring-indigo-500/50 scale-110' : ''}
              `}>
                {completed ? <CheckCircle2 className="w-7 h-7" /> : unlocked ? <Zap className="w-7 h-7" /> : <Lock className="w-6 h-6" />}
              </div>
              <div className="absolute top-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                 <div className={`font-bold text-sm ${unlocked ? 'text-white' : 'text-slate-500'}`}>{node.label}</div>
                 <div className={`text-[10px] font-mono uppercase font-black tracking-widest ${unlocked ? 'text-amber-400' : 'text-slate-600'}`}>
                    {node.requiredXP} XP
                 </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedNode && (
          <motion.div 
             initial={{ opacity: 0, y: 50, scale: 0.9 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 50, scale: 0.9 }}
             className="absolute bottom-10 right-10 z-50 w-96"
          >
             <Card className="bg-slate-900/90 backdrop-blur-xl border-slate-700 shadow-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
                <CardContent className="p-6">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                         <div className={`p-3 rounded-xl ${isNodeUnlocked(selectedNode) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                            {isNodeCompleted(selectedNode) ? <Star className="w-6 h-6" /> : isNodeUnlocked(selectedNode) ? <BookOpen className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                         </div>
                         <div>
                            <h3 className="text-xl font-bold text-white">{selectedNode.label}</h3>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 font-mono">
                               Status: {isNodeCompleted(selectedNode) ? 'Mastered' : isNodeUnlocked(selectedNode) ? 'Learning' : 'Locked'}
                            </span>
                         </div>
                      </div>
                      <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white transition-colors">
                         <X className="w-5 h-5" />
                      </button>
                   </div>
                   <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      {selectedNode.description}
                   </p>
                   
                   {!isNodeUnlocked(selectedNode) && (
                      <div className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between border border-slate-700">
                         <span className="text-xs font-bold text-slate-400 uppercase">Потребно:</span>
                         <span className="text-sm font-mono text-amber-500 font-black">{selectedNode.requiredXP} XP</span>
                      </div>
                   )}
                   
                   {isNodeUnlocked(selectedNode) && (
                      <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 flex justify-center items-center gap-2">
                         <BrainCircuit className="w-4 h-4" /> Вежбај го овој концепт
                      </button>
                   )}
                </CardContent>
             </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
