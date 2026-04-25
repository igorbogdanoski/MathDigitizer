import React from 'react';
import { BrainCircuit } from 'lucide-react';

interface ConceptMastery {
  id: string;
  name: string;
  x: number; // 0-100%
  y: number; // 0-100%
  mastery: number; // 0-100
  prerequisites: string[];
}

const mockConcepts: ConceptMastery[] = [
  { id: 'add', name: 'Собирање', x: 20, y: 15, mastery: 95, prerequisites: [] },
  { id: 'sub', name: 'Одземање', x: 45, y: 15, mastery: 90, prerequisites: ['add'] },
  { id: 'mul', name: 'Множење', x: 70, y: 15, mastery: 85, prerequisites: ['add'] },
  
  { id: 'div', name: 'Делење', x: 45, y: 40, mastery: 70, prerequisites: ['sub', 'mul'] },
  { id: 'sqrt', name: 'Корен', x: 80, y: 40, mastery: 80, prerequisites: ['mul'] },
  
  { id: 'frac', name: 'Дропки', x: 45, y: 65, mastery: 40, prerequisites: ['div'] },
  { id: 'pyth', name: 'Питагорова Т.', x: 80, y: 65, mastery: 30, prerequisites: ['sqrt'] },
  
  { id: 'perc', name: 'Проценти', x: 45, y: 85, mastery: 65, prerequisites: ['frac'] },
  { id: 'trig', name: 'Тригонометрија', x: 80, y: 85, mastery: 10, prerequisites: ['pyth'] },
];

export const KnowledgeGraphVisualizer: React.FC<{ struggleTopic?: string }> = ({ struggleTopic }) => {
  
  const getFillColor = (mastery: number, name: string) => {
    if (name === struggleTopic) return 'fill-red-500 border-red-200';
    if (mastery >= 85) return 'fill-emerald-500 border-emerald-200';
    if (mastery >= 60) return 'fill-amber-500 border-amber-200';
    return 'fill-red-500 border-red-200';
  };
  
  const getStrokeColor = (mastery: number, name: string) => {
    if (name === struggleTopic) return 'stroke-red-500';
    if (mastery >= 85) return 'stroke-emerald-500';
    if (mastery >= 60) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  const getEdgeStyle = (sourceNode: ConceptMastery, targetNode: ConceptMastery) => {
    // If target is failing, color the line red to highlight the break in knowledge
    if (targetNode.mastery < 50 || targetNode.name === struggleTopic) {
      return "stroke-red-400 dark:stroke-red-900 stroke-[3] stroke-dasharray-[4,4] animate-pulse";
    }
    return "stroke-emerald-200 dark:stroke-emerald-900/50 stroke-[2]";
  };

  return (
    <div className="w-full flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
       <div className="flex items-center gap-2 mb-2">
         <BrainCircuit className="w-5 h-5 text-indigo-500" />
         <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Мапа на Знаење</h3>
       </div>
       <div className="flex-1 w-full min-h-[300px] relative">
            <svg className="absolute inset-0 w-full h-full" overflow="visible">
              
              {/* Draw Edges */}
              {mockConcepts.map(target => 
                target.prerequisites.map(preId => {
                  const source = mockConcepts.find(c => c.id === preId);
                  if (!source) return null;
                  
                  // Simple curve
                  const pathData = `M ${source.x}% ${source.y + 5}% Q ${source.x}% ${target.y}%, ${target.x}% ${target.y - 5}%`;

                  return (
                    <path 
                      key={`edge-${source.id}-${target.id}`} 
                      d={pathData} 
                      fill="none"
                      className={getEdgeStyle(source, target)} 
                    />
                  );
                })
              )}
              
              {/* Draw Nodes */}
              {mockConcepts.map(concept => (
                 <g key={concept.id} className="cursor-pointer transition-transform hover:scale-110">
                   <circle 
                     cx={`${concept.x}%`} 
                     cy={`${concept.y}%`} 
                     r="25" 
                     className={`stroke-4 ${getFillColor(concept.mastery, concept.name)} dark:border-opacity-20 translate-transform origin-center`} 
                   />
                   {/* Inner white circle for text contrast */}
                   <circle cx={`${concept.x}%`} cy={`${concept.y}%`} r="20" className="fill-white dark:fill-slate-800" />
                   <text 
                     x={`${concept.x}%`} 
                     y={`${concept.y}%`}
                     dy="1"
                     textAnchor="middle" 
                     alignmentBaseline="middle"
                     className="text-xs font-black fill-slate-800 dark:fill-slate-200 pointer-events-none"
                     style={{ fontSize: '11px' }}
                   >
                     {concept.mastery}%
                   </text>
                   {/* Label below */}
                   <text 
                     x={`${concept.x}%`} 
                     y={`${concept.y}%`}
                     dy="38"
                     textAnchor="middle" 
                     className="text-xs font-bold fill-slate-600 dark:fill-slate-400 pointer-events-none"
                   >
                     {concept.name}
                   </text>
                 </g>
              ))}
            </svg>
       </div>
    </div>
  );
};
