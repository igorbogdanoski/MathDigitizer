import React from 'react';
import { Users, ChevronRight } from 'lucide-react';
import type { TFunction } from 'i18next';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { UserStats } from '../../lib/schema';

type LeaderboardEntry = UserStats & { displayName?: string; photoURL?: string };

interface LeaderboardPanelProps {
  leaderboard: LeaderboardEntry[];
  currentUid?: string | null;
  t: TFunction<'dashboard'>;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ leaderboard, currentUid, t }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <Users className="w-6 h-6 text-blue-600" />
        {t('leaderboard')}
      </h3>
      <Card className="border-slate-200 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl overflow-hidden">
        <div className="bg-slate-50 dark:bg-white/5 p-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span>{t('rankUser')}</span>
            <span>XP</span>
          </div>
        </div>
        <CardContent className="p-0">
          {leaderboard.map((leader, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/10 last:border-0 ${
                leader.uid === currentUid ? 'bg-blue-50/50 dark:bg-blue-500/10' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-yellow-400 text-white' :
                  idx === 1 ? 'bg-slate-300 text-white' :
                  idx === 2 ? 'bg-orange-400 text-white' :
                  'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                    {leader.photoURL ? (
                      <img src={leader.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {leader.displayName?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                    {leader.uid === currentUid ? t('you') : (leader.displayName || t('user'))}
                  </div>
                </div>
              </div>
              <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                {leader.xp.toLocaleString()}
              </div>
            </div>
          ))}
        </CardContent>
        <div className="p-4 bg-slate-50 dark:bg-white/5 text-center">
          <Button variant="ghost" size="sm" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            {t('viewFullLeaderboard')} <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </Card>
    </div>
  );
};
