import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import {
  Upload, Image as ImageIcon, Copy, Check, Loader2, RefreshCw, Download,
  FileText, Code, Save, ScanLine, PenTool, Crop, AlertTriangle, Quote, Zap,
  Activity, Images, ClipboardPaste
} from 'lucide-react';
import { Button } from './ui/Button';
import { extractMathTasksFromImage, extractMathTasksFromPdf, enrichTaskPedagogy } from '../lib/gemini';
import { MathTask } from '../lib/schema';
import { MathRenderer } from './MathRenderer';
import { useToast } from '../contexts/ToastContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import ReactCrop, { Crop as CropType, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { GeoGebraViewer } from './GeoGebraViewer';
const MathEditor = lazy(() => import('./MathEditor').then((m) => ({ default: m.MathEditor })));

import { SEO } from './SEO';

export const SmartOCR: React.FC = () => {

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Draw Mode Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  // MathType-like grouped quick inserts
  const quickInsertGroups = [
    {
      group: "Основни",
      items: [
        { label: 'Дропка', insert: '\\frac{ }{ }' },
        { label: 'Корен', insert: '\\sqrt{ }' },
        { label: 'Степен', insert: '^{ }' },
        { label: 'Индекс', insert: '_{ }' },
      ]
    },
    {
      group: "Симболи",
      items: [
        { label: '±', insert: '\\pm ' },
        { label: '≈', insert: '\\approx ' },
        { label: '≠', insert: '\\neq ' },
        { label: '∞', insert: '\\infty ' },
        { label: '∀ (секој)', insert: '\\forall ' },
        { label: '∃ (постои)', insert: '\\exists ' },
      ]
    },
    {
      group: "Геометрија",
      items: [
        { label: 'Агол (∠)', insert: '\\angle ' },
        { label: 'Триаголник (△)', insert: '\\triangle ' },
        { label: 'Степен (°)', insert: '^{\\circ}' },
        { label: 'π', insert: '\\pi ' },
      ]
    },
    {
      group: "Калкулус",
      items: [
        { label: 'Сума (∑)', insert: '\\sum_{i=1}^{n} ' },
        { label: 'Интеграл (∫)', insert: '\\int_{a}^{b} ' },
        { label: 'Лимес', insert: '\\lim_{x \\to \\infty} ' },
      ]
    }
  ];

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
      showToast('Ве молиме прикачете слика (JPG, PNG), PDF или Word (.docx) документ.', 'error');
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
    if (all.length > 0) showToast(`Batch: ${all.length} задачи извлечени од ${arr.length} слики`, 'success');
    else showToast('Не се пронајдени задачи во ниту една слика.', 'error');
  };

  const handleSaveAll = async () => {
    if (!auth.currentUser || batchTasks.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(
        batchTasks.map(t =>
          addDoc(collection(db, 'tasks'), {
            ...t,
            author_uid: auth.currentUser!.uid,
            created_at: new Date().toISOString()
          })
        )
      );
      showToast(`${batchTasks.length} задачи зачувани во Библиотеката!`, 'success');
    } catch {
      showToast('Грешка при зачувување.', 'error');
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
        throw new Error("Не се пронајдени задачи на оваа слика.");
      }
      
      const task = result[0];
      setExtractedTask(task);
      
      // Format the result into a clean LaTeX/Markdown string
      let formattedText = task.original_text || '';
      if (task.solution_steps && task.solution_steps.length > 0) {
        formattedText += '\n\n**Решение:**\n' + task.solution_steps.join('\n');
      }
      setLatexCode(formattedText);
      showToast('Сликата е успешно дигитализирана!', 'success');
    } catch (error) {
      console.error("Грешка при скенирање:", error);
      showToast('Настана грешка при скенирањето. Обидете се со појасна слика.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(latexCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showToast('Кодот е копиран во клипборд.', 'success');
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
      showToast('Задачата е успешно зачувана во Библиотеката!', 'success');
    } catch (error) {
      console.error("Грешка при зачувување:", error);
      showToast('Настана грешка при зачувувањето.', 'error');
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
      showToast('Педагошките елементи се успешно генерирани!', 'success');
    } catch (error: any) {
      console.error("Грешка при збогатување:", error);
      showToast(error.message || 'Настана грешка при генерирање на педагогијата.', 'error');
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] lg:h-[calc(100vh-100px)] max-w-7xl mx-auto p-4 space-y-4 lg:space-y-6 animate-in fade-in duration-500">
      <SEO 
        title="Smart OCR & Проверка на ракопис" 
        description="Специјализиран модел за препознавање македонски ракопис и стари кирилични учебници. Напредна AI OCR технологија." 
        keywords="ocr, математика, ракопис, скенирање, gemini vision, ai, македонски математика OCR"
      />
      {/* Header / Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <ScanLine className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Advanced Vision OCR</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Специјализиран за ракопис, оштетен текст и стари учебници</p>
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
              Слика / PDF
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
              Ракопис
            </button>
          </div>
        </div>

        {/* Model B Advanced Settings */}
        <div className="flex flex-wrap gap-4 items-center bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Излезен Јазик:</span>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value as any)}
              title="Излезен јазик"
              aria-label="Излезен јазик"
              className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200"
            >
              <option value="auto">Автоматски (Оригинален)</option>
              <option value="mk">Македонски</option>
              <option value="en">English (Англиски)</option>
              <option value="tr">Türkçe (Турски)</option>
              <option value="ru">Русский (Руски)</option>
            </select>
          </div>
          
          <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800 hidden sm:block"></div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Визуелизација:</span>
            <select
              defaultValue="geogebra"
              title="Визуелизација"
              aria-label="Визуелизација"
              className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <option value="none">Без дијаграм</option>
              <option value="tikz">LaTeX (TikZ)</option>
              <option value="geogebra">GeoGebra (Интерактивно)</option>
              <option value="nanobanana">AI Контекстуална Слика</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Модел:</span>
            <select
              value={ocrModel}
              onChange={(e) => setOcrModel(e.target.value)}
              title="OCR модел"
              aria-label="OCR модел"
              className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (World-Class)</option>
              <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
            </select>
          </div>

          <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800 hidden md:block"></div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Логичка Реконструкција:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={enableLogicalReconstruction}
                onChange={(e) => setEnableLogicalReconstruction(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
              <span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                {enableLogicalReconstruction ? 'Вклучена' : 'Исклучена'}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Panel: Upload/Crop OR Draw Canvas */}
        <div className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              {activeTab === 'upload' ? (
                <><ImageIcon className="w-4 h-4" /> Оригинална Слика</>
              ) : (
                <><PenTool className="w-4 h-4" /> Табла за цртање</>
              )}
            </h2>
            <div className="flex gap-2">
              {activeTab === 'upload' && image && (
                <Button variant="outline" size="sm" onClick={handleExtractCrop} disabled={isScanning || !completedCrop}>
                  <Crop className="w-4 h-4 mr-2" />
                  Извлечи (Crop & OCR)
                </Button>
              )}
              {activeTab === 'draw' && (
                <Button variant="outline" size="sm" onClick={() => scanImage(canvasRef.current?.toDataURL('image/png') || '', 'image/png')} disabled={isScanning}>
                  <ScanLine className="w-4 h-4 mr-2" />
                  OCR на ракопис
                </Button>
              )}
              {(image || activeTab === 'draw') && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="text-slate-500 hover:text-red-600">
                  Исчисти
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1 p-6 relative overflow-hidden flex flex-col">
            {activeTab === 'upload' ? (
              batchProgress !== null ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 p-8">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                    <Images className="w-8 h-8 text-indigo-500 animate-pulse" />
                  </div>
                  <div className="w-full max-w-xs text-center">
                    <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">Batch OCR во тек...</p>
                    <p className="text-sm text-slate-500 mb-4">{batchProgress.done} / {batchProgress.total} слики обработени</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((batchProgress.done / batchProgress.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{Math.round((batchProgress.done / batchProgress.total) * 100)}%</p>
                  </div>
                </div>
              ) : !image ? (
                <div
                  ref={dropZoneRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:border-indigo-400 group relative"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    title="Прикачи слика или PDF"
                    aria-label="Прикачи слика или PDF"
                  />
                  <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-indigo-500" />
                  </div>
                  <p className="text-lg text-slate-700 dark:text-slate-300 font-medium mb-2">
                    Повлечете слика/PDF или залепете (CTRL+V)
                  </p>
                  <p className="text-sm text-slate-500 mb-1">
                    Поддржани формати: JPG, PNG, PDF
                  </p>
                  <p className="text-xs text-indigo-500 flex items-center gap-1">
                    <Images className="w-3.5 h-3.5" /> Изберете повеќе датотеки истовремено за batch обработка
                  </p>
                </div>
              ) : (
                <div className="flex-1 relative flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl overflow-auto border border-slate-200 dark:border-slate-700 p-4">
                  <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
                    <img 
                      ref={imgRef}
                      src={image} 
                      alt="Прикачена задача" 
                      className="max-w-full object-contain"
                    />
                  </ReactCrop>
                  {isScanning && (
                    <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center rounded-xl">
                      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center border border-slate-200 dark:border-slate-700">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                        <p className="font-extrabold text-lg text-slate-900 dark:text-white">Gemini 3.1 Pro OCR...</p>
                        <p className="text-sm text-slate-500 mt-2">Анализа на пиксели во тек</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="flex-1 relative w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair touch-none mix-blend-multiply dark:mix-blend-normal"
                  onPointerDown={(e) => {
                    setIsDrawing(true);
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect && ctx) {
                      ctx.beginPath();
                      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!isDrawing) return;
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect && ctx) {
                      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                      ctx.stroke();
                    }
                  }}
                  onPointerUp={() => {
                    setIsDrawing(false);
                    ctx?.closePath();
                  }}
                  onPointerLeave={() => {
                    setIsDrawing(false);
                    ctx?.closePath();
                  }}
                />
                <div className="absolute bottom-4 left-4 text-xs font-medium text-slate-400 pointer-events-none">
                  Цртајте овде...
                </div>
              </div>
            )}
          </div>
        </div>

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
                Преглед
              </Button>
              <Button 
                variant={viewMode === 'code' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('code')}
                className={viewMode === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
              >
                <Code className="w-4 h-4 mr-2" />
                LaTeX Код
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
                {isCopied ? 'Копирано' : 'Копирај'}
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSave}
                disabled={!latexCode || isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Зачувај
              </Button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col p-0 overflow-hidden">
            {viewMode === 'code' && (
              <div className="flex flex-col border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
                {/* MathType Group Tabs */}
                <div className="flex px-3 pt-3 gap-1 overflow-x-auto scrollbar-hide">
                  {quickInsertGroups.map((grp) => (
                    <button
                      key={grp.group}
                      onClick={() => setActiveGroup(grp.group)}
                      className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-t border-x ${
                        activeGroup === grp.group 
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-b-white dark:border-b-slate-800 relative z-10 translate-y-[1px]'
                          : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      {grp.group}
                    </button>
                  ))}
                </div>
                {/* MathType Buttons for active group */}
                <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 shadow-inner min-h-[60px] items-center relative z-0">
                  {quickInsertGroups.find(g => g.group === activeGroup)?.items.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => insertLatex(item.insert)}
                      title={`Вметни симбол ${item.label}`}
                      aria-label={`Вметни симбол ${item.label}`}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md transition-all active:scale-95 flex-shrink-0"
                    >
                      <MathRenderer content={`$${item.label}$`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex-1 p-6 overflow-y-auto">
              {batchTasks.length > 0 && !latexCode ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Images className="w-5 h-5 text-indigo-500" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">Batch резултати: {batchTasks.length} задачи</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveAll}
                      disabled={isSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Зачувај ги сите
                    </Button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {batchTasks.map((t, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 line-clamp-2 flex-1">{t.title}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const text = t.latex_formulas?.length
                                ? t.latex_formulas.map(f => `$$${f}$$`).join('\n\n')
                                : t.original_text;
                              navigator.clipboard.writeText(text);
                              setBatchCopied(i);
                              setTimeout(() => setBatchCopied(null), 2000);
                            }}
                            className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${batchCopied === i ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}`}
                            title="Копирај LaTeX"
                          >
                            {batchCopied === i ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${t.difficulty === 'easy' ? 'bg-green-100 text-green-700' : t.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{t.difficulty}</span>
                          {t.tags?.slice(0, 2).map((tag, ti) => (
                            <span key={ti} className="text-[9px] font-medium uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{t.original_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !latexCode && !isScanning ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p>Дигитализираниот текст ќе се појави овде</p>
                </div>
              ) : (
                viewMode === 'code' ? (
                  <div className="flex flex-col h-full gap-4">
                    <div className="flex-none hidden xl:block">
                      <p className="text-xs text-slate-500 mb-2">Напреден Математички Едитор (За вметнување равенки во кодот, копирај го резултатот тука и вметни го со $\dots$):</p>
                      <Suspense fallback={<div className="text-xs text-slate-400 py-2">Вчитување на математички едитор...</div>}>
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
                      placeholder="LaTeX кодот ќе се појави овде..."
                    />
                  </div>
                ) : (
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {extractedTask?.evidence_quote && (
                      <div className="mb-6 flex items-start gap-2 bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border-l-2 border-amber-300 text-amber-700 dark:text-amber-400 text-sm italic">
                        <Quote className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />
                        <p>Пронајден доказ: "{extractedTask.evidence_quote}"</p>
                      </div>
                    )}
                    <MathRenderer content={latexCode} />
                    
                    {extractedTask && extractedTask.difficulty && (
                      <div className="mt-8 space-y-4">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">AI Метаподатоци</h4>
                            {!extractedTask.pedagogical_insights && (
                              <Button 
                                size="sm" 
                                onClick={handleEnrich} 
                                disabled={isEnriching}
                                className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700"
                              >
                                {isEnriching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                                Педагошко збогатување
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mt-3 border-t border-indigo-100 dark:border-indigo-800/50 pt-3">
                            {extractedTask.type !== 'theory' && <div><span className="text-slate-500">Тежина:</span> <span className="font-medium text-slate-900 dark:text-white">{extractedTask.difficulty}</span></div>}
                            <div><span className="text-slate-500">Тема:</span> <span className="font-medium text-slate-900 dark:text-white">{extractedTask.curriculum_topic}</span></div>
                            <div><span className="text-slate-500">Тип:</span> <span className={`font-medium px-2 py-0.5 rounded text-[10px] uppercase font-bold ${extractedTask.type === 'theory' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{extractedTask.type}</span></div>
                            {extractedTask.detected_language && <div><span className="text-slate-500">Јазик:</span> <span className="font-medium text-slate-900 dark:text-white uppercase text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded ml-1">{extractedTask.detected_language}</span></div>}
                          </div>
                        </div>

                        {extractedTask.pedagogical_insights && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-red-50/80 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <AlertTriangle className="w-12 h-12 text-red-600" />
                                </div>
                                <h4 className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-400 mb-2 relative z-10">
                                  <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                  Можни грешки
                                </h4>
                                <ul className="space-y-1 relative z-10">
                                  {extractedTask.pedagogical_insights.common_pitfalls.map((p, i) => (
                                    <li key={i} className="text-[11px] text-red-800 dark:text-red-300 flex gap-2">
                                       <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                                       {p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="bg-indigo-50/80 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(79,70,229,0.05)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <Quote className="w-12 h-12 text-indigo-600" />
                                </div>
                                <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-400 mb-2 relative z-10">
                                  <Quote className="w-3.5 h-3.5" />
                                  Водечки прашања
                                </h4>
                                <ul className="space-y-1 relative z-10">
                                  {extractedTask.pedagogical_insights.socratic_questions.map((q, i) => (
                                    <li key={i} className="text-[11px] text-indigo-800 dark:text-indigo-300 italic flex gap-2">
                                       <span className="text-indigo-400 font-bold">?</span>
                                       {q}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {extractedTask.pedagogical_insights.modeling_scenario && (
                              <div className="bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.05)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <Activity className="w-12 h-12 text-emerald-600" />
                                </div>
                                <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-400 mb-2 relative z-10">
                                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                                  Математичко Моделирање
                                </h4>
                                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium relative z-10">
                                  {extractedTask.pedagogical_insights.modeling_scenario}
                                </p>
                              </div>
                            )}

                            {extractedTask.pedagogical_insights.modern_context_suggestion && (
                              <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                                <Zap className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0 animate-bounce" />
                                <div>
                                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest block mb-1">Предлог за модернизација</span>
                                  <p className="text-sm text-orange-950 dark:text-orange-100 italic leading-relaxed font-display">
                                    "{extractedTask.pedagogical_insights.modern_context_suggestion}"
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* GeoGebra / Visualization Sub-card */}
                        {(extractedTask.geogebra_commands?.length ?? 0) > 0 && (
                          <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-inner mt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                                  <Activity className="w-4 h-4 text-indigo-500" />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">GeoGebra Command API</h4>
                              </div>
                              <Button 
                                size="sm" 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-bold"
                                onClick={() => setActiveGeogebraCmds(extractedTask.geogebra_commands || [])}
                              >
                                <Code className="w-4 h-4 mr-2" />
                                Отвори во GeoGebra
                              </Button>
                            </div>
                            <div className="bg-slate-900 rounded-xl p-3 text-emerald-400 font-mono text-xs overflow-x-auto">
                              {extractedTask.geogebra_commands?.map((cmd, i) => (
                                <div key={i} className="whitespace-nowrap"><span className="text-slate-500">evalCommand:</span> {cmd}</div>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-3 text-center uppercase tracking-widest font-bold">Овој код е подготвен за автоматско полнење на GeoGebra Applet.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
