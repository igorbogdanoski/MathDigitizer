import React from 'react';
import { Upload } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

interface StepUploadProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onLoadFile: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const StepUpload: React.FC<StepUploadProps> = ({ fileInputRef, onLoadFile, onDrop }) => (
  <Card>
    <CardContent className="p-6">
      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all"
        onClick={() => fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
      >
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="font-semibold text-slate-700 dark:text-slate-300">Прикачи график</p>
        <p className="text-xs text-slate-400 mt-1">JPG, PNG, SVG, BMP, WebP</p>
        <p className="text-xs text-slate-400">или повлечи и пусти</p>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onLoadFile(f); }} />
    </CardContent>
  </Card>
);
