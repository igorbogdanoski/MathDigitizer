import React from 'react';
import { useTranslation } from 'react-i18next';
import { Target } from 'lucide-react';
import { Button } from '../ui/Button';
import { AxisConfig } from './types';

interface CalibrationDialogProps {
  calibDialog: boolean;
  pendingPixel: { x: number; y: number } | null;
  waitingCalib: 1 | 2 | 3 | null;
  calibInput: { x: string; y: string };
  setCalibInput: React.Dispatch<React.SetStateAction<{ x: string; y: string }>>;
  onConfirm: () => void;
  onClose: () => void;
  calibModalRef: React.RefObject<HTMLDivElement | null>;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
}

export const CalibrationDialog: React.FC<CalibrationDialogProps> = ({
  calibDialog, pendingPixel, waitingCalib, calibInput, setCalibInput,
  onConfirm, onClose, calibModalRef, xAxis, yAxis,
}) => {
  const { t } = useTranslation('graphDigitizer');
  if (!calibDialog || !pendingPixel) return null;

  return (
    <div ref={calibModalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-80 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-800 dark:text-white">
            {t('calibDialog.enterCoords', { point: waitingCalib === 1 ? t('calibrate.point1') : t('calibrate.point2') })}
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          {t('calibDialog.clickedPosition', { px: Math.round(pendingPixel.x), py: Math.round(pendingPixel.y) })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[['x', xAxis.label], ['y', yAxis.label]].map(([axis, label]) => (
            <div key={axis}>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{t('calibDialog.value', { label })}</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-mono"
                placeholder={`${axis}=?`}
                value={calibInput[axis as 'x' | 'y']}
                onChange={e => setCalibInput(p => ({ ...p, [axis]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && onConfirm()}
                autoFocus={axis === 'x'}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('calibDialog.cancel')}
          </Button>
          <Button className="flex-1" onClick={onConfirm}
            disabled={!calibInput.x || !calibInput.y || isNaN(parseFloat(calibInput.x)) || isNaN(parseFloat(calibInput.y))}>
            {t('calibDialog.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};
