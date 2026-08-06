import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Play, Trash2, RefreshCw, Check, Loader2,
  AlertCircle, BarChart2, ChevronDown, ChevronRight,
  Database, Sparkles, Download, Layers, LayoutGrid,
  ListChecks, Wand2, PieChart,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ingestStaticCurriculum,
  clearAllCurriculumChunks,
  getCurriculumChunkCount,
  getTotalStaticChunkCount,
} from '../lib/curriculumKnowledge';
import { generateTaskEmbedding } from '../lib/gemini';
import { classifyTaskCurriculum } from '../lib/ai/curriculum';
import { assignTaskCurriculumTopic } from '../lib/ai/classification';
import { ALL_MK_CURRICULUM } from '../lib/curriculumData';
import {
  fetchCoverageTasks,
  buildCoverageSnapshot,
  type CoverageTaskEntry,
} from '../lib/curriculumCoverage';
import type { MathTask, CurriculumRef } from '../lib/schema';
import { SEO } from './SEO';

type IngestStatus = 'idle' | 'running' | 'done' | 'error';

interface TrackStats {
  track: string;
  label: string;
  grades: number;
  topics: number;
  richPct: number;
}

const TRACK_META: Record<string, string> = {
  primary: 'Основно образование (I–IX)',
  secondary_general: 'Општа гимназија (I–IV год.)',
  secondary_math_info: 'Мат-инф гимназија (I–IV год.)',
  secondary_vocational: 'Стручно образование',
};

function buildTrackStats(): TrackStats[] {
  const map: Record<string, { grades: Set<string>; topics: number; rich: number }> = {};
  for (const g of ALL_MK_CURRICULUM) {
    if (!map[g.education_track]) map[g.education_track] = { grades: new Set(), topics: 0, rich: 0 };
    map[g.education_track].grades.add(g.grade);
    map[g.education_track].topics += g.topics.length;
    for (const t of g.topics) {
      const hasOutcomes = t.outcomes.length > 0;
      const hasKeywords = t.keywords.length > 0;
      const hasTasks = t.example_tasks.length > 0;
      if (hasOutcomes && hasKeywords && hasTasks) map[g.education_track].rich++;
    }
  }
  return Object.entries(map).map(([track, d]) => ({
    track,
    label: TRACK_META[track] ?? track,
    grades: d.grades.size,
    topics: d.topics,
    richPct: d.topics > 0 ? Math.round((d.rich / d.topics) * 100) : 0,
  }));
}

const heatColor = (pct: number) =>
  pct >= 70
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
    : pct > 0
      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
      : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';

const QUEUE_LIMIT = 20;

