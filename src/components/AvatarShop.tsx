import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, CheckCircle2, Shield, Crown, Zap, Flame, Star, StarHalf } from 'lucide-react';
import { Button } from './ui/Button';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { updateProfile } from 'firebase/auth';

interface AvatarShopProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: number;
  currentAvatar: string | null;
}

const AVATARS = [
  { id: 'av1', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Math1', levelReq: 1, name: 'Студент Бот' },
  { id: 'av2', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Algo', levelReq: 2, name: 'Алго Бот' },
  { id: 'av3', url: 'https://api.dicebear.com/7.x/flocces/svg?seed=Geom', levelReq: 3, name: 'Гео Флок' },
  { id: 'av4', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=Logic', levelReq: 5, name: 'Логички Облик' },
  { id: 'av5', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Pro', levelReq: 10, name: 'Про Авантурист' },
  { id: 'av6', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Master', levelReq: 15, name: 'Гранд Мастер' },
  { id: 'av7', url: 'https://api.dicebear.com/7.x/icons/svg?seed=Legend', levelReq: 25, name: 'Легендарен Икон' },
  { id: 'av8', url: 'https://api.dicebear.com/7.x/micah/svg?seed=GodT', levelReq: 50, name: 'Мат Титан' }
];

export const AvatarShop: React.FC<AvatarShopProps> = ({ isOpen, onClose, currentLevel, currentAvatar }) => {
  const { showToast } = useToast();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedAvatar || !auth.currentUser) return;
    
    setIsSaving(true);
    try {
      // Update Auth Profile
      await updateProfile(auth.currentUser, {
        photoURL: selectedAvatar
      });
      
      // Update user stats to sync across leaderboards
      const statsRef = doc(db, 'user_stats', auth.currentUser.uid);
      await updateDoc(statsRef, { photoURL: selectedAvatar });
      
      showToast('Успешно ажуриран аватар!', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Грешка при зачувување на аватарот.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Продавница за Аватари</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Отклучувај нови аватари преку левелирање</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Затвори" className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {AVATARS.map((avatar) => {
                const isUnlocked = currentLevel >= avatar.levelReq;
                const isCurrent = currentAvatar === avatar.url || (!currentAvatar && avatar.id === 'av1');
                const isSelected = selectedAvatar === avatar.url;

                return (
                  <div 
                    key={avatar.id}
                    onClick={() => {
                      if (isUnlocked && !isCurrent) setSelectedAvatar(avatar.url);
                    }}
                    className={`
                      relative p-4 rounded-2xl border-2 transition-all group
                      ${isUnlocked ? (isSelected ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md cursor-pointer' : (isCurrent ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 cursor-pointer')) : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed grayscale'}
                    `}
                  >
                    <div className="relative aspect-square mb-3">
                      <img src={avatar.url} alt={avatar.name} className="w-full h-full object-contain drop-shadow-sm" />
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-slate-900/40 rounded-xl backdrop-blur-[2px]">
                          <Lock className="w-8 h-8 text-slate-600 dark:text-slate-300 drop-shadow-md" />
                        </div>
                      )}
                      {(isCurrent || isSelected) && (
                        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white ${isCurrent ? 'bg-emerald-500' : 'bg-indigo-600'} shadow-sm`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{avatar.name}</div>
                      <div className={`text-xs font-semibold mt-1 inline-flex items-center gap-1 ${isUnlocked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                        Ниво {avatar.levelReq} {isUnlocked ? <CheckCircle2 className="w-3 h-3" /> : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="border-slate-200 dark:border-slate-700">Откажи</Button>
            <Button 
              onClick={handleSave} 
              disabled={!selectedAvatar || isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              {isSaving ? 'Зачувување...' : 'Зачувај избор'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
