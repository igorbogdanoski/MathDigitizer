import React from 'react';

interface OCRSettingsBarProps {
  targetLanguage: 'auto' | 'mk' | 'en' | 'ru' | 'tr';
  setTargetLanguage: (v: 'auto' | 'mk' | 'en' | 'ru' | 'tr') => void;
  visualizationMode: 'none' | 'tikz' | 'geogebra' | 'nanobanana';
  setVisualizationMode: (v: 'none' | 'tikz' | 'geogebra' | 'nanobanana') => void;
  ocrModel: string;
  setOcrModel: (v: string) => void;
  enableLogicalReconstruction: boolean;
  setEnableLogicalReconstruction: (v: boolean) => void;
}

export const OCRSettingsBar: React.FC<OCRSettingsBarProps> = ({
  targetLanguage,
  setTargetLanguage,
  visualizationMode,
  setVisualizationMode,
  ocrModel,
  setOcrModel,
  enableLogicalReconstruction,
  setEnableLogicalReconstruction,
}) => {
  return (
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
          value={visualizationMode}
          onChange={(e) => setVisualizationMode(e.target.value as typeof visualizationMode)}
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
  );
};
