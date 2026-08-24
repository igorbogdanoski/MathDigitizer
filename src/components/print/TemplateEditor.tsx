import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  ACCENT_PRESETS,
  MAX_LOGO_BYTES,
  PrintTemplate,
  TemplateVariant,
  fitLogoSize,
  sanitizeLogo,
} from '../../lib/materials/printTemplate';

interface TemplateEditorProps {
  template: PrintTemplate;
  onChange: (patch: Partial<PrintTemplate>) => void;
}

/**
 * Downscales a logo to a print-friendly size and returns a data URL.
 *
 * A school crest is routinely a multi-megabyte photo; stored raw it would blow
 * the localStorage quota and bloat every exported PDF. 320px is more than the
 * 14mm the letterhead prints it at, even at 3× export scale.
 */
async function toPrintableLogo(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // SVG is already compact and scales perfectly — keep it as-is.
  if (file.type === 'image/svg+xml') return dataUrl;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const size = fitLogoSize({ width: image.naturalWidth, height: image.naturalHeight });
  if (size.width === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, size.width, size.height);

  // PNG keeps transparency, which most crests rely on.
  return canvas.toDataURL('image/png');
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onChange }) => {
  const { t } = useTranslation('materialsFactory');
  const fileRef = useRef<HTMLInputElement>(null);
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogo = async (file?: File) => {
    if (!file) return;
    setIsLoadingLogo(true);
    setLogoError(null);
    try {
      const logo = sanitizeLogo(await toPrintableLogo(file));
      if (!logo) {
        setLogoError(t('template.logoTooLarge', { kb: Math.round(MAX_LOGO_BYTES / 1000) }));
        return;
      }
      onChange({ logoDataUrl: logo });
    } catch {
      setLogoError(t('template.logoFailed'));
    } finally {
      setIsLoadingLogo(false);
    }
  };

  const textField = (
    field: keyof PrintTemplate,
    labelKey: string,
    options: { placeholder?: string; wide?: boolean } = {}
  ) => (
    <div className={options.wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={`tpl-${field}`} className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
        {t(labelKey)}
      </label>
      <input
        id={`tpl-${field}`}
        type="text"
        value={String(template[field] ?? '')}
        onChange={(e) => onChange({ [field]: e.target.value } as Partial<PrintTemplate>)}
        placeholder={options.placeholder}
        className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
      />
    </div>
  );

  const toggle = (field: keyof PrintTemplate, labelKey: string) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
      <input
        type="checkbox"
        checked={Boolean(template[field])}
        onChange={(e) => onChange({ [field]: e.target.checked } as Partial<PrintTemplate>)}
        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      {t(labelKey)}
    </label>
  );

  return (
    <section className="space-y-5 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
          {t('template.title')}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{t('template.hint')}</p>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-white dark:bg-slate-800 overflow-hidden shrink-0">
          {template.logoDataUrl ? (
            <img src={template.logoDataUrl} alt={t('template.logoAlt')} className="max-w-full max-h-full object-contain" />
          ) : (
            <ImagePlus className="w-6 h-6 text-slate-300" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => handleLogo(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={isLoadingLogo} className="rounded-lg">
            {isLoadingLogo
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              : <ImagePlus className="w-4 h-4 mr-2" aria-hidden="true" />}
            {t('template.uploadLogo')}
          </Button>

          {template.logoDataUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ logoDataUrl: '' })}
              aria-label={t('template.removeLogo')}
              className="rounded-lg text-slate-500"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}

          {logoError && <p role="alert" className="text-xs text-rose-600 w-full">{logoError}</p>}
        </div>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {textField('school', 'template.school', { wide: true, placeholder: 'ООУ „Блаже Конески"' })}
        {textField('municipality', 'template.municipality')}
        {textField('schoolYear', 'template.schoolYear', { placeholder: '2026/2027' })}
        {textField('subject', 'template.subject', { placeholder: 'Математика' })}
        {textField('grade', 'template.grade', { placeholder: 'VII-б' })}
        {textField('teacher', 'template.teacher', { wide: true })}
        {textField('note', 'template.note', { wide: true })}
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            {t('template.variant')}
          </span>
          <div className="flex gap-1 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" role="group">
            {(['official', 'compact', 'minimal'] as TemplateVariant[]).map(variant => (
              <button
                key={variant}
                type="button"
                onClick={() => onChange({ variant })}
                aria-pressed={template.variant === variant}
                className={`flex-1 h-8 rounded-md text-xs font-bold transition-colors ${
                  template.variant === variant
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {t(`template.variant_${variant}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            {t('template.accent')}
          </span>
          <div className="flex gap-2">
            {ACCENT_PRESETS.map(accent => (
              <button
                key={accent}
                type="button"
                onClick={() => onChange({ accent })}
                aria-label={accent}
                aria-pressed={template.accent === accent}
                style={{ backgroundColor: accent }}
                className={`w-8 h-8 rounded-lg transition-transform ${
                  template.accent === accent ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {toggle('showStudentFields', 'template.showStudentFields')}
        {toggle('showPointsBox', 'template.showPointsBox')}
        {toggle('showGradingScale', 'template.showGradingScale')}
        {toggle('showFooter', 'template.showFooter')}
      </div>

      <div className="sm:w-1/2">
        <label htmlFor="tpl-points" className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
          {t('template.totalPoints')}
        </label>
        <input
          id="tpl-points"
          type="number"
          min={1}
          max={1000}
          value={template.totalPoints}
          onChange={(e) => onChange({ totalPoints: Number(e.target.value) })}
          className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>
    </section>
  );
};
