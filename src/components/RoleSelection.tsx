import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../lib/schema';
import { GraduationCap, BookOpen, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';

interface RoleSelectionProps {
  user: any;
  onComplete: (profile: UserProfile) => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ user, onComplete }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectRole = async (role: 'teacher' | 'student') => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || 'no-email@example.com',
        displayName: user.displayName || 'Корисник',
        role: role,
        trialStartedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), newProfile);
      
      // Initialize user stats
      const today = new Date().toISOString().split('T')[0];
      const statsRef = doc(db, 'user_stats', user.uid);
      await setDoc(statsRef, {
        uid: user.uid,
        xp: 50, // Initial XP for login
        level: 1,
        tasks_completed: 0,
        streak: 1,
        badges: ['Добредојде!'],
        last_activity: new Date().toISOString(),
        quests: {
          date: today,
          items: [
            { id: 'q1', type: 'login', title: 'Најави се', target: 1, progress: 1, completed: true, xpReward: 50 },
            { id: 'q2', type: 'extract', title: 'Екстрактирај 1 видео/слика', target: 1, progress: 0, completed: false, xpReward: 100 },
            { id: 'q3', type: 'solve', title: 'Реши 3 задачи', target: 3, progress: 0, completed: false, xpReward: 150 }
          ]
        }
      });

      onComplete(newProfile);
    } catch (error: any) {
      console.error("Error saving role:", error);
      setErrorMsg(error.message || "Настана грешка при зачувување на улогата.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl p-8 border border-slate-200 dark:border-slate-700 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">Добредојдовте во MathAI!</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg">
          За да ви го пружиме најдоброто искуство, ве молиме изберете ја вашата улога.
        </p>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => handleSelectRole('student')}
            disabled={isSubmitting}
            className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
          >
            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Јас сум Ученик</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Сакам да решавам задачи, да учам со флешкарти и да го следам мојот напредок.
            </p>
          </button>

          <button
            onClick={() => handleSelectRole('teacher')}
            disabled={isSubmitting}
            className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Јас сум Наставник</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Сакам да дигитализирам задачи, да креирам тестови и работни листови.
            </p>
          </button>
        </div>

        {isSubmitting && (
          <div className="mt-8 flex items-center justify-center text-indigo-600">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Се зачувува...</span>
          </div>
        )}
      </div>
    </div>
  );
};
