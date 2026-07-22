import React from 'react';
import { ChevronRight, Target, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { CalibPoint } from './types';

interface StepCalibrateProps {
  calibP1: CalibPoint | null;
  calibP2: CalibPoint | null;
  waitingCalib: 1 | 2 | null;
  onSetWaitingCalib: (w: 1 | 2 | null) => void;
  onClearPoint: (slot: 1 | 2) => void;
  onNext: () => void;
}

export const StepCalibrate: React.FC<StepCalibrateProps> = ({
  calibP1, calibP2, waitingCalib, onSetWaitingCalib, onClearPoint, onNext,
}) => {
  const calibrated = !!(calibP1 && calibP2);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Target className="w-4 h-4 text-indigo-500" /> 2-точкова калибрација
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Кликни на 2 точки чии координати ги знаеш (пр. пресечиште на оски, ознаки на мрежа). Тоа ги дефинира вистинските координати за сите останати точки.
        </p>

        {[{ label: 'Точка 1', pt: calibP1, slot: 1 as const, color: '#ef4444' },
          { label: 'Точка 2', pt: calibP2, slot: 2 as const, color: '#3b82f6' }]
          .map(({ label, pt, slot, color }) => (
            <div key={slot} className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
              waitingCalib === slot
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 animate-pulse'
                : pt
                  ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
            }`}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
              </div>
              {pt ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                    ({pt.real.x}, {pt.real.y})
                  </span>
                  <button onClick={() => { onClearPoint(slot); onSetWaitingCalib(slot); }}
                    className="text-slate-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  {waitingCalib === slot ? 'Кликни на сликата →' : 'Чека...'}
                </span>
              )}
            </div>
          ))}

        <Button
          className="w-full"
          disabled={!calibrated}
          onClick={onNext}
        >
          {calibrated ? <>Дигитализирај точки <ChevronRight className="w-4 h-4 ml-1" /></> : 'Поставете ги двете точки'}
        </Button>
      </CardContent>
    </Card>
  );
};
