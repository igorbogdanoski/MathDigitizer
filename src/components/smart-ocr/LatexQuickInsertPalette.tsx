import React from 'react';
import { MathRenderer } from '../MathRenderer';
import { quickInsertGroups } from './types';

interface LatexQuickInsertPaletteProps {
  activeGroup: string;
  setActiveGroup: (group: string) => void;
  onInsertSymbol: (latex: string) => void;
}

export const LatexQuickInsertPalette: React.FC<LatexQuickInsertPaletteProps> = ({
  activeGroup,
  setActiveGroup,
  onInsertSymbol,
}) => {
  return (
    <div className="flex flex-col border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
      {/* MathType Group Tabs */}
      <div className="flex px-3 pt-3 gap-1 overflow-x-auto scrollbar-hide">
        {quickInsertGroups.map((grp) => (
          <button
            key={grp.group}
            onClick={() => setActiveGroup(grp.group)}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-t border-x ${
              activeGroup === grp.group
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-b-white dark:border-b-slate-800 relative z-10 translate-y-[1px]'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            {grp.group}
          </button>
        ))}
      </div>
      {/* MathType Buttons for active group */}
      <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 shadow-inner min-h-[60px] items-center relative z-0">
        {quickInsertGroups.find(g => g.group === activeGroup)?.items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onInsertSymbol(item.insert)}
            title={`Вметни симбол ${item.label}`}
            aria-label={`Вметни симбол ${item.label}`}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md transition-all active:scale-95 flex-shrink-0"
          >
            <MathRenderer content={`$${item.label}$`} />
          </button>
        ))}
      </div>
    </div>
  );
};
