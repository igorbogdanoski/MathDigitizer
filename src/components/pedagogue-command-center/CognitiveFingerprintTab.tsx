import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Activity, Zap, Compass } from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';
import { CognitiveFingerprint } from './types';

interface CognitiveFingerprintTabProps {
  task: MathTask | undefined;
  cognitiveFingerprint: CognitiveFingerprint | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}

export const CognitiveFingerprintTab: React.FC<CognitiveFingerprintTabProps> = ({
  task,
  cognitiveFingerprint,
  isAnalyzing,
  onAnalyze,
}) => {
  const { t } = useTranslation('pedagogue');
  return (
    <motion.div
      key="fingerprint"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full h-full flex items-center justify-center p-12"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-6xl">
        <div className="flex flex-col justify-center gap-8">
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-4">
              {t('fingerprint.title')}
            </h2>
            <p className="text-slate-400 max-w-md leading-relaxed">
              {t('fingerprint.description')}
            </p>
          </div>

          {!cognitiveFingerprint ? (
            <Button
              size="lg"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-fit group px-8"
            >
              {isAnalyzing ? <Activity className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 group-hover:animate-pulse" />}
              {isAnalyzing ? t('fingerprint.analyzing') : t('fingerprint.performAutopsy')}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: t('fingerprint.rigor'), value: cognitiveFingerprint.rigor, color: 'indigo' },
                { label: t('fingerprint.abstraction'), value: cognitiveFingerprint.abstraction, color: 'purple' },
                { label: t('fingerprint.connectivity'), value: cognitiveFingerprint.connectivity, color: 'blue' },
                { label: t('fingerprint.context'), value: cognitiveFingerprint.contextuality, color: 'emerald' },
                { label: t('fingerprint.effort'), value: cognitiveFingerprint.effort, color: 'orange' }
              ].map(stat => (
                <div key={stat.label} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">{stat.label}</div>
                  <div className="text-2xl font-mono text-white flex items-end gap-1">
                    {stat.value}
                    <span className="text-[10px] text-slate-600 mb-1.5">%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.value}%` }}
                      className={`h-full bg-${stat.color}-500 shadow-[0_0_10px_rgba(var(--tw-gradient-to-r))]`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center bg-slate-900/30 rounded-7xl border border-slate-800/50 p-8 backdrop-blur-sm">
          {cognitiveFingerprint ? (
            <svg width="400" height="400" viewBox="0 0 400 400">
              {/* Radar Chart Lines */}
              {[20, 40, 60, 80, 100].map(r => (
                <circle key={r} cx="200" cy="200" r={r * 1.5} fill="none" stroke="#1e293b" strokeWidth="1" />
              ))}
              {/* Radar Data */}
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                d={(() => {
                  const center = 200;
                  const scale = 1.5;
                  const points = [
                    { a: 0, r: cognitiveFingerprint.rigor },
                    { a: (Math.PI * 2) / 5, r: cognitiveFingerprint.abstraction },
                    { a: (Math.PI * 2 * 2) / 5, r: cognitiveFingerprint.connectivity },
                    { a: (Math.PI * 2 * 3) / 5, r: cognitiveFingerprint.contextuality },
                    { a: (Math.PI * 2 * 4) / 5, r: cognitiveFingerprint.effort }
                  ];
                  return points.map((p, i) => {
                    const x = center + Math.cos(p.a - Math.PI / 2) * p.r * scale;
                    const y = center + Math.sin(p.a - Math.PI / 2) * p.r * scale;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ') + ' Z';
                })()}
                fill="rgba(99, 102, 241, 0.2)"
                stroke="#6366f1"
                strokeWidth="2"
              />
            </svg>
          ) : (
            <div className="text-center">
              <Compass className="w-48 h-48 text-slate-800 animate-spin-slow mb-4 mx-auto" strokeWidth={0.5} />
              <p className="text-slate-600 font-mono text-xs uppercase tracking-widest">{t('fingerprint.awaitingAnalysis')}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
