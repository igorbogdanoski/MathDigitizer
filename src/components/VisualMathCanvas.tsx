import React, { useMemo } from 'react';

interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface MathPlotConfig {
  viewport: Viewport;
  grid?: { stepX: number; stepY: number; showAxes: boolean };
  elements: any[];
}

export const VisualMathCanvas = ({ jsonConfig }: { jsonConfig: any }) => {
  const config: MathPlotConfig | null = useMemo(() => {
    try {
      if (typeof jsonConfig === 'object' && jsonConfig !== null) {
         return jsonConfig;
      }
      if (typeof jsonConfig === 'string') {
         // It might be double stringified, let's parse until it's an object
         let parsed = JSON.parse(jsonConfig);
         if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
         }
         return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, [jsonConfig]);

  if (!config) {
    return <div className="text-red-500 font-mono text-sm p-4 bg-red-50 rounded">Invalid math-plot JSON</div>;
  }

  const viewport = config.viewport || { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  const grid = config.grid;
  const elements = Array.isArray(config.elements) ? config.elements : [];
  const W = Math.max((viewport.xMax - viewport.xMin) || 20, 1);
  const H = Math.max((viewport.yMax - viewport.yMin) || 20, 1);
  
  // Internal SVG resolution (perfectly matched to viewport aspect ratio)
  const svgWidth = 800;
  const svgHeight = (H / W) * svgWidth;

  // Coordinate mapping functions
  const mapX = (x: number) => ((x - viewport.xMin) / W) * svgWidth;
  const mapY = (y: number) => svgHeight - ((y - viewport.yMin) / H) * svgHeight;
  const mapDist = (d: number) => (d / W) * svgWidth;

  // Generate grid lines
  const gridLinesX = [];
  if (grid?.stepX) {
     const startX = Math.ceil(viewport.xMin / grid.stepX) * grid.stepX;
     for (let x = startX; x <= viewport.xMax; x += grid.stepX) {
        gridLinesX.push(x);
     }
  }

  const gridLinesY = [];
  if (grid?.stepY) {
     const startY = Math.ceil(viewport.yMin / grid.stepY) * grid.stepY;
     for (let y = startY; y <= viewport.yMax; y += grid.stepY) {
        gridLinesY.push(y);
     }
  }

  return (
    <div className="w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative my-6 font-sans group">
       <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-600/50 text-xs font-black tracking-widest text-slate-300 z-10 uppercase flex items-center gap-2 shadow-lg">
         <div className="w-2 h-2 rounded-full bg-indigo-500 animate-[pulse_2s_ease-in-out_infinite]"></div>
         VisualMath Engine
       </div>
       
       {/* CSS for draw animations */}
       <style>{`
         @keyframes draw-path {
           from { stroke-dashoffset: 1000; }
           to { stroke-dashoffset: 0; }
         }
         .math-svg-anim {
           stroke-dasharray: 1000;
           animation: draw-path 2s ease-out forwards;
         }
         .math-element-fade {
           animation: fade-in-up 0.8s ease-out forwards;
           opacity: 0;
           transform-origin: center;
         }
         @keyframes fade-in-up {
           from { opacity: 0; transform: translateY(10px); }
           to { opacity: 1; transform: translateY(0); }
         }
       `}</style>

       <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-h-[300px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
         
         {/* Background is replaced by the radial-gradient tailwind class above */}
         
         {/* Grid */}
         {grid && (
           <g className="opacity-20">
             {gridLinesX.map(x => (
               <line key={`gx-${x}`} x1={mapX(x)} y1="0" x2={mapX(x)} y2={svgHeight} stroke="#64748b" strokeWidth="1" />
             ))}
             {gridLinesY.map(y => (
               <line key={`gy-${y}`} x1="0" y1={mapY(y)} x2={svgWidth} y2={mapY(y)} stroke="#64748b" strokeWidth="1" />
             ))}
           </g>
         )}

         {/* Axes */}
         {grid?.showAxes !== false && (
           <g>
             {/* X Axis */}
             {viewport.yMin <= 0 && viewport.yMax >= 0 && (
               <>
                 <line x1="0" y1={mapY(0)} x2={svgWidth} y2={mapY(0)} stroke="#94a3b8" strokeWidth="2" />
                 {/* X Axis labels */}
                 {gridLinesX.map(x => x !== 0 && (
                    <text key={`lx-${x}`} x={mapX(x)} y={mapY(0) + 16} fill="#64748b" fontSize="12" textAnchor="middle">{x}</text>
                 ))}
               </>
             )}
             {/* Y Axis */}
             {viewport.xMin <= 0 && viewport.xMax >= 0 && (
               <>
                 <line x1={mapX(0)} y1="0" x2={mapX(0)} y2={svgHeight} stroke="#94a3b8" strokeWidth="2" />
                 {/* Y Axis labels */}
                 {gridLinesY.map(y => y !== 0 && (
                    <text key={`ly-${y}`} x={mapX(0) - 8} y={mapY(y) + 4} fill="#64748b" fontSize="12" textAnchor="end">{y}</text>
                 ))}
               </>
             )}
           </g>
         )}

         {/* Elements */}
         <g>
           {elements.map((el, i) => {
             if (el.type === 'point') {
               return (
                 <g key={i}>
                   <circle cx={mapX(el.x)} cy={mapY(el.y)} r="6" fill={el.color || '#3b82f6'} className="transition-all hover:r-8 cursor-pointer" />
                   {el.label && (
                     <text x={mapX(el.x) + 10} y={mapY(el.y) - 10} fill={el.color || '#cbd5e1'} fontSize="16" fontWeight="bold">
                       {el.label}
                     </text>
                   )}
                 </g>
               );
             }
             
             if (el.type === 'segment') {
               return (
                 <g key={i}>
                   <line x1={mapX(el.x1)} y1={mapY(el.y1)} x2={mapX(el.x2)} y2={mapY(el.y2)} stroke={el.color || '#10b981'} strokeWidth="3" strokeLinecap="round" />
                   {el.label && (
                      <text x={(mapX(el.x1) + mapX(el.x2))/2 + 5} y={(mapY(el.y1) + mapY(el.y2))/2 - 5} fill={el.color || '#cbd5e1'} fontSize="14" fontWeight="bold">
                        {el.label}
                      </text>
                   )}
                 </g>
               );
             }

             if (el.type === 'circle') {
               return (
                  <circle key={i} cx={mapX(el.cx)} cy={mapY(el.cy)} r={mapDist(el.r)} fill={el.fill || 'transparent'} stroke={el.stroke || '#3b82f6'} strokeWidth={el.strokeWidth || 2} />
               );
             }

             if (el.type === 'angle') {
               const startRad = (el.startAngle * Math.PI) / 180;
               const endRad = (el.endAngle * Math.PI) / 180;
               
               const x1 = mapX(el.cx + el.r * Math.cos(startRad));
               const y1 = mapY(el.cy + el.r * Math.sin(startRad));
               const x2 = mapX(el.cx + el.r * Math.cos(endRad));
               const y2 = mapY(el.cy + el.r * Math.sin(endRad));
               const cxSvg = mapX(el.cx);
               const cySvg = mapY(el.cy);
               
               const diff = el.endAngle - el.startAngle;
               const largeArc = Math.abs(diff) > 180 ? 1 : 0;
               const sweep = diff > 0 ? 0 : 1; 

               const d = el.wedge !== false 
                 ? `M ${cxSvg} ${cySvg} L ${x1} ${y1} A ${mapDist(el.r)} ${mapDist(el.r)} 0 ${largeArc} ${sweep} ${x2} ${y2} Z`
                 : `M ${x1} ${y1} A ${mapDist(el.r)} ${mapDist(el.r)} 0 ${largeArc} ${sweep} ${x2} ${y2}`;

               // Calculate label position slightly further out
               const midAngle = el.startAngle + diff / 2;
               const midRad = (midAngle * Math.PI) / 180;
               const lx = mapX(el.cx + (el.r * 1.5) * Math.cos(midRad));
               const ly = mapY(el.cy + (el.r * 1.5) * Math.sin(midRad));

               return (
                  <g key={i}>
                    <path d={d} fill={el.fill || 'rgba(234, 179, 8, 0.2)'} stroke={el.stroke || '#eab308'} strokeWidth={el.strokeWidth || 2} />
                    {el.label && (
                       <text x={lx} y={ly} fill={el.color || '#cbd5e1'} fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                         {el.label}
                       </text>
                    )}
                  </g>
               );
             }

             if (el.type === 'text') {
               return (
                  <text key={i} x={mapX(el.x)} y={mapY(el.y)} fill={el.color || '#cbd5e1'} fontSize={el.fontSize || "16"} fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                    {el.text}
                  </text>
               );
             }

             if (el.type === 'polygon') {
               const ptsArray = Array.isArray(el.points) ? el.points : [];
               const pts = ptsArray.map((p: any) => `${mapX(p.x)},${mapY(p.y)}`).join(' ');
               return (
                 <polygon key={i} points={pts} fill={el.fill || 'rgba(59, 130, 246, 0.2)'} stroke={el.stroke || '#3b82f6'} strokeWidth="2" strokeLinejoin="round" />
               );
             }

             if (el.type === 'function-path') {
               // We support raw SVG paths or a simple evaluator. To keep it safe, if 'expression' is passed, we plot points safely 
               // by passing to a safe math parser, but for now we expect the AI to give us robust approximations or we parse simple linear/quadratics.
               // Since evaluating raw JS is dangerous, we highly recommend AI to pass `points: [{x,y}...]` instead of `expression`.
               if (Array.isArray(el.points) && el.points.length > 0) {
                  const pathData = el.points.map((p: any, idx: number) => `${idx===0?'M':'L'} ${mapX(p.x)} ${mapY(p.y)}`).join(' ');
                  return (
                     <path key={i} d={pathData} fill="none" stroke={el.color || '#8b5cf6'} strokeWidth={el.strokeWidth || 3} />
                  );
               }
             }

             return null;
           })}
         </g>
       </svg>
    </div>
  );
};
