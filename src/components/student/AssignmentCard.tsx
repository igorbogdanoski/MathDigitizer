import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Clock, BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { Assignment, MathTask } from '../../lib/schema';

interface AssignmentCardProps {
  assignment: Assignment;
  tasks: MathTask[];
  completedTaskIds: Set<string>;
  onSolveTask: (task: MathTask, assignmentId: string) => void;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  tasks,
  completedTaskIds,
  onSolveTask,
}) => {
  const [expanded, setExpanded] = useState(true);

  const completedCount = tasks.filter(t => completedTaskIds.has(t.id!)).length;
  const total = tasks.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const allDone = completedCount === total && total > 0;

  const dueDate = new Date(assignment.dueDate);
  const isPastDue = dueDate < new Date() && !allDone;
  const dueDateLabel = dueDate.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div
        className="p-5 flex items-start justify-between cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800 text-base truncate">{assignment.title}</h3>
            {allDone ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Завршено</span>
            ) : completedCount > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Во тек</span>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Незапочнато</span>
            )}
            <span className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full ${isPastDue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              <Clock className="w-3 h-3" />
              {dueDateLabel}
            </span>
          </div>
          {assignment.description && (
            <p className="text-sm text-slate-500 mt-1 truncate">{assignment.description}</p>
          )}
        </div>
        <div className="ml-3 flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-slate-500">{completedCount}/{total}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-2">
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      {expanded && (
        <div className="px-5 pb-5 space-y-2 mt-2">
          {tasks.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
              <BookOpen className="w-4 h-4" />
              <span>Нема задачи во ова задание.</span>
            </div>
          ) : (
            tasks.map((task, i) => {
              const done = completedTaskIds.has(task.id!);
              return (
                <div
                  key={task.id ?? i}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                    done
                      ? 'bg-emerald-50 border-emerald-100'
                      : 'bg-slate-50 border-slate-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className={`text-sm font-medium truncate ${done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {task.title}
                    </span>
                    {task.difficulty && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        task.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        task.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {task.difficulty === 'easy' ? 'Лесна' : task.difficulty === 'medium' ? 'Средна' : 'Тешка'}
                      </span>
                    )}
                  </div>
                  {done ? (
                    <span className="text-xs text-emerald-600 font-semibold shrink-0">Решено ✓</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs"
                      onClick={() => onSolveTask(task, assignment.id!)}
                    >
                      Реши
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </motion.div>
  );
};
