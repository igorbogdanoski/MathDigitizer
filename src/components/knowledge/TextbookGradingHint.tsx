/**
 * Offers textbook import where it would actually change something.
 *
 * Nobody sits down wanting to import a textbook. It is not a destination, it is
 * an enhancement to grading: a distilled chapter carries the specific wrong
 * moves students make on that content, which is the difference between telling
 * a student they are wrong and telling them why. A tile in a menu competing
 * with the tools a teacher came for would say the name and none of the reason.
 *
 * So it is offered here, at the screen where the difference shows, and only to
 * a teacher who has not imported anything — once you have, the offer is noise.
 * Dismissible, because an offer that cannot be refused is an advertisement.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BookOpen, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasStored, writeStored } from '../../lib/safeStorage';

const DISMISSED_KEY = 'md.hint.textbookGrading.dismissed';

export const TextbookGradingHint: React.FC = () => {
  const { t } = useTranslation();
  const { user, userProfile } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || userProfile?.role !== 'teacher') return;

    let cancelled = false;
    (async () => {
      // Storage blocked reads as "not dismissed", which shows the hint. That is
      // the safe side: a hint shown twice costs a glance, one never shown costs
      // a teacher the feature.
      if (hasStored(DISMISSED_KEY)) return;

      try {
        const { getChapterSkills } = await import('../../lib/knowledge/store');
        const imported = await getChapterSkills(user.uid);
        if (!cancelled && imported.length === 0) setShow(true);
      } catch (error) {
        // A hint is not worth a failed screen; if we cannot tell, say nothing.
        console.warn('Could not check for imported textbooks:', error);
      }
    })();

    return () => { cancelled = true; };
  }, [user, userProfile]);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    // If storage refuses, the hint returns next visit. Acceptable for a hint.
    writeStored(DISMISSED_KEY, new Date().toISOString());
  };

  return (
    <aside className="flex items-start gap-3 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30">
      <BookOpen className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" aria-hidden="true" />

      <p className="flex-1 text-xs leading-relaxed text-indigo-900 dark:text-indigo-200">
        {t('textbookHint.body')}{' '}
        <Link to="/textbooks" className="font-bold underline underline-offset-2">
          {t('textbookHint.action')}
        </Link>
      </p>

      <button
        type="button"
        onClick={dismiss}
        aria-label={t('textbookHint.dismiss')}
        className="shrink-0 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </aside>
  );
};

export default TextbookGradingHint;
