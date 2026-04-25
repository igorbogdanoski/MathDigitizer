import React, { useMemo } from 'react';

interface AlgebraTilesConfig {
  expression?: string;
  tiles: {
    type: 'x^2' | 'y^2' | 'xy' | 'x' | 'y' | '1';
    value: number; // positive or negative count
  }[];
}

export const AlgebraTilesCanvas = ({ jsonConfig }: { jsonConfig: any }) => {
  const config: AlgebraTilesConfig | null = useMemo(() => {
    try {
      if (typeof jsonConfig === 'object' && jsonConfig !== null) {
        return jsonConfig;
      }
      if (typeof jsonConfig === 'string') {
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

  if (!config || !Array.isArray(config.tiles)) {
    return <div className="text-red-500 font-mono text-sm p-4 bg-red-50 rounded">Invalid algebra-tiles JSON</div>;
  }

  // Dimensions
  const BIG_SQ = 80;
  const RECT_L = 80;
  const RECT_W = 20;
  const SMALL_SQ = 20;
  const GAP = 8;

  const renderTiles = (type: string, count: number) => {
    const isNegative = count < 0;
    const items = [];
    const absoluteCount = Math.abs(count);

    for (let i = 0; i < absoluteCount; i++) {
       let width = SMALL_SQ;
       let height = SMALL_SQ;
       let color = isNegative ? 'bg-red-500' : 'bg-yellow-400';
       let label = isNegative ? '-1' : '+1';

       if (type === 'x^2' || type === 'y^2' || type === 'xy') {
          width = BIG_SQ;
          height = BIG_SQ;
          color = isNegative ? 'bg-red-500' : 'bg-blue-500';
          label = isNegative ? `-${type}` : type;
       } else if (type === 'x') {
          width = RECT_W;
          height = RECT_L;
          color = isNegative ? 'bg-red-500' : 'bg-green-500';
          label = isNegative ? '-x' : '+x';
       } else if (type === 'y') {
          width = RECT_L;
          height = RECT_W;
          color = isNegative ? 'bg-red-500' : 'bg-emerald-500';
          label = isNegative ? '-y' : '+y';
       }

       items.push(
         <div 
           key={`${type}-${i}`} 
           className={`${color} flex items-center justify-center rounded-sm border-2 ${isNegative ? 'border-red-700' : 'border-black/20'} shadow-sm text-white font-bold text-xs shadow-inner transition-transform hover:scale-105`}
           style={{ width, height }}
           title={label}
         >
           {width >= 40 && height >= 40 ? label : ''}
         </div>
       );
    }
    return items;
  };

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-inner my-6">
      {config.expression && (
        <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
           <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Алгебарски плочки за:</h4>
           <div className="text-2xl font-mono text-slate-800 dark:text-slate-200">{config.expression}</div>
        </div>
      )}
      
      <div className="flex flex-wrap gap-4 items-end">
        {config.tiles.map((tileGroup, idx) => (
          <div key={idx} className="flex flex-wrap gap-2 items-end">
             {renderTiles(tileGroup.type, tileGroup.value)}
          </div>
        ))}
      </div>
    </div>
  );
};
