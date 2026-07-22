import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  Area, ComposedChart
} from 'recharts';
import { Card, CardContent } from '../ui/Card';
import { LongitudinalDataPoint } from './types';

export interface LongitudinalChartProps {
  data: LongitudinalDataPoint[];
  isDark: boolean;
}

export const LongitudinalChart: React.FC<LongitudinalChartProps> = ({ data, isDark }) => {
  const { t } = useTranslation('analytics');
  return (
    <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl col-span-1 md:col-span-2">
      <CardContent className="p-8 md:p-10">
        <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg mb-8 flex items-center gap-3 uppercase tracking-widest text-sm">
          <TrendingUp className="w-6 h-6 text-indigo-500" />
          {t('longitudinal.title')}
        </h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorConcept" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 }} dy={15} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 }} domain={[0, 100]} dx={-10} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#10b981', fontWeight: 700 }} domain={[-50, 50]} dx={10} />
              <RechartsTooltip
                 contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: '16px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '16px' }}
                 itemStyle={{ fontWeight: 800, fontSize: '14px' }}
                 labelStyle={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px', fontSize: '13px', fontWeight: 700 }} />
              <Area yAxisId="left" type="monotone" name={t('longitudinal.conceptualUnderstanding')} dataKey="concept" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorConcept)" activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }} />
              <Area yAxisId="left" type="monotone" name={t('longitudinal.proceduralFluency')} dataKey="execution" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorExec)" activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} />
              <Line yAxisId="right" type="monotone" name={t('longitudinal.momentumVelocity')} dataKey="velocity" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 8 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
