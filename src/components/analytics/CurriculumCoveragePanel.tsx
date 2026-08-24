import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, BookOpen, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
// Only ids, names and counts are read here — the light index keeps the
// 571 KB corpus of outcome prose out of the analytics bundle.
import { CURRICULUM_INDEX } from '../../lib/curriculumIndex';
import {
  fetchCoverageTasks,
  buildCoverageSnapshot,
  getZeroTaskTopics,
  type CoverageSnapshot,
} from '../../lib/curriculumCoverage';

const TOP_TOPIC_LIMIT = 12;
const GAP_PREVIEW_LIMIT = 8;

const heatColor = (pct: number) =>
  pct >= 70
    ? 'bg-emerald-500'
    : pct > 0
      ? 'bg-amber-500'
      : 'bg-red-500';

/**
 * Curriculum coverage panel for the AnalyticsDashboard: tasks per curriculum
 * topic, topics with zero tasks (gaps) and coverage percentage per grade.
 */
export const CurriculumCoveragePanel: React.FC = () => {
  const { t } = useTranslation('analytics');
  const [snapshot, setSnapshot] = useState<CoverageSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAllGaps, setShowAllGaps] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tasks = await fetchCoverageTasks();
        if (!cancelled) setSnapshot(buildCoverageSnapshot(tasks));
      } catch (e) {
        console.error('Error loading curriculum coverage:', e);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Top topics by task count (bar list)
  const topTopics = useMemo(() => {
    if (!snapshot) return [];
    const rows: { topic_id: string; name: string; level_label: string; count: number }[] = [];
    for (const grade of CURRICULUM_INDEX) {
      for (const topic of grade.topics) {
        const count = snapshot.topicCounts.get(topic.id) ?? 0;
        if (count > 0) {
          rows.push({ topic_id: topic.id, name: topic.name, level_label: grade.level_label, count });
        }
      }
    }
    return rows.sort((a, b) => b.count - a.count).slice(0, TOP_TOPIC_LIMIT);
  }, [snapshot]);

  const gaps = useMemo(() => (snapshot ? getZeroTaskTopics(snapshot) : []), [snapshot]);

  const maxCount = topTopics.length > 0 ? topTopics[0].count : 1;
  const totalTopicCount = useMemo(
    () => CURRICULUM_INDEX.reduce((sum, g) => sum + g.topics.length, 0),
    [],
  );
  const coveredTopicCount = snapshot ? totalTopicCount - gaps.length : 0;
  const overallPct = totalTopicCount > 0 && snapshot
    ? Math.round((coveredTopicCount / totalTopicCount) * 100)
    : 0;

  return (
    <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl xl:col-span-3">
      <CardContent className="p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 uppercase tracking-widest text-sm">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            {t('curriculumCoverage.title')}
          </h3>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10">
            {t('curriculumCoverage.description')}
          </span>
        </div>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('curriculumCoverage.loading')}
          </div>
        ) : loadError || !snapshot ? (
          <div className="h-24 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            {t('curriculumCoverage.loadError')}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary chips */}
            <div className="grid grid-cols-3 gap-4 max-w-xl">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
                <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">{totalTopicCount}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 font-bold">
                  {t('curriculumCoverage.summary.totalTopics')}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
                <div className="text-2xl font-black text-emerald-500 font-mono">{coveredTopicCount}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 font-bold">
                  {t('curriculumCoverage.summary.coveredTopics')}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
                <div className={`text-2xl font-black font-mono ${overallPct >= 70 ? 'text-emerald-500' : overallPct > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                  {overallPct}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 font-bold">
                  {t('curriculumCoverage.summary.coveragePct')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tasks per topic — bar list */}
              <div>
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  {t('curriculumCoverage.tasksPerTopic')}
                </h4>
                <div className="space-y-2.5">
                  {topTopics.map(row => (
                    <div key={row.topic_id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate mr-2">
                          {row.name}
                          <span className="text-slate-400 font-normal ml-1.5">({row.level_label})</span>
                        </span>
                        <span className="font-black text-slate-600 dark:text-slate-300 font-mono shrink-0">{row.count}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${Math.max(4, Math.round((row.count / maxCount) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {topTopics.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">—</p>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {/* Coverage per grade */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
                    {t('curriculumCoverage.byGrade.title')}
                  </h4>
                  <div className="space-y-2">
                    {snapshot.gradeCoverage.map(gc => (
                      <div key={`${gc.track}|${gc.grade}`} className="flex items-center gap-3 text-xs">
                        <span className="w-28 shrink-0 font-semibold text-slate-600 dark:text-slate-300 truncate">
                          {gc.level_label}
                        </span>
                        <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${heatColor(gc.pct)}`}
                            style={{ width: `${Math.max(gc.pct > 0 ? 4 : 0, gc.pct)}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-slate-400 font-mono">
                          {t('curriculumCoverage.byGrade.topicsCovered', { covered: gc.coveredTopics, total: gc.totalTopics })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gaps: topics with zero tasks */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
                    {t('curriculumCoverage.gaps.title')}
                    <span className="ml-2 text-red-500 font-mono">{gaps.length}</span>
                  </h4>
                  {gaps.length === 0 ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {t('curriculumCoverage.gaps.none')}
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {(showAllGaps ? gaps : gaps.slice(0, GAP_PREVIEW_LIMIT)).map(gap => (
                          <span
                            key={gap.topic_id}
                            title={`${gap.level_label} · ${gap.track}`}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300"
                          >
                            {gap.name} <span className="opacity-60">({gap.level_label})</span>
                          </span>
                        ))}
                      </div>
                      {gaps.length > GAP_PREVIEW_LIMIT && (
                        <button
                          onClick={() => setShowAllGaps(v => !v)}
                          className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {showAllGaps
                            ? t('curriculumCoverage.gaps.showLess')
                            : t('curriculumCoverage.gaps.showAll', { count: gaps.length })}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
