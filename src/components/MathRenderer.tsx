import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// katex.min.css loaded from CDN in index.html — avoids bundling CSS into JS chunks
import { Copy, Check, Info, Loader2, X } from 'lucide-react';
import { explainFormula } from '../lib/gemini';
import { VisualMathCanvas } from './VisualMathCanvas';
import { AlgebraTilesCanvas } from './AlgebraTilesCanvas';
import { GeometryWorkspace } from './GeometryWorkspace';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

// AI-generated LaTeX occasionally comes back with a handful of predictable
// slips — an unclosed \left/\right pair, an odd number of braces, a bare
// backslash at the end of a line. None of these are fixable in general, but
// these specific patterns are common enough (and safe enough to auto-close)
// that fixing them here means the difference between "renders correctly"
// and "shows a raw KaTeX error" for a meaningful share of real content.
function sanitizeLatex(source: string): string {
  let text = source;

  // Balance curly braces within each math segment ($...$, $$...$$, \(...\),
  // \[...\]) by appending any missing closing braces at the end of the
  // segment — far better than leaving KaTeX to fail on the whole formula.
  const mathSegmentPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;
  text = text.replace(mathSegmentPattern, (segment) => {
    let opens = 0;
    for (const ch of segment) {
      if (ch === '{') opens++;
      else if (ch === '}') opens--;
    }
    if (opens > 0) {
      // Insert missing closing braces just before the segment's own closing
      // delimiter, not after it.
      const closingDelimMatch = segment.match(/(\$\$|\$|\\\)|\\\])$/);
      const closingDelim = closingDelimMatch ? closingDelimMatch[0] : '';
      const body = closingDelim ? segment.slice(0, -closingDelim.length) : segment;
      return body + '}'.repeat(opens) + closingDelim;
    }
    return segment;
  });

  // \left...\right must be paired; an unmatched \left with no \right at all
  // in the same segment makes KaTeX refuse to render anything after it.
  text = text.replace(mathSegmentPattern, (segment) => {
    const leftCount = (segment.match(/\\left(?![a-zA-Z])/g) || []).length;
    const rightCount = (segment.match(/\\right(?![a-zA-Z])/g) || []).length;
    if (leftCount > rightCount) {
      const closingDelimMatch = segment.match(/(\$\$|\$|\\\)|\\\])$/);
      const closingDelim = closingDelimMatch ? closingDelimMatch[0] : '';
      const body = closingDelim ? segment.slice(0, -closingDelim.length) : segment;
      return body + ' \\right.'.repeat(leftCount - rightCount) + closingDelim;
    }
    return segment;
  });

  // Normalize common AI mistakes
  text = text
    // Fix double subscripts/superscripts: x_1_2 → x_{12}
    .replace(/([a-zA-Z])_(\d)_(\d)/g, '$1_{$2$3}')
    // Fix missing braces in fractions: \frac12 → \frac{1}{2}
    .replace(/\\frac(\d)(\d)/g, '\\frac{$1}{$2}')
    // Fix \sqrt without braces: \sqrt2 → \sqrt{2}
    .replace(/\\sqrt(\d+)/g, '\\sqrt{$1}')
    // Normalize \cdot vs \times (prefer \cdot for multiplication)
    .replace(/\\times(?=\s*\d)/g, '\\cdot')
    // Fix missing \ in common commands
    .replace(/(?<![\\])sin(?=\s*[\(\{])/g, '\\sin')
    .replace(/(?<![\\])cos(?=\s*[\(\{])/g, '\\cos')
    .replace(/(?<![\\])tan(?=\s*[\(\{])/g, '\\tan')
    .replace(/(?<![\\])log(?=\s*[\(\{])/g, '\\log')
    .replace(/(?<![\\])ln(?=\s*[\(\{])/g, '\\ln')
    // Fix double equals: x==5 → x=5
    .replace(/==/g, '=')
    // Fix missing spaces around equals in display math
    .replace(/\$\$([^$]+)\$\$/g, (match, content) => {
      // Add proper spacing around = in aligned environments
      const aligned = content.replace(/([^=\s])=([^=\s])/g, '$1 &= $2');
      return `$$${aligned}$$`;
    });

  return text;
}

// Convert long equations to aligned environment for better readability
function normalizeLongEquation(latex: string): string {
  // If the equation is very long and contains multiple = signs,
  // convert to aligned environment
  const equalsCount = (latex.match(/=/g) || []).length;
  const isLong = latex.length > 100;

  if (equalsCount >= 2 && isLong && !latex.includes('\\begin{aligned}')) {
    // Split by = and create aligned environment
    const parts = latex.split('=').map(p => p.trim());
    if (parts.length >= 3) {
      const aligned = parts.map((part, i) => {
        if (i === 0) return part;
        return `&= ${part}`;
      }).join(' \\\\\n');
      return `\\begin{aligned}\n${aligned}\n\\end{aligned}`;
    }
  }

  return latex;
}

// Never throw on unrecoverable LaTeX: render a subdued inline error span
// (styled in index.css via .katex-error) instead of taking down whatever
// component happens to be hosting this content.
const REHYPE_KATEX_OPTIONS = { throwOnError: false, errorColor: '#94a3b8', strict: false } as const;

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className, inline }) => {
  const { t } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ formula: string, text: string, isLoading: boolean } | null>(null);

  const sanitizedContent = useMemo(() => sanitizeLatex(content), [content]);

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
        rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}
        components={components}
      >
        {sanitizedContent}
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
            <button onClick={() => setExplanation(null)} aria-label={t('ariaClose')} title={t('ariaClose')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}>
                {sanitizeLatex(explanation.text)}
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
