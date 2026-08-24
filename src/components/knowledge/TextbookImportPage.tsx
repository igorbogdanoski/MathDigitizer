/**
 * Importing a textbook (EXPERT_LEVEL_MASTER_PLAN, 10.1).
 *
 * The pipeline underneath — extract, sanitise, segment, distil, store — was
 * written and tested first, and until this screen existed no teacher could
 * reach any of it. That was the audit's first finding.
 *
 * The order of the screen is the order of the decisions. Nothing is sent to a
 * model until the teacher has seen what was read out of their file, what it
 * would cost, and has said on what basis they may use the book. That last one
 * is not a formality: `distilBook` takes the declaration as a required
 * argument and throws without it, so this form is the only way in.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, BookOpen, CheckCircle2, FileUp, Loader2, ShieldCheck, Trash2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { SEO } from '../SEO';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { extractDocumentText } from '../../lib/documents/extractText';
import { SUSPICIOUS_INVISIBLE_COUNT } from '../../lib/documents/sanitizeText';
import { Chapter, segmentChapters } from '../../lib/knowledge/chapters';
import { buildTokenBudget, estimateTokens } from '../../lib/knowledge/tokenBudget';
import { USAGE_BASES, UsageBasis, requiresNote, validateUsageDeclaration } from '../../lib/knowledge/usageRights';
import { StoredChapterSkill, deleteBook, getChapterSkills, saveChapterSkills } from '../../lib/knowledge/store';
import { invalidateKnowledgeCache } from '../../lib/knowledge/context';

/** What one distilled chapter is budgeted to cost, for the pre-flight estimate. */
const BUDGETED_CORE_TOKENS = 1200;
const BUDGETED_CHAPTER_TOKENS = 600;

interface ReadFile {
  name: string;
  chapters: Chapter[];
  pageCount: number;
  invisiblesRemoved: number;
}

