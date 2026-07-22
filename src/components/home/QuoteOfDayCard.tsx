import React from 'react';
import { BrainCircuit, Quote, Play, Square } from 'lucide-react';
import { Button } from '../ui/Button';
import type { MathQuote } from './constants';

interface QuoteOfDayCardProps {
  quoteOfDay: MathQuote;
  isPlaying: boolean;
  isGeneratingAudio: boolean;
  onPlayQuote: () => void;
}

export const QuoteOfDayCard: React.FC<QuoteOfDayCardProps> = ({
  quoteOfDay,
  isPlaying,
  isGeneratingAudio,
  onPlayQuote,
}) => {
  return (
    <section className="max-w-5xl mx-auto px-6 mb-16">
      <div className="relative p-10 md:p-14 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-indigo-950/40 dark:to-blue-900/20 rounded-6xl shadow-inner border border-blue-100 dark:border-indigo-500/20 overflow-hidden group hover:shadow-lg transition-all duration-300">
        <Quote className="absolute top-10 right-10 w-32 h-32 text-blue-200 dark:text-blue-500/10 opacity-50 transform -rotate-12 group-hover:scale-110 transition-transform duration-700" />

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-sm font-black tracking-widest text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-2">
              <BrainCircuit className="w-5 h-5" />
              Едукативна Мисла
            </h3>
            <Button
              variant="outline"
              onClick={onPlayQuote}
              disabled={isGeneratingAudio}
              className="rounded-full w-12 h-12 p-0 flex items-center justify-center bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-500/30 shadow-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white transition-all duration-300"
              title={isPlaying ? "Стопирај" : "Слушни аудио"}
            >
              {isGeneratingAudio ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : isPlaying ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 ml-1 fill-current" />
              )}
            </Button>
          </div>
          <blockquote className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 leading-snug mb-8 tracking-tight transition-colors duration-300">
            "{quoteOfDay.text}"
          </blockquote>
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 px-5 py-2.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 inline-block font-semibold text-slate-700 dark:text-slate-300 transition-colors duration-300">
              — {quoteOfDay.author}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
