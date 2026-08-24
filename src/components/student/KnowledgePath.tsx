import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Lock, BookOpen } from 'lucide-react';
import { TaskAttempt } from '../../lib/schema';
// Matches on topic ids and names only; see curriculumIndex.
import { CURRICULUM_INDEX, type CurriculumTopicIndex } from '../../lib/curriculumIndex';

interface KnowledgePathProps {
  completedAttempts: TaskAttempt[];
  userXP: number;
}

export const KnowledgePath: React.FC<KnowledgePathProps> = ({ completedAttempts, userXP }) => {
  const { t } = useTranslation('studentDashboard');
  // Build set of mastered topic names/ids from completed attempts
  const masteredKeys = useMemo(() => {
    const keys = new Set<string>();
    completedAttempts.forEach(a => {
      if (a.curriculum_topic) {
        keys.add(a.curriculum_topic.toLowerCase().trim());
      }
    });
    return keys;
  }, [completedAttempts]);

  // Show primary grades 5-9, max 24 topics
  const displayTopics = useMemo(() => {
    const grades = CURRICULUM_INDEX.filter(
      g => g.education_track === 'primary' && ['5', '6', '7', '8', '9'].includes(g.grade)
    );
    return grades.flatMap(g => g.topics).slice(0, 24);
  }, []);

  const isMastered = (topic: CurriculumTopicIndex) =>
    masteredKeys.has(topic.id.toLowerCase()) ||
    masteredKeys.has(topic.name.toLowerCase()) ||
    masteredKeys.has(topic.name_short.toLowerCase());

  const masteredCount = displayTopics.filter(isMastered).length;
  const pct = displayTopics.length > 0 ? Math.round((masteredCount / displayTopics.length) * 100) : 0;

  // Simple unlock logic: first topic is always unlocked, rest require previous or XP
  const isUnlocked = (topic: CurriculumTopicIndex, idx: number) =>
    isMastered(topic) || idx === 0 || masteredCount >= idx || userXP >= idx * 50;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-indigo-900">{t('knowledgePath.title')}</h3>
            <p className="text-sm text-indigo-600">{t('knowledgePath.mastered', { count: masteredCount, total: displayTopics.length })}</p>
          </div>
          <span className="text-3xl font-black text-indigo-300">{pct}%</span>
        </div>
        <div className="w-full h-2.5 bg-indigo-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />{t('knowledgePath.legendMastered')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-400 inline-block" />{t('knowledgePath.legendUnlocked')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-300 inline-block" />{t('knowledgePath.legendLocked')}</span>
      </div>

      {/* Topic grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayTopics.map((topic, idx) => {
          const mastered = isMastered(topic);
          const unlocked = isUnlocked(topic, idx);
          return (
            <div
              key={topic.id}
              className={`rounded-xl p-3 border flex flex-col gap-1.5 transition-all ${
                mastered
                  ? 'bg-emerald-50 border-emerald-200'
                  : unlocked
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                {mastered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : unlocked ? (
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-xs text-slate-400">{topic.hours}ч</span>
              </div>
              <p className={`text-xs font-semibold leading-tight ${
                mastered ? 'text-emerald-800' : unlocked ? 'text-indigo-800' : 'text-slate-500'
              }`}>
                {topic.name_short}
              </p>
            </div>
          );
        })}
      </div>

      {completedAttempts.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-4">
          {t('knowledgePath.hint')}
        </p>
      )}
    </div>
  );
};
