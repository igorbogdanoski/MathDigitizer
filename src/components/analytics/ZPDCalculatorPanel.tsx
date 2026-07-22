import React from 'react';
import { Calculator } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

export interface ZPDCalculatorPanelProps {
  zpdAvg: number;
  zpdVel: number;
  setZpdAvg: (value: number) => void;
  setZpdVel: (value: number) => void;
  calculatedZPD: number;
  zpdNextSteps: string;
  /** Restores the sliders to the active student's real data. */
  onReset: () => void;
}

export const ZPDCalculatorPanel: React.FC<ZPDCalculatorPanelProps> = ({ zpdAvg, zpdVel, setZpdAvg, setZpdVel, calculatedZPD, zpdNextSteps, onReset }) => {
  return (
    <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl overflow-hidden">
      <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="space-y-8 pr-0 md:pr-10 md:border-r border-slate-100 dark:border-white/10">
          <h3 className="font-black text-slate-800 dark:text-slate-100 text-xl flex items-center gap-3">
            <Calculator className="w-6 h-6 text-indigo-500" />
            Интерактивен ZPD Калкулатор
          </h3>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Тековен Просек ({zpdAvg}%)</label>
              </div>
              <input
                type="range" min="0" max="100" value={zpdAvg}
                onChange={(e) => setZpdAvg(parseInt(e.target.value))}
                title="Тековен просек"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-white/10 accent-indigo-600"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Напредок / Моментум ({zpdVel > 0 ? '+' : ''}{zpdVel})</label>
              </div>
              <input
                type="range" min="-50" max="50" value={zpdVel}
                onChange={(e) => setZpdVel(parseInt(e.target.value))}
                title="Напредок и моментум"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-white/10 accent-emerald-500"
              />
            </div>

            <div className="p-4 bg-indigo-50 dark:bg-indigo-500/15 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
               <p className="text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                 Променете ги вредностите за да симулирате различни сценарија и да ги проверите препорачаните педагошки чекори за вашата наредна интервенција.
               </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col h-full justify-center">
          <h4 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Целен Капацитет (ZPD)</h4>
          <div className="text-6xl font-black text-slate-800 dark:text-slate-100 flex items-baseline gap-2 tracking-tighter mb-6">
            {calculatedZPD}<span className="text-3xl text-slate-300 dark:text-slate-500 font-medium">%</span>
          </div>

          <h4 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Предложени следни чекори</h4>
          <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-5 border border-slate-100 dark:border-white/10 w-full mb-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 font-bold leading-relaxed space-y-2">
               {zpdNextSteps}
            </p>
          </div>
          <Button
            onClick={onReset}
            variant="outline"
            className="self-start text-xs rounded-xl h-8 px-4 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Врати на реални податоци
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
