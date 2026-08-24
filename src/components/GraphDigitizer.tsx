import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Check, TrendingUp, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useToast } from '../contexts/ToastContext';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import { analyzeGraphWithAI, classifyTaskCurriculum, GraphAnalysis } from '../lib/gemini';
import type { MathTask } from '../lib/schema';
import { applyAffine, fitAffineCalibration } from '../lib/graph/calibration';
import { SEO } from './SEO';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  type Step,
  type AxisConfig,
  type CalibPoint,
  type DataPoint,
  type Dataset,
  type DigitizeMode,
  type MousePos,
  DATASET_COLORS,
  STEPS,
  pixelToReal,
} from './graph-digitizer/types';
import { StepUpload } from './graph-digitizer/StepUpload';
import { StepAxisSetup } from './graph-digitizer/StepAxisSetup';
import { StepCalibrate } from './graph-digitizer/StepCalibrate';
import { StepDigitize } from './graph-digitizer/StepDigitize';
import { StepAnalyze } from './graph-digitizer/StepAnalyze';
import { StepExport } from './graph-digitizer/StepExport';
import { GraphCanvas } from './graph-digitizer/GraphCanvas';
import { CalibrationDialog } from './graph-digitizer/CalibrationDialog';

// ─── Main Component ───────────────────────────────────────────────────────────

