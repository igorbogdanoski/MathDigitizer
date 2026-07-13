import React from 'react';
import { Link } from 'react-router-dom';
import { Wand2, Library as LibraryIcon, Factory, ChevronRight } from 'lucide-react';

const WORKFLOW_STEPS = [
  { key: 'extract', path: '/extract', label: 'Екстракција', icon: Wand2 },
  { key: 'library', path: '/library', label: 'Библиотека', icon: LibraryIcon },
  { key: 'factory', path: '/factory', label: 'Фабрика', icon: Factory },
] as const;

interface WorkflowStepsProps {
  current: (typeof WORKFLOW_STEPS)[number]['key'];
}

/**
 * Small "where am I in the workflow" indicator for the core
 * Екстракција → Библиотека → Фабрика pipeline that the marketing copy on
 * Home.tsx already promises — surfaced inside the app itself so the
 * narrative is reinforced while teachers are actually using it.
 */
export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ current }) => {
  const currentIndex = WORKFLOW_STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="Работен тек" className="flex items-center gap-1 text-sm overflow-x-auto no-scrollbar">
      {WORKFLOW_STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex;
        return (
          <React.Fragment key={step.key}>
            {index > 0 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}
            <Link
              to={step.path}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors shrink-0 ${
                isCurrent
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDone
                    ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {step.label}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
