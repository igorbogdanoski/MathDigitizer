import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight, Sparkles, Loader2, BarChart2, Activity, BookOpen,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { GraphAnalysis } from '../../lib/gemini';
import { DOK_COLORS } from './types';

interface StepAnalyzeProps {
  analysis: GraphAnalysis | null;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
  onNext: () => void;
}

export const StepAnalyze: React.FC<StepAnalyzeProps> = ({
  analysis, isAnalyzing, onRunAnalysis, onNext,
}) => {
  const { t } = useTranslation('graphDigitizer');
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Sparkles className="w-4 h-4 text-indigo-500" /> {t('analyze.title')}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('analyze.description')}
        </p>
        <Button className="w-full" onClick={onRunAnalysis} disabled={isAnalyzing}>
          {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('analyze.analyzing')}</> : <><Sparkles className="w-4 h-4 mr-2" /> {t('analyze.analyzeWithGemini')}</>}
        </Button>

        {analysis && (
          <div className="space-y-3">
            {/* Graph type badge */}
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {analysis.graph_type}
              </span>
              {analysis.grade_level && (
                <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                  {t('analyze.grade', { grade: analysis.grade_level })}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
              {analysis.description}
            </p>

            {/* Detected equation */}
            {analysis.detected_equation && (
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg">
                <Activity className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-xs font-mono text-indigo-700 dark:text-indigo-300">
                  {analysis.detected_equation}
                </span>
              </div>
            )}

            {/* Curriculum */}
            {analysis.curriculum_topic && (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                {analysis.curriculum_topic}
              </div>
            )}

            {/* Questions */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('analyze.pedagogicalQuestions')}</p>
              {analysis.generated_questions.map((q, i) => (
                <div key={i} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{q.question}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${DOK_COLORS[q.dok_level] ?? 'bg-slate-100 text-slate-600'}`}>
                      DoK {q.dok_level} · {t(`dok.${q.dok_level}`)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {t(`bloom.${q.bloom_level}`, { defaultValue: q.bloom_level })}
                    </span>
                  </div>
                  {q.answer_hint && (
                    <p className="text-[10px] text-slate-400 italic">{q.answer_hint}</p>
                  )}
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={onNext}>
              {t('analyze.export')} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
