import React, { useState, useEffect } from 'react';
import {
  BookOpen, Play, Trash2, RefreshCw, Check, Loader2,
  AlertCircle, BarChart2, ChevronDown, ChevronRight,
  Database, Sparkles, Info, Download,
} from 'lucide-react';
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
import { ALL_MK_CURRICULUM } from '../lib/curriculumData';
import { SEO } from './SEO';

type IngestStatus = 'idle' | 'running' | 'done' | 'error';

interface TrackStats {
  track: string;
  label: string;
  grades: number;
  topics: number;
}

const TRACK_META: Record<string, string> = {
  primary: 'Основно образование (I–IX)',
  secondary_general: 'Општа гимназија (I–IV год.)',
  secondary_math_info: 'Мат-инф гимназија (I–IV год.)',
  secondary_vocational: 'Стручно образование',
};

function buildTrackStats(): TrackStats[] {
  const map: Record<string, { grades: Set<string>; topics: number }> = {};
  for (const g of ALL_MK_CURRICULUM) {
    if (!map[g.education_track]) map[g.education_track] = { grades: new Set(), topics: 0 };
    map[g.education_track].grades.add(g.grade);
    map[g.education_track].topics += g.topics.length;
  }
  return Object.entries(map).map(([track, d]) => ({
    track,
    label: TRACK_META[track] ?? track,
    grades: d.grades.size,
    topics: d.topics,
  }));
}

export const CurriculumAdmin: React.FC = () => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [firestoreCount, setFirestoreCount] = useState<number | null>(null);
  const [staticTotal] = useState(getTotalStaticChunkCount());
  const [trackStats] = useState(buildTrackStats());

  const [status, setStatus] = useState<IngestStatus>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [useEmbeddings, setUseEmbeddings] = useState(true);
  const [lastResult, setLastResult] = useState<{ ingested: number; errors: number } | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  useEffect(() => {
    getCurriculumChunkCount().then(setFirestoreCount);
  }, []);

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

  const pct = firestoreCount != null && staticTotal > 0
    ? Math.round((firestoreCount / staticTotal) * 100)
    : 0;

  const progressPct = progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

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

      <div className="max-w-3xl mx-auto space-y-6">

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

        {/* Status card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <Database className="w-4 h-4 text-indigo-500" />
                Состојба на Firestore
              </div>
              <button onClick={refreshCount} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
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

        {/* Curriculum coverage breakdown */}
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
                      ts.track === 'secondary_vocational' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      ts.track === 'secondary_math_info' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {ts.track === 'secondary_vocational' ? '0% — недостасува' :
                       ts.track === 'secondary_math_info' ? '~21% — делумно' :
                       ts.track === 'primary' ? '~52% — добро' : '~67% — добро'}
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

            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Стручното образование и делови на мат-инф недостасуваат. Изврши <strong>--pdf</strong> режимот на скриптата (кога ќе имаш serviceAccount.json) за пополнување од вистинските БРО PDFs.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Embedding model info */}
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

        {/* Ingest controls */}
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
