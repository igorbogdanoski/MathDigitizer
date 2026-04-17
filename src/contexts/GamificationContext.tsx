import React, { createContext, useContext, useEffect } from 'react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import confetti from 'canvas-confetti';
import { DailyQuest } from '../lib/schema';

interface GamificationContextType {
  awardXP: (amount: number) => Promise<void>;
  updateQuestProgress: (type: 'extract' | 'solve' | 'flashcard' | 'login', amount?: number) => Promise<void>;
  triggerConfetti: () => void;
  checkAndResetDailyQuests: (currentUser: any) => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType>({
  awardXP: async () => {},
  updateQuestProgress: async () => {},
  triggerConfetti: () => {},
  checkAndResetDailyQuests: async () => {},
});

export const useGamification = () => useContext(GamificationContext);

export const GamificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#3b82f6', '#10b981', '#8b5cf6']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#3b82f6', '#10b981', '#8b5cf6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const awardXP = async (amount: number) => {
    if (!user) return;
    try {
      const statsRef = doc(db, 'user_stats', user.uid);
      const statsSnap = await getDoc(statsRef);
      
      if (statsSnap.exists()) {
        const currentXP = statsSnap.data().xp;
        const currentLevel = statsSnap.data().level;
        const newXP = currentXP + amount;
        const newLevel = Math.floor(newXP / 1000) + 1;
        
        if (newLevel > currentLevel) {
          triggerConfetti();
        }

        await updateDoc(statsRef, {
          xp: increment(amount),
          level: newLevel,
          last_activity: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Error awarding XP:", err);
    }
  };

  const updateQuestProgress = async (type: 'extract' | 'solve' | 'flashcard' | 'login', amount: number = 1) => {
    if (!user) return;
    try {
      const statsRef = doc(db, 'user_stats', user.uid);
      const statsSnap = await getDoc(statsRef);
      
      if (!statsSnap.exists()) return;
      
      const data = statsSnap.data();
      if (!data.quests || !data.quests.items) return;

      const today = new Date().toISOString().split('T')[0];
      if (data.quests.date !== today) return; // Quests are stale

      let updated = false;
      let xpToAward = 0;
      const newItems = data.quests.items.map((quest: DailyQuest) => {
        if (quest.type === type && !quest.completed) {
          const newProgress = Math.min(quest.progress + amount, quest.target);
          const completed = newProgress >= quest.target;
          if (completed) {
            xpToAward += quest.xpReward;
            triggerConfetti();
          }
          updated = true;
          return { ...quest, progress: newProgress, completed };
        }
        return quest;
      });

      if (updated) {
        await updateDoc(statsRef, {
          'quests.items': newItems
        });
        
        if (xpToAward > 0) {
          await awardXP(xpToAward);
        }
      }
    } catch (err) {
      console.error("Error updating quest progress:", err);
    }
  };

  const checkAndResetDailyQuests = async (currentUser: any) => {
    try {
      const statsRef = doc(db, 'user_stats', currentUser.uid);
      const statsSnap = await getDoc(statsRef);
      
      if (!statsSnap.exists()) return;
      
      const data = statsSnap.data();
      const today = new Date().toISOString().split('T')[0];
      
      // Check streak
      let newStreak = data.streak || 0;
      const lastActivityDate = data.last_activity ? new Date(data.last_activity).toISOString().split('T')[0] : null;
      
      if (lastActivityDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastActivityDate === yesterdayStr) {
          newStreak += 1;
        } else if (lastActivityDate !== today) {
          newStreak = 1; // Reset streak
        }
      } else {
        newStreak = 1;
      }

      // Check quests
      if (!data.quests || data.quests.date !== today) {
        const newQuests: DailyQuest[] = [
          { id: 'q1', type: 'login', title: 'Најави се', target: 1, progress: 1, completed: true, xpReward: 50 },
          { id: 'q2', type: 'extract', title: 'Екстрактирај 1 видео/слика', target: 1, progress: 0, completed: false, xpReward: 100 },
          { id: 'q3', type: 'solve', title: 'Реши 3 задачи', target: 3, progress: 0, completed: false, xpReward: 150 }
        ];
        
        await updateDoc(statsRef, {
          streak: newStreak,
          last_activity: new Date().toISOString(),
          quests: {
            date: today,
            items: newQuests
          }
        });
        
        // Award XP for login quest
        await awardXP(50);
        triggerConfetti();
      } else if (lastActivityDate !== today) {
        // Just update last activity and streak if quests are already set for today
        await updateDoc(statsRef, {
          streak: newStreak,
          last_activity: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Error checking daily quests:", err);
    }
  };

  useEffect(() => {
    if (user) {
      checkAndResetDailyQuests(user);
    }
  }, [user]);

  return (
    <GamificationContext.Provider value={{ awardXP, updateQuestProgress, triggerConfetti, checkAndResetDailyQuests }}>
      {children}
    </GamificationContext.Provider>
  );
};
