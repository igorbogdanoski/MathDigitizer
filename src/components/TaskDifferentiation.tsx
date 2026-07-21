import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers, Lightbulb, CheckCircle2, Clock, BookOpen,
  ChevronDown, ChevronUp, Sparkles, Target, TrendingUp
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { MathRenderer } from './MathRenderer';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { generateDifferentiatedTask } from '../lib/gemini';
import type { MathTask, DifferentiationResult, DifferentiationLevel } from '../lib/schema';

// ─── Level Config ────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<DifferentiationLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  description: string;
}> = {
  support: {
    label: 'Support',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: <Lightbulb className="w-5 h-5" />,
    description: 'За ученици кои имаат потешкотии',
  },
  core: {
    label: 'Core',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: <Target className="w-5 h-5" />,
    description: 'Стандардно ниво',
  },
  extension: {
    label: 'Extension',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'За напредни ученици',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface TaskDifferentiationProps {
  task?: MathTask;
}

export const TaskDifferentiation: React.FC<TaskDifferentiationProps> = ({ task: propTask }) => {
  const { t } = useTranslation(['differentiation', 'common']);
  const { tasks } = useLibraryStore();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [selectedTask, setSelectedTask] = useState<MathTask | null>(propTask || null);
  const [result, setResult] = useState<DifferentiationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<DifferentiationLevel | null>(null);
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.original_text.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(t => t.type !== 'theory');

  const handleGenerate = async () => {
    if (!selectedTask) {
      showToast('Изберете задача прво', 'error');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const differentiationResult = await generateDifferentiatedTask(selectedTask, {
        generateSupport: true,
        generateExtension: true,
        includeHints: true,
        includeScaffolding: true,
        language: 'mk',
      });
      setResult(differentiationResult);
      showToast('Диференцијацијата е генерирана', 'success');
    } catch (error) {
      console.error('Differentiation error:', error);
      showToast('Грешка при генерирање', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleHint = (level: DifferentiationLevel, hintLevel: number) => {
    const key = `${level}-${hintLevel}`;
    setShowHints(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderHints = (level: DifferentiationLevel, hints: { level1: string; level2: string; level3: string }) => {
    const hintLevels = [
      { num: 1, label: 'Насока', text: hints.level1 },
      { num: 2, label: 'Прв чекор', text: hints.level2 },
      { num: 3, label: 'Речиси решение', text: hints.level3 },
    ];

    return (
      <div className="space-y-2 mt-3">
        {hintLevels.map(hint => (
          <div key={hint.num} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleHint(level, hint.num)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>💡 {hint.label}</span>
              {showHints[`${level}-${hint.num}`] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {showHints[`${level}-${hint.num}`] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50"
                >
                  {hint.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    );
  };

  const renderScaffolding = (scaffolding: string[]) => {
    if (scaffolding.length === 0) return null;

    return (
      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Scaffolding (Чекор-по-чекор)
        </h4>
        <ol className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {scaffolding.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-slate-400">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  };

  const renderLevelCard = (level: DifferentiationLevel) => {
    if (!result) return null;

    const config = LEVEL_CONFIG[level];
    const variant = result.variants[level];
    const isExpanded = expandedLevel === level;

    return (
      <motion.div
        layout
        className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden`}
      >
        <button
          onClick={() => setExpandedLevel(isExpanded ? null : level)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <div className={config.color}>{config.icon}</div>
            <div className="text-left">
              <h3 className={`font-bold ${config.color}`}>{config.label}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {variant.estimatedTime} мин
            </span>
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4"
            >
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                  {variant.task.title}
                </h4>
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
                  <MathRenderer content={variant.task.original_text} />
                </div>

                {variant.task.solution_steps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Решение:
                    </h5>
                    <ol className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      {variant.task.solution_steps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-slate-400">{i + 1}.</span>
                          <MathRenderer content={step} inline />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {renderScaffolding(variant.scaffolding)}
                {renderHints(level, variant.hints)}

                {variant.successCriteria.length > 0 && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Критериуми за успех
                    </h4>
                    <ul className="space-y-1 text-sm text-green-600 dark:text-green-400">
                      {variant.successCriteria.map((criterion, i) => (
                        <li key={i} className="flex gap-2">
                          <span>✓</span>
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {variant.prerequisites.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {variant.prerequisites.map((prereq, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full"
                      >
                        {prereq}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Layers className="w-8 h-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('title', 'Диференцијација на задачи')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {t('subtitle', 'Генерирај 3 нивоа: Support, Core, Extension')}
          </p>
        </div>
      </div>

      {/* Task Selection */}
      {!propTask && (
        <Card>
          <CardContent className="p-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder', 'Пребарај задача...')}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white mb-3"
            />
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTask?.id === task.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="font-medium text-slate-900 dark:text-white">{task.title}</p>
                  <p className="text-sm text-slate-500 line-clamp-1">{task.original_text}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedTask}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 px-8 py-3"
        >
          {isGenerating ? (
            <>
              <Sparkles className="w-5 h-5 animate-spin" />
              {t('generating', 'Се генерира...')}
            </>
          ) : (
            <>
              <Layers className="w-5 h-5" />
              {t('generate', 'Генерирај диференцијација')}
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Pedagogical Notes */}
          <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
            <CardContent className="p-4">
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Педагошки белешки
              </h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {result.pedagogicalNotes}
              </p>
              <div className="flex gap-4 mt-3 text-sm text-indigo-600 dark:text-indigo-400">
                <span>Bloom: {result.bloomLevel}</span>
                <span>DOK: {result.dokLevel}</span>
              </div>
            </CardContent>
          </Card>

          {/* Level Cards */}
          {(['support', 'core', 'extension'] as DifferentiationLevel[]).map(level =>
            renderLevelCard(level)
          )}
        </div>
      )}
    </div>
  );
};
