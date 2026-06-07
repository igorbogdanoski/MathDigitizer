import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';

interface ProFeatureGateProps {
  featureName?: string;
  description?: string;
}

const PRO_HIGHLIGHTS = [
  'Неограничени AI генерации',
  'PDF Batch Фабрика',
  'Напредна аналитика + DoK',
  'Live Kahoot (неограничен)',
  'AI Педагогија Critique',
  'Curriculum по МОН кодови',
];

export const ProFeatureGate: React.FC<ProFeatureGateProps> = ({
  featureName = 'Pro Функција',
  description = 'Оваа функција е достапна само за Pro наставници.',
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="rounded-3xl border border-indigo-200 dark:border-indigo-700/40 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="p-8">
            {/* Icon + title */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">Pro функција</p>
                <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{featureName}</h2>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed text-sm">{description}</p>

            {/* Pro highlights */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Со Pro добивате</p>
              <ul className="grid grid-cols-1 gap-2">
                {PRO_HIGHLIGHTS.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Price callout */}
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-3xl font-black text-slate-900 dark:text-white">490</span>
              <span className="text-sm font-bold text-slate-500">МКД / месец</span>
              <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">= 2 кафиња / год</span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/pricing" className="flex-1">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Отклучи Pro
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline" className="font-bold h-11 rounded-xl border-slate-300 dark:border-slate-600">
                  Назад
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          490 МКД/месец · Без договор · Откажи кога сакаш
        </p>
      </div>
    </div>
  );
};