export const GraphDigitizer: React.FC = () => {
  const { t } = useTranslation('graphDigitizer');
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
  /**
   * Optional third reference (Phase 8.2). Two points fix the mapping exactly,
   * so an imprecise click becomes systematic error over the whole graph and is
   * invisible. With three, a least-squares fit averages them and the residual
   * reveals a misplaced reference.
   */
  const [calibP3, setCalibP3] = useState<CalibPoint | null>(null);
  const [waitingCalib, setWaitingCalib] = useState<1 | 2 | 3 | null>(null);
  const [pendingPixel, setPendingPixel] = useState<{ x: number; y: number } | null>(null);
  const [calibDialog, setCalibDialog] = useState(false);
  const calibModalRef = useModalA11y<HTMLDivElement>(() => { setCalibDialog(false); setPendingPixel(null); }, calibDialog);
  const [calibInput, setCalibInput] = useState({ x: '', y: '' });

  // Datasets
  const [datasets, setDatasets] = useState<Dataset[]>([
    { name: t('dataset.default', { num: 1 }), color: DATASET_COLORS[0], points: [] },
  ]);
  const [activeDs, setActiveDs] = useState(0);
  const [mode, setMode] = useState<DigitizeMode>('add');

  // Canvas / mouse
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<MousePos | null>(null);
  const [showLens, setShowLens] = useState(true);
  const [lensZoom] = useState(3);

  // AI
  const [analysis, setAnalysis] = useState<GraphAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Export
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copiedGeo, setCopiedGeo] = useState(false);
  const [autoSave, setAutoSave] = useState(false);

  // ── File handling ──────────────────────────────────────────────────────────

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast(t('toasts.onlyImages'), 'error');
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
      setDatasets([{ name: t('dataset.default', { num: 1 }), color: DATASET_COLORS[0], points: [] }]);
      setAnalysis(null);
      setSavedId(null);
    };
    reader.readAsDataURL(file);
  }, [showToast, t]);

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
    } else if (waitingCalib === 2) {
      setCalibP2(point);
      setWaitingCalib(null);
    } else {
      setCalibP3(point);
      setWaitingCalib(null);
    }
    setCalibDialog(false);
    setPendingPixel(null);
    setCalibInput({ x: '', y: '' });
  };

  const clearCalibPoint = (slot: 1 | 2 | 3) => {
    if (slot === 1) setCalibP1(null);
    else if (slot === 2) setCalibP2(null);
    else setCalibP3(null);
  };

  /**
   * Least-squares calibration when a third reference exists and both axes are
   * linear. A log axis is not affine in pixel space, so it keeps the two-point
   * mapping.
   */
  const affineCalibration = useMemo(() => {
    if (!calibP1 || !calibP2 || !calibP3) return null;
    if (xAxis.scale !== 'linear' || yAxis.scale !== 'linear') return null;
    return fitAffineCalibration([calibP1, calibP2, calibP3]);
  }, [calibP1, calibP2, calibP3, xAxis.scale, yAxis.scale]);

  /** Pixel → real, through whichever calibration is available. */
  const mapPixel = useCallback((px: number, py: number) => {
    if (affineCalibration) {
      const real = applyAffine(affineCalibration, px, py);
      return { x: Math.round(real.x * 10000) / 10000, y: Math.round(real.y * 10000) / 10000 };
    }
    if (!calibP1 || !calibP2) return null;
    return pixelToReal(px, py, calibP1, calibP2, xAxis.scale, yAxis.scale);
  }, [affineCalibration, calibP1, calibP2, xAxis.scale, yAxis.scale]);

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
        if (!calibP1 || !calibP2) { showToast(t('toasts.calibrateFirst'), 'error'); return; }
        const real = mapPixel(px, py);
        // A degenerate calibration silently produced NaN coordinates before.
        if (!real) { showToast(t('toasts.badCalibration'), 'error'); return; }
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
      name: t('dataset.default', { num: next + 1 }),
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
      showToast(t('toasts.aiComplete'), 'success');

      // Auto-save to Library if enabled
      if (autoSave && auth.currentUser) {
        await saveToLibrary();
      }
    } catch (err: any) {
      showToast(err?.message ?? t('toasts.aiError'), 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const rows = [`${xAxis.label},${yAxis.label},${t('stats.datasets')}`];
    datasets.forEach(ds => ds.points.forEach(p => rows.push(`${p.rx},${p.ry},${ds.name}`)));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'graph_data.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast(t('toasts.csvExported'), 'success');
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
    showToast(t('toasts.geogebraCopied'), 'success');
  };

  const saveToLibrary = async () => {
    if (!auth.currentUser) { showToast(t('toasts.loginToSave'), 'error'); return; }
    setIsSaving(true);
    try {
      const allPoints = datasets.flatMap(ds => ds.points);
      const task = {
        type: 'task',
        title: analysis?.curriculum_topic
          ? `${t('library.graphPrefix')} ${analysis.curriculum_topic}`
          : t('library.digitizedGraph', { count: allPoints.length }),
        original_text: analysis?.description
          ?? t('library.digitizedDesc', { count: allPoints.length }),
        solution_steps: (analysis?.generated_questions ?? []).map(q => q.question),
        latex_formulas: analysis?.detected_equation ? [`$${analysis.detected_equation}$`] : [],
        geogebra_commands: buildGeoGebraCommands(),
        tags: [t('library.tags.graph'), t('library.tags.coordinates'), t('library.tags.digitization'),
          ...(analysis?.curriculum_topic ? [analysis.curriculum_topic.toLowerCase()] : [])],
        difficulty: 'medium',
        source_url: 'Graph Digitizer',
        grade_level: analysis?.grade_level ?? '',
        curriculum_topic: analysis?.curriculum_topic ?? t('library.coordSystem'),
        dok_level: 2,
        author_uid: auth.currentUser.uid,
        created_at: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, 'tasks'), task);
      setSavedId(ref.id);
      showToast(t('toasts.savedToLibrary'), 'success');

      // Curriculum classification (Phase 8.5) — graph tasks were the only kind
      // saved without curriculum_refs, so they never appeared in the mastery
      // rollup. Non-blocking: it must never fail the save.
      classifyTaskCurriculum(task as unknown as MathTask)
        .then(async refs => { if (refs.length > 0) await updateDoc(ref, { curriculum_refs: refs }); })
        .catch(err => console.warn('Curriculum classification failed for graph task:', err));
    } catch {
      showToast(t('toasts.errorSaving'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const totalPoints = datasets.reduce((s, d) => s + d.points.length, 0);
  /** Every digitized point in real coordinates — the evidence a fit is built on. */
  const allRealPoints = useMemo(
    () => datasets.flatMap(ds => ds.points.map(p => ({ x: p.rx, y: p.ry }))),
    [datasets]
  );
  const currentMouseReal = mousePos && calibP1 && calibP2
    ? mapPixel(mousePos.imgX, mousePos.imgY)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <SEO title="Graph Digitizer | MathDigitizer Pro" description={t('seo.description')} />

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              {t('title')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('subtitle')}
            </p>
          </div>
          {imageUrl && (
            <Button variant="outline" size="sm" onClick={() => {
              setImageUrl(null); setStep('upload');
              setCalibP1(null); setCalibP2(null);
              setDatasets([{ name: t('dataset.default', { num: 1 }), color: DATASET_COLORS[0], points: [] }]);
              setAnalysis(null); setSavedId(null);
            }}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> {t('newImage')}
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
                    {t(`steps.${s.id}`)}
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
              <StepUpload
                fileInputRef={fileInputRef}
                onLoadFile={loadFile}
                onDrop={handleDrop}
              />
            )}

            {/* STEP: Setup axes */}
            {step === 'setup' && (
              <StepAxisSetup
                xAxis={xAxis}
                yAxis={yAxis}
                setXAxis={setXAxis}
                setYAxis={setYAxis}
                onNext={() => { setStep('calibrate'); setWaitingCalib(1); }}
              />
            )}

            {/* STEP: Calibrate */}
            {step === 'calibrate' && (
              <StepCalibrate
                calibP1={calibP1}
                calibP2={calibP2}
                calibP3={calibP3}
                affineResidual={affineCalibration?.maxResidual ?? null}
                waitingCalib={waitingCalib}
                onSetWaitingCalib={setWaitingCalib}
                onClearPoint={clearCalibPoint}
                onNext={() => { setStep('digitize'); setWaitingCalib(null); }}
              />
            )}

            {/* STEP: Digitize */}
            {step === 'digitize' && (
              <StepDigitize
                datasets={datasets}
                activeDs={activeDs}
                mode={mode}
                setMode={setMode}
                setActiveDs={setActiveDs}
                onAddDataset={addDataset}
                onDeletePoint={deletePoint}
                totalPoints={totalPoints}
                xAxis={xAxis}
                yAxis={yAxis}
                onNext={() => setStep('analyze')}
              />
            )}

            {/* STEP: Analyze */}
            {step === 'analyze' && (
              <StepAnalyze
                analysis={analysis}
                points={allRealPoints}
                onUseFit={(latex) => setAnalysis(prev => prev ? { ...prev, detected_equation: latex } : prev)}
                isAnalyzing={isAnalyzing}
                onRunAnalysis={runAnalysis}
                onNext={() => setStep('export')}
              />
            )}

            {/* STEP: Export */}
            {step === 'export' && (
              <StepExport
                analysis={analysis}
                replotSeries={datasets.map(ds => ({
                  points: ds.points.map(p => ({ x: p.rx, y: p.ry })),
                  color: ds.color,
                  name: ds.name,
                }))}
                onExportCSV={exportCSV}
                onCopyGeoGebra={copyGeoGebra}
                onSaveToLibrary={saveToLibrary}
                copiedGeo={copiedGeo}
                isSaving={isSaving}
                savedId={savedId}
                buildGeoGebraCommands={buildGeoGebraCommands}
                autoSave={autoSave}
                setAutoSave={setAutoSave}
              />
            )}

            {/* Stats card (shown when digitizing) */}
            {(step === 'digitize' || step === 'analyze' || step === 'export') && totalPoints > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xl font-black text-indigo-600">{totalPoints}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('stats.points')}</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-emerald-600">{datasets.length}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('stats.datasets')}</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-amber-600">
                        {analysis?.generated_questions?.length ?? '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('stats.questions')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ─── Right: Canvas ───────────────────────────────────────────── */}
          <GraphCanvas
            imageUrl={imageUrl}
            step={step}
            datasets={datasets}
            activeDs={activeDs}
            mode={mode}
            calibP1={calibP1}
            calibP2={calibP2}
            waitingCalib={waitingCalib}
            pendingPixel={pendingPixel}
            calibDialog={calibDialog}
            analysis={analysis}
            mousePos={mousePos}
            showLens={showLens}
            lensZoom={lensZoom}
            containerRef={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onCanvasClick={handleCanvasClick}
            onToggleLens={() => setShowLens(p => !p)}
            currentMouseReal={currentMouseReal}
            xAxis={xAxis}
            yAxis={yAxis}
          />
        </div>
      </div>

      {/* Calibration dialog */}
      <CalibrationDialog
        calibDialog={calibDialog}
        pendingPixel={pendingPixel}
        waitingCalib={waitingCalib}
        calibInput={calibInput}
        setCalibInput={setCalibInput}
        onConfirm={confirmCalib}
        onClose={() => { setCalibDialog(false); setPendingPixel(null); }}
        calibModalRef={calibModalRef}
        xAxis={xAxis}
        yAxis={yAxis}
      />
    </>
  );
};
