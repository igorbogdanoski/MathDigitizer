import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, Loader2, Sparkles, Layers } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateCurriculumTasks } from '../lib/gemini';
import { useToast } from '../contexts/ToastContext';
import { ALL_MK_CURRICULUM, type EducationTrack } from '../lib/curriculumData';

const TRACK_LABEL_KEYS: Record<EducationTrack, string> = {
  primary: 'curriculumTestGen.trackPrimary',
  secondary_general: 'curriculumTestGen.trackSecondaryGeneral',
  secondary_math_info: 'curriculumTestGen.trackSecondaryMathInfo',
  secondary_vocational: 'curriculumTestGen.trackSecondaryVocational',
};

export const CurriculumTestGenerator: React.FC = () => {
  const { t } = useTranslation('common');
  const { showToast } = useToast();

  const [selectedTrack, setSelectedTrack] = useState<EducationTrack>('primary');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const tracks = useMemo(
    () => Array.from(new Set(ALL_MK_CURRICULUM.map(g => g.education_track))),
    [],
  );

  const gradesForTrack = useMemo(
    () => ALL_MK_CURRICULUM.filter(g => g.education_track === selectedTrack),
    [selectedTrack],
  );

  const activeGradeObj = gradesForTrack.find(g => g.grade === selectedGrade);
  const activeTopic = activeGradeObj?.topics.find(tp => tp.id === selectedTopicId);

  const handleGenerate = async () => {
    if (!activeTopic || !activeGradeObj || !auth.currentUser) return;
    setIsGenerating(true);

    try {
      const outcomeLines = activeTopic.outcomes
        .map(o => `- [${o.code}] ${o.text}`)
        .join('\n');
      const exampleLines = activeTopic.example_tasks.map(e => `- ${e}`).join('\n');

      const prompt = `Генерирај 3 математички задачи строго усогласени со официјалната македонска наставна програма (БРО — bro.gov.mk).

НИВО: ${activeGradeObj.level_label} (${TRACK_LABEL_KEYS[selectedTrack] ? t(TRACK_LABEL_KEYS[selectedTrack]) : selectedTrack})
ТЕМА: ${activeTopic.name}

НАСТАВНИ ИСХОДИ — задачите МОРА да ги покриваат овие исходи:
${outcomeLines}

КЛУЧНИ ЗБОРОВИ НА ТЕМАТА: ${activeTopic.keywords.join(', ')}

ПРИМЕРИ АКТИВНОСТИ ОД ПРОГРАМАТА (користи ги како инспирација за контекст):
${exampleLines}

Барања:
- Задачите мора да бидат соодветни на возраста и нивото (${activeGradeObj.level_label}).
- За секоја задача обезбеди математички точно чекор-по-чекор решение.
- Користи македонски јазик и LaTeX за сите математички изрази ($...$ / $$...$$).`;

      const tasks = await generateCurriculumTasks(prompt, { strategy: 'tot' });

      let count = 0;
      for (const task of tasks) {
        if (!auth.currentUser) break;
        await addDoc(collection(db, 'tasks'), {
          ...task,
          author_uid: auth.currentUser.uid,
          created_at: serverTimestamp(),
          curriculum_topic: activeTopic.name,
          curriculum_grade: activeGradeObj.grade,
          grade_level: task.grade_level || activeGradeObj.grade,
          curriculum_refs: [
            {
              education_track: selectedTrack,
              grade: activeGradeObj.grade,
              topic_id: activeTopic.id,
              topic_name: activeTopic.name,
              outcome_codes: activeTopic.outcomes.map(o => o.code),
              confidence: 1,
              source: 'manual',
            },
          ],
        });
        count++;
      }

      showToast(t('curriculumTestGen.savedToast', { count }), 'success');
    } catch (e) {
      console.error(e);
      showToast(t('curriculumTestGen.errorToast'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/15 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('curriculumTestGen.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t('curriculumTestGen.subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">

          {/* Track Select */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              {t('curriculumTestGen.trackLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {tracks.map(track => (
                <Button
                  key={track}
                  onClick={() => { setSelectedTrack(track); setSelectedGrade(''); setSelectedTopicId(''); }}
                  variant={selectedTrack === track ? 'default' : 'outline'}
                  className={selectedTrack === track ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}
                >
                  {t(TRACK_LABEL_KEYS[track])}
                  {selectedTrack === track && <Check className="w-4 h-4 ml-2" />}
                </Button>
              ))}
            </div>
          </div>

          {/* Grade Select */}
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              {t('curriculumTestGen.gradeLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {gradesForTrack.map(g => (
                <Button
                  key={`${g.education_track}|${g.grade}`}
                  onClick={() => { setSelectedGrade(g.grade); setSelectedTopicId(''); }}
                  variant={selectedGrade === g.grade ? 'default' : 'outline'}
                  title={g.level_label}
                  className={selectedGrade === g.grade ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}
                >
                  {g.level_label}
                </Button>
              ))}
            </div>
          </div>

          {/* Topic Select */}
          {activeGradeObj && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                {t('curriculumTestGen.topicLabel')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeGradeObj.topics.map(tp => (
                  <div
                    key={tp.id}
                    onClick={() => setSelectedTopicId(tp.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedTopicId === tp.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10'
                        : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedTopicId === tp.id ? 'border-indigo-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {selectedTopicId === tp.id && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${selectedTopicId === tp.id ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}>
                          {tp.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {t('curriculumTestGen.outcomesCount', { count: tp.outcomes.length })}
                          {' · '}
                          {t('curriculumTestGen.keywordsCount', { count: tp.keywords.length })}
                          {' · '}
                          {t('curriculumTestGen.hoursShort', { hours: tp.hours })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          {activeTopic && activeGradeObj && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md h-12 text-lg"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                {isGenerating ? t('curriculumTestGen.generating') : t('curriculumTestGen.generate')}
              </Button>
              <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 mt-3 flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {t('curriculumTestGen.injectionNote')}
              </p>
              <p className="text-center text-xs text-slate-400 mt-2">
                {t('curriculumTestGen.footerNote')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
