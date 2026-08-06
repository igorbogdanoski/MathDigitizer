import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { saveAs } from 'file-saver';
import { X, Download, Share2, Copy, CheckSquare, Square, Loader2 } from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';
import { useToast } from '../../contexts/ToastContext';
import { apiUrl } from '../../lib/ai/client';
import {
  toSharedTask,
  toSharedTaskExport,
  sharedTasksToLatex,
  sharedTasksToMarkdown,
} from '../../lib/sharedTaskFormat';
import { tasksToSlideDeck } from '../../lib/slidesExport';
import { tasksByCurriculum } from '../../lib/curriculumExport';
import { tasksToSlideaDocument, getSlideaFilename } from '../../lib/slideaInterchange';

type ExportFormat = 'json' | 'latex' | 'markdown' | 'slides' | 'curriculum' | 'slidea';
type ExportTarget = 'ai-navigator' | 'slides' | 'generic';

interface ExportPanelProps {
  /** All tasks currently visible after library filters. */
  tasks: MathTask[];
  /** Tasks selected via the library selection mode (may be empty). */
  preselectedIds: Set<string>;
  onClose: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ tasks, preselectedIds, onClose }) => {
  const { t } = useTranslation('library');
  const { showToast } = useToast();

  const initialSelection = useMemo(() => {
    const available = tasks.filter((task) => task.id);
    const preselected = available.filter((task) => preselectedIds.has(task.id!));
    const base = preselected.length > 0 ? preselected : available;
    return new Set(base.map((task) => task.id!));
  }, [tasks, preselectedIds]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelection);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [target, setTarget] = useState<ExportTarget>('generic');
  const [isExporting, setIsExporting] = useState(false);
  const [apiUrlCopied, setApiUrlCopied] = useState(false);

  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.id && selectedIds.has(task.id)),
    [tasks, selectedIds]
  );

  const toggleTask = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(tasks.filter((task) => task.id).map((task) => task.id!)));
  const clearAll = () => setSelectedIds(new Set());

  const getExportApiUrl = (): string => {
    const url = apiUrl('/api/export/tasks');
    if (/^https?:\/\//.test(url)) return url;
    return `${window.location.origin}${url}`;
  };

  const handleCopyApiUrl = async () => {
    const url = getExportApiUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (non-secure context) — fall back to execCommand.
      const helper = document.createElement('textarea');
      helper.value = url;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      document.body.removeChild(helper);
    }
    setApiUrlCopied(true);
    setTimeout(() => setApiUrlCopied(false), 2000);
    showToast(t('exportApiUrlCopied'), 'success');
  };

  const handleDownload = () => {
    if (selectedTasks.length === 0) {
      showToast(t('exportNoTasksSelected'), 'error');
      return;
    }

    setIsExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);

      switch (format) {
        case 'json': {
          const envelope = toSharedTaskExport(selectedTasks, target);
          saveAs(
            new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json;charset=utf-8' }),
            `shared-tasks-${stamp}.json`
          );
          break;
        }
        case 'latex': {
          const latex = sharedTasksToLatex(selectedTasks.map(toSharedTask));
          saveAs(new Blob([latex], { type: 'text/plain;charset=utf-8' }), `math-tasks-${stamp}.tex`);
          break;
        }
        case 'markdown': {
          const md = sharedTasksToMarkdown(selectedTasks.map(toSharedTask));
          saveAs(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `math-tasks-${stamp}.md`);
          break;
        }
        case 'slides': {
          const deck = tasksToSlideDeck(selectedTasks);
          saveAs(
            new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json;charset=utf-8' }),
            `slide-deck-${stamp}.json`
          );
          break;
        }
        case 'curriculum': {
          const grouped = tasksByCurriculum(selectedTasks);
          saveAs(
            new Blob([JSON.stringify(grouped, null, 2)], { type: 'application/json;charset=utf-8' }),
            `curriculum-export-${stamp}.json`
          );
          break;
        }
        case 'slidea': {
          const doc = tasksToSlideaDocument(selectedTasks);
          const filename = getSlideaFilename(doc.title);
          saveAs(
            new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json;charset=utf-8' }),
            filename
          );
          break;
        }
      }
      showToast(t('exportDownloadSuccess', { count: selectedTasks.length }), 'success');
    } catch (e) {
      console.error('Export failed:', e);
      showToast(t('exportDownloadError'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const formats: { value: ExportFormat; labelKey: string; descKey: string }[] = [
    { value: 'json', labelKey: 'exportFormatJson', descKey: 'exportFormatJsonDesc' },
    { value: 'latex', labelKey: 'exportFormatLatex', descKey: 'exportFormatLatexDesc' },
    { value: 'markdown', labelKey: 'exportFormatMarkdown', descKey: 'exportFormatMarkdownDesc' },
    { value: 'slides', labelKey: 'exportFormatSlides', descKey: 'exportFormatSlidesDesc' },
    { value: 'curriculum', labelKey: 'exportFormatCurriculum', descKey: 'exportFormatCurriculumDesc' },
    { value: 'slidea', labelKey: 'exportFormatSlidea', descKey: 'exportFormatSlideaDesc' },
  ];

  const targets: { value: ExportTarget; labelKey: string }[] = [
    { value: 'ai-navigator', labelKey: 'exportTargetAiNavigator' },
    { value: 'slides', labelKey: 'exportTargetSlides' },
    { value: 'generic', labelKey: 'exportTargetGeneric' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col border border-slate-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('exportPanelTitle')}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Share2 className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('exportPanelTitle')}</h2>
          </div>
          <button
            type="button"
            aria-label={t('close')}
            title={t('close')}
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left: settings */}
          <div className="lg:w-80 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/30 space-y-5 flex-shrink-0">
            {/* Format */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {t('exportFormatLabel')}
              </h3>
              <div className="space-y-1.5">
                {formats.map((f) => (
                  <label
                    key={f.value}
                    className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      format === f.value
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="export-format"
                        checked={format === f.value}
                        onChange={() => setFormat(f.value)}
                        className="rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(f.labelKey)}</span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-6">{t(f.descKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Target app */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {t('exportTargetLabel')}
              </h3>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as ExportTarget)}
                title={t('exportTargetLabel')}
                aria-label={t('exportTargetLabel')}
                className="w-full h-10 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {targets.map((tgt) => (
                  <option key={tgt.value} value={tgt.value}>
                    {t(tgt.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary + actions */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                {t('exportTasksCount', { count: selectedTasks.length })}
              </p>
              <Button
                variant="default"
                onClick={handleDownload}
                disabled={isExporting || selectedTasks.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {t('exportDownload')}
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyApiUrl}
                className="w-full dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                title={t('exportCopyApiUrlTip')}
              >
                {apiUrlCopied ? <CheckSquare className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                {apiUrlCopied ? t('exportApiUrlCopied') : t('exportCopyApiUrl')}
              </Button>
            </div>
          </div>

          {/* Right: task selection */}
          <div className="flex-1 p-5 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('exportSelectTasks')}
              </h3>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  {t('selectAllItems')}
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:underline font-semibold"
                >
                  {t('deselectAllItems')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px] space-y-1 pr-1">
              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">{t('noMatchingTasks')}</p>
              ) : (
                tasks.map((task) => {
                  const taskId = task.id;
                  const checked = !!taskId && selectedIds.has(taskId);
                  return (
                    <button
                      key={taskId || task.title}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={!taskId}
                      onClick={() => taskId && toggleTask(taskId)}
                      className="w-full flex items-start gap-3 p-2.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors disabled:cursor-not-allowed"
                    >
                      <span className="mt-0.5 flex-shrink-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </span>
                      <span className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {task.title}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {[task.grade_level, task.curriculum_topic, task.difficulty]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
