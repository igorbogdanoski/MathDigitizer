import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, ChevronRight, Settings2, Target, Plus, Trash2,
  Download, Save, Sparkles, ZoomIn, ZoomOut, RotateCcw,
  Loader2, Check, TrendingUp, BarChart2, AlertCircle,
  BookOpen, Activity, Eye, EyeOff, Database, Code2,
  PlusCircle, X, Copy, FileText, Crosshair,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useToast } from '../contexts/ToastContext';
import { db, auth } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { analyzeGraphWithAI, GraphAnalysis } from '../lib/gemini';
import { SEO } from './SEO';
import { useModalA11y } from '../hooks/useModalA11y';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScaleType = 'linear' | 'log';
type Step = 'upload' | 'setup' | 'calibrate' | 'digitize' | 'analyze' | 'export';
type DigitizeMode = 'add' | 'delete';

interface AxisConfig {
  label: string;
  min: number;
  max: number;
  scale: ScaleType;
}

interface CalibPoint {
  pixel: { x: number; y: number };
  real: { x: number; y: number };
}

interface DataPoint {
  id: string;
  px: number;
  py: number;
  rx: number;
  ry: number;
}

interface Dataset {
  name: string;
  color: string;
  points: DataPoint[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATASET_COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

const DOK_LABELS: Record<number, string> = { 1: 'Recall', 2: 'Skill', 3: 'Strategic', 4: 'Extended' };
const DOK_COLORS: Record<number, string> = { 1: 'bg-emerald-100 text-emerald-700', 2: 'bg-blue-100 text-blue-700', 3: 'bg-amber-100 text-amber-700', 4: 'bg-red-100 text-red-700' };
const BLOOM_MK: Record<string, string> = {
  remember: 'Памети', understand: 'Разбери', apply: 'Примени',
  analyze: 'Анализирај', evaluate: 'Оценувај', create: 'Создади',
};

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Слика' },
  { id: 'setup', label: 'Оски' },
  { id: 'calibrate', label: 'Калиб.' },
  { id: 'digitize', label: 'Точки' },
  { id: 'analyze', label: 'AI' },
  { id: 'export', label: 'Извоз' },
];

// ─── Coordinate transform ──────────────────────────────────────────────────────

function pixelToReal(
  px: number, py: number,
  p1: CalibPoint, p2: CalibPoint,
  xScale: ScaleType, yScale: ScaleType,
): { x: number; y: number } {
  const dx = p2.pixel.x - p1.pixel.x;
  const dy = p2.pixel.y - p1.pixel.y;

  let rx: number;
  if (xScale === 'log') {
    const logR1 = Math.log10(p1.real.x);
    const logR2 = Math.log10(p2.real.x);
    rx = Math.pow(10, logR1 + (px - p1.pixel.x) / dx * (logR2 - logR1));
  } else {
    rx = p1.real.x + (px - p1.pixel.x) / dx * (p2.real.x - p1.real.x);
  }

  let ry: number;
  if (yScale === 'log') {
    const logR1 = Math.log10(p1.real.y);
    const logR2 = Math.log10(p2.real.y);
    ry = Math.pow(10, logR1 + (py - p1.pixel.y) / dy * (logR2 - logR1));
  } else {
    ry = p1.real.y + (py - p1.pixel.y) / dy * (p2.real.y - p1.real.y);
  }

  return { x: Math.round(rx * 10000) / 10000, y: Math.round(ry * 10000) / 10000 };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const GraphDigitizer: React.FC = () => {
  const { showToast } = useToast();

  // Upload
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMime, setImageMime] = useState<string>('image/png');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step
  const [step, setStep] = useState<Step>('upload');

  // Axis config
  const [xAxis, setXAxis] = useState<AxisConfig>({ label: 'x', min: 0, max: 10, scale: 'linear' });
  const [yAxis, setYAxis] = useState<AxisConfig>({ label: 'y', min: 0, max: 10, scale: 'linear' });

  // Calibration
  const [calibP1, setCalibP1] = useState<CalibPoint | null>(null);
  const [calibP2, setCalibP2] = useState<CalibPoint | null>(null);
  const [waitingCalib, setWaitingCalib] = useState<1 | 2 | null>(null);
  const [pendingPixel, setPendingPixel] = useState<{ x: number; y: number } | null>(null);
  const [calibDialog, setCalibDialog] = useState(false);
  const calibModalRef = useModalA11y<HTMLDivElement>(() => { setCalibDialog(false); setPendingPixel(null); });
  const [calibInput, setCalibInput] = useState({ x: '', y: '' });

  // Datasets
  const [datasets, setDatasets] = useState<Dataset[]>([
    { name: 'Датасет 1', color: DATASET_COLORS[0], points: [] },
  ]);
  const [activeDs, setActiveDs] = useState(0);
  const [mode, setMode] = useState<DigitizeMode>('add');

  // Canvas / mouse
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ imgX: number; imgY: number; clientX: number; clientY: number } | null>(null);
  const [showLens, setShowLens] = useState(true);
  const [lensZoom] = useState(3);

