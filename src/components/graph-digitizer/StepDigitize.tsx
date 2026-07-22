import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, Plus, PlusCircle, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { AxisConfig, Dataset, DigitizeMode } from './types';

interface StepDigitizeProps {
  datasets: Dataset[];
  activeDs: number;
  mode: DigitizeMode;
  setMode: React.Dispatch<React.SetStateAction<DigitizeMode>>;
  setActiveDs: React.Dispatch<React.SetStateAction<number>>;
  onAddDataset: () => void;
  onDeletePoint: (dsIdx: number, ptId: string) => void;
  totalPoints: number;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  onNext: () => void;
}

export const StepDigitize: React.FC<StepDigitizeProps> = ({
  datasets, activeDs, mode, setMode, setActiveDs,
  onAddDataset, onDeletePoint, totalPoints, xAxis, yAxis, onNext,
}) => {
  const { t } = useTranslation('graphDigitizer');
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Crosshair className="w-4 h-4 text-indigo-500" /> {t('digitize.title')}
          </div>
          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
            {t('digitize.pointsCount', { count: totalPoints })}
          </span>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {(['add', 'delete'] as DigitizeMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}>
              {m === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
              {m === 'add' ? t('digitize.add') : t('digitize.delete')}
            </button>
          ))}
        </div>

        {/* Datasets */}
        <div className="space-y-1.5">
          {datasets.map((ds, i) => (
            <button key={i} onClick={() => setActiveDs(i)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                activeDs === i
                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: ds.color }} />
                <span className="font-medium text-slate-700 dark:text-slate-200">{ds.name}</span>
              </span>
              <span className="text-xs text-slate-400">{ds.points.length} {t('digitize.pointsShort')}</span>
            </button>
          ))}
          {datasets.length < 8 && (
            <button onClick={onAddDataset}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
              <PlusCircle className="w-3.5 h-3.5" /> {t('digitize.newDataset')}
            </button>
          )}
        </div>

        {/* Points table for active dataset */}
        {datasets[activeDs]?.points.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left text-slate-500">#</th>
                  <th className="px-2 py-1.5 text-left text-slate-500">{xAxis.label}</th>
                  <th className="px-2 py-1.5 text-left text-slate-500">{yAxis.label}</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {datasets[activeDs].points.map((p, i) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700/50">
                    <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-200">{p.rx}</td>
                    <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-200">{p.ry}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => onDeletePoint(activeDs, p.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Button className="w-full" disabled={totalPoints === 0}
          onClick={onNext}>
          {t('digitize.aiAnalysis')} <Sparkles className="w-4 h-4 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
};
