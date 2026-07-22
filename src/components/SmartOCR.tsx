import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image as ImageIcon, Copy, Check, Loader2,
  FileText, Code, Save, ScanLine, PenTool
} from 'lucide-react';
import { Button } from './ui/Button';
import { extractMathTasksFromImage, extractMathTasksFromPdf, enrichTaskPedagogy } from '../lib/gemini';
import { MathTask } from '../lib/schema';
import { useToast } from '../contexts/ToastContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Crop as CropType, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { GeoGebraViewer } from './GeoGebraViewer';
const MathEditor = lazy(() => import('./MathEditor').then((m) => ({ default: m.MathEditor })));

import { SEO } from './SEO';
import { OCRSettingsBar } from './smart-ocr/OCRSettingsBar';
import { ImageCropPanel } from './smart-ocr/ImageCropPanel';
import { LatexQuickInsertPalette } from './smart-ocr/LatexQuickInsertPalette';
import { BatchResultsList } from './smart-ocr/BatchResultsList';
import { OCRResultPreview } from './smart-ocr/OCRResultPreview';

export const SmartOCR: React.FC = () => {
  const { t } = useTranslation('smartOcr');

  const [activeTab, setActiveTab] = useState<'upload' | 'draw'>('upload');

  // Upload State
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Global State
  const [isScanning, setIsScanning] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [extractedTask, setExtractedTask] = useState<Partial<MathTask> | null>(null);
  const [activeGeogebraCmds, setActiveGeogebraCmds] = useState<string[] | null>(null);
  const [latexCode, setLatexCode] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('code');

  // Batch State
  const [batchTasks, setBatchTasks] = useState<MathTask[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchCopied, setBatchCopied] = useState<number | null>(null);

  // Advanced OCR Settings
  const [targetLanguage, setTargetLanguage] = useState<'auto' | 'mk' | 'en' | 'ru' | 'tr'>('mk');
  const [enableLogicalReconstruction, setEnableLogicalReconstruction] = useState(true);
  const [ocrModel, setOcrModel] = useState<string>('gemini-3.1-pro-preview');
  const [visualizationMode, setVisualizationMode] = useState<'none' | 'tikz' | 'geogebra' | 'nanobanana'>('geogebra');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Draw Mode Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  const [activeGroup, setActiveGroup] = useState<string>('Основни');

  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current && !ctx) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = document.documentElement.classList.contains('dark') ? 'white' : 'black';
        context.lineWidth = 3;
        setCtx(context);
      }
    }
  }, [activeTab]);

  // Handle paste events — Ctrl+V image from clipboard (screenshot, copy from browser, etc.)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith('image/') || it.type === 'application/pdf') {
          const file = it.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) processFiles(imageFiles);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [targetLanguage, enableLogicalReconstruction, ocrModel]); // deps so closure stays fresh

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Single-file path (PDF, DOCX, or one image) — preserves existing UX
  const processFile = (file: File) => {
    const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && !isDocx) {
      showToast(t('toasts.invalidFile'), 'error');
      return;
    }
    setMimeType(file.type || (isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : ''));
    const reader = new FileReader();
    reader.onload = event => {
      const base64Data = event.target?.result as string;
      setImage(file.type.startsWith('image/') ? base64Data : null);
      scanImage(base64Data, file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    };
    reader.readAsDataURL(file);
  };

  // Multi-file batch path — processes images sequentially, shows live progress
  const processFiles = async (files: File[] | FileList) => {
    const arr = Array.from(files).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (arr.length === 0) return;
    if (arr.length === 1) { processFile(arr[0]); return; }

    // BATCH MODE
    setIsScanning(true);
    setBatchTasks([]);
    setBatchProgress({ done: 0, total: arr.length });
    setExtractedTask(null);
    setLatexCode('');
    setImage(null);

    const all: MathTask[] = [];
    for (const file of arr) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const base64 = dataUrl.split(',')[1];
        const result = await extractMathTasksFromImage(base64, file.type, targetLanguage, enableLogicalReconstruction, ocrModel);
        if (result?.length) { all.push(...result); setBatchTasks([...all]); }
      } catch (err) {
        console.error('Batch OCR error:', file.name, err);
      }
      setBatchProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
    }

    setIsScanning(false);
    setBatchProgress(null);
    if (all.length > 0) showToast(t('toasts.batchSuccess', { count: all.length, total: arr.length }), 'success');
    else showToast(t('toasts.batchEmpty'), 'error');
  };

  const handleSaveAll = async () => {
    if (!auth.currentUser || batchTasks.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(
        batchTasks.map(task =>
          addDoc(collection(db, 'tasks'), {
            ...task,
            author_uid: auth.currentUser!.uid,
            created_at: new Date().toISOString()
          })
        )
      );
      showToast(t('toasts.batchSaved', { count: batchTasks.length }), 'success');
    } catch {
      showToast(t('toasts.saveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const scanImage = async (base64Data: string, mime: string) => {
    setIsScanning(true);
    setExtractedTask(null);
    setLatexCode('');

    try {
      const base64String = base64Data.split(',')[1];

      let result;
      if (mime === 'application/pdf') {
        result = await extractMathTasksFromPdf(
          base64String,
          targetLanguage,
          enableLogicalReconstruction,
          ocrModel
        );
      } else {
        result = await extractMathTasksFromImage(
          base64String,
          mime,
          targetLanguage,
          enableLogicalReconstruction,
          ocrModel
        );
      }

      if (!result || result.length === 0) {
        throw new Error(t('toasts.noTasksFound'));
      }

      const task = result[0];
      setExtractedTask(task);

      // Format the result into a clean LaTeX/Markdown string
      let formattedText = task.original_text || '';
      if (task.solution_steps && task.solution_steps.length > 0) {
        formattedText += '\n\n**Решение:**\n' + task.solution_steps.join('\n');
      }
      setLatexCode(formattedText);
      showToast(t('toasts.scanSuccess'), 'success');
    } catch (error) {
      console.error("Грешка при скенирање:", error);
      showToast(t('toasts.scanError'), 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(latexCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showToast(t('toasts.codeCopied'), 'success');
  };

  const handleExtractCrop = () => {
    if (!imgRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );
      scanImage(canvas.toDataURL('image/jpeg'), 'image/jpeg');
    }
  };

  const insertLatex = (latexToInsert: string) => {
    setLatexCode(prev => prev + ' ' + latexToInsert + ' ');
  };
  const handleClear = () => {
    setImage(null);
    setCrop(undefined);
    setCompletedCrop(null);
    if (activeTab === 'draw' && ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setExtractedTask(null);
    setLatexCode('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!extractedTask || !latexCode) return;

    setIsSaving(true);
    try {
      const taskToSave = {
        ...extractedTask,
        original_text: latexCode, // Use the edited code
        author_uid: auth.currentUser?.uid || 'anonymous',
        created_at: new Date().toISOString()
      };

      await addDoc(collection(db, 'tasks'), taskToSave);
      showToast(t('toasts.taskSaved'), 'success');
    } catch (error) {
      console.error("Грешка при зачувување:", error);
      showToast(t('toasts.taskSaveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnrich = async () => {
    if (!extractedTask) return;
    setIsEnriching(true);
    try {
      const insights = await enrichTaskPedagogy(extractedTask as MathTask, ocrModel);
      setExtractedTask({ ...extractedTask, pedagogical_insights: insights });
      showToast(t('toasts.enrichSuccess'), 'success');
    } catch (error: any) {
      console.error("Грешка при збогатување:", error);
      showToast(error.message || t('toasts.enrichError'), 'error');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleCopyTask = (task: MathTask, index: number) => {
    const text = task.latex_formulas?.length
      ? task.latex_formulas.map(f => `$$${f}$$`).join('\n\n')
      : task.original_text;
    navigator.clipboard.writeText(text);
    setBatchCopied(index);
    setTimeout(() => setBatchCopied(null), 2000);
  };

  const handleScanCanvas = () => {
    scanImage(canvasRef.current?.toDataURL('image/png') || '', 'image/png');
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] lg:h-[calc(100vh-100px)] max-w-7xl mx-auto p-4 space-y-4 lg:space-y-6 animate-in fade-in duration-500">
      <SEO
        title={t('seo.title')}
        description={t('seo.description')}
        keywords={t('seo.keywords')}
      />
      {/* Header / Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <ScanLine className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white font-display tracking-tight">{t('header.title')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('header.subtitle')}</p>
            </div>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              {t('tabs.upload')}
            </button>
            <button
              onClick={() => setActiveTab('draw')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'draw'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <PenTool className="w-4 h-4" />
              {t('tabs.draw')}
            </button>
          </div>
        </div>

        {/* Model B Advanced Settings */}
        <OCRSettingsBar
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
          visualizationMode={visualizationMode}
          setVisualizationMode={setVisualizationMode}
          ocrModel={ocrModel}
          setOcrModel={setOcrModel}
          enableLogicalReconstruction={enableLogicalReconstruction}
          setEnableLogicalReconstruction={setEnableLogicalReconstruction}
        />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Panel: Upload/Crop OR Draw Canvas */}
        <ImageCropPanel
          activeTab={activeTab}
          image={image}
          batchProgress={batchProgress}
          isScanning={isScanning}
          crop={crop}
          onCropChange={(percentCrop) => setCrop(percentCrop)}
          onCropComplete={(c) => setCompletedCrop(c)}
          imgRef={imgRef}
          canvasRef={canvasRef}
          ctx={ctx}
          isDrawing={isDrawing}
          setIsDrawing={setIsDrawing}
          completedCrop={completedCrop}
          fileInputRef={fileInputRef}
          dropZoneRef={dropZoneRef}
          onExtractCrop={handleExtractCrop}
          onClear={handleClear}
          onScanCanvas={handleScanCanvas}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onFileSelect={handleFileSelect}
        />

        {/* Right Panel: Extracted LaTeX & Preview */}
        <div className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px] lg:min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('preview')}
                className={viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
              >
                <FileText className="w-4 h-4 mr-2" />
                {t('view.preview')}
              </Button>
              <Button
                variant={viewMode === 'code' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('code')}
                className={viewMode === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
              >
                <Code className="w-4 h-4 mr-2" />
                {t('view.latexCode')}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!latexCode}
                className="border-slate-200 dark:border-slate-700"
              >
                {isCopied ? <Check className="w-4 h-4 mr-2 text-emerald-500" /> : <Copy className="w-4 h-4 mr-2" />}
                {isCopied ? t('view.copied') : t('view.copy')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={!latexCode || isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t('view.save')}
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col p-0 overflow-hidden">
            {viewMode === 'code' && (
              <LatexQuickInsertPalette
                activeGroup={activeGroup}
                setActiveGroup={setActiveGroup}
                onInsertSymbol={insertLatex}
              />
            )}

            <div className="flex-1 p-6 overflow-y-auto">
              {/* Batch Progress Indicator */}
              {batchProgress && (
                <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      {t('view.processingImages')}
                    </span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {batchProgress.done} / {batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-indigo-100 dark:bg-indigo-900/50 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2">
                    {batchProgress.done === 0
                      ? t('view.starting')
                      : batchProgress.done < batchProgress.total
                        ? t('view.processedImage', { done: batchProgress.done, total: batchProgress.total })
                        : t('view.done')}
                  </p>
                </div>
              )}

              {batchTasks.length > 0 && !latexCode ? (
                <BatchResultsList
                  batchTasks={batchTasks}
                  batchProgress={batchProgress}
                  batchCopied={batchCopied}
                  isSaving={isSaving}
                  onCopyTask={handleCopyTask}
                  onSaveAll={handleSaveAll}
                />
              ) : !latexCode && !isScanning ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p>{t('view.emptyState')}</p>
                </div>
              ) : (
                viewMode === 'code' ? (
                  <div className="flex flex-col h-full gap-4">
                    <div className="flex-none hidden xl:block">
                      <p className="text-xs text-slate-500 mb-2">{t('view.mathEditorHint')}</p>
                      <Suspense fallback={<div className="text-xs text-slate-400 py-2">{t('view.loadingMathEditor')}</div>}>
                        <MathEditor
                          value=""
                          onChange={(val) => insertLatex(val)}
                          className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-sm rounded-xl py-2"
                        />
                      </Suspense>
                    </div>
                    <textarea
                      value={latexCode}
                      onChange={(e) => setLatexCode(e.target.value)}
                      className="w-full flex-1 p-4 font-mono text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-slate-800 dark:text-slate-200"
                      placeholder={t('view.latexPlaceholder')}
                    />
                  </div>
                ) : (
                  <OCRResultPreview
                    extractedTask={extractedTask}
                    latexCode={latexCode}
                    isEnriching={isEnriching}
                    onEnrich={handleEnrich}
                    onOpenGeogebra={setActiveGeogebraCmds}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
      {activeGeogebraCmds && (
        <GeoGebraViewer commands={activeGeogebraCmds} onClose={() => setActiveGeogebraCmds(null)} />
      )}
    </div>
  );
};
