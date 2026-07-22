import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  MessageSquare, Zap, Layers, BookOpen,
  Loader2, RefreshCw, Check, Save
} from 'lucide-react';
import { MathTask, LessonArchitectScript } from '../../lib/schema';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

interface LessonArchitectTabProps {
  task: MathTask | undefined;
  lessonScript: LessonArchitectScript | null;
  isGeneratingScript: boolean;
  isSavingScript: boolean;
  scriptSaved: boolean;
  onGenerate: () => void;
  onSave: () => void;
}

export const LessonArchitectTab: React.FC<LessonArchitectTabProps> = ({
  task,
  lessonScript,
  isGeneratingScript,
  isSavingScript,
  scriptSaved,
  onGenerate,
  onSave,
}) => {
  const { t } = useTranslation('pedagogue');
  return (
    <motion.div
      key="architect"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full p-8 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">{t('architect.title')}</h2>
            <p className="text-slate-400">{t('architect.description')}</p>
          </div>
          {task && (
            <Button
              onClick={onGenerate}
              disabled={isGeneratingScript || !task}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            >
              {isGeneratingScript ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {lessonScript ? t('architect.regenerate') : t('architect.generateScript')}
            </Button>
          )}
        </header>

        {!task ? (
          <div className="text-center py-24 opacity-50">
            <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-sm uppercase tracking-widest">{t('architect.selectTask')}</p>
          </div>
        ) : !lessonScript ? (
          <div className="text-center py-24">
            {isGeneratingScript ? (
              <>
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
                <p className="text-slate-400 text-sm">{t('architect.composing')}</p>
              </>
            ) : (
              <p className="text-slate-500 text-sm">{t('architect.clickToGenerate')}</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-slate-100">{t('architect.socraticHook')}</h3>
                  </div>
                  <p className="text-sm text-slate-400 italic">"{lessonScript.socratic_hook}"</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-slate-100">{t('architect.metaphoricBridge')}</h3>
                  </div>
                  <p className="text-sm text-slate-400">{lessonScript.metaphoric_bridge}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">{t('architect.instructionalSequence')}</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={isSavingScript || !task?.id}
                className="border-slate-700 text-slate-300"
              >
                {isSavingScript ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : scriptSaved ? <Check className="w-4 h-4 mr-2 text-emerald-400" /> : <Save className="w-4 h-4 mr-2" />}
                {scriptSaved ? t('architect.saved') : t('architect.saveScript')}
              </Button>
            </div>

            <div className="space-y-6">
              {lessonScript.instructional_sequence.map((step, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-mono text-slate-400 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-colors">
                      {i + 1}
                    </div>
                    <div className="flex-1 w-px bg-slate-800 group-last:bg-transparent my-2" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1 rounded">{step.time}</span>
                      <h4 className="text-sm font-bold text-slate-200">{step.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