  // AI
  const [analysis, setAnalysis] = useState<GraphAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Export
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copiedGeo, setCopiedGeo] = useState(false);

  // ── File handling ──────────────────────────────────────────────────────────

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Само слики се поддржани (JPG, PNG, SVG...)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setImageUrl(dataUrl);
      setImageBase64(base64);
      setImageMime(file.type);
      setStep('setup');
      // reset digitize state on new image
      setCalibP1(null);
      setCalibP2(null);
      setDatasets([{ name: 'Датасет 1', color: DATASET_COLORS[0], points: [] }]);
      setAnalysis(null);
      setSavedId(null);
    };
    reader.readAsDataURL(file);
  }, [showToast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  // ── Calibration dialog ─────────────────────────────────────────────────────

  const confirmCalib = () => {
    const rx = parseFloat(calibInput.x);
    const ry = parseFloat(calibInput.y);
    if (isNaN(rx) || isNaN(ry) || !pendingPixel) return;
    const point: CalibPoint = { pixel: pendingPixel, real: { x: rx, y: ry } };
    if (waitingCalib === 1) {
      setCalibP1(point);
      setWaitingCalib(2);
    } else {
      setCalibP2(point);
      setWaitingCalib(null);
    }
    setCalibDialog(false);
    setPendingPixel(null);
    setCalibInput({ x: '', y: '' });
  };

  // ── Canvas interaction ─────────────────────────────────────────────────────

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      imgX: e.clientX - rect.left,
      imgY: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handleMouseLeave = () => setMousePos(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (step === 'calibrate') {
      if (waitingCalib !== null) {
        setPendingPixel({ x: px, y: py });
        setCalibInput({ x: '', y: '' });
        setCalibDialog(true);
      }
      return;
    }

    if (step === 'digitize') {
      if (mode === 'add') {
        if (!calibP1 || !calibP2) { showToast('Прво калибрирајте ги осите', 'error'); return; }
        const real = pixelToReal(px, py, calibP1, calibP2, xAxis.scale, yAxis.scale);
        const newPt: DataPoint = { id: crypto.randomUUID(), px, py, rx: real.x, ry: real.y };
        setDatasets(prev => prev.map((ds, i) =>
          i === activeDs ? { ...ds, points: [...ds.points, newPt] } : ds
        ));
      }
    }
  };

  const deletePoint = (dsIdx: number, ptId: string) => {
    setDatasets(prev => prev.map((ds, i) =>
      i === dsIdx ? { ...ds, points: ds.points.filter(p => p.id !== ptId) } : ds
    ));
  };

  const addDataset = () => {
    const next = datasets.length;
    setDatasets(prev => [...prev, {
      name: `Датасет ${next + 1}`,
      color: DATASET_COLORS[next % DATASET_COLORS.length],
      points: [],
    }]);
    setActiveDs(next);
  };

  // ── AI Analysis ────────────────────────────────────────────────────────────

  const runAnalysis = async () => {
    if (!imageBase64) return;
    setIsAnalyzing(true);
    try {
      const allPoints = datasets.flatMap(ds =>
        ds.points.map(p => ({ datasetName: ds.name, x: p.rx, y: p.ry }))
      );
      const result = await analyzeGraphWithAI(
        imageBase64, imageMime, allPoints,
        { x: xAxis, y: yAxis },
      );
      setAnalysis(result);
      showToast('AI анализата е завршена!', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Грешка при AI анализа', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const rows = [`${xAxis.label},${yAxis.label},Датасет`];
    datasets.forEach(ds => ds.points.forEach(p => rows.push(`${p.rx},${p.ry},${ds.name}`)));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'graph_data.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV извезен', 'success');
  };

  const buildGeoGebraCommands = (): string[] => {
    const cmds: string[] = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let idx = 0;
    datasets.forEach((ds, di) => {
      const ptNames: string[] = [];
      ds.points.forEach(p => {
        const label = di === 0
          ? letters[idx % 26]
          : `${letters[di % 26]}${idx % 26 + 1}`;
        cmds.push(`${label} = (${p.rx}, ${p.ry})`);
        ptNames.push(label);
        idx++;
      });
      if (ptNames.length > 1) {
        cmds.push(`Polyline(${ptNames.join(', ')})`);
      }
    });
    if (analysis?.detected_equation) {
      cmds.push(`f(x) = ${analysis.detected_equation.replace(/\$/g, '')}`);
    }
    return cmds;
  };

  const copyGeoGebra = () => {
    const cmds = buildGeoGebraCommands();
    navigator.clipboard.writeText(cmds.join('\n'));
    setCopiedGeo(true);
    setTimeout(() => setCopiedGeo(false), 2000);
    showToast('GeoGebra команди копирани!', 'success');
  };

  const saveToLibrary = async () => {
    if (!auth.currentUser) { showToast('Најавете се за да зачувате', 'error'); return; }
    setIsSaving(true);
    try {
      const allPoints = datasets.flatMap(ds => ds.points);
      const task = {
        type: 'task',
        title: analysis?.curriculum_topic
          ? `График: ${analysis.curriculum_topic}`
          : `Дигитализиран График (${allPoints.length} точки)`,
        original_text: analysis?.description
          ?? `Дигитализиран график со ${allPoints.length} точки.`,
        solution_steps: (analysis?.generated_questions ?? []).map(q => q.question),
        latex_formulas: analysis?.detected_equation ? [`$${analysis.detected_equation}$`] : [],
        geogebra_commands: buildGeoGebraCommands(),
        tags: ['график', 'координати', 'дигитализација',
          ...(analysis?.curriculum_topic ? [analysis.curriculum_topic.toLowerCase()] : [])],
        difficulty: 'medium',
        source_url: 'Graph Digitizer',
        grade_level: analysis?.grade_level ?? '',
        curriculum_topic: analysis?.curriculum_topic ?? 'Координатен систем',
        dok_level: 2,
        author_uid: auth.currentUser.uid,
        created_at: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, 'tasks'), task);
      setSavedId(ref.id);
      showToast('Зачувано во Библиотека!', 'success');
    } catch {
      showToast('Грешка при зачувување', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const calibrated = !!(calibP1 && calibP2);
  const totalPoints = datasets.reduce((s, d) => s + d.points.length, 0);
  const currentMouseReal = mousePos && calibP1 && calibP2
    ? pixelToReal(mousePos.imgX, mousePos.imgY, calibP1, calibP2, xAxis.scale, yAxis.scale)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <SEO title="Graph Digitizer | MathDigitizer Pro" description="Дигитализирај графици од учебници — извлечи координати и генерирај задачи со AI" />

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              Graph Digitizer
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Прикачи график од учебник → калибрирај оски → прочитај координати → генерирај задачи со AI
            </p>
          </div>
          {imageUrl && (
            <Button variant="outline" size="sm" onClick={() => {
              setImageUrl(null); setStep('upload');
              setCalibP1(null); setCalibP2(null);
              setDatasets([{ name: 'Датасет 1', color: DATASET_COLORS[0], points: [] }]);
              setAnalysis(null); setSavedId(null);
            }}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Нова слика
            </Button>
          )}
        </div>

        {/* Step indicator */}
        {imageUrl && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const stepOrder = STEPS.findIndex(x => x.id === step);
              const thisOrder = i;
              const isDone = thisOrder < stepOrder;
              const isActive = s.id === step;
              return (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => isDone || isActive ? setStep(s.id) : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isDone
                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 cursor-pointer hover:bg-indigo-100'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-default'
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : <span>{i + 1}.</span>}
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ─── Left: Controls ─────────────────────────────────────────── */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">

            {/* STEP: Upload */}
            {step === 'upload' && (
              <Card>
                <CardContent className="p-6">
                  <div
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                  >
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Прикачи график</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, SVG, BMP, WebP</p>
                    <p className="text-xs text-slate-400">или повлечи и пусти</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
                </CardContent>
              </Card>
            )}

            {/* STEP: Setup axes */}
            {step === 'setup' && (
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Settings2 className="w-4 h-4 text-indigo-500" /> Конфигурација на оски
                  </div>
                  {(['x', 'y'] as const).map(ax => {
                    const cfg = ax === 'x' ? xAxis : yAxis;
                    const setCfg = ax === 'x' ? setXAxis : setYAxis;
                    return (
                      <div key={ax} className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{ax === 'x' ? 'X — Хоризонтална' : 'Y — Вертикална'}</p>
                        <input
                          className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                          placeholder="Назив на оска (пр. Време, Цена)"
                          value={cfg.label}
                          onChange={e => setCfg(p => ({ ...p, label: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-500">Мин</label>
                            <input type="number" className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                              value={cfg.min} onChange={e => setCfg(p => ({ ...p, min: parseFloat(e.target.value) || 0 }))} />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Макс</label>
                            <input type="number" className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                              value={cfg.max} onChange={e => setCfg(p => ({ ...p, max: parseFloat(e.target.value) || 10 }))} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {(['linear', 'log'] as ScaleType[]).map(sc => (
                            <button key={sc} onClick={() => setCfg(p => ({ ...p, scale: sc }))}
                              className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${cfg.scale === sc ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                              {sc === 'linear' ? 'Линеарна' : 'Логаритамска'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <Button className="w-full" onClick={() => { setStep('calibrate'); setWaitingCalib(1); }}>
                    Следно: Калибрација <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* STEP: Calibrate */}
            {step === 'calibrate' && (
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Target className="w-4 h-4 text-indigo-500" /> 2-точкова калибрација
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Кликни на 2 точки чии координати ги знаеш (пр. пресечиште на оски, ознаки на мрежа). Тоа ги дефинира вистинските координати за сите останати точки.
                  </p>

                  {[{ label: 'Точка 1', pt: calibP1, slot: 1 as const, color: '#ef4444' },
                    { label: 'Точка 2', pt: calibP2, slot: 2 as const, color: '#3b82f6' }]
                    .map(({ label, pt, slot, color }) => (
                      <div key={slot} className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                        waitingCalib === slot
                          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 animate-pulse'
                          : pt
                            ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                        </div>
                        {pt ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                              ({pt.real.x}, {pt.real.y})
                            </span>
                            <button onClick={() => { slot === 1 ? setCalibP1(null) : setCalibP2(null); setWaitingCalib(slot); }}
                              className="text-slate-400 hover:text-red-500">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {waitingCalib === slot ? 'Кликни на сликата →' : 'Чека...'}
                          </span>
                        )}
                      </div>
                    ))}

                  <Button
                    className="w-full"
                    disabled={!calibrated}
                    onClick={() => { setStep('digitize'); setWaitingCalib(null); }}
                  >
                    {calibrated ? <>Дигитализирај точки <ChevronRight className="w-4 h-4 ml-1" /></> : 'Поставете ги двете точки'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* STEP: Digitize */}
            {step === 'digitize' && (
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <Crosshair className="w-4 h-4 text-indigo-500" /> Дигитализирај
                    </div>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                      {totalPoints} точки
                    </span>
                  </div>

                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    {(['add', 'delete'] as DigitizeMode[]).map(m => (
                      <button key={m} onClick={() => setMode(m)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}>
                        {m === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {m === 'add' ? 'Додај' : 'Бриши'}
                      </button>
                    ))}
                  </div>

                  {/* Datasets */}
                  <div className="space-y-1.5">
                    {datasets.map((ds, i) => (
                      <button key={i} onClick={() => setActiveDs(i)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                          activeDs === i
                            ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}>
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: ds.color }} />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{ds.name}</span>
                        </span>
                        <span className="text-xs text-slate-400">{ds.points.length} т.</span>
                      </button>
                    ))}
                    {datasets.length < 8 && (
                      <button onClick={addDataset}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                        <PlusCircle className="w-3.5 h-3.5" /> Нов датасет
                      </button>
                    )}
                  </div>

                  {/* Points table for active dataset */}
                  {datasets[activeDs]?.points.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-slate-500">#</th>
                            <th className="px-2 py-1.5 text-left text-slate-500">{xAxis.label}</th>
                            <th className="px-2 py-1.5 text-left text-slate-500">{yAxis.label}</th>
                            <th className="px-2 py-1.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {datasets[activeDs].points.map((p, i) => (
                            <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700/50">
                              <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                              <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-200">{p.rx}</td>
                              <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-200">{p.ry}</td>
                              <td className="px-2 py-1">
                                <button onClick={() => deletePoint(activeDs, p.id)}
                                  className="text-slate-300 hover:text-red-500 transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Button className="w-full" disabled={totalPoints === 0}
                    onClick={() => setStep('analyze')}>
                    AI Анализа <Sparkles className="w-4 h-4 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* STEP: Analyze */}
            {step === 'analyze' && (
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Sparkles className="w-4 h-4 text-indigo-500" /> AI Педагошка Анализа
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Gemini ќе го анализира графикот, ќе детектира тип, функција и ќе генерира педагошки прашања на македонски со DoK нивоа.
                  </p>
                  <Button className="w-full" onClick={runAnalysis} disabled={isAnalyzing}>
                    {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Анализира...</> : <><Sparkles className="w-4 h-4 mr-2" /> Анализирај со Gemini</>}
                  </Button>

                  {analysis && (
                    <div className="space-y-3">
                      {/* Graph type badge */}
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {analysis.graph_type}
                        </span>
                        {analysis.grade_level && (
                          <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                            {analysis.grade_level} одд.
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
                        {analysis.description}
                      </p>

                      {/* Detected equation */}
                      {analysis.detected_equation && (
                        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg">
                          <Activity className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="text-xs font-mono text-indigo-700 dark:text-indigo-300">
                            {analysis.detected_equation}
                          </span>
                        </div>
                      )}

                      {/* Curriculum */}
                      {analysis.curriculum_topic && (
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          {analysis.curriculum_topic}
                        </div>
                      )}

                      {/* Questions */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Педагошки прашања</p>
                        {analysis.generated_questions.map((q, i) => (
                          <div key={i} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{q.question}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${DOK_COLORS[q.dok_level] ?? 'bg-slate-100 text-slate-600'}`}>
                                DoK {q.dok_level} · {DOK_LABELS[q.dok_level]}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {BLOOM_MK[q.bloom_level] ?? q.bloom_level}
                              </span>
                            </div>
                            {q.answer_hint && (
                              <p className="text-[10px] text-slate-400 italic">{q.answer_hint}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      <Button className="w-full" onClick={() => setStep('export')}>
                        Извоз <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP: Export */}
            {step === 'export' && (
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Download className="w-4 h-4 text-indigo-500" /> Извоз на податоци
                  </div>

                  <Button variant="outline" className="w-full justify-start" onClick={exportCSV}>
                    <FileText className="w-4 h-4 mr-2 text-emerald-600" /> Извези CSV
                  </Button>

                  <Button variant="outline" className="w-full justify-start" onClick={copyGeoGebra}>
                    {copiedGeo ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Copy className="w-4 h-4 mr-2 text-blue-600" />}
                    {copiedGeo ? 'Копирано!' : 'GeoGebra команди'}
                  </Button>

                  {(analysis?.geogebra_commands?.length ?? 0) > 0 && (
                    <div className="bg-slate-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {[...buildGeoGebraCommands(), ...(analysis?.geogebra_commands ?? [])].filter((c, i, arr) => arr.indexOf(c) === i).map((cmd, i) => (
                        <p key={i} className="text-[11px] font-mono text-emerald-400">{cmd}</p>
                      ))}
                    </div>
                  )}

                  <div className="h-px bg-slate-200 dark:bg-slate-700" />

                  <Button className="w-full" onClick={saveToLibrary} disabled={isSaving || !!savedId}>
                    {isSaving
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Зачувува...</>
                      : savedId
                        ? <><Check className="w-4 h-4 mr-2" /> Зачувано во Библиотека</>
                        : <><Save className="w-4 h-4 mr-2" /> Зачувај во Библиотека</>}
                  </Button>

                  {savedId && (
                    <p className="text-xs text-center text-emerald-600 dark:text-emerald-400">
                      Задачата е достапна во твојата Библиотека.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stats card (shown when digitizing) */}
            {(step === 'digitize' || step === 'analyze' || step === 'export') && totalPoints > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xl font-black text-indigo-600">{totalPoints}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Точки</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-emerald-600">{datasets.length}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Датасети</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-amber-600">
                        {analysis?.generated_questions?.length ?? '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Прашања</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ─── Right: Canvas ───────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {!imageUrl ? (
              <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 gap-3">
                <TrendingUp className="w-12 h-12 opacity-30" />
                <p className="text-sm font-medium">Прикачи слика за да почнеш</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Canvas toolbar */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowLens(p => !p)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${showLens ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      {showLens ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Лупа ×{lensZoom}
                    </button>
                  </div>
                  {currentMouseReal && (
                    <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-900 text-emerald-400 px-3 py-1.5 rounded-lg">
                      <Crosshair className="w-3 h-3" />
                      {xAxis.label}={currentMouseReal.x} &nbsp;
                      {yAxis.label}={currentMouseReal.y}
                    </div>
                  )}
                </div>

                {/* Canvas container */}
                <div
                  ref={containerRef}
                  className={`relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 select-none ${
                    (step === 'calibrate' && waitingCalib !== null) || step === 'digitize'
                      ? 'cursor-crosshair'
                      : 'cursor-default'
                  }`}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={handleCanvasClick}
                >
                  <img
                    src={imageUrl}
                    alt="График за дигитализација"
                    className="w-full h-auto block"
                    draggable={false}
                  />

                  {/* SVG overlay */}
                  <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                    {/* Calibration point 1 */}
                    {calibP1 && (
                      <g>
                        <line x1={calibP1.pixel.x - 14} y1={calibP1.pixel.y} x2={calibP1.pixel.x + 14} y2={calibP1.pixel.y} stroke="#ef4444" strokeWidth={1.5} />
                        <line x1={calibP1.pixel.x} y1={calibP1.pixel.y - 14} x2={calibP1.pixel.x} y2={calibP1.pixel.y + 14} stroke="#ef4444" strokeWidth={1.5} />
                        <rect x={calibP1.pixel.x - 6} y={calibP1.pixel.y - 6} width={12} height={12} fill="none" stroke="#ef4444" strokeWidth={2} />
                        <text x={calibP1.pixel.x + 10} y={calibP1.pixel.y - 8} fill="#ef4444" fontSize="11" fontWeight="bold" className="drop-shadow-sm">
                          P1 ({calibP1.real.x},{calibP1.real.y})
                        </text>
                      </g>
                    )}
                    {/* Calibration point 2 */}
                    {calibP2 && (
                      <g>
                        <line x1={calibP2.pixel.x - 14} y1={calibP2.pixel.y} x2={calibP2.pixel.x + 14} y2={calibP2.pixel.y} stroke="#3b82f6" strokeWidth={1.5} />
                        <line x1={calibP2.pixel.x} y1={calibP2.pixel.y - 14} x2={calibP2.pixel.x} y2={calibP2.pixel.y + 14} stroke="#3b82f6" strokeWidth={1.5} />
                        <rect x={calibP2.pixel.x - 6} y={calibP2.pixel.y - 6} width={12} height={12} fill="none" stroke="#3b82f6" strokeWidth={2} />
                        <text x={calibP2.pixel.x + 10} y={calibP2.pixel.y - 8} fill="#3b82f6" fontSize="11" fontWeight="bold">
                          P2 ({calibP2.real.x},{calibP2.real.y})
                        </text>
                      </g>
                    )}

                    {/* Dataset lines + points */}
                    {datasets.map((ds, di) => (
                      <g key={di}>
                        {ds.points.length > 1 && (
                          <polyline
                            points={ds.points.map(p => `${p.px},${p.py}`).join(' ')}
                            fill="none" stroke={ds.color} strokeWidth={1.5} opacity={0.5} strokeDasharray="5 3"
                          />
                        )}
                        {ds.points.map((p, pi) => (
                          <g key={p.id}>
                            <circle cx={p.px} cy={p.py} r={5} fill={ds.color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                            <text x={p.px + 8} y={p.py - 5} fill={ds.color} fontSize="10" fontWeight="700">{pi + 1}</text>
                          </g>
                        ))}
                      </g>
                    ))}

                    {/* Pending calibration point preview */}
                    {pendingPixel && calibDialog && (
                      <g>
                        <line x1={pendingPixel.x - 18} y1={pendingPixel.y} x2={pendingPixel.x + 18} y2={pendingPixel.y} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
                        <line x1={pendingPixel.x} y1={pendingPixel.y - 18} x2={pendingPixel.x} y2={pendingPixel.y + 18} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
                      </g>
                    )}

                    {/* Key points from AI */}
                    {analysis?.key_points?.map((kp, i) => {
                      if (!calibP1 || !calibP2) return null;
                      // rough reverse transform for display (optional - only if inside range)
                      return null; // skip pixel-space rendering of AI points (they're in real space)
                    })}
                  </svg>
                </div>

                {/* Info bar below canvas */}
                {step === 'digitize' && (
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {mode === 'add'
                      ? 'Кликни на графикот за да додадеш точка.'
                      : 'Кликни на точка за да ја избришеш (или користи × во табелата).'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Lens */}
      {showLens && mousePos && imageUrl && containerRef.current && (
        <div
          className="fixed pointer-events-none z-[200] rounded-full border-2 border-indigo-500 shadow-2xl overflow-hidden"
          style={{ width: 128, height: 128, left: mousePos.clientX + 20, top: mousePos.clientY - 70 }}
        >
          <div className="relative w-full h-full overflow-hidden" style={{ background: '#111' }}>
            <img
              src={imageUrl}
              alt=""
              style={{
                position: 'absolute',
                width: containerRef.current.getBoundingClientRect().width * lensZoom,
                height: 'auto',
                left: -mousePos.imgX * lensZoom + 64,
                top: -mousePos.imgY * lensZoom + 64,
                imageRendering: 'pixelated',
              }}
            />
          </div>
          {/* Crosshair */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500/80" style={{ transform: 'translateX(-50%)' }} />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500/80" style={{ transform: 'translateY(-50%)' }} />
            <div className="absolute inset-0 rounded-full border border-indigo-400/30" />
          </div>
        </div>
      )}

      {/* Calibration dialog */}
      {calibDialog && pendingPixel && (
        <div ref={calibModalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-80 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 dark:text-white">
                Внеси координати за {waitingCalib === 1 ? 'Точка 1' : 'Точка 2'}
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Кликна на позиција (px: {Math.round(pendingPixel.x)}, py: {Math.round(pendingPixel.y)}). Внеси ги вистинските координати кои ги знаеш за оваа точка.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[['x', xAxis.label], ['y', yAxis.label]].map(([axis, label]) => (
                <div key={axis}>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{label} вредност</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-mono"
                    placeholder={`${axis}=?`}
                    value={calibInput[axis as 'x' | 'y']}
                    onChange={e => setCalibInput(p => ({ ...p, [axis]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && confirmCalib()}
                    autoFocus={axis === 'x'}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setCalibDialog(false); setPendingPixel(null); }}>
                Откажи
              </Button>
              <Button className="flex-1" onClick={confirmCalib}
                disabled={!calibInput.x || !calibInput.y || isNaN(parseFloat(calibInput.x)) || isNaN(parseFloat(calibInput.y))}>
                Потврди
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
