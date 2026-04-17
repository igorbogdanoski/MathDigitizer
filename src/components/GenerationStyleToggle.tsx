import React from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { BookOpen, Globe, Zap } from 'lucide-react';

export const GenerationStyleToggle: React.FC = () => {
  const { generationStyle, setGenerationStyle } = useLibraryStore();

  const styles = [
    { 
      id: 'traditional', 
      label: 'Традиционален', 
      icon: BookOpen, 
      color: 'blue',
      description: 'Академски пристап'
    },
    { 
      id: 'real-world', 
      label: 'Реален Свет', 
      icon: Globe, 
      color: 'emerald',
      description: 'Бизнис и секојдневие'
    },
    { 
      id: 'modern', 
      label: 'Гејминг/Модерен', 
      icon: Zap, 
      color: 'orange',
      description: 'Gen-Z контекст'
    }
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
        Стил на генерирање
      </label>
      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
        {styles.map((style) => {
          const Icon = style.icon;
          const isActive = generationStyle === style.id;
          
          return (
            <button
              key={style.id}
              onClick={() => setGenerationStyle(style.id)}
              className={`
                flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all relative group
                ${isActive 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md border border-slate-100 dark:border-slate-700' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }
              `}
            >
              <Icon className={`w-4 h-4 mb-1 transition-transform group-hover:scale-110 ${isActive ? `text-${style.color}-500` : ''}`} />
              <span className="text-[10px] font-bold whitespace-nowrap">{style.label}</span>
              {isActive && (
                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-${style.color}-500 animate-pulse`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
