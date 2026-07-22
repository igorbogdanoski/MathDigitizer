import React from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('smartOcr');
  return (
    <div className="flex flex-wrap gap-4 items-center bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">{t('settings.outputLanguage')}</span>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value as any)}
          title={t('settings.outputLanguageTitle')}
          aria-label={t('settings.outputLanguageTitle')}
          className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="auto">{t('settings.langAuto')}</option>
          <option value="mk">{t('settings.langMk')}</option>
          <option value="en">{t('settings.langEn')}</option>
          <option value="tr">{t('settings.langTr')}</option>
          <option value="ru">{t('settings.langRu')}</option>
        </select>
      </div>

      <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800 hidden sm:block"></div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">{t('settings.visualization')}</span>
        <select
          value={visualizationMode}
          onChange={(e) => setVisualizationMode(e.target.value as typeof visualizationMode)}
          title={t('settings.visualizationTitle')}
          aria-label={t('settings.visualizationTitle')}
          className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 shadow-sm"
        >
          <option value="none">{t('settings.vizNone')}</option>
          <option value="tikz">{t('settings.vizTikz')}</option>
          <option value="geogebra">{t('settings.vizGeogebra')}</option>
          <option value="nanobanana">{t('settings.vizNanobanana')}</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">{t('settings.model')}</span>
        <select
          value={ocrModel}
          onChange={(e) => setOcrModel(e.target.value)}
          title={t('settings.modelTitle')}
          aria-label={t('settings.modelTitle')}
          className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 shadow-sm"
        >
          <option value="gemini-3.1-pro-preview">{t('settings.modelPro')}</option>
          <option value="gemini-3-flash-preview">{t('settings.modelFlash')}</option>
        </select>
      </div>

      <div className="w-px h-6 bg-indigo-200 dark:bg-indigo-800 hidden md:block"></div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">{t('settings.logicalReconstruction')}</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enableLogicalReconstruction}
            onChange={(e) => setEnableLogicalReconstruction(e.target.checked)}
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
          <span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            {enableLogicalReconstruction ? t('settings.enabled') : t('settings.disabled')}
          </span>
        </label>
      </div>
    </div>
  );
};
