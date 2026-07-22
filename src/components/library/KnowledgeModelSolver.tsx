import React, { useState } from 'react';
import { generateHybridMathSolution, KnowledgeModelResponse } from '../../lib/knowledgeModel';
import { BrainCircuit, Loader2, Sparkles, CheckCircle2, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useTranslation } from 'react-i18next';

interface Props {
  initialProblem?: string;
}

export function KnowledgeModelSolver({ initialProblem = '' }: Props) {
  const { t } = useTranslation('library');
  const tasks = useLibraryStore((state) => state.tasks);
  const [problemText, setProblemText] = useState(initialProblem);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<KnowledgeModelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!problemText.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await generateHybridMathSolution(problemText, {
        strategy: 'hybrid',
        retrievalTasks: tasks
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full max-h-[800px]">
      <div className="p-4 bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex items-center gap-3">
        <BrainCircuit className="w-6 h-6 text-indigo-300" />
        <div>
          <h2 className="font-bold text-lg leading-tight">{t('knowledgeModelTitle')}</h2>
          <p className="text-xs text-indigo-200">{t('knowledgeModelSubtitle')}</p>
        </div>
      </div>

      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('mathProblemLabel')}</label>
        <textarea
          value={problemText}
          onChange={(e) => setProblemText(e.target.value)}
          placeholder={t('mathProblemPlaceholder')}
          className="w-full min-h-[100px] p-3 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-y bg-white"
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !problemText.trim()}
          className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t('generatingHybridModel')}</>
          ) : (
            <><Sparkles className="w-4 h-4" /> {t('analyzeAndSolve')}</>
          )}
        </button>
        {error && <p className="mt-2 text-sm text-red-600 font-medium">{t('errorLabel', { message: error })}</p>}
      </div>

      {result && (
        <div className="p-0 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="p-4 sm:p-6 space-y-8">
            
            {/* Tree of Thoughts Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">1</div>
                <h3 className="font-bold text-slate-800 text-lg tracking-tight">{t('treeOfThoughtsTitle')}</h3>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                {[result.tree_of_thoughts.path_1, result.tree_of_thoughts.path_2, result.tree_of_thoughts.path_3].map((path, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                    <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      P{i+1}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{path}</ReactMarkdown></p>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">{t('criticalEvaluation')}</h4>
                <p className="text-sm text-amber-900 leading-relaxed font-medium"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{result.tree_of_thoughts.evaluation}</ReactMarkdown></p>
                <div className="mt-3 flex items-center gap-2 text-emerald-700 bg-emerald-100/50 px-3 py-1.5 rounded-md w-fit">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold">{t('chosenPath', { path: result.tree_of_thoughts.chosen_path })}</span>
                </div>
              </div>
            </div>

            {/* Chain of Thought Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">2</div>
                <h3 className="font-bold text-slate-800 text-lg tracking-tight">{t('chainOfThoughtTitle')}</h3>
              </div>
              <div className="bg-white border-l-4 border-indigo-500 p-4 rounded-r-xl shadow-sm">
                <p className="text-sm text-slate-700 leading-relaxed"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{result.chain_of_thought_explanation}</ReactMarkdown></p>
              </div>
            </div>

            {/* Solution Steps */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">3</div>
                <h3 className="font-bold text-slate-800 text-lg tracking-tight">{t('stepByStepSolution')}</h3>
              </div>
              <div className="space-y-3">
                {result.solution_steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">
                      {idx + 1}
                    </span>
                    <div className="text-slate-800 leading-relaxed break-words overflow-x-auto print-math">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {step}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags & Metadata */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                {t('csvDok')}: {result.metadata.dok_level}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                {result.metadata.grade_level}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                {result.metadata.curriculum_topic}
              </span>
              {result.metadata.tags.map(t => (
                <span key={t} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                  #{t}
                </span>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
