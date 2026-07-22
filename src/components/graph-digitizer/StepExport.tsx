import React from 'react';
import {
  Download, Save, Loader2, Check, Copy, FileText,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { GraphAnalysis } from '../../lib/gemini';

interface StepExportProps {
  analysis: GraphAnalysis | null;
  onExportCSV: () => void;
  onCopyGeoGebra: () => void;
  onSaveToLibrary: () => void;
  copiedGeo: boolean;
  isSaving: boolean;
  savedId: string | null;
  buildGeoGebraCommands: () => string[];
  autoSave: boolean;
  setAutoSave: React.Dispatch<React.SetStateAction<boolean>>;
}

export const StepExport: React.FC<StepExportProps> = ({
  analysis, onExportCSV, onCopyGeoGebra, onSaveToLibrary,
  copiedGeo, isSaving, savedId, buildGeoGebraCommands, autoSave, setAutoSave,
}) => (
  <Card>
    <CardContent className="p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <Download className="w-4 h-4 text-indigo-500" /> Извоз на податоци
      </div>

      <Button variant="outline" className="w-full justify-start" onClick={onExportCSV}>
        <FileText className="w-4 h-4 mr-2 text-emerald-600" /> Извези CSV
      </Button>

      <Button variant="outline" className="w-full justify-start" onClick={onCopyGeoGebra}>
        {copiedGeo ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Copy className="w-4 h-4 mr-2 text-blue-600" />}
        {copiedGeo ? 'Копирано!' : 'GeoGebra команди'}
      </Button>

      {(analysis?.geogebra_commands?.length ?? 0) > 0 && (
        <div className="bg-slate-900 rounded-lg p-3 max-h-32 overflow-y-auto">
          {[...buildGeoGebraCommands(), ...(analysis?.geogebra_commands ?? [])].filter((c, i, arr) => arr.indexOf(c) === i).map((cmd, i) => (
            <p key={i} className="text-[11px] font-mono text-emerald-400">{cmd}</p>
          ))}
        </div>
      )}

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      {/* Auto-save option */}
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={autoSave}
          onChange={(e) => setAutoSave(e.target.checked)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        Автоматско зачувување по анализа
      </label>

      <Button className="w-full" onClick={onSaveToLibrary} disabled={isSaving || !!savedId}>
        {isSaving
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Зачувува...</>
          : savedId
            ? <><Check className="w-4 h-4 mr-2" /> Зачувано во Библиотека</>
            : <><Save className="w-4 h-4 mr-2" /> Зачувај во Библиотека</>}
      </Button>

      {savedId && (
        <p className="text-xs text-center text-emerald-600 dark:text-emerald-400">
          Задачата е достапна во твојата Библиотека.
        </p>
      )}
    </CardContent>
  </Card>
);
