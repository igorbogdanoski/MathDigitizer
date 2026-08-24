import React from 'react';
import { Zap, ScanLine, Library as LibraryIcon, Wand2, Layers, CreditCard, Network } from 'lucide-react';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';

interface QuickAccessGridProps {
  t: TFunction<'dashboard'>;
}

export const QuickAccessGrid: React.FC<QuickAccessGridProps> = ({ t }) => {
  return (
    <>
      <div className="mt-8 mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-500" />
          {t('quickAccess')}
        </h3>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('allToolsOnePlace')}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-12">
        {[
          { title: "Smart OCR", desc: t('scanTasks'), icon: <ScanLine className="w-5 h-5 text-blue-500" />, to: "/smart-ocr", bg: "bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20", borderColor: "border-blue-100 dark:border-blue-800/50" },
          { title: t('library'), desc: t('knowledgeBank'), icon: <LibraryIcon className="w-5 h-5 text-emerald-500" />, to: "/library", bg: "bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20", borderColor: "border-emerald-100 dark:border-emerald-800/50" },
          { title: t('extractionModule'), desc: t('fromYouTubeVideos'), icon: <Wand2 className="w-5 h-5 text-purple-500" />, to: "/extract", bg: "bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20", borderColor: "border-purple-100 dark:border-purple-800/50" },
          { title: t('testFactory'), desc: t('generateTestsInSecond'), icon: <Layers className="w-5 h-5 text-rose-500" />, to: "/mass-factory", bg: "bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20", borderColor: "border-rose-100 dark:border-rose-800/50" },
          // Concept maps belong here: unlike textbook import, which is an
          // enhancement to grading and is offered where grading happens, a map
          // is a thing a teacher sits down to make.
          { title: t('conceptMaps'), desc: t('buildConceptMap'), icon: <Network className="w-5 h-5 text-amber-500" />, to: "/mind-maps", bg: "bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20", borderColor: "border-amber-100 dark:border-amber-800/50" },
          { title: t('billing'), desc: t('subscriptionAndPayments'), icon: <CreditCard className="w-5 h-5 text-indigo-500" />, to: "/billing", bg: "bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20", borderColor: "border-indigo-100 dark:border-indigo-800/50" }
        ].map((item, idx) => (
          <Link key={idx} to={item.to} className={`flex flex-col p-4 rounded-2xl border transition-all ${item.bg} ${item.borderColor}`}>
            <div className="bg-white dark:bg-white/10 p-2.5 rounded-xl w-max shadow-sm mb-3">
              {item.icon}
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">{item.title}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{item.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
};
