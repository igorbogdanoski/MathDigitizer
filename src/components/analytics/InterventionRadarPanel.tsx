import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, Zap } from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  Tooltip as RechartsTooltip
} from 'recharts';
import { Button } from '../ui/Button';
import { ProficiencyDataPoint } from './types';

export interface InterventionRadarPanelProps {
  proficiencyData: ProficiencyDataPoint[];
  primaryDeficit?: string;
  isGeneratingPlan: boolean;
  onGenerate: () => void;
}

export const InterventionRadarPanel: React.FC<InterventionRadarPanelProps> = ({ proficiencyData, primaryDeficit, isGeneratingPlan, onGenerate }) => {
  const { t } = useTranslation('analytics');
  return (
    <div className="bg-indigo-600 rounded-5xl p-8 md:p-12 text-white grid grid-cols-1 md:grid-cols-2 gap-12 items-center shadow-xl shadow-indigo-600/20 relative overflow-hidden border border-indigo-500/50">
      <div className="absolute right-0 top-0 w-2/3 h-full bg-gradient-to-l from-indigo-500 to-transparent z-0 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500 opacity-30 rounded-full blur-3xl" />

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] border border-white/20 mb-8 shadow-sm">
          <BrainCircuit className="w-4 h-4" />
          {t('radar.deficit')}
        </div>
        <h3 className="text-4xl md:text-5xl font-black mb-4 leading-tight tracking-tight">
          <span className="text-indigo-200 block text-lg font-bold mb-2 uppercase tracking-widest">{t('radar.primaryFocus')}</span>
          {primaryDeficit}
        </h3>
        <p className="text-indigo-100 text-sm leading-relaxed mb-10 max-w-sm font-medium">
           {t('radar.description')}
        </p>
        <Button
          onClick={onGenerate}
          disabled={isGeneratingPlan}
          className="bg-white text-indigo-700 hover:bg-slate-50 border-none rounded-2xl font-black text-sm h-14 px-8 shadow-[0_0_20px_rgba(255,255,255,0.3)] w-full md:w-auto transition-transform hover:scale-105">
          <Zap className={`w-5 h-5 mr-3 ${isGeneratingPlan ? 'animate-bounce text-amber-500' : 'text-indigo-600'}`} />
          {isGeneratingPlan ? t('radar.generating') : t('radar.constructPlan')}
        </Button>
      </div>
      <div className="relative z-10 flex items-center justify-center">
         <div className="w-full max-w-[320px] aspect-square relative bg-indigo-900/60 rounded-6xl border border-indigo-400/30 shadow-2xl backdrop-blur-xl p-8">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={proficiencyData}>
                <PolarGrid stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#e0e7ff', fontWeight: 800 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={t('radar.proficiency')} dataKey="A" stroke="#fff" strokeWidth={3} fill="#818cf8" fillOpacity={0.65} />
                <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold' }} />
              </RadarChart>
            </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
};
