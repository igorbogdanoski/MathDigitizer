import React from 'react';
import { Award, Medal, Star } from 'lucide-react';
import type { TFunction } from 'i18next';
import { motion } from 'motion/react';
import { UserStats } from '../../lib/schema';

interface BadgesGridProps {
  stats: UserStats;
  t: TFunction<'dashboard'>;
}

export const BadgesGrid: React.FC<BadgesGridProps> = ({ stats, t }) => {
  return (
    <>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <Award className="w-6 h-6 text-indigo-600" />
        {t('yourBadges')}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {stats.badges.map((badge, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.05 }}
            className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-4 rounded-2xl border border-slate-200 dark:border-white/10 text-center shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
              <Medal className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{badge}</div>
          </motion.div>
        ))}
        {/* Locked Badges Placeholder */}
        {[1, 2, 3].map((_, idx) => (
          <div key={idx} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center opacity-50">
            <div className="w-12 h-12 bg-slate-100 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 text-slate-300" />
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('locked')}</div>
          </div>
        ))}
      </div>
    </>
  );
};
