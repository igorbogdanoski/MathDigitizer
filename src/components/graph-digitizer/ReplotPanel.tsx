import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Download, ImageDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import {
  ReplotSeries,
  buildReplotScript,
  fitLatexToExpression,
  pointsToCsv,
  toJsxGraphBlock,
} from '../../lib/graph/replot';
import { bestFit } from '../../lib/graph/regression';

interface ReplotPanelProps {
  series: ReplotSeries[];
  /** The equation shown for the graph, if the teacher kept the detected one. */
  detectedEquation?: string;
}

/**
 * The digitized data re-plotted on real axes
 * (EXPERT_LEVEL_MASTER_PLAN, 8.4).
 *
 * Points and the fitted curve on proper axes, so the extracted function can be
 * seen against the data it claims to describe. Exports the plot as SVG or PNG
 * for a worksheet, and the points as CSV for anyone who wants the numbers.
 */
export const ReplotPanel: React.FC<ReplotPanelProps> = ({ series, detectedEquation }) => {
  const { t } = useTranslation('graphDigitizer');
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const points = useMemo(() => series.flatMap(s => s.points), [series]);

  /**
   * The curve to draw: the teacher's equation if it can be evaluated, otherwise
   * the computed fit. Never both — two curves would suggest a comparison the
   * plot is not making.
   */
  const expression = useMemo(() => {
    const fromDetected = detectedEquation ? fitLatexToExpression(detectedEquation) : null;
    if (fromDetected) return fromDetected;

    const fit = bestFit(points);
    return fit ? fitLatexToExpression(fit.latex) : null;
  }, [detectedEquation, points]);

  const script = useMemo(
    () => buildReplotScript({ series, ...(expression ? { functionExpression: expression } : {}) }),
    [series, expression]
  );

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /** JSXGraph renders to SVG, so the vector export is the live node itself. */
  const exportSvg = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    download(new Blob([clone.outerHTML], { type: 'image/svg+xml;charset=utf-8' }), 'graf.svg');
  };

  const exportPng = async () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;

    setIsExporting(true);
    try {
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const rect = svg.getBoundingClientRect();
      const source = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(clone.outerHTML)))}`;

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = source;
      });

      // 2× for a print-quality raster.
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rect.width * 2));
      canvas.height = Math.max(1, Math.round(rect.height * 2));

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => { if (blob) download(blob, 'graf.png'); }, 'image/png');
    } catch (err) {
      console.error('PNG export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const exportCsv = () => {
    download(new Blob([`﻿${pointsToCsv(series)}`], { type: 'text/csv;charset=utf-8;' }), 'tocki.csv');
  };

  if (points.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <header className="flex items-center gap-2">
        <LineChart className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('replot.title')}</h4>
        <span className="ml-auto text-[11px] text-slate-500">
          {t('replot.pointCount', { count: points.length })}
        </span>
      </header>

      <div ref={containerRef} className="bg-white rounded-xl overflow-hidden">
        <MathRenderer content={toJsxGraphBlock(script)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={exportSvg} className="h-8 text-xs font-bold rounded-lg">
          <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> SVG
        </Button>
        <Button size="sm" variant="outline" onClick={exportPng} disabled={isExporting} className="h-8 text-xs font-bold rounded-lg">
          <ImageDown className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> PNG
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 text-xs font-bold rounded-lg">
          <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> CSV
        </Button>
      </div>

      {!expression && (
        <p className="text-[11px] text-slate-500">{t('replot.noCurve')}</p>
      )}
    </section>
  );
};
