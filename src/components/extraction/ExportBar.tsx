import React from 'react';
import { Button } from '../ui/Button';
import { MathTask } from '../../lib/schema';
import { exportToJson, exportToLatex, exportToMarkdown, exportToTxt } from '../../lib/export';

interface ExportBarProps {
  tasks: MathTask[];
}

export const ExportBar: React.FC<ExportBarProps> = ({ tasks }) => {
  return (
    <div className="flex flex-wrap gap-2 shrink-0 max-w-sm justify-end">
      <span className="w-full text-right text-xs font-bold text-slate-400 mb-1">Експорт Опции:</span>
      <Button variant="outline" onClick={() => exportToMarkdown(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
        Markdown
      </Button>
      <Button variant="outline" onClick={() => exportToLatex(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
        LaTeX
      </Button>
      <Button variant="outline" onClick={() => window.print()} className="bg-slate-900 border-slate-800 hover:bg-slate-800 text-white shadow-sm text-xs h-8 px-3">
        A4 PDF
      </Button>
      <Button variant="outline" onClick={() => exportToTxt(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
        TXT
      </Button>
      <Button variant="outline" onClick={() => exportToJson(tasks)} className="bg-white border-slate-200 hover:border-slate-300 shadow-sm text-xs h-8 px-3">
        JSON
      </Button>
    </div>
  );
};
