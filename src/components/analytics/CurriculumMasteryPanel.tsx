import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Target, Info, ArrowDownRight } from 'lucide-react';
import {
  GradedEvidence,
  buildMasteryRollup,
  classificationCoverage,
  findWeaknesses,
} from '../../lib/analytics/masteryRollup';

interface CurriculumMasteryPanelProps {
  evidence: GradedEvidence[];
  /** Narrows the rollup to one student; omit for the whole class. */
  studentId?: string;
}

/** Colour band for a mastery percentage, consistent with the rest of the app. */
const bandClass = (score: number): string =>
  score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500';

/**
 * Weaknesses in the language of the curriculum
 * (EXPERT_LEVEL_MASTER_PLAN, 7.2).
 *
 * Shows mastery per БРО domain and per outcome code, and — where the vertical
 * progression knows one — the prerequisite the weakness most likely rests on.
 * Coverage is stated up front: a rollup built on a fraction of the work is a
 * hint, not a finding, and the teacher is told which.
 */
export const CurriculumMasteryPanel: React.FC<CurriculumMasteryPanelProps> = ({ evidence, studentId }) => {
  const { t } = useTranslation('analytics');

  const { rollup, weaknesses, coverage } = useMemo(() => {
    const scoped = studentId ? evidence.filter(e => e.studentId === studentId) : evidence;
    const built = buildMasteryRollup(scoped);
    return {
      rollup: built,
      weaknesses: findWeaknesses(built),
      coverage: classificationCoverage(built),
    };
  }, [evidence, studentId]);

  if (rollup.totalEvidence === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
        <Target className="w-10 h-10 mx-auto mb-3 opacity-20" aria-hidden="true" />
        <p>{t('mastery.noEvidence')}</p>
      </div>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" aria-hidden="true" />
            {t('mastery.title')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{t('mastery.subtitle')}</p>
        </div>

        {/* Coverage is stated, not hidden — an unclassified majority changes
            how much weight these numbers deserve. */}
        <div className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
          coverage >= 70 ? 'bg-emerald-50 text-emerald-700' :
          coverage >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {t('mastery.coverage', { percent: coverage, classified: rollup.totalEvidence - rollup.unclassifiedCount, total: rollup.totalEvidence })}
        </div>
      </header>

      {coverage < 50 && (
        <p role="note" className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {t('mastery.lowCoverageWarning')}
        </p>
      )}

      {/* Mastery per curriculum domain */}
      {rollup.domains.length > 0 && (
        <div className="space-y-3">
          {rollup.domains.map(domain => (
            <div key={domain.domain}>
              <div className="flex justify-between items-baseline text-sm mb-1">
                <span className="font-bold text-slate-800 dark:text-slate-200">{domain.label}</span>
                <span className="text-xs text-slate-500">
                  {t('mastery.domainMeta', { score: domain.averageScore, attempts: domain.attempts })}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${bandClass(domain.averageScore)}`}
                  role="progressbar"
                  aria-label={domain.label}
                  aria-valuenow={Math.round(domain.averageScore)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{ width: `${Math.max(2, Math.round(domain.averageScore))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actionable weaknesses, each with the prerequisite to revisit */}
      {weaknesses.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            {t('mastery.weaknessesTitle')}
          </h4>

          {weaknesses.map(weakness => (
            <article
              key={weakness.domain}
              className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-900/10 p-4"
            >
              <div className="flex justify-between items-baseline gap-3">
                <h5 className="font-bold text-slate-900 dark:text-white">{weakness.label}</h5>
                <span className="text-sm font-black text-rose-700 dark:text-rose-400">
                  {weakness.averageScore}%
                </span>
              </div>

              <ul className="mt-2 space-y-1">
                {weakness.codes.map(code => (
                  <li key={code.code} className="text-xs text-slate-700 dark:text-slate-300 flex items-baseline gap-2">
                    <code className="font-mono font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                      {code.code}
                    </code>
                    <span className="truncate">{code.label}</span>
                    <span className="ml-auto shrink-0 text-slate-500">
                      {t('mastery.codeMeta', { score: code.averageScore, attempts: code.attempts })}
                    </span>
                  </li>
                ))}
              </ul>

              {/* The prerequisite that this weakness rests on — the actual next step */}
              {weakness.prerequisite && (
                <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-900/50">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('mastery.prerequisiteTitle', { grade: weakness.prerequisite.grade })}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    {weakness.prerequisite.concepts}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        rollup.domains.length > 0 && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{t('mastery.noWeaknesses')}</p>
        )
      )}

      {rollup.unclassifiedCount > 0 && rollup.domains.length === 0 && (
        <p className="text-sm text-slate-500">{t('mastery.allUnclassified')}</p>
      )}
    </section>
  );
};
