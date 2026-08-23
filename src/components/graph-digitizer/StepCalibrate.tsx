import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Target, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { CalibPoint } from './types';

interface StepCalibrateProps {
  calibP1: CalibPoint | null;
  calibP2: CalibPoint | null;
  /** Optional third reference; enables the least-squares calibration (8.2). */
  calibP3?: CalibPoint | null;
  /** How far the three references disagree, in real units. */
  affineResidual?: number | null;
  waitingCalib: 1 | 2 | 3 | null;
  onSetWaitingCalib: (w: 1 | 2 | 3 | null) => void;
  onClearPoint: (slot: 1 | 2 | 3) => void;
  onNext: () => void;
}

export const StepCalibrate: React.FC<StepCalibrateProps> = ({
  calibP1, calibP2, calibP3 = null, affineResidual = null, waitingCalib, onSetWaitingCalib, onClearPoint, onNext,
}) => {
  const { t } = useTranslation('graphDigitizer');
  const calibrated = !!(calibP1 && calibP2);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Target className="w-4 h-4 text-indigo-500" /> {t('calibrate.title')}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {t('calibrate.description')}
        </p>

        {[{ label: t('calibrate.point1'), pt: calibP1, slot: 1 as const, color: '#ef4444' },
          { label: t('calibrate.point2'), pt: calibP2, slot: 2 as const, color: '#3b82f6' }]
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
                  {waitingCalib === slot ? t('calibrate.clickOnImage') : t('calibrate.waiting')}
                </span>
              )}
            </div>
          ))}

        {/* Optional third reference: turns an exact two-point mapping into a
            least-squares fit, and reveals a misplaced click. */}
        {calibrated && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {t('calibrate.thirdPointTitle')}
              </span>
              {calibP3 ? (
                <button
                  type="button"
                  onClick={() => onClearPoint(3)}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  {t('calibrate.remove')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetWaitingCalib(3)}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  {waitingCalib === 3 ? t('calibrate.clickOnImage') : t('calibrate.addThirdPoint')}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              {t('calibrate.thirdPointHint')}
            </p>

            {calibP3 && affineResidual !== null && (
              <p className={`text-[11px] font-bold ${affineResidual > 0.5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {t('calibrate.residual', { value: Math.round(affineResidual * 1000) / 1000 })}
                {affineResidual > 0.5 && ` — ${t('calibrate.residualWarning')}`}
              </p>
            )}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!calibrated}
          onClick={onNext}
        >
          {calibrated ? <>{t('calibrate.digitizePoints')} <ChevronRight className="w-4 h-4 ml-1" /></> : t('calibrate.setBothPoints')}
        </Button>
      </CardContent>
    </Card>
  );
};
