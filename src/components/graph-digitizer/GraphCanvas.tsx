import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Eye, EyeOff, Crosshair, AlertCircle,
} from 'lucide-react';
import { GraphAnalysis } from '../../lib/gemini';
import {
  Step, Dataset, CalibPoint, DigitizeMode, AxisConfig, MousePos,
} from './types';

interface GraphCanvasProps {
  imageUrl: string | null;
  step: Step;
  datasets: Dataset[];
  activeDs: number;
  mode: DigitizeMode;
  calibP1: CalibPoint | null;
  calibP2: CalibPoint | null;
  waitingCalib: 1 | 2 | 3 | null;
  pendingPixel: { x: number; y: number } | null;
  calibDialog: boolean;
  analysis: GraphAnalysis | null;
  mousePos: MousePos | null;
  showLens: boolean;
  lensZoom: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onCanvasClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggleLens: () => void;
  currentMouseReal: { x: number; y: number } | null;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  imageUrl, step, datasets, activeDs, mode,
  calibP1, calibP2, waitingCalib, pendingPixel, calibDialog, analysis,
  mousePos, showLens, lensZoom, containerRef,
  onMouseMove, onMouseLeave, onCanvasClick, onToggleLens,
  currentMouseReal, xAxis, yAxis,
}) => {
  const { t } = useTranslation('graphDigitizer');
  return (
    <>
      <div className="flex-1 min-w-0">
        {!imageUrl ? (
          <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 gap-3">
            <TrendingUp className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">{t('canvas.attachImageToStart')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Canvas toolbar */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button onClick={onToggleLens}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${showLens ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {showLens ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {t('canvas.lens', { zoom: lensZoom })}
                </button>
              </div>
              {currentMouseReal && (
                <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-900 text-emerald-400 px-3 py-1.5 rounded-lg">
                  <Crosshair className="w-3 h-3" />
                  {xAxis.label}={currentMouseReal.x} &nbsp;
                  {yAxis.label}={currentMouseReal.y}
                </div>
              )}
            </div>

            {/* Canvas container */}
            <div
              ref={containerRef}
              className={`relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 select-none ${
                (step === 'calibrate' && waitingCalib !== null) || step === 'digitize'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }`}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              onClick={onCanvasClick}
            >
              <img
                src={imageUrl}
                alt={t('canvas.graphAlt')}
                className="w-full h-auto block"
                draggable={false}
              />

              {/* SVG overlay */}
              <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                {/* Calibration point 1 */}
                {calibP1 && (
                  <g>
                    <line x1={calibP1.pixel.x - 14} y1={calibP1.pixel.y} x2={calibP1.pixel.x + 14} y2={calibP1.pixel.y} stroke="#ef4444" strokeWidth={1.5} />
                    <line x1={calibP1.pixel.x} y1={calibP1.pixel.y - 14} x2={calibP1.pixel.x} y2={calibP1.pixel.y + 14} stroke="#ef4444" strokeWidth={1.5} />
                    <rect x={calibP1.pixel.x - 6} y={calibP1.pixel.y - 6} width={12} height={12} fill="none" stroke="#ef4444" strokeWidth={2} />
                    <text x={calibP1.pixel.x + 10} y={calibP1.pixel.y - 8} fill="#ef4444" fontSize="11" fontWeight="bold" className="drop-shadow-sm">
                      P1 ({calibP1.real.x},{calibP1.real.y})
                    </text>
                  </g>
                )}
                {/* Calibration point 2 */}
                {calibP2 && (
                  <g>
                    <line x1={calibP2.pixel.x - 14} y1={calibP2.pixel.y} x2={calibP2.pixel.x + 14} y2={calibP2.pixel.y} stroke="#3b82f6" strokeWidth={1.5} />
                    <line x1={calibP2.pixel.x} y1={calibP2.pixel.y - 14} x2={calibP2.pixel.x} y2={calibP2.pixel.y + 14} stroke="#3b82f6" strokeWidth={1.5} />
                    <rect x={calibP2.pixel.x - 6} y={calibP2.pixel.y - 6} width={12} height={12} fill="none" stroke="#3b82f6" strokeWidth={2} />
                    <text x={calibP2.pixel.x + 10} y={calibP2.pixel.y - 8} fill="#3b82f6" fontSize="11" fontWeight="bold">
                      P2 ({calibP2.real.x},{calibP2.real.y})
                    </text>
                  </g>
                )}

                {/* Dataset lines + points */}
                {datasets.map((ds, di) => (
                  <g key={di}>
                    {ds.points.length > 1 && (
                      <polyline
                        points={ds.points.map(p => `${p.px},${p.py}`).join(' ')}
                        fill="none" stroke={ds.color} strokeWidth={1.5} opacity={0.5} strokeDasharray="5 3"
                      />
                    )}
                    {ds.points.map((p, pi) => (
                      <g key={p.id}>
                        <circle cx={p.px} cy={p.py} r={5} fill={ds.color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                        <text x={p.px + 8} y={p.py - 5} fill={ds.color} fontSize="10" fontWeight="700">{pi + 1}</text>
                      </g>
                    ))}
                  </g>
                ))}

                {/* Pending calibration point preview */}
                {pendingPixel && calibDialog && (
                  <g>
                    <line x1={pendingPixel.x - 18} y1={pendingPixel.y} x2={pendingPixel.x + 18} y2={pendingPixel.y} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
                    <line x1={pendingPixel.x} y1={pendingPixel.y - 18} x2={pendingPixel.x} y2={pendingPixel.y + 18} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
                  </g>
                )}

                {/* Key points from AI */}
                {analysis?.key_points?.map((kp, i) => {
                  if (!calibP1 || !calibP2) return null;
                  // rough reverse transform for display (optional - only if inside range)
                  return null; // skip pixel-space rendering of AI points (they're in real space)
                })}
              </svg>
            </div>

            {/* Info bar below canvas */}
            {step === 'digitize' && (
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {mode === 'add'
                  ? t('canvas.addPointHint')
                  : t('canvas.deletePointHint')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zoom Lens */}
      {showLens && mousePos && imageUrl && containerRef.current && (
        <div
          className="fixed pointer-events-none z-[200] rounded-full border-2 border-indigo-500 shadow-2xl overflow-hidden"
          style={{ width: 128, height: 128, left: mousePos.clientX + 20, top: mousePos.clientY - 70 }}
        >
          <div className="relative w-full h-full overflow-hidden" style={{ background: '#111' }}>
            <img
              src={imageUrl}
              alt=""
              style={{
                position: 'absolute',
                width: containerRef.current.getBoundingClientRect().width * lensZoom,
                height: 'auto',
                left: -mousePos.imgX * lensZoom + 64,
                top: -mousePos.imgY * lensZoom + 64,
                imageRendering: 'pixelated',
              }}
            />
          </div>
          {/* Crosshair */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500/80" style={{ transform: 'translateX(-50%)' }} />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500/80" style={{ transform: 'translateY(-50%)' }} />
            <div className="absolute inset-0 rounded-full border border-indigo-400/30" />
          </div>
        </div>
      )}
    </>
  );
};
