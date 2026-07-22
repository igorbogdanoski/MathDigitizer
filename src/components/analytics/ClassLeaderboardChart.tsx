import React from 'react';
import { Target } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';
import { StudentStats } from './types';

const getSeriesDotClass = (seriesName?: string) => {
  if (seriesName === 'Просек') return 'bg-indigo-500';
  if (seriesName === 'Евалуации') return 'bg-emerald-500';
  return 'bg-slate-400';
};

const getSeriesTextClass = (seriesName?: string) => {
  if (seriesName === 'Просек') return 'text-indigo-600 dark:text-indigo-400';
  if (seriesName === 'Евалуации') return 'text-emerald-600 dark:text-emerald-400';
  return 'text-slate-600 dark:text-slate-300';
};

export interface ClassLeaderboardChartProps {
  data: StudentStats[];
  isDark: boolean;
}

export const ClassLeaderboardChart: React.FC<ClassLeaderboardChartProps> = ({ data, isDark }) => {
  return (
    <div className="xl:col-span-2 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-5xl overflow-hidden shadow-sm p-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Target className="w-7 h-7 text-rose-500" />
            Аналитичка Лидерска Табла
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Глобален ранкинг според Концептуална Совладливост (Просечен Резултат) и Моментум
          </p>
        </div>
        <div className="flex gap-2">
           <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
              <span className="w-3 h-3 rounded-full bg-indigo-500 block"></span>
              Просек (0-100)
           </span>
           <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
              <span className="w-3 h-3 rounded-full bg-emerald-400 block"></span>
              Вкупни Евалуации
           </span>
        </div>
      </div>

      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0.4}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
            <XAxis dataKey="id" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 800 }} dy={10} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 800 }} domain={[0, 100]} dx={-10} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#10b981', fontWeight: 800 }} dx={10} />
            <RechartsTooltip
              cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-4 rounded-2xl shadow-xl">
                       <div className="font-black text-lg text-slate-800 dark:text-white mb-2">{label}</div>
                       <div className="flex flex-col gap-2">
                         {payload.map((entry: any, index: number) => (
                           <div key={index} className="flex items-center gap-3">
                             <span className={`w-3 h-3 rounded-full ${getSeriesDotClass(entry.name)}`}></span>
                             <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{entry.name}:</span>
                             <span className={`text-lg font-black ${getSeriesTextClass(entry.name)}`}>{entry.value}</span>
                           </div>
                         ))}
                       </div>
                       <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10 text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center justify-between">
                         <span>Cognitive ZPD Target:</span>
                         <span className="text-indigo-500 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
                           {payload[0] && payload[0].payload ? Math.min(100, Math.round(payload[0].payload.averageScore + (100 - payload[0].payload.averageScore) * 0.3)) : 0}
                         </span>
                       </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar yAxisId="left" dataKey="averageScore" name="Просек" fill="url(#colorScore)" radius={[6, 6, 0, 0]} maxBarSize={60} />
            <Line yAxisId="right" type="monotone" dataKey={(d) => d.submissions.length} name="Евалуации" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 8 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
