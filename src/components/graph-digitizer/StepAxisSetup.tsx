import React from 'react';
import { ChevronRight, Settings2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { AxisConfig, ScaleType } from './types';

interface StepAxisSetupProps {
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  setXAxis: React.Dispatch<React.SetStateAction<AxisConfig>>;
  setYAxis: React.Dispatch<React.SetStateAction<AxisConfig>>;
  onNext: () => void;
}

export const StepAxisSetup: React.FC<StepAxisSetupProps> = ({ xAxis, yAxis, setXAxis, setYAxis, onNext }) => (
  <Card>
    <CardContent className="p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <Settings2 className="w-4 h-4 text-indigo-500" /> Конфигурација на оски
      </div>
      {(['x', 'y'] as const).map(ax => {
        const cfg = ax === 'x' ? xAxis : yAxis;
        const setCfg = ax === 'x' ? setXAxis : setYAxis;
        return (
          <div key={ax} className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{ax === 'x' ? 'X — Хоризонтална' : 'Y — Вертикална'}</p>
            <input
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              placeholder="Назив на оска (пр. Време, Цена)"
              value={cfg.label}
              onChange={e => setCfg(p => ({ ...p, label: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500">Мин</label>
                <input type="number" className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  value={cfg.min} onChange={e => setCfg(p => ({ ...p, min: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Макс</label>
                <input type="number" className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  value={cfg.max} onChange={e => setCfg(p => ({ ...p, max: parseFloat(e.target.value) || 10 }))} />
              </div>
            </div>
            <div className="flex gap-2">
              {(['linear', 'log'] as ScaleType[]).map(sc => (
                <button key={sc} onClick={() => setCfg(p => ({ ...p, scale: sc }))}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${cfg.scale === sc ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {sc === 'linear' ? 'Линеарна' : 'Логаритамска'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <Button className="w-full" onClick={onNext}>
        Следно: Калибрација <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </CardContent>
  </Card>
);
