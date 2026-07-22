import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Quote, Zap, AlertTriangle, Activity, Code, Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { MathTask } from '../../lib/schema';

interface OCRResultPreviewProps {
  extractedTask: Partial<MathTask> | null;
  latexCode: string;
  isEnriching: boolean;
  onEnrich: () => void;
  onOpenGeogebra: (cmds: string[]) => void;
}

export const OCRResultPreview: React.FC<OCRResultPreviewProps> = ({
  extractedTask,
  latexCode,
  isEnriching,
  onEnrich,
  onOpenGeogebra,
}) => {
  const { t } = useTranslation('smartOcr');
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      {extractedTask?.evidence_quote && (
        <div className="mb-6 flex items-start gap-2 bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border-l-2 border-amber-300 text-amber-700 dark:text-amber-400 text-sm italic">
          <Quote className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />
          <p>{t('result.evidenceFound', { quote: extractedTask.evidence_quote })}</p>
        </div>
      )}
      <MathRenderer content={latexCode} />

      {extractedTask && extractedTask.difficulty && (
        <div className="mt-8 space-y-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">{t('result.aiMetadata')}</h4>
              {!extractedTask.pedagogical_insights && (
                <Button
                  size="sm"
                  onClick={onEnrich}
                  disabled={isEnriching}
                  className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700"
                >
                  {isEnriching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  {t('result.pedagogicalEnrichment')}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mt-3 border-t border-indigo-100 dark:border-indigo-800/50 pt-3">
              {extractedTask.type !== 'theory' && <div><span className="text-slate-500">{t('result.difficulty')}</span> <span className="font-medium text-slate-900 dark:text-white">{extractedTask.difficulty}</span></div>}
              <div><span className="text-slate-500">{t('result.topic')}</span> <span className="font-medium text-slate-900 dark:text-white">{extractedTask.curriculum_topic}</span></div>
              <div><span className="text-slate-500">{t('result.type')}</span> <span className={`font-medium px-2 py-0.5 rounded text-[10px] uppercase font-bold ${extractedTask.type === 'theory' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{extractedTask.type}</span></div>
              {extractedTask.detected_language && <div><span className="text-slate-500">{t('result.language')}</span> <span className="font-medium text-slate-900 dark:text-white uppercase text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded ml-1">{extractedTask.detected_language}</span></div>}
            </div>
          </div>

          {extractedTask.pedagogical_insights && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50/80 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <AlertTriangle className="w-12 h-12 text-red-600" />
                  </div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-400 mb-2 relative z-10">
                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                    {t('result.commonPitfalls')}
                  </h4>
                  <ul className="space-y-1 relative z-10">
                    {extractedTask.pedagogical_insights.common_pitfalls.map((p, i) => (
                      <li key={i} className="text-[11px] text-red-800 dark:text-red-300 flex gap-2">
                         <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                         {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-indigo-50/80 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(79,70,229,0.05)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Quote className="w-12 h-12 text-indigo-600" />
                  </div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-400 mb-2 relative z-10">
                    <Quote className="w-3.5 h-3.5" />
                    {t('result.socraticQuestions')}
                  </h4>
                  <ul className="space-y-1 relative z-10">
                    {extractedTask.pedagogical_insights.socratic_questions.map((q, i) => (
                      <li key={i} className="text-[11px] text-indigo-800 dark:text-indigo-300 italic flex gap-2">
                         <span className="text-indigo-400 font-bold">?</span>
                         {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {extractedTask.pedagogical_insights.modeling_scenario && (
                <div className="bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.05)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity className="w-12 h-12 text-emerald-600" />
                  </div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-400 mb-2 relative z-10">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    {t('result.modelingScenario')}
                  </h4>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium relative z-10">
                    {extractedTask.pedagogical_insights.modeling_scenario}
                  </p>
                </div>
              )}

              {extractedTask.pedagogical_insights.modern_context_suggestion && (
                <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <Zap className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0 animate-bounce" />
                  <div>
                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest block mb-1">{t('result.modernizationSuggestion')}</span>
                    <p className="text-sm text-orange-950 dark:text-orange-100 italic leading-relaxed font-display">
                      "{extractedTask.pedagogical_insights.modern_context_suggestion}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GeoGebra / Visualization Sub-card */}
          {(extractedTask.geogebra_commands?.length ?? 0) > 0 && (
            <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-inner mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-indigo-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">GeoGebra Command API</h4>
                </div>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-bold"
                  onClick={() => onOpenGeogebra(extractedTask.geogebra_commands || [])}
                >
                  <Code className="w-4 h-4 mr-2" />
                  {t('result.openInGeogebra')}
                </Button>
              </div>
              <div className="bg-slate-900 rounded-xl p-3 text-emerald-400 font-mono text-xs overflow-x-auto">
                {extractedTask.geogebra_commands?.map((cmd, i) => (
                  <div key={i} className="whitespace-nowrap"><span className="text-slate-500">evalCommand:</span> {cmd}</div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 text-center uppercase tracking-widest font-bold">{t('result.geogebraReady')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
