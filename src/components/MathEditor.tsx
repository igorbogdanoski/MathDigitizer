import React, { useRef, useEffect, useState } from 'react';

const MATHLIVE_CDN_URL = 'https://cdn.jsdelivr.net/npm/mathlive@0.109.2/dist/mathlive.min.js';
let mathliveLoaderPromise: Promise<void> | null = null;

function ensureMathliveLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (customElements.get('math-field')) {
    return Promise.resolve();
  }

  if (mathliveLoaderPromise) {
    return mathliveLoaderPromise;
  }

  mathliveLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-mathlive-src="${MATHLIVE_CDN_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load MathLive script')));
      return;
    }

    const script = document.createElement('script');
    script.src = MATHLIVE_CDN_URL;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-mathlive-src', MATHLIVE_CDN_URL);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load MathLive script'));
    document.head.appendChild(script);
  });

  return mathliveLoaderPromise;
}

interface MathEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const MathEditor: React.FC<MathEditorProps> = ({ value, onChange, className }) => {
  const ref = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    ensureMathliveLoaded()
      .then(() => {
        if (mounted) setIsReady(true);
      })
      .catch((error) => {
        console.error('MathLive loader error:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const mf = ref.current;
    if (mf) {
      if (mf.value !== value) {
        mf.setValue(value, { suppressChangeNotifications: true });
      }
    }
  }, [isReady, value]);

  useEffect(() => {
    if (!isReady) return;
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
  }, [isReady, onChange]);

  return (
    <div className={`math-editor-container bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden ${className || ''}`}>
      {!isReady && (
        <div className="min-h-[60px] p-2 text-xs text-slate-500 flex items-center">Вчитување математички едитор...</div>
      )}
      <math-field 
        ref={ref} 
        className={`${isReady ? 'block' : 'hidden'} w-full min-h-[60px] p-2 outline-none border-0 bg-transparent text-inherit`}
      >
        {value}
      </math-field>
    </div>
  );
};
