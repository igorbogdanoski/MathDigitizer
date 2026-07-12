import React, { useState } from 'react';
import { MathTask } from '../../lib/schema';
import { Card, CardContent } from '../ui/Card';
import { GripVertical, Check, Trash2, Edit3, Copy } from 'lucide-react';

import { MathRenderer } from '../MathRenderer';

interface TaskCardProps {
  task: MathTask;
  taskId: string;
  isSelected: boolean;
  isDeleting: boolean;
  isSelectionMode: boolean;
  isSelectedForTest: boolean;
  onSelect: () => void;
  onToggleSelection: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  renderDetailContent?: () => React.ReactNode;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  taskId,
  isSelected,
  isDeleting,
  isSelectionMode,
  isSelectedForTest,
  onSelect,
  onToggleSelection,
  onDelete,
  onEdit,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  renderDetailContent
}) => {
  const [latexCopied, setLatexCopied] = useState(false);

  const handleCopyLatex = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = task.latex_formulas?.length
      ? task.latex_formulas.map(f => `$$${f}$$`).join('\n\n')
      : task.original_text;
    navigator.clipboard.writeText(text);
    setLatexCopied(true);
    setTimeout(() => setLatexCopied(false), 2000);
  };

  return (
    <Card
      draggable
      data-testid={`task-card-${taskId}`}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`overflow-hidden border-slate-200 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl transition-all duration-300 cursor-pointer rounded-2xl ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 dark:border-indigo-400/60 shadow-lg shadow-indigo-900/10 dark:shadow-indigo-500/10' : 'hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-400/40 shadow-sm'} ${isDeleting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
      onClick={onSelect}
    >
      <div className="bg-slate-50/80 dark:bg-white/5 px-5 py-4 border-b border-slate-100 dark:border-white/10 flex justify-between items-start backdrop-blur-sm">
        <div className="flex gap-4 items-start">
          <div className="mt-0.5 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors">
            <GripVertical className="w-5 h-5" />
          </div>
          {isSelectionMode && (
            <div
              data-testid={`task-select-${taskId}`}
              onClick={onToggleSelection}
              className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                isSelectedForTest
                  ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              {isSelectedForTest && <Check className="w-4 h-4 text-white" />}
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <span className="font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-tight line-clamp-2 pr-6">
              {task.type === 'theory' ? `Теорија: ${task.title}` : task.title}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {task.type === 'theory' && (
                <span className="text-[9px] font-medium uppercase tracking-wider bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
                  Теорија
                </span>
              )}
              {task.tags?.slice(0, 2).map((tag, i) => (
                <span key={i} className="text-[9px] font-medium uppercase tracking-wider bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
              {task.tags && task.tags.length > 2 && (
                <span className="text-[9px] font-medium uppercase tracking-wider bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                  +{task.tags.length - 2}
                </span>
              )}
              <span className={`text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                task.difficulty === 'easy' ? 'bg-green-100 dark:bg-emerald-500/15 text-green-700 dark:text-emerald-300' :
                task.difficulty === 'medium' ? 'bg-yellow-100 dark:bg-amber-500/15 text-yellow-700 dark:text-amber-300' :
                'bg-red-100 dark:bg-rose-500/15 text-red-700 dark:text-rose-300'
              }`}>
                {task.difficulty}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleCopyLatex}
            className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${latexCopied ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}
            title="Копирај LaTeX"
          >
            {latexCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            data-testid={`task-edit-${taskId}`}
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors flex-shrink-0"
            title="Уреди задача"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            data-testid={`task-delete-${taskId}`}
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-rose-500/10 rounded-md transition-colors flex-shrink-0"
            title="Избриши задача"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile inline detail or Desktop full view when not selected */}
      {(!isSelected || (isSelected && window.innerWidth < 1024)) && (
        <CardContent className="p-4">
          {isSelected && renderDetailContent ? (
            renderDetailContent()
          ) : (
            <div className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3">
              <MathRenderer content={task.original_text} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
