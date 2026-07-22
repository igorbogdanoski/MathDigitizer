import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Layers } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { WeaknessEntry } from './types';

export interface KnowledgeGapsGridProps {
  weaknesses: WeaknessEntry[];
}

export const KnowledgeGapsGrid: React.FC<KnowledgeGapsGridProps> = ({ weaknesses }) => {
  const { t } = useTranslation('analytics');
  return (
    <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl md:col-span-2">
      <CardContent className="p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-3 uppercase tracking-widest text-sm">
            <Layers className="w-6 h-6 text-orange-500" />
            {t('gaps.title')}
          </h3>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10">{t('gaps.granularAnalysis')}</span>
        </div>

        {weaknesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {weaknesses.slice(0,6).map((w, idx) => (
              <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-400/40 hover:shadow-md transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 flex items-center justify-center font-black text-base group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/15 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 transition-colors">
                    0{idx + 1}
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-base">{w.concept}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-fit pl-4">
                  <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider ${w.count > 2 ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'}`}>
                    {t('gaps.incidents', { count: w.count })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 opacity-50" />
            <p className="font-medium text-sm">{t('gaps.noGaps')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
