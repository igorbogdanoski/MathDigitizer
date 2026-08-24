/**
 * Says where a curriculum mapping came from (EXPERT_LEVEL_MASTER_PLAN, 9.5).
 *
 * The shared contract's §3 turns on one distinction: a code that came with the
 * content is knowledge, a code the model produced is a proposal. Both were
 * rendered identically — the `source` field was written on every ref and read
 * by nothing — so a teacher exporting to Slidea, or reading a coverage figure,
 * could not tell which they were looking at.
 *
 * One component so the wording cannot drift between the admin queue, the
 * coverage panel and anywhere refs are shown later.
 */
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CurriculumRef } from '../../lib/schema';
import { isConfirmedRef } from '../../lib/curriculumCoverage';

interface Props {
  ref_: CurriculumRef | undefined;
  /** Shows the model's own confidence next to an unconfirmed suggestion. */
  showConfidence?: boolean;
  className?: string;
}

export default function CurriculumRefBadge({ ref_, showConfidence = false, className = '' }: Props) {
  const { t } = useTranslation();
  if (!ref_) return null;

  const confirmed = isConfirmedRef(ref_);
  const confidencePct =
    typeof ref_.confidence === 'number' ? Math.round(ref_.confidence * 100) : null;

  const base =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border';
  const tone = confirmed
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';

  return (
    <span
      className={`${base} ${tone} ${className}`}
      title={confirmed ? t('curriculumRef.confirmedHint') : t('curriculumRef.suggestedHint')}
    >
      {confirmed ? <CheckCircle2 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
      {confirmed ? t('curriculumRef.confirmed') : t('curriculumRef.suggested')}
      {!confirmed && showConfidence && confidencePct !== null && (
        <span className="opacity-70">· {confidencePct}%</span>
      )}
    </span>
  );
}
