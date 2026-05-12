import React, { useRef, useEffect } from 'react';
import 'mathlive';

interface MathEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const MathEditor: React.FC<MathEditorProps> = ({ value, onChange, className }) => {
  const ref = useRef<any>(null);

  useEffect(() => {
    const mf = ref.current;
    if (mf) {
      if (mf.value !== value) {
        mf.setValue(value, { suppressChangeNotifications: true });
      }
    }
  }, [value]);

  useEffect(() => {
    const mf = ref.current;
    if (mf) {
      const handleInput = (e: any) => {
        onChange(e.target.value);
      };
      mf.addEventListener('input', handleInput);
      return () => {
        mf.removeEventListener('input', handleInput);
      };
    }
  }, [onChange]);

  return (
    <div className={`math-editor-container bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden ${className || ''}`}>
      <math-field 
        ref={ref} 
        style={{ width: '100%', minHeight: '60px', padding: '8px', outline: 'none', border: 'none', background: 'transparent', color: 'inherit' }}
      >
        {value}
      </math-field>
    </div>
  );
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
