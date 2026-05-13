import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';

interface ProFeatureGateProps {
  featureName: string;
  description: string;
}

export const ProFeatureGate: React.FC<ProFeatureGateProps> = ({ featureName, description }) => {
  return (
    <div className="max-w-4xl mx-auto rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8 shadow-lg dark:border-amber-700/40 dark:from-amber-900/20 dark:to-slate-900">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-700/30 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-700 dark:text-amber-300" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Pro Feature: {featureName}</h2>
      </div>
      <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">{description}</p>
      <div className="flex gap-3">
        <Link to="/pricing">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
            <Sparkles className="w-4 h-4 mr-2" /> Отклучи Pro
          </Button>
        </Link>
        <Link to="/dashboard">
          <Button variant="outline" className="font-bold">Назад кон табла</Button>
        </Link>
      </div>
    </div>
  );
};
