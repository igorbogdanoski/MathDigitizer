import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Copy, Check, Info, Loader2, X } from 'lucide-react';
import { explainFormula } from '../lib/gemini';
import { VisualMathCanvas } from './VisualMathCanvas';
import { AlgebraTilesCanvas } from './AlgebraTilesCanvas';
import { GeometryWorkspace } from './live/GeometryWorkspace';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className, inline }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ formula: string, text: string, isLoading: boolean } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const handleMathClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const katexElement = target.closest('.katex');
      
      if (katexElement) {
        e.stopPropagation();
        // Try to find the LaTeX source in the annotation tag
        const annotation = katexElement.querySelector('annotation[encoding="application/x-tex"]');
        const formula = annotation?.textContent || '';
        
        if (formula) {
           const isDisplay = katexElement.classList.contains('katex-display');
           const fullFormula = isDisplay ? `$$${formula}$$` : `$${formula}$`;
           
           navigator.clipboard.writeText(fullFormula);
           setCopiedFormula(fullFormula);
           
           // Visual feedback on the element
           const originalBg = (katexElement as HTMLElement).style.backgroundColor;
           (katexElement as HTMLElement).style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
           setTimeout(() => {
             (katexElement as HTMLElement).style.backgroundColor = originalBg;
           }, 500);
           
           setTimeout(() => setCopiedFormula(null), 2000);

           // Fetch explanation
           setExplanation({ formula: fullFormula, text: '', isLoading: true });
           try {
             const expText = await explainFormula(formula);
             setExplanation({ formula: fullFormula, text: expText, isLoading: false });
           } catch (err) {
             setExplanation({ formula: fullFormula, text: 'Грешка при вчитување на објаснувањето.', isLoading: false });
           }
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleMathClick);
    
    // Add hover styles to math elements
    const katexElements = container.querySelectorAll('.katex');
    katexElements.forEach((el) => {
      (el as HTMLElement).style.cursor = 'pointer';
      (el as HTMLElement).title = 'Кликни за да копираш и да добиеш објаснување';
    });

    return () => {
      container.removeEventListener('click', handleMathClick);
    };
  }, [content]);

  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+|-)/.exec(className || "");
      const lang = match ? match[1] : "";
      
      if (!inline && lang === "math-plot") {
        return <VisualMathCanvas jsonConfig={String(children).replace(/\n$/, "")} />;
      }
      
      if (!inline && lang === "algebra-tiles") {
        return <AlgebraTilesCanvas jsonConfig={String(children).replace(/\n$/, "")} />;
      }

      if (!inline && lang === "jsxgraph") {
        return <GeometryWorkspace scriptCode={String(children).replace(/\n$/, "")} />;
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative ${inline ? 'inline-block' : 'prose prose-slate max-w-none dark:prose-invert'} ${className || ''}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
      
      {copiedFormula && !explanation && (
        <div className="fixed bottom-4 right-4 bg-slate-900/90 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 z-[100] border border-slate-700 backdrop-blur-sm max-w-md">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Копирано во клипборд</span>
            <span className="text-sm font-mono truncate max-w-[250px]">{copiedFormula}</span>
          </div>
        </div>
      )}

      {explanation && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-4 rounded-xl shadow-2xl flex flex-col gap-3 animate-in slide-in-from-bottom-4 z-[100] border border-slate-200 dark:border-slate-700 max-w-md w-full">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-bold">Објаснување на формула</span>
            </div>
            <button onClick={() => setExplanation(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700 overflow-x-auto">
            {explanation.formula}
          </div>
          <div className="text-sm leading-relaxed max-h-[200px] overflow-y-auto">
            {explanation.isLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Се генерира објаснување...</span>
              </div>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {explanation.text}
              </ReactMarkdown>
            )}
          </div>
          {copiedFormula && (
            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
              <Check className="w-3 h-3" /> Формулата е копирана во клипборд
            </div>
          )}
        </div>
      )}
    </div>
  );
};
