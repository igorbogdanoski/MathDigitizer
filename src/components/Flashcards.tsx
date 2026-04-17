import React, { useState, useEffect, useMemo } from 'react';
import { Brain, CheckCircle2, XCircle, RotateCcw, ChevronRight, ChevronLeft, Plus, Trash2, Loader2, Sparkles, Calendar } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { MathRenderer } from './MathRenderer';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Flashcard } from '../lib/schema';
import { motion, AnimatePresence } from 'motion/react';
import { calculateSM2 } from '../lib/srsAlgorithm';

interface FlashcardsProps {
  onReviewComplete?: () => void;
}

export const Flashcards: React.FC<FlashcardsProps> = ({ onReviewComplete }) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  // Calculate due flashcards
  const dueFlashcards = useMemo(() => {
    const now = new Date();
    return flashcards.filter(card => {
      if (!card.next_review) return true;
      return new Date(card.next_review) <= now;
    });
  }, [flashcards]);

  // The cards currently being studied
  const studyCards = isStudying ? dueFlashcards : flashcards;

  useEffect(() => {
    const fetchFlashcards = async () => {
      if (!auth.currentUser) return;
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'flashcards'),
          where('user_uid', '==', auth.currentUser.uid),
          orderBy('created_at', 'desc')
        );
        const snapshot = await getDocs(q);
        const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard));
        setFlashcards(cards);
      } catch (err) {
        console.error("Error fetching flashcards:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlashcards();
  }, []);

  const handleAddFlashcard = async () => {
    if (!auth.currentUser || !newFront.trim() || !newBack.trim()) return;
    
    try {
      const newCard: Partial<Flashcard> = {
        front: newFront,
        back: newBack,
        user_uid: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        ease_factor: 2.5,
        interval: 0,
        next_review: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'flashcards'), newCard);
      setFlashcards(prev => [{ id: docRef.id, ...newCard } as Flashcard, ...prev]);
      setNewFront('');
      setNewBack('');
      setShowAddModal(false);
    } catch (err) {
      console.error("Error adding flashcard:", err);
    }
  };

  const handleDeleteFlashcard = async (id: string) => {
    if (!window.confirm('Дали сте сигурни дека сакате да ја избришете оваа картичка?')) return;
    try {
      await deleteDoc(doc(db, 'flashcards', id));
      setFlashcards(prev => prev.filter(c => c.id !== id));
      if (currentIndex >= studyCards.length - 1 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    } catch (err) {
      console.error("Error deleting flashcard:", err);
    }
  };

  const handleReview = async (quality: number) => {
    const card = studyCards[currentIndex];
    if (!card.id) return;

    const { interval, easeFactor, nextReview } = calculateSM2(
      quality,
      card.interval || 0,
      card.ease_factor || 2.5
    );

    try {
      await updateDoc(doc(db, 'flashcards', card.id), {
        interval,
        ease_factor: easeFactor,
        next_review: nextReview
      });
      
      // Update local state
      setFlashcards(prev => prev.map(c => 
        c.id === card.id 
          ? { ...c, interval, ease_factor: easeFactor, next_review: nextReview } 
          : c
      ));
      
      // Move to next card
      if (currentIndex < studyCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        setIsStudying(false);
        alert('Завршивте со денешната сесија!');
        if (onReviewComplete) {
          onReviewComplete();
        }
      }
    } catch (err) {
      console.error("Error updating flashcard:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500">Се вчитуваат вашите картички...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-indigo-600" />
            Паметни Картички (Flashcards)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Користете Spaced Repetition за долготрајно помнење на математичките концепти.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Нова Картичка
          </Button>
          {flashcards.length > 0 && !isStudying && (
            <Button 
              onClick={() => { setIsStudying(true); setCurrentIndex(0); setIsFlipped(false); }}
              disabled={dueFlashcards.length === 0}
              className={`${dueFlashcards.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {dueFlashcards.length > 0 ? `Започни со учење (${dueFlashcards.length})` : 'Нема картички за денес'}
            </Button>
          )}
        </div>
      </div>

      {!isStudying && flashcards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Вкупно картички</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{flashcards.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">За повторување денес</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{dueFlashcards.length}</p>
            </div>
          </div>
        </div>
      )}

      {isStudying && studyCards.length > 0 ? (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Картичка {currentIndex + 1} од {studyCards.length}</span>
            <Button variant="ghost" size="sm" onClick={() => setIsStudying(false)}>Откажи</Button>
          </div>

          <div 
            className="relative h-80 perspective-1000 cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full absolute inset-0"
              >
                <motion.div 
                  className="w-full h-full relative transition-all duration-500 preserve-3d"
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                >
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4">Прашање / Концепт</div>
                    <div className="text-xl md:text-2xl font-medium text-slate-800 dark:text-slate-100">
                      <MathRenderer content={studyCards[currentIndex].front} />
                    </div>
                    <div className="absolute bottom-6 text-slate-400 text-xs flex items-center gap-2">
                      <RotateCcw className="w-3 h-3" /> Кликни за да го видиш одговорот
                    </div>
                  </div>

                  {/* Back */}
                  <div className="absolute inset-0 backface-hidden bg-indigo-50 dark:bg-slate-900 rounded-3xl shadow-xl border-2 border-indigo-200 dark:border-indigo-900 flex flex-col items-center justify-center p-8 text-center rotate-y-180">
                    <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4">Одговор / Објаснување</div>
                    <div className="text-xl md:text-2xl font-medium text-slate-800 dark:text-slate-100">
                      <MathRenderer content={studyCards[currentIndex].back} />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {isFlipped && (
            <div className="flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-top-4">
              <Button 
                variant="outline" 
                className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 h-12 px-6"
                onClick={() => handleReview(1)}
              >
                <XCircle className="w-5 h-5 mr-2" /> Тешко
              </Button>
              <Button 
                variant="outline" 
                className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 h-12 px-6"
                onClick={() => handleReview(3)}
              >
                <RotateCcw className="w-5 h-5 mr-2" /> Добро
              </Button>
              <Button 
                variant="outline" 
                className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 h-12 px-6"
                onClick={() => handleReview(5)}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Лесно
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flashcards.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
              <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Немате зачувани картички</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Започнете со креирање на вашата прва картичка за учење.</p>
              <Button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Додади картичка
              </Button>
            </div>
          ) : (
            flashcards.map((card) => (
              <Card key={card.id} className="group hover:shadow-md transition-all border-slate-200 dark:border-slate-700">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Картичка</div>
                    <button 
                      onClick={() => card.id && handleDeleteFlashcard(card.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                      <MathRenderer content={card.front} inline />
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                      <MathRenderer content={card.back} inline />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  Нова Картичка
                </h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Предна страна (Прашање)</label>
                  <textarea 
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    className="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-sm"
                    placeholder="Внесете го прашањето или концептот (може и LaTeX)..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Задна страна (Одговор)</label>
                  <textarea 
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    className="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-sm"
                    placeholder="Внесете го одговорот или објаснувањето..."
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowAddModal(false)}>Откажи</Button>
                <Button 
                  onClick={handleAddFlashcard} 
                  disabled={!newFront.trim() || !newBack.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Зачувај Картичка
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};
