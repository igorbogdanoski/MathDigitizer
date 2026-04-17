import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Copy, Check, Loader2, RefreshCw, Download, 
  FileText, Code, Save, ScanLine, PenTool, Crop, AlertTriangle, Quote, Zap,
  Activity
} from 'lucide-react';
import { Button } from './ui/Button';
import { extractTaskFromImage } from '../lib/gemini';
import { MathTask } from '../lib/schema';
import { MathRenderer } from './MathRenderer';
import { useToast } from '../contexts/ToastContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import ReactCrop, { Crop as CropType, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
  const [extractedTask, setExtractedTask] = useState<Partial<MathTask> | null>(null);
  const [latexCode, setLatexCode] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('code');
  
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

  // Handle paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Ве молиме прикачете слика (JPG, PNG).', 'error');
      return;
    }

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
      // Auto-scan when image is loaded
      scanImage(event.target?.result as string, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
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
      const base64Image = base64Data.split(',')[1];
      const result = await extractTaskFromImage(base64Image, mime);
      setExtractedTask(result);
      
      // Format the result into a clean LaTeX/Markdown string
      let formattedText = result.original_text || '';
      if (result.solution_steps && result.solution_steps.length > 0) {
        formattedText += '\n\n**Решение:**\n' + result.solution_steps.join('\n');
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

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in duration-500">
      {/* Header / Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <ScanLine className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Smart OCR 2.0</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Дигитализација на математика со светска прецизност</p>
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

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Panel: Upload/Crop OR Draw Canvas */}
        <div className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
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
              !image ? (
                <div 
                  ref={dropZoneRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:border-indigo-400 group"
                >
                  <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-indigo-500" />
                  </div>
                  <p className="text-lg text-slate-700 dark:text-slate-300 font-medium mb-2">
                    Повлечете слика или залепете (CTRL+V)
                  </p>
                  <p className="text-sm text-slate-500">
                    Поддржани формати: JPG, PNG
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
        <div className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
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
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md transition-all active:scale-95 flex-shrink-0"
                    >
                      <MathRenderer content={`$${item.label}$`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex-1 p-6 overflow-y-auto">
              {!latexCode && !isScanning ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p>Дигитализираниот текст ќе се појави овде</p>
                </div>
              ) : (
                viewMode === 'code' ? (
                  <textarea
                    value={latexCode}
                    onChange={(e) => setLatexCode(e.target.value)}
                    className="w-full h-full p-4 font-mono text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-slate-800 dark:text-slate-200"
                    placeholder="LaTeX кодот ќе се појави овде..."
                  />
                ) : (
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <MathRenderer content={latexCode} />
                    
                    {extractedTask && extractedTask.difficulty && (
                      <div className="mt-8 space-y-4">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-2">AI Метаподатоци</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500">Тежина:</span> <span className="font-medium text-slate-900 dark:text-white">{extractedTask.difficulty}</span></div>
                            <div><span className="text-slate-500">Тема:</span> <span className="font-medium text-slate-900 dark:text-white">{extractedTask.curriculum_topic}</span></div>
                            <div><span className="text-slate-500">Одделение:</span> <span className="font-medium text-slate-900 dark:text-white">{extractedTask.grade_level}</span></div>
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
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
