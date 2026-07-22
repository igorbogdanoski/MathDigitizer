import React from 'react';
import { Paintbrush, Zap, Target } from 'lucide-react';
import type { TFunction } from 'i18next';
import { motion } from 'motion/react';
import { auth } from '../../lib/firebase';
import { UserStats, UserProfile } from '../../lib/schema';

interface XPLevelHeaderProps {
  stats: UserStats;
  userProfile?: UserProfile | null;
  onOpenAvatarShop: () => void;
  t: TFunction<'dashboard'>;
}

export const XPLevelHeader: React.FC<XPLevelHeaderProps> = ({
  stats,
  userProfile,
  onOpenAvatarShop,
  t,
}) => {
  const getLevelProgress = () => {
    const xpInCurrentLevel = stats.xp % 1000;
    return (xpInCurrentLevel / 1000) * 100;
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-8 shadow-xl">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner overflow-hidden cursor-pointer" onClick={onOpenAvatarShop}>
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black">{stats.level}</span>
              )}
            </div>
            <div
              className="absolute -bottom-2 -right-2 bg-indigo-500 rounded-full p-1.5 border border-white/30 cursor-pointer hover:bg-indigo-400 transition-colors shadow-lg"
              onClick={onOpenAvatarShop}
            >
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold">{t('level')} {stats.level}</h2>
              {userProfile && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white border border-white/30">
                  {String(userProfile.role) === 'teacher' ? t('teacher') : t('student')}
                </span>
              )}
            </div>
            <p className="text-indigo-100">{t('totalXp')} {stats.xp.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex-1 max-w-md">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{t('progressToLevel', { level: stats.level + 1 })}</span>
            <span>{stats.xp % 1000} / 1000 XP</span>
          </div>
          <div className="h-4 bg-black/20 rounded-full overflow-hidden border border-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getLevelProgress()}%` }}
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="text-center">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
              <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <div className="text-xl font-bold">{stats.streak}</div>
              <div className="text-[10px] uppercase tracking-wider text-indigo-200">{t('dailyStreak')}</div>
            </div>
          </div>
          <div className="text-center">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
              <Target className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <div className="text-xl font-bold">{stats.tasks_completed}</div>
              <div className="text-[10px] uppercase tracking-wider text-indigo-200">{t('solvedTasks')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full -ml-24 -mb-24 blur-2xl"></div>
    </section>
  );
};
