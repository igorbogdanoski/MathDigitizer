import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight, ChevronLeft, Sparkles, ShieldCheck,
  Activity, Microscope, Share2
} from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';

const LazyMathRenderer = lazy(() => import('../MathRenderer').then(m => ({ default: m.MathRenderer })));

interface CommandCenterSidebarProps {
  task: MathTask | undefined;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const CommandCenterSidebar: React.FC<CommandCenterSidebarProps> = ({
  task,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const { t } = useTranslation('pedagogue');
  return (
    <aside
      className={`h-full border-l border-slate-800 bg-slate-900/30 backdrop-blur-2xl transition-all duration-500 ease-in-out relative z-10 flex flex-col ${
        isSidebarOpen ? 'w-[450px]' : 'w-0'
      }`}
    >
      <button
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? t('sidebar.collapsePanel') : t('sidebar.expandPanel')}
        title={isSidebarOpen ? t('sidebar.collapsePanel') : t('sidebar.expandPanel')}
        className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
      >
        {isSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {task ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-mono uppercase tracking-widest mb-1">
                <Sparkles className="w-3 h-3" />
                {t('sidebar.targetDataSource')}
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight">{task.title}</h1>
            </div>

            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
              <Suspense fallback={<span className="text-slate-400 text-xs">{t('sidebar.loading')}</span>}>
                <LazyMathRenderer content={task.original_text} />
              </Suspense>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-300">{t('sidebar.pedagogicalFidelity')}</span>
                </div>
                <span className="text-xs font-mono text-emerald-400">98.4%</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-300">{t('sidebar.cognitiveLoadFactor')}</span>
                </div>
                <span className="text-xs font-mono text-blue-400">{t('sidebar.high')}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{t('sidebar.metadataStream')}</h3>
              <div className="space-y-2">
                {task.tags.map(tag => (
                  <div key={tag} className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500 uppercase">{tag}</span>
                    <span className="text-indigo-400">{t('sidebar.active')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <Microscope className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-xs text-slate-500 uppercase tracking-widest">{t('sidebar.selectTask')}</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-900 border-t border-slate-800">
        <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl h-12">
          <Share2 className="w-4 h-4 mr-2" />
          {t('sidebar.intelligenceBroadcast')}
        </Button>
      </div>
    </aside>
  );
};