export const CurriculumAdmin: React.FC = () => {
  const { t } = useTranslation('common');
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  // ─── Ingest state (existing) ────────────────────────────────────────────────
  const [firestoreCount, setFirestoreCount] = useState<number | null>(null);
  const [staticTotal] = useState(getTotalStaticChunkCount());
  const [trackStats] = useState(buildTrackStats());

  const [status, setStatus] = useState<IngestStatus>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [useEmbeddings, setUseEmbeddings] = useState(true);
  const [lastResult, setLastResult] = useState<{ ingested: number; errors: number } | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  // ─── Coverage / mapping state (new) ─────────────────────────────────────────
  const [coverageTasks, setCoverageTasks] = useState<CoverageTaskEntry[] | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [browserTrack, setBrowserTrack] = useState<string | null>(null);
  const [browserGrade, setBrowserGrade] = useState<string | null>(null); // key: `${track}|${grade}`
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const snapshot = useMemo(
    () => (coverageTasks ? buildCoverageSnapshot(coverageTasks) : null),
    [coverageTasks],
  );

  const loadCoverage = useCallback(async () => {
    setCoverageLoading(true);
    try {
      setCoverageTasks(await fetchCoverageTasks());
    } catch (e) {
      console.error('Error loading tasks for coverage:', e);
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurriculumChunkCount().then(setFirestoreCount);
    loadCoverage();
  }, [loadCoverage]);

  // Manual-assignment options grouped by grade
  const topicOptionGroups = useMemo(
    () =>
      ALL_MK_CURRICULUM.map(g => ({
        key: `${g.education_track}|${g.grade}`,
        label: `${g.level_label} · ${TRACK_META[g.education_track] ?? g.education_track}`,
        topics: g.topics.map(tp => ({
          value: `${g.education_track}|${g.grade}|${tp.id}`,
          name: tp.name,
        })),
      })),
    [],
  );

  const refreshCount = async () => {
    setFirestoreCount(null);
    const n = await getCurriculumChunkCount();
    setFirestoreCount(n);
  };

  const runIngest = async () => {
    if (status === 'running') return;
    setStatus('running');
    setProgress({ done: 0, total: staticTotal });
    setLastResult(null);

    const embedFn = useEmbeddings ? generateTaskEmbedding : undefined;

    try {
      const result = await ingestStaticCurriculum(
        (done, total) => setProgress({ done, total }),
        embedFn,
      );
      setLastResult(result);
      setStatus('done');
      showToast(`Внесени ${result.ingested} теми во Firestore!`, 'success');
      await refreshCount();
    } catch (err: any) {
      setStatus('error');
      showToast(err?.message ?? 'Грешка при внесување', 'error');
    }
  };

  const runClear = async () => {
    if (!confirm('Сигурно? Ова ги брише сите curriculum_knowledge записи.')) return;
    setIsClearing(true);
    try {
      await clearAllCurriculumChunks();
      showToast('Колекцијата е исчистена', 'success');
      await refreshCount();
    } catch {
      showToast('Грешка при бришење', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // ─── Mapping queue handlers ─────────────────────────────────────────────────

  const applyLocalRefs = (taskId: string, refs: CurriculumRef[]) => {
    setCoverageTasks(prev =>
      prev
        ? prev.map(tk =>
            tk.id === taskId
              ? { ...tk, curriculum_refs: refs, curriculum_topic: refs[0]?.topic_name ?? tk.curriculum_topic }
              : tk,
          )
        : prev,
    );
  };

  const handleClassify = async (entry: CoverageTaskEntry) => {
    if (busyTaskId) return;
    setBusyTaskId(entry.id);
    try {
      const taskForAI: MathTask = {
        id: entry.id,
        title: entry.title,
        original_text: entry.original_text || entry.title,
        solution_steps: [],
        latex_formulas: [],
        source_url: '',
        tags: entry.tags || [],
        difficulty:
          entry.difficulty === 'easy' || entry.difficulty === 'medium' || entry.difficulty === 'hard'
            ? entry.difficulty
            : 'medium',
        curriculum_topic: entry.curriculum_topic,
        grade_level: entry.grade_level,
      };
      const refs = await classifyTaskCurriculum(taskForAI);
      if (refs.length === 0) {
        showToast(t('curriculumAdmin.queue.classifyNoMatch'), 'info');
        return;
      }
      await updateDoc(doc(db, 'tasks', entry.id), { curriculum_refs: refs });
      applyLocalRefs(entry.id, refs);
      showToast(
        t('curriculumAdmin.queue.classifySuccess', {
          topic: refs[0].topic_name,
          confidence: refs[0].confidence ?? '—',
        }),
        'success',
      );
    } catch (e) {
      console.error('Classify error:', e);
      showToast(t('curriculumAdmin.queue.classifyError'), 'error');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleManualAssign = async (entryId: string, value: string) => {
    if (!value || busyTaskId) return;
    const [education_track, grade, topic_id] = value.split('|');
    const gradeObj = ALL_MK_CURRICULUM.find(
      g => g.education_track === education_track && g.grade === grade,
    );
    const topic = gradeObj?.topics.find(tp => tp.id === topic_id);
    if (!gradeObj || !topic) return;

    setBusyTaskId(entryId);
    try {
      await assignTaskCurriculumTopic(entryId, {
        topic_id,
        topic_name: topic.name,
        grade,
        education_track,
        outcome_codes: topic.outcomes.map(o => o.code),
      });
      applyLocalRefs(entryId, [
        {
          education_track,
          grade,
          topic_id,
          topic_name: topic.name,
          outcome_codes: topic.outcomes.map(o => o.code),
          confidence: 1,
          source: 'manual',
        },
      ]);
      showToast(t('curriculumAdmin.queue.assignSuccess'), 'success');
    } catch (e) {
      console.error('Manual assign error:', e);
      showToast(t('curriculumAdmin.queue.assignError'), 'error');
    } finally {
      setBusyTaskId(null);
    }
  };

  // ─── Derived values ─────────────────────────────────────────────────────────

  const pct = firestoreCount != null && staticTotal > 0
    ? Math.round((firestoreCount / staticTotal) * 100)
    : 0;

  const progressPct = progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  const reviewQueue = useMemo(() => {
    if (!snapshot) return [];
    return [
      ...snapshot.unmappedList.map(e => ({ entry: e, kind: 'unmapped' as const, confidence: undefined as number | undefined })),
      ...snapshot.lowConfidenceList.map(e => ({ entry: e, kind: 'low' as const, confidence: e.bestConfidence })),
    ];
  }, [snapshot]);

  if (userProfile?.role !== 'teacher') {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        <AlertCircle className="w-4 h-4 mr-2" /> Само за наставници.
      </div>
    );
  }

  return (
    <>
      <SEO title="Curriculum Admin | MathDigitizer Pro" description="Управување со БРО наставни програми" noindex />

      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Curriculum Knowledge Base
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Официјални наставни програми — БРО.ГОВ.МК · <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">curriculum_knowledge</code> Firestore колекција
          </p>
        </div>

        {/* ── Stats cards: task mapping ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <PieChart className="w-4 h-4 text-indigo-500" />
                {t('curriculumAdmin.stats.title')}
              </div>
              <button
                onClick={loadCoverage}
                aria-label={t('curriculumAdmin.refresh')}
                title={t('curriculumAdmin.refresh')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              >
                {coverageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>

            {coverageLoading && !snapshot ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> {t('curriculumAdmin.loadingTasks')}
              </div>
            ) : snapshot && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <p className="text-3xl font-black text-slate-700 dark:text-slate-200">{snapshot.totalTasks}</p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{t('curriculumAdmin.stats.totalTasks')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <p className="text-3xl font-black text-emerald-600">{snapshot.mappedTasks}</p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{t('curriculumAdmin.stats.mappedTasks')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <p className="text-3xl font-black text-red-500">{snapshot.unmappedTasks}</p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{t('curriculumAdmin.stats.unmappedTasks')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <p className={`text-3xl font-black ${snapshot.mappingPct >= 70 ? 'text-emerald-600' : snapshot.mappingPct > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                      {snapshot.mappingPct}%
                    </p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{t('curriculumAdmin.stats.mappingPct')}</p>
                  </div>
                </div>

                {snapshot.lowConfidenceCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {t('curriculumAdmin.stats.lowConfidence')}: {snapshot.lowConfidenceCount}
                  </div>
                )}

                {/* Per-track breakdown */}
                <div>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-2">
                    {t('curriculumAdmin.stats.trackBreakdown')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {snapshot.trackCoverage.map(tc => (
                      <div key={tc.track} className="flex items-center justify-between text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                        <span className="text-slate-600 dark:text-slate-300 truncate mr-2">{TRACK_META[tc.track] ?? tc.track}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-400">{tc.mappedTasks} 📄</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            tc.pct >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            tc.pct > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {tc.coveredTopics}/{tc.totalTopics} · {tc.pct}%
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Coverage heatmap ── */}
        {snapshot && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                  <LayoutGrid className="w-4 h-4 text-indigo-500" />
                  {t('curriculumAdmin.heatmap.title')}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{t('curriculumAdmin.heatmap.subtitle')}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {snapshot.gradeCoverage.map(gc => (
                  <div
                    key={`${gc.track}|${gc.grade}`}
                    className={`rounded-xl border p-3 text-center transition-colors ${heatColor(gc.pct)}`}
                    title={`${gc.level_label} — ${TRACK_META[gc.track] ?? gc.track}`}
                  >
                    <p className="text-[11px] font-semibold opacity-80 truncate">{gc.level_label}</p>
                    <p className="text-2xl font-black my-1">{gc.pct}%</p>
                    <p className="text-[10px] opacity-75">
                      {t('curriculumAdmin.heatmap.topicsCovered', { covered: gc.coveredTopics, total: gc.totalTopics })}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-400" /> {t('curriculumAdmin.heatmap.legendGood')} (≥70%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-400" /> {t('curriculumAdmin.heatmap.legendPartial')} (1–69%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-400" /> {t('curriculumAdmin.heatmap.legendNone')} (0%)
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Mapping review queue ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <ListChecks className="w-4 h-4 text-indigo-500" />
                {t('curriculumAdmin.queue.title')}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('curriculumAdmin.queue.subtitle')}</p>
            </div>

            {reviewQueue.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300">
                <Check className="w-4 h-4 shrink-0" /> {t('curriculumAdmin.queue.empty')}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {reviewQueue.slice(0, QUEUE_LIMIT).map(({ entry, kind, confidence }) => (
                    <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{entry.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {kind === 'unmapped' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {t('curriculumAdmin.queue.unmapped')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              {t('curriculumAdmin.queue.lowConfidence', { value: confidence })}
                            </span>
                          )}
                          {entry.curriculum_topic && (
                            <span className="text-[11px] text-slate-400 truncate">{entry.curriculum_topic}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClassify(entry)}
                          disabled={busyTaskId !== null}
                        >
                          {busyTaskId === entry.id
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t('curriculumAdmin.queue.classifying')}</>
                            : <><Wand2 className="w-3.5 h-3.5 mr-1.5" />{t('curriculumAdmin.queue.classify')}</>}
                        </Button>
                        <select
                          className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 max-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          defaultValue=""
                          aria-label={t('curriculumAdmin.queue.manualAssign')}
                          disabled={busyTaskId !== null}
                          onChange={e => handleManualAssign(entry.id, e.target.value)}
                        >
                          <option value="" disabled>{t('curriculumAdmin.queue.selectTopic')}</option>
                          {topicOptionGroups.map(group => (
                            <optgroup key={group.key} label={group.label}>
                              {group.topics.map(tp => (
                                <option key={tp.value} value={tp.value}>{tp.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                {reviewQueue.length > QUEUE_LIMIT && (
                  <p className="text-[11px] text-slate-400 text-center">
                    {t('curriculumAdmin.queue.showingFirst', { count: QUEUE_LIMIT })} · {reviewQueue.length - QUEUE_LIMIT}+
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Topic browser ── */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <Layers className="w-4 h-4 text-indigo-500" />
                {t('curriculumAdmin.browser.title')}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('curriculumAdmin.browser.subtitle')}</p>
            </div>

            {trackStats.map(ts => (
              <div key={ts.track} className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setBrowserTrack(browserTrack === ts.track ? null : ts.track)}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {browserTrack === ts.track ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    {ts.label}
                  </span>
                  <span className="text-xs text-slate-400">{ts.grades} одд/год · {ts.topics} теми</span>
                </button>

                {browserTrack === ts.track && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {ALL_MK_CURRICULUM.filter(g => g.education_track === ts.track).map(g => {
                      const gradeKey = `${ts.track}|${g.grade}`;
                      const gc = snapshot?.gradeCoverage.find(c => c.track === ts.track && c.grade === g.grade);
                      return (
                        <div key={gradeKey}>
                          <button
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            onClick={() => setBrowserGrade(browserGrade === gradeKey ? null : gradeKey)}
                          >
                            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                              {browserGrade === gradeKey ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                              {g.level_label}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-400">
                              {gc && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  gc.pct >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  gc.pct > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {gc.pct}%
                                </span>
                              )}
                              {g.topics.length} теми · {g.hours_per_week}ч/нед
                            </span>
                          </button>

                          {browserGrade === gradeKey && (
                            <div className="px-4 pb-3 space-y-1.5">
                              {g.topics.map(tp => {
                                const taskCount = snapshot?.topicCounts.get(tp.id) ?? 0;
                                return (
                                  <div key={tp.id} className="flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{tp.name}</span>
                                    <span className="flex items-center gap-2 text-slate-400">
                                      <span title="Часови">{tp.hours}{t('curriculumAdmin.browser.hoursShort')}</span>
                                      <span>·</span>
                                      <span>{tp.outcomes.length} {t('curriculumAdmin.browser.outcomes')}</span>
                                      <span>·</span>
                                      <span>{tp.keywords.length} {t('curriculumAdmin.browser.keywords')}</span>
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                        taskCount > 0
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                          : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                      }`}>
                                        {taskCount > 0
                                          ? t('curriculumAdmin.browser.taskCount', { count: taskCount })
                                          : t('curriculumAdmin.browser.noTasks')}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Firestore status (existing ingest card) ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <Database className="w-4 h-4 text-indigo-500" />
                Состојба на Firestore
              </div>
              <button onClick={refreshCount} aria-label={t('ariaRefreshStats')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <p className="text-3xl font-black text-indigo-600">
                  {firestoreCount === null ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : firestoreCount}
                </p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Во Firestore</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <p className="text-3xl font-black text-slate-700 dark:text-slate-200">{staticTotal}</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Static теми</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <p className={`text-3xl font-black ${pct >= 90 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                  {firestoreCount === null ? '—' : `${pct}%`}
                </p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Покриеност</p>
              </div>
            </div>

            {/* Progress bar */}
            {firestoreCount !== null && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            )}

            {firestoreCount === 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Firestore е празен — AI генерацијата користи само static keyword RAG. Изврши ингестија за да ги активираш embedding пребарувањата.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Curriculum coverage breakdown by track (existing richness card) ── */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 mb-1">
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              Покриеност по образовен тип
            </div>

            {trackStats.map(ts => (
              <div key={ts.track}>
                <button
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedTrack(expandedTrack === ts.track ? null : ts.track)}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {expandedTrack === ts.track ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    {ts.label}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{ts.grades} одд/год.</span>
                    <span className="font-semibold text-indigo-600">{ts.topics} теми</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      ts.richPct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      ts.richPct >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {ts.richPct}% — {ts.richPct >= 80 ? 'добро' : ts.richPct >= 40 ? 'делумно' : 'недостасува'}
                    </span>
                  </span>
                </button>
                {expandedTrack === ts.track && (
                  <div className="ml-8 mb-2 space-y-1">
                    {ALL_MK_CURRICULUM.filter(g => g.education_track === ts.track).map(g => (
                      <div key={g.grade} className="flex items-center justify-between text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                        <span className="text-slate-600 dark:text-slate-300">{g.level_label}</span>
                        <span className="text-slate-400">{g.topics.length} теми · {g.hours_per_week}ч/нед</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Сите образовни типови се пополнети со официјални БРО наставни програми (bro.gov.mk). Темите со исходи, клучни зборови и примери задачи се целосно индексирани.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Embedding model info (existing) ── */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Embedding модел
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-slate-400">Модел:</span>
                    <code className="bg-slate-900 text-emerald-400 px-2 py-0.5 rounded">gemini-embedding-2</code>
                    <span className="text-emerald-600 font-semibold text-[10px] bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">GA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-slate-400">Димензии:</span>
                    <span>128–3072 (Matryoshka)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-slate-400">Контекст:</span>
                    <span>8 192 токени</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-slate-400">Мулти-модален:</span>
                    <span>Text · Image · Video · Audio · Documents</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-slate-400">Јазици:</span>
                    <span>100+ (вклучувајќи македонски)</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Конзистентност</div>
                <div className="flex flex-col gap-1 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Check className="w-3 h-3" /> gemini.ts ✓
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Check className="w-3 h-3" /> ingest-script ✓
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Ingest controls (existing) ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500" />
              Изврши ингестија
            </div>

            {/* Embedding toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setUseEmbeddings(p => !p)}
                className={`relative w-10 h-5 rounded-full transition-colors ${useEmbeddings ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useEmbeddings ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Генерирај embeddings (gemini-embedding-2)
                </span>
                <p className="text-xs text-slate-400">
                  {useEmbeddings
                    ? 'Побавно (~2 API повик/тема) · Семантичко пребарување'
                    : 'Брзо · Само keyword пребарување'}
                </p>
              </div>
            </label>

            {/* Ingest progress */}
            {status === 'running' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Внесување...</span>
                  <span>{progress.done}/{progress.total} теми ({progressPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                  <div
                    className="h-2.5 bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center">
                  {useEmbeddings ? 'Генерирање embeddings — може да потрае 2–3 минути...' : 'Внесување без embeddings — брзо...'}
                </p>
              </div>
            )}

            {/* Result */}
            {lastResult && status === 'done' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-sm">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-800 dark:text-emerald-300">
                  <strong>{lastResult.ingested}</strong> теми внесени
                  {lastResult.errors > 0 && <span className="text-amber-600 ml-2">({lastResult.errors} грешки)</span>}
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={runIngest}
                disabled={status === 'running' || isClearing}
              >
                {status === 'running'
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Работи...</>
                  : <><Play className="w-4 h-4 mr-2" /> Ингестирај {staticTotal} теми</>}
              </Button>
              <Button
                variant="outline"
                onClick={runClear}
                disabled={status === 'running' || isClearing || firestoreCount === 0}
                className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong className="text-slate-500">Следен чекор (богата содржина):</strong> Додај <code>serviceAccount.json</code> во <code>scripts/secrets/</code> и изврши:
                <br />
                <code className="block mt-1 bg-slate-900 text-emerald-400 p-2 rounded text-[10px]">
                  npx tsx scripts/ingest-curriculum.mjs --pdf --clear
                </code>
                Ова ги превзема вистинските БРО PDFs и ги вметнува во Firestore со богата педагошка содржина.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
