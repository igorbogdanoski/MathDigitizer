import React from 'react';
import { Target, CheckCircle2, Circle } from 'lucide-react';
import type { TFunction } from 'i18next';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { UserStats } from '../../lib/schema';

interface DailyQuestsSectionProps {
  stats: UserStats;
  t: TFunction<'dashboard'>;
}

export const DailyQuestsSection: React.FC<DailyQuestsSectionProps> = ({ stats, t }) => {
  return (
    <Card className="border-slate-200 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          {t('dailyQuests')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {stats.quests && stats.quests.date === new Date().toISOString().split('T')[0] ? (
          <div className="space-y-4">
            {stats.quests.items.map((quest) => (
              <div key={quest.id} className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quest.completed ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
                      {quest.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </div>
                    <span className={`font-semibold ${quest.completed ? 'text-slate-900 dark:text-white line-through opacity-70' : 'text-slate-900 dark:text-white'}`}>
                      {quest.title}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md">
                    +{quest.xpReward} XP
                  </span>
                </div>
                <div className="pl-11">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{t('progress')}</span>
                    <span>{quest.progress} / {quest.target}</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(quest.progress / quest.target) * 100}%` }}
                      className={`h-full ${quest.completed ? 'bg-emerald-500' : 'bg-orange-500'}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>{t('questsRefreshing')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
