import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Lock, Zap, BookOpen, BrainCircuit, Star, X } from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  MasteryRecord,
  SkillNodeSpec,
  isNodeCompleted as isCompleted,
  isNodeUnlocked as isUnlocked,
  nodeMasteryLevel,
  practiceLinkFor,
} from '../lib/student/skillTree';

interface SkillNode extends SkillNodeSpec {
  label: string;
  x: number;
  y: number;
  description: string;
}

const KNOWLEDGE_NODES: SkillNode[] = [
  { id: 'math_basics', label: 'Основи на Математика', x: 50, y: 10, description: 'Аритметика, операции, основни равенки.', requiredXP: 0, dependsOn: [], topicKeywords: ['аритметик', 'основи', 'броев'] },
  { id: 'algebra_1', label: 'Алгебра 1', x: 25, y: 30, description: 'Линеарни равенки, полиноми, системи.', requiredXP: 500, dependsOn: ['math_basics'], topicKeywords: ['алгебра', 'равенк', 'полином', 'систем'] },
  { id: 'geometry_1', label: 'Геометрија', x: 75, y: 30, description: 'Планиметрија, агли, многуаголници.', requiredXP: 500, dependsOn: ['math_basics'], topicKeywords: ['геометрија', 'агол', 'триаголник', 'многуаголник'] },
  { id: 'functions', label: 'Функции', x: 15, y: 55, description: 'Квадратни, експоненцијални функции.', requiredXP: 1000, dependsOn: ['algebra_1'], topicKeywords: ['функц', 'квадратн', 'експоненц'] },
  { id: 'trigonometry', label: 'Тригонометрија', x: 50, y: 55, description: 'Синус, косинус, тригонометриски равенки.', requiredXP: 1200, dependsOn: ['algebra_1', 'geometry_1'], topicKeywords: ['тригоном', 'синус', 'косинус'] },
  { id: 'solid_geometry', label: 'Стереометрија', x: 85, y: 55, description: 'Просторни фигури, волумен и плоштина.', requiredXP: 1000, dependsOn: ['geometry_1'], topicKeywords: ['стереометр', 'волумен', 'плоштина'] },
  { id: 'calculus', label: 'Калкулус (Изводи)', x: 30, y: 80, description: 'Изводи, граници, примена на изводи.', requiredXP: 2000, dependsOn: ['functions', 'trigonometry'], topicKeywords: ['извод', 'граничн', 'лимес'] },
  { id: 'statistics', label: 'Веројатност & Стат.', x: 70, y: 80, description: 'Анализа на податоци, комбинаторика.', requiredXP: 1500, dependsOn: ['trigonometry'], topicKeywords: ['веројатн', 'статист', 'комбинатор'] },
  { id: 'integrals', label: 'Интеграли', x: 50, y: 100, description: 'Определени и неопределени интеграли.', requiredXP: 3000, dependsOn: ['calculus'], topicKeywords: ['интеграл'] },
];

