import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  Brain, Microscope, Loader2, RefreshCw, Play, User
} from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { Button } from '../ui/Button';
import { SimMessage, SIM_PERSONAS } from './types';

interface SocraticSimulationTabProps {
  task: MathTask | undefined;
  simPersona: string;
  simMessages: SimMessage[];
  simInput: string;
  isSimLoading: boolean;
  simStarted: boolean;
  onPersonaChange: (persona: string) => void;
  onInputChange: (input: string) => void;
  onStartSimulation: () => void;
  onSendMessage: () => void;
}

export const SocraticSimulationTab: React.FC<SocraticSimulationTabProps> = ({
  task,
  simPersona,
  simMessages,
  simInput,
  isSimLoading,
  simStarted,
  onPersonaChange,
  onInputChange,
  onStartSimulation,
  onSendMessage,
}) => {
  const { t } = useTranslation('pedagogue');
  const simMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    simMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages]);

  return (
    <motion.div
      key="simulation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col p-8"
    >
      <div className="flex-1 bg-slate-950/50 rounded-7xl border border-slate-800/50 overflow-hidden flex flex-col shadow-inner">
        <header className="px-8 py-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${simStarted ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{t('simulation.socraticStudent')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">{t('simulation.persona')}</span>
              <select
                title={t('simulation.persona')}
                aria-label={t('simulation.persona')}
                value={simPersona}
                onChange={(e) => onPersonaChange(e.target.value)}
                disabled={isSimLoading}
                className="bg-slate-800 border-none text-[10px] text-slate-300 rounded px-2 py-1 outline-none"
              >
                {SIM_PERSONAS.map(p => <option key={p.id} value={p.id}>{t(p.labelKey)}</option>)}
              </select>
            </div>
            {simStarted && (
              <button
                onClick={onStartSimulation}
                disabled={isSimLoading}
                title={t('simulation.restartSimulation')}
                aria-label={t('simulation.restartSimulation')}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          {!task ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <Microscope className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-xs text-slate-500 uppercase tracking-widest">{t('simulation.selectTask')}</p>
            </div>
          ) : !simStarted ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <p className="text-slate-400 text-sm max-w-md">{t('simulation.practiceDescription')}</p>
              <Button onClick={onStartSimulation} disabled={isSimLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSimLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {t('simulation.startSimulation')}
              </Button>
            </div>
          ) : (
            <>
              {simMessages.map((msg, i) => (
                <div key={i} className={`flex gap-4 max-w-2xl ${msg.role === 'teacher' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'teacher' ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                    {msg.role === 'teacher' ? <User className="w-4 h-4 text-white" /> : <Brain className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div className={`rounded-2xl p-4 ${msg.role === 'teacher' ? 'bg-indigo-600 rounded-tr-none' : 'bg-slate-900 border border-slate-800 rounded-tl-none'}`}>
                    <p className={`text-sm ${msg.role === 'teacher' ? 'text-white' : 'text-slate-300'}`}>{msg.text}</p>
                  </div>
                </div>
              ))}
              {isSimLoading && (
                <div className="flex gap-4 max-w-2xl">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4">
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={simMessagesEndRef} />
            </>
          )}
        </div>

        <div className="p-6 bg-slate-900/80 backdrop-blur-md border-t border-slate-800">
          <div className="relative">
            <input
              value={simInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSendMessage(); } }}
              disabled={!simStarted || isSimLoading}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 transition-colors outline-none pr-12 disabled:opacity-40"
              placeholder={t('simulation.inputPlaceholder')}
            />
            <button
              onClick={onSendMessage}
              disabled={!simStarted || isSimLoading || !simInput.trim()}
              title={t('simulation.sendResponse')}
              aria-label={t('simulation.sendResponse')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              <Play className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center uppercase tracking-tighter">{t('simulation.inputHint')}</p>
        </div>
      </div>
    </motion.div>
  );
};
