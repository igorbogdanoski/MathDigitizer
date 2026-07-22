import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Loader2, Sparkles } from 'lucide-react';

interface ExtractionProgressProps {
  statusText: string;
  progress: number;
}

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({ statusText, progress }) => {
  const { t } = useTranslation('extraction');
  return (
    <div className="mt-8 bg-white/5 rounded-3xl p-6 md:p-8 border border-white/10 backdrop-blur-xl text-left animate-in fade-in shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Sparkles className="w-32 h-32 text-indigo-300 animate-pulse" />
      </div>

      <h3 className="text-white font-bold text-xl mb-6 flex items-center">
         <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center mr-3">
           <Loader2 className="w-4 h-4 text-indigo-300 animate-spin" />
         </div>
         {t('progressAnalyzingAi')}
      </h3>

      <div className="flex justify-between text-sm text-indigo-200 font-medium mb-3">
        <span className="flex items-center">{statusText}</span>
        <span className="font-mono text-indigo-300">{progress}%</span>
      </div>

      <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5 shadow-inner">
        <motion.div
          className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 h-full rounded-full transition-all duration-700 ease-out relative"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 w-full animate-pulse"></div>
        </motion.div>
      </div>

      <p className="mt-6 text-indigo-300/80 text-xs md:text-sm leading-relaxed max-w-2xl">
        {t('progressAnalyzingDescription')}
      </p>
    </div>
  );
};
