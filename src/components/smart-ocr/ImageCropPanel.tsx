import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image as ImageIcon, PenTool, Crop, ScanLine, Upload, Loader2, Images
} from 'lucide-react';
import { Button } from '../ui/Button';
import ReactCrop, { Crop as CropType, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropPanelProps {
  activeTab: 'upload' | 'draw';
  image: string | null;
  batchProgress: { done: number; total: number } | null;
  isScanning: boolean;
  crop: CropType | undefined;
  onCropChange: (percentCrop: CropType) => void;
  onCropComplete: (c: PixelCrop) => void;
  imgRef: React.RefObject<HTMLImageElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ctx: CanvasRenderingContext2D | null;
  isDrawing: boolean;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  completedCrop: PixelCrop | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  onExtractCrop: () => void;
  onClear: () => void;
  onScanCanvas: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ImageCropPanel: React.FC<ImageCropPanelProps> = ({
  activeTab,
  image,
  batchProgress,
  isScanning,
  crop,
  onCropChange,
  onCropComplete,
  imgRef,
  canvasRef,
  ctx,
  isDrawing,
  setIsDrawing,
  completedCrop,
  fileInputRef,
  dropZoneRef,
  onExtractCrop,
  onClear,
  onScanCanvas,
  onDrop,
  onDragOver,
  onFileSelect,
}) => {
  const { t } = useTranslation('smartOcr');
  return (
    <div className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[400px] lg:min-h-0">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          {activeTab === 'upload' ? (
            <><ImageIcon className="w-4 h-4" /> {t('crop.originalImage')}</>
          ) : (
            <><PenTool className="w-4 h-4" /> {t('crop.drawingBoard')}</>
          )}
        </h2>
        <div className="flex gap-2">
          {activeTab === 'upload' && image && (
            <Button variant="outline" size="sm" onClick={onExtractCrop} disabled={isScanning || !completedCrop}>
              <Crop className="w-4 h-4 mr-2" />
              {t('crop.extractCrop')}
            </Button>
          )}
          {activeTab === 'draw' && (
            <Button variant="outline" size="sm" onClick={onScanCanvas} disabled={isScanning}>
              <ScanLine className="w-4 h-4 mr-2" />
              {t('crop.ocrHandwriting')}
            </Button>
          )}
          {(image || activeTab === 'draw') && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-slate-500 hover:text-red-600">
              {t('crop.clear')}
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
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">{t('crop.batchInProgress')}</p>
                <p className="text-sm text-slate-500 mb-4">{t('crop.batchImagesProcessed', { done: batchProgress.done, total: batchProgress.total })}</p>
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
              onDrop={onDrop}
              onDragOver={onDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:border-indigo-400 group relative"
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                multiple
                onChange={onFileSelect}
                title={t('crop.attachImageOrPdf')}
                aria-label={t('crop.attachImageOrPdf')}
              />
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-indigo-500" />
              </div>
              <p className="text-lg text-slate-700 dark:text-slate-300 font-medium mb-2">
                {t('crop.dropzoneTitle')}
              </p>
              <p className="text-sm text-slate-500 mb-1">
                {t('crop.dropzoneFormats')}
              </p>
              <p className="text-xs text-indigo-500 flex items-center gap-1">
                <Images className="w-3.5 h-3.5" /> {t('crop.dropzoneBatchHint')}
              </p>
            </div>
          ) : (
            <div className="flex-1 relative flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl overflow-auto border border-slate-200 dark:border-slate-700 p-4">
              <ReactCrop crop={crop} onChange={(_, percentCrop) => onCropChange(percentCrop)} onComplete={(c) => onCropComplete(c)}>
                <img
                  ref={imgRef}
                  src={image}
                  alt={t('crop.attachedTask')}
                  className="max-w-full object-contain"
                />
              </ReactCrop>
              {isScanning && (
                <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center rounded-xl">
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-5xl shadow-2xl flex flex-col items-center border border-slate-200 dark:border-slate-700">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="font-extrabold text-lg text-slate-900 dark:text-white">{t('crop.scanningTitle')}</p>
                    <p className="text-sm text-slate-500 mt-2">{t('crop.scanningSubtitle')}</p>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="flex-1 relative w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={t('crop.canvasLabel')}
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
              {t('crop.drawHint')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
