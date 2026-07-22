import React, { useState, useRef, useCallback } from 'react';
import { ChevronRight, Check, TrendingUp, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useToast } from '../contexts/ToastContext';
import { db, auth } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { analyzeGraphWithAI, GraphAnalysis } from '../lib/gemini';
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
  StepUpload,
  StepAxisSetup,
  StepCalibrate,
  StepDigitize,
  StepAnalyze,
  StepExport,
  GraphCanvas,
  CalibrationDialog,
} from './graph-digitizer';

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
  const calibModalRef = useModalA11y<HTMLDivElement>(() => { setCalibDialog(false); setPendingPixel(null); }, calibDialog);
  const [calibInput, setCalibInput] = useState({ x: '', y: '' });

  // Datasets
  const [datasets, setDatasets] = useState<Dataset[]>([
    { name: 'Датасет 1', color: DATASET_COLORS[0], points: [] },
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

  const clearCalibPoint = (slot: 1 | 2) => {
    slot === 1 ? setCalibP1(null) : setCalibP2(null);
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

      // Auto-save to Library if enabled
      if (autoSave && auth.currentUser) {
        await saveToLibrary();
      }
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
                isAnalyzing={isAnalyzing}
                onRunAnalysis={runAnalysis}
                onNext={() => setStep('export')}
              />
            )}

            {/* STEP: Export */}
            {step === 'export' && (
              <StepExport
                analysis={analysis}
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