export const StudentSkillTree: React.FC<{ currentXP: number }> = ({ currentXP }) => {
  const { t } = useTranslation(['studentDashboard', 'common']);
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);
  const [mastery, setMastery] = useState<MasteryRecord[]>([]);

  // Real mastery evidence — the tree used to unlock on XP alone, with the
  // dependency check explicitly skipped.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    let cancelled = false;
    getDocs(query(collection(db, 'user_mastery'), where('uid', '==', user.uid)))
      .then(snapshot => {
        if (cancelled) return;
        setMastery(snapshot.docs.map(d => d.data() as MasteryRecord));
      })
      .catch(err => console.warn('Failed to load mastery for skill tree', err));

    return () => { cancelled = true; };
  }, []);

  const isNodeUnlocked = (node: SkillNode) => isUnlocked(node, KNOWLEDGE_NODES, mastery, currentXP);
  const isNodeCompleted = (node: SkillNode) => isCompleted(node, mastery, currentXP);

  return (
    <div className="w-full relative bg-slate-950 rounded-7xl p-8 md:p-12 overflow-hidden shadow-2xl border border-slate-800 min-h-[800px] flex items-center justify-center">
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#6366f1 2px, transparent 2px)', backgroundSize: '60px 60px' }} />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(2,6,23,1))] pointer-events-none"></div>
      <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[150px] mix-blend-screen" />
      <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] bg-rose-600/20 rounded-full blur-[150px] mix-blend-screen" />
      
      {/* Title */}
      <div className="absolute top-10 left-10 z-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-indigo-300 text-xs font-black uppercase tracking-[0.2em] mb-4 shadow-[0_0_20px_rgba(4,4,5,0.5)] backdrop-blur-md">
          <BrainCircuit className="w-4 h-4 text-rose-400" aria-hidden="true" />
          {t('skillTree.badge')}
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">{t('skillTree.title')}</h2>
        <p className="text-slate-400 mt-3 max-w-sm font-medium">{t('skillTree.subtitle')}</p>
      </div>

      <div className="relative w-full max-w-5xl h-[700px] mt-24">
        <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" preserveAspectRatio="none">
           <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
                 <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
                 <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
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
                  transition={{ duration: 2, ease: "easeInOut" }}
                  key={`${depId}-${node.id}`}
                  x1={`${depNode.x}%`}
                  y1={`${depNode.y}%`}
                  x2={`${node.x}%`}
                  y2={`${node.y}%`}
                  stroke={unlocked ? "url(#lineGrad)" : "rgba(30,34,55,0.8)"}
                  strokeWidth={unlocked ? "4" : "2"}
                  className={unlocked ? "" : "stroke-dasharray-4"}
                  strokeDasharray={unlocked ? "none" : "8 8"}
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
              whileHover={unlocked ? { scale: 1.15 } : {}}
              onClick={() => setSelectedNode(node)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 
                          ${unlocked ? 'drop-shadow-[0_0_20px_rgba(99,102,241,0.6)]' : 'opacity-50 grayscale'}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div className={`
                flex items-center justify-center rounded-[1.2rem] w-16 h-16 border-2 transition-all duration-300
                ${completed ? 'bg-gradient-to-br from-indigo-500 to-blue-600 border-white/20 text-white shadow-inner' : 
                  unlocked ? 'bg-slate-900 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-600'}
                ${isSelected ? 'ring-4 ring-rose-500/50 scale-110 rotate-3' : ''}
              `}>
                {completed ? <CheckCircle2 className="w-8 h-8" /> : unlocked ? <Zap className="w-8 h-8" /> : <Lock className="w-6 h-6" />}
              </div>
              <div className="absolute top-20 left-1/2 -translate-x-1/2 whitespace-nowrap text-center bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-700/50">
                 <div className={`font-black text-xs uppercase tracking-wide ${unlocked ? 'text-white' : 'text-slate-500'}`}>{node.label}</div>
                 <div className={`text-[10px] font-mono uppercase font-black tracking-widest ${unlocked ? 'text-rose-400' : 'text-slate-600'}`}>
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
             initial={{ opacity: 0, x: 50, scale: 0.95 }}
             animate={{ opacity: 1, x: 0, scale: 1 }}
             exit={{ opacity: 0, x: 50, scale: 0.95 }}
             className="absolute bottom-10 right-10 z-50 w-96"
          >
             <Card className="bg-slate-900/95 backdrop-blur-2xl border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-5xl">
                <div className="h-1.5 bg-gradient-to-r from-rose-500 via-indigo-500 to-blue-500"></div>
                <CardContent className="p-8">
                   <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                         <div className={`p-4 rounded-2xl ${isNodeUnlocked(selectedNode) ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                            {isNodeCompleted(selectedNode) ? <Star className="w-7 h-7" /> : isNodeUnlocked(selectedNode) ? <BookOpen className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
                         </div>
                         <div>
                            <h3 className="text-2xl font-black text-white leading-tight">{selectedNode.label}</h3>
                            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400 font-mono bg-emerald-400/10 px-2 py-0.5 rounded-lg">
                               {isNodeCompleted(selectedNode)
                                 ? t('skillTree.statusMastered')
                                 : isNodeUnlocked(selectedNode)
                                   ? t('skillTree.statusInProgress')
                                   : t('skillTree.statusLocked')}
                            </span>
                         </div>
                      </div>
                      <button onClick={() => setSelectedNode(null)} aria-label={t('common:ariaClose')} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
                         <X className="w-5 h-5" />
                      </button>
                   </div>
                   <p className="text-slate-300 text-sm leading-relaxed mb-8 font-medium">
                      {selectedNode.description}
                   </p>
                   
                   {!isNodeUnlocked(selectedNode) && (
                      <div className="space-y-3">
                         <div className="bg-slate-800/80 rounded-2xl p-4 flex items-center justify-between border border-slate-700">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('skillTree.required')}</span>
                            <span className="text-lg font-mono text-rose-400 font-black tracking-wider">{selectedNode.requiredXP} XP</span>
                         </div>

                         {/* Say which prerequisite is actually missing, rather than
                             leaving the student to guess at a locked node. */}
                         {currentXP >= selectedNode.requiredXP && selectedNode.dependsOn.length > 0 && (
                            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
                               <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">
                                  {t('skillTree.missingPrerequisites')}
                               </span>
                               <ul className="space-y-1">
                                  {selectedNode.dependsOn
                                    .map(id => KNOWLEDGE_NODES.find(n => n.id === id))
                                    .filter((dep): dep is SkillNode => !!dep && !isNodeCompleted(dep))
                                    .map(dep => (
                                      <li key={dep.id} className="text-sm text-slate-300 flex items-center justify-between gap-3">
                                         <span>{dep.label}</span>
                                         <span className="text-[10px] font-mono text-slate-500">
                                            {Math.round(nodeMasteryLevel(dep, mastery) * 100)}%
                                         </span>
                                      </li>
                                    ))}
                               </ul>
                            </div>
                         )}
                      </div>
                   )}

                   {isNodeUnlocked(selectedNode) && (
                      <a
                         href={practiceLinkFor(selectedNode, mastery)}
                         className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                      >
                         <BrainCircuit className="w-5 h-5" aria-hidden="true" /> {t('skillTree.startTraining')}
                      </a>
                   )}
                </CardContent>
             </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
