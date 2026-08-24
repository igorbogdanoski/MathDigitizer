import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Sigma, Loader2 } from 'lucide-react';
import { MathRenderer } from '../MathRenderer';
import { Button } from '../ui/Button';
import { validateLatex } from '../../lib/ai/validate';
import { Point, bestFit, FitResult } from '../../lib/graph/regression';
import { ResidualReport, evaluateResidual, relativePercent } from '../../lib/graph/residual';

interface EquationVerificationProps {
  /** The equation the model reported for the graph. */
  detectedEquation?: string;
  /** Digitized points, in real coordinates. */
  points: Point[];
  /** Replaces the detected equation with the computed fit. */
  onUseFit?: (latex: string) => void;
}

const VERDICT_STYLE = {
  good: { icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  approximate: { icon: AlertTriangle, className: 'text-amber-700 bg-amber-50 border-amber-200' },
  poor: { icon: XCircle, className: 'text-rose-700 bg-rose-50 border-rose-200' },
  unverifiable: { icon: HelpCircle, className: 'text-slate-600 bg-slate-50 border-slate-200' },
} as const;

/**
 * Checks the detected equation against the digitized points
 * (EXPERT_LEVEL_MASTER_PLAN, 8.1 and 8.3).
 *
 * Two independent checks: the equation must parse as LaTeX, and it must
 * actually describe the points. Alongside it, a least-squares fit computed from
 * the points themselves — arithmetic the teacher can compare the model's answer
 * against, rather than having to take it on trust.
 */
export const EquationVerification: React.FC<EquationVerificationProps> = ({
  detectedEquation,
  points,
  onUseFit,
}) => {
  const { t } = useTranslation('graphDigitizer');
  const [residual, setResidual] = useState<ResidualReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const latexIssues = useMemo(
    () => (detectedEquation ? validateLatex(`$${detectedEquation.replace(/\$/g, '')}$`) : []),
    [detectedEquation]
  );

  const fit = useMemo<FitResult | null>(() => bestFit(points), [points]);

  useEffect(() => {
    if (!detectedEquation || points.length < 2) {
      setResidual(null);
      return;
    }

    let cancelled = false;
    setIsChecking(true);

    evaluateResidual(detectedEquation, points)
      .then(report => { if (!cancelled) setResidual(report); })
      .catch(() => { if (!cancelled) setResidual(null); })
      .finally(() => { if (!cancelled) setIsChecking(false); });

    return () => { cancelled = true; };
  }, [detectedEquation, points]);

  if (!detectedEquation && !fit) return null;

  const verdict = residual?.verdict ?? 'unverifiable';
  const { icon: VerdictIcon, className } = VERDICT_STYLE[verdict];

  return (
    <section className="space-y-3">
      {/* LaTeX validity — a formula that does not parse cannot be trusted or shown */}
      {latexIssues.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
            {t('verify.invalidLatex')}
          </p>
          <p className="text-xs text-rose-700/80 mt-1 font-mono">{latexIssues[0].error}</p>
        </div>
      )}

      {/* Residual against the digitized points */}
      {detectedEquation && (
        <div className={`rounded-xl border p-3 ${className}`}>
          <div className="flex items-start gap-2">
            {isChecking
              ? <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
              : <VerdictIcon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider">
                {isChecking ? t('verify.checking') : t(`verify.verdict.${verdict}`)}
              </p>
              {residual && residual.evaluated > 0 && (
                <p className="text-[11px] mt-1 opacity-90">
                  {t('verify.residualDetail', {
                    percent: relativePercent(residual),
                    evaluated: residual.evaluated,
                    max: Math.round(residual.maxDeviation * 1000) / 1000,
                  })}
                </p>
              )}
              {residual && residual.skipped > 0 && (
                <p className="text-[11px] mt-0.5 opacity-75">
                  {t('verify.skipped', { count: residual.skipped })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deterministic fit from the points — the check on the model's answer */}
      {fit && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-900/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sigma className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              {t(`verify.fitKind.${fit.kind}`)}
            </p>
            <span className="ml-auto text-[11px] font-mono text-indigo-700 dark:text-indigo-400">
              R² = {Math.round(fit.r2 * 1000) / 1000}
            </span>
          </div>

          <div className="text-sm">
            <MathRenderer content={`$${fit.latex}$`} />
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
            {t('verify.fitDetail', {
              points: fit.pointsUsed,
              rmse: Math.round(fit.rmse * 1000) / 1000,
            })}
          </p>

          {onUseFit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUseFit(fit.latex.replace(/^y\s*=\s*/, ''))}
              className="mt-3 h-8 text-xs font-bold rounded-lg"
            >
              {t('verify.useFit')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
