import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface MasteryRadarChartProps {
  data: { subject: string; A: number; fullMark: number }[];
}

export const MasteryRadarChart: React.FC<MasteryRadarChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
        <Radar
          name="Мастерство"
          dataKey="A"
          stroke="#4f46e5"
          fill="#4f46e5"
          fillOpacity={0.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default MasteryRadarChart;