export const TextbookImportPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [read, setRead] = useState<ReadFile | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [basis, setBasis] = useState<UsageBasis | ''>('');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [books, setBooks] = useState<StoredChapterSkill[] | null>(null);

  React.useEffect(() => {
    if (!user) return;
    void getChapterSkills(user.uid).then(setBooks);
  }, [user]);

  const budget = useMemo(
    () => read ? buildTokenBudget(read.chapters, {
      coreTokens: BUDGETED_CORE_TOKENS,
      chapterTokens: BUDGETED_CHAPTER_TOKENS,
    }) : null,
    [read],
  );

  const declaration = useMemo(() => ({
    basis: (basis || undefined) as UsageBasis | undefined,
    declaredBy: user?.uid ?? '',
    declaredAt: new Date().toISOString(),
    note: note.trim() || undefined,
  }), [basis, note, user]);

  const problems = validateUsageDeclaration(declaration);
  const canDistil = Boolean(read && read.chapters.length > 0 && problems.length === 0 && !progress);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsReading(true);
    setRead(null);
    try {
      const document = await extractDocumentText(file);
      if (document.empty) {
        showToast(t('textbook.noText'), 'error');
        return;
      }
      setRead({
        name: file.name.replace(/\.[^.]+$/, ''),
        chapters: segmentChapters(document.text),
        pageCount: document.pageCount,
        invisiblesRemoved: document.invisiblesRemoved,
      });
    } catch (error) {
      console.error('Could not read the document:', error);
      showToast(t('textbook.readFailed'), 'error');
    } finally {
      setIsReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleDistil = async () => {
    if (!user || !read) return;
    setProgress({ done: 0, total: read.chapters.length, title: '' });

    try {
      const { distilBook } = await import('../../lib/ai/knowledge');
      const distilled = await distilBook(read.chapters, {
        bookTitle: read.name,
        ownerId: user.uid,
        usage: declaration as Parameters<typeof distilBook>[1]['usage'],
        onProgress: setProgress,
      });

      if (distilled.length === 0) {
        showToast(t('textbook.nothingDistilled'), 'info');
        return;
      }

      await saveChapterSkills(distilled);
      invalidateKnowledgeCache();
      setBooks(await getChapterSkills(user.uid));
      setRead(null);
      setBasis('');
      setNote('');
      showToast(t('textbook.imported', { count: distilled.length }), 'success');
    } catch (error) {
      console.error('Distillation failed:', error);
      showToast(t('textbook.distilFailed'), 'error');
    } finally {
      setProgress(null);
    }
  };

  const grouped = useMemo(() => {
    const byBook = new Map<string, { title: string; chapters: number }>();
    for (const skill of books ?? []) {
      const entry = byBook.get(skill.bookId) ?? { title: skill.bookTitle, chapters: 0 };
      entry.chapters++;
      byBook.set(skill.bookId, entry);
    }
    return [...byBook.entries()];
  }, [books]);

  const handleDeleteBook = async (bookId: string, title: string) => {
    if (!user || !confirm(t('textbook.confirmDelete', { title }))) return;
    await deleteBook(user.uid, bookId);
    invalidateKnowledgeCache();
    setBooks(await getChapterSkills(user.uid));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SEO title="Учебници | MathDigitizer Pro" description="Внеси учебник во базата на знаење" noindex />

      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
          <BookOpen className="w-6 h-6 text-indigo-500" aria-hidden="true" />
          {t('textbook.pageTitle')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-prose">
          {t('textbook.pageSubtitle')}
        </p>
      </div>

      {/* 1 — read the file */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
            {t('textbook.step1')}
          </h2>

          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="sr-only"
            id="textbook-file"
            onChange={handleFile}
          />
          <label htmlFor="textbook-file" className="inline-block">
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer">
              {isReading
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : <FileUp className="w-4 h-4" aria-hidden="true" />}
              {t('textbook.pickFile')}
            </span>
          </label>

          {read && (
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-100">{read.name}</p>
              <p>{t('textbook.readSummary', { pages: read.pageCount, chapters: read.chapters.length })}</p>
              {read.chapters.every(c => c.synthetic) && read.chapters.length > 1 && (
                <p className="text-amber-700 dark:text-amber-400">{t('textbook.noHeadings')}</p>
              )}
              {read.invisiblesRemoved >= SUSPICIOUS_INVISIBLE_COUNT && (
                <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {t('textbook.invisiblesRemoved', { count: read.invisiblesRemoved })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2 — what it would cost */}
      {read && budget && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
              {t('textbook.step2')}
            </h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t('textbook.wholeBook')}</dt>
                <dd className="font-mono font-bold tabular-nums">{budget.wholeBook.toLocaleString('mk-MK')}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t('textbook.perQuestion')}</dt>
                <dd className="font-mono font-bold tabular-nums">{budget.distilled.toLocaleString('mk-MK')}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t('textbook.saving')}</dt>
                <dd className="font-mono font-bold tabular-nums">{budget.savingVsWholeBook}×</dd>
              </div>
            </dl>

            {!budget.worthwhile && (
              <p className="text-sm text-amber-700 dark:text-amber-400">{t('textbook.notWorthwhile')}</p>
            )}

            <details>
              <summary className="text-sm text-indigo-600 dark:text-indigo-400 cursor-pointer">
                {t('textbook.showChapters')}
              </summary>
              <ul className="mt-2 space-y-1 text-sm max-h-64 overflow-y-auto">
                {read.chapters.map(chapter => (
                  <li key={chapter.index} className="flex justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-1">
                    <span className="truncate">{chapter.title}</span>
                    <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                      {estimateTokens(chapter.text).toLocaleString('mk-MK')}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>
      )}

      {/* 3 — the right to use it */}
      {read && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" aria-hidden="true" />
              {t('textbook.step3')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-prose">
              {t('textbook.rightsExplainer')}
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-semibold" htmlFor="usage-basis">
                {t('textbook.basisLabel')}
              </label>
              <select
                id="usage-basis"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800"
                value={basis}
                onChange={event => setBasis(event.target.value as UsageBasis | '')}
              >
                <option value="">{t('textbook.basisUnset')}</option>
                {USAGE_BASES.map(value => (
                  <option key={value} value={value}>{t(`textbook.basis.${value}`)}</option>
                ))}
              </select>
            </div>

            {basis && requiresNote(basis) && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold" htmlFor="usage-note">
                  {t('textbook.noteLabel')}
                </label>
                <input
                  id="usage-note"
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800"
                  placeholder={t('textbook.notePlaceholder')}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                />
              </div>
            )}

            {problems.length > 0 && basis !== '' && (
              <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                {problems.map(problem => <li key={problem.field}>{problem.reason}</li>)}
              </ul>
            )}

            <Button onClick={handleDistil} disabled={!canDistil}>
              {progress
                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden="true" />
                : <CheckCircle2 className="w-4 h-4 mr-1.5" aria-hidden="true" />}
              {t('textbook.distil')}
            </Button>

            {progress && (
              <div className="space-y-1">
                <div
                  className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progress.done}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-label={t('textbook.progressLabel')}
                >
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {t('textbook.progress', { done: progress.done, total: progress.total, title: progress.title })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* what is already in */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
            {t('textbook.myBooks')}
          </h2>

          {books === null ? (
            <p className="text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t('textbook.loading')}
            </p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('textbook.noBooks')}</p>
          ) : (
            <ul className="space-y-2">
              {grouped.map(([bookId, info]) => (
                <li key={bookId} className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{info.title}</span>
                    <span className="block text-xs text-slate-400">
                      {t('textbook.bookSummary', { count: info.chapters })}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBook(bookId, info.title)}
                    aria-label={t('textbook.deleteBook', { title: info.title })}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TextbookImportPage;
