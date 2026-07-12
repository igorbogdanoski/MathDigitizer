import React, { useState, useEffect, useMemo } from 'react';
import { Brain, CheckCircle2, XCircle, RotateCcw, ChevronRight, ChevronLeft, Plus, Trash2, Loader2, Sparkles, Calendar, BookOpen, Layers, Trophy, ArrowRight, Play, Check, X, Activity } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { MathRenderer } from './MathRenderer';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { Flashcard } from '../lib/schema';
import { motion, AnimatePresence } from 'motion/react';
import { calculateSM2 } from '../lib/srsAlgorithm';
import { generateFlashcards } from '../lib/gemini';
import { useToast } from '../contexts/ToastContext';
import { useModalA11y } from '../hooks/useModalA11y';

interface FlashcardsProps {
  onReviewComplete?: () => void;
}

type StudyMode = 'library' | 'flashcards' | 'quiz' | 'match';

export const Flashcards: React.FC<FlashcardsProps> = ({ onReviewComplete }) => {
  const { showToast } = useToast();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<StudyMode>('library');
  
  // Flashcard Study State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, hard: 0, good: 0, easy: 0 });
  const [showCompletion, setShowCompletion] = useState(false);
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  // AI Modal State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const addModalRef = useModalA11y<HTMLDivElement>(() => setShowAddModal(false));
  const aiModalRef = useModalA11y<HTMLDivElement>(() => setShowAIModal(false));

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);

  // Match State
  const [matchItems, setMatchItems] = useState<{id: string, text: string, type: 'front'|'back', cardId: string, isMatched: boolean}[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [matchStartTime, setMatchStartTime] = useState<number>(0);
  const [matchTimeElapsed, setMatchTimeElapsed] = useState<number>(0);
  const [isMatchFinished, setIsMatchFinished] = useState(false);

  // Calculate due flashcards
  const dueFlashcards = useMemo(() => {
    const now = new Date();
    return flashcards.filter(card => {
      if (!card.next_review) return true;
      return new Date(card.next_review) <= now;
    });
  }, [flashcards]);

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

  // Keyboard Shortcuts for Study Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStudying || showAddModal || showCompletion) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleReview(1);
        if (e.key === '2') handleReview(3);
        if (e.key === '3') handleReview(5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudying, isFlipped, showAddModal, showCompletion]);

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

  const startStudySession = () => {
    if (dueFlashcards.length === 0) return;
    setIsStudying(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowCompletion(false);
    setSessionStats({ reviewed: 0, hard: 0, good: 0, easy: 0 });
    setActiveTab('flashcards');
  };

  const handleReview = async (quality: number) => {
    const card = studyCards[currentIndex];
    if (!card.id) return;

    // Update Stats
    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      hard: prev.hard + (quality === 1 ? 1 : 0),
      good: prev.good + (quality === 3 ? 1 : 0),
      easy: prev.easy + (quality === 5 ? 1 : 0),
    }));

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
      
      setFlashcards(prev => prev.map(c => 
        c.id === card.id 
          ? { ...c, interval, ease_factor: easeFactor, next_review: nextReview } 
          : c
      ));
      
      if (currentIndex < studyCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        setIsStudying(false);
        setShowCompletion(true);
        if (onReviewComplete) onReviewComplete();
      }
    } catch (err) {
      console.error("Error updating flashcard:", err);
    }
  };

  // Generate Quiz
  const startQuiz = () => {
    if (flashcards.length < 4) {
      showToast("Потребни се најмалку 4 картички за да креирате квиз!", 'error');
      return;
    }
    
    // Pick 10 random cards (or all if < 10)
    const shuffled = [...flashcards].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(10, flashcards.length));
    
    const questions = selected.map(card => {
      // Pick 3 random wrong answers
      const wrongPool = flashcards.filter(c => c.id !== card.id);
      const randomWrongs = [...wrongPool].sort(() => 0.5 - Math.random()).slice(0, 3).map(c => c.back);
      
      const options = [...randomWrongs, card.back].sort(() => 0.5 - Math.random());
      
      return {
        id: card.id,
        question: card.front,
        correctAnswer: card.back,
        options
      };
    });
    
    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizScore(0);
    setIsQuizFinished(false);
    setSelectedAnswer(null);
    setActiveTab('quiz');
  };

  const handleQuizAnswer = (answer: string) => {
    if (selectedAnswer) return; // Prevent clicking again
    setSelectedAnswer(answer);
    
    const isCorrect = answer === quizQuestions[quizIndex].correctAnswer;
    if (isCorrect) setQuizScore(prev => prev + 1);
    
    setTimeout(() => {
      if (quizIndex < quizQuestions.length - 1) {
        setQuizIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        setIsQuizFinished(true);
        if (onReviewComplete) onReviewComplete();
      }
    }, 1500);
  };

  // Match Game Logic
  const startMatchGame = () => {
    if (flashcards.length < 4) {
      showToast("Потребни се најмалку 4 картички за да играте совпаѓање!", 'error');
      return;
    }
    
    const shuffled = [...flashcards].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(6, flashcards.length));
    
    const items: {id: string, text: string, type: 'front'|'back', cardId: string, isMatched: boolean}[] = [];
    
    selected.forEach(card => {
      if (card.id) {
        items.push({ id: `front-${card.id}`, text: card.front, type: 'front', cardId: card.id, isMatched: false });
        items.push({ id: `back-${card.id}`, text: card.back, type: 'back', cardId: card.id, isMatched: false });
      }
    });
    
    setMatchItems(items.sort(() => 0.5 - Math.random()));
    setSelectedMatch(null);
    setMatchStartTime(Date.now());
    setMatchTimeElapsed(0);
    setIsMatchFinished(false);
    setActiveTab('match');
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeTab === 'match' && !isMatchFinished) {
      timer = setInterval(() => {
        setMatchTimeElapsed((Date.now() - matchStartTime) / 1000);
      }, 100);
    }
    return () => clearInterval(timer);
  }, [activeTab, isMatchFinished, matchStartTime]);

  const handleMatchClick = (item: {id: string, text: string, type: 'front'|'back', cardId: string, isMatched: boolean}) => {
    if (item.isMatched || isMatchFinished) return;
    
    if (!selectedMatch) {
      setSelectedMatch(item.id);
      return;
    }
    
    const selectedItem = matchItems.find(i => i.id === selectedMatch);
    if (!selectedItem || selectedItem.id === item.id) {
      setSelectedMatch(null);
      return;
    }
    
    if (selectedItem.cardId === item.cardId && selectedItem.type !== item.type) {
      // Match found
      const newItems = matchItems.map(i => 
        i.cardId === item.cardId ? { ...i, isMatched: true } : i
      );
      setMatchItems(newItems);
      setSelectedMatch(null);
      
      if (newItems.every(i => i.isMatched)) {
        setIsMatchFinished(true);
        if (onReviewComplete) onReviewComplete();
      }
    } else {
      // Wrong match
      setSelectedMatch(item.id); // Or just null to reset, let's reset or change selection
      setTimeout(() => setSelectedMatch(null), 500); 
    }
  };

  // AI Generation Logic
  const handleAIGeneration = async () => {
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    try {
      const generatedCards = await generateFlashcards(aiTopic, 5);
      if (generatedCards && generatedCards.length > 0) {
        let created = 0;
        const newCards: Flashcard[] = [];
        for (const card of generatedCards) {
          if (auth.currentUser) {
            const newCard: Partial<Flashcard> = {
              front: card.front,
              back: card.back,
              user_uid: auth.currentUser.uid,
              created_at: new Date().toISOString(),
              ease_factor: 2.5,
              interval: 0,
              next_review: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'flashcards'), newCard);
            newCards.push({ id: docRef.id, ...newCard } as Flashcard);
            created++;
          }
        }
        setFlashcards(prev => [...newCards, ...prev]);
        setShowAIModal(false);
        setAiTopic('');
        showToast(`Успешно креирани ${created} картички со помош на AI!`, 'success');
      }
    } catch (e) {
      showToast("Настана грешка при генерирање картички. Обидете се повторно.", 'error');
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500">Се вчитуваат вашите картички...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-indigo-600" />
              Quizlet Македонија
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Твојот личен простор за интелигентно учење и меморирање.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => setShowAIModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Картотека
            </Button>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Нова Картичка
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        {(!isStudying && !showCompletion && activeTab !== 'quiz' && activeTab !== 'match') && (
          <div className="flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'library'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              Колекција ({flashcards.length})
            </button>
            <button
              type="button"
              onClick={startStudySession}
              disabled={dueFlashcards.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                dueFlashcards.length === 0
                  ? 'opacity-50 cursor-not-allowed text-slate-400'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              }`}
            >
              <Brain className="w-4 h-4" />
              Паметно Учење ({dueFlashcards.length})
            </button>
            <button
              type="button"
              onClick={startQuiz}
              disabled={flashcards.length < 4}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                flashcards.length < 4
                  ? 'opacity-50 cursor-not-allowed text-slate-400'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Квиз Режим
            </button>
            <button
              type="button"
              onClick={startMatchGame}
              disabled={flashcards.length < 4}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                flashcards.length < 4
                  ? 'opacity-50 cursor-not-allowed text-slate-400'
                  : 'text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20'
              }`}
            >
              <Activity className="w-4 h-4" />
              Игра на совпаѓање
            </button>
          </div>
        )}
      </div>

      {/* Completion Screen */}
      <AnimatePresence>
        {showCompletion && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-gradient-to-b from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 p-10 rounded-3xl border border-indigo-100 dark:border-slate-700 shadow-xl text-center mt-8"
          >
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Одлична Сесија!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm mx-auto">
              Успешно завршивте со денешните паметни картички. Вашиот мозок е еден чекор посилен.
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{sessionStats.reviewed}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Повторени</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-800/50">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{sessionStats.easy + sessionStats.good}</div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest font-bold mt-1">Научени</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-800/50">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{sessionStats.hard}</div>
                <div className="text-xs text-amber-600/70 dark:text-amber-400/70 uppercase tracking-widest font-bold mt-1">Тешки</div>
              </div>
            </div>
            
            <Button 
              onClick={() => { setShowCompletion(false); setActiveTab('library'); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 h-12"
            >
              Врати се кон библиотеката
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiz Mode */}
      {(activeTab === 'quiz' && !isQuizFinished && quizQuestions.length > 0) && (
        <div className="max-w-2xl mx-auto pt-4">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-slate-500 font-medium mb-2">
              <span>Прашање {quizIndex + 1} од {quizQuestions.length}</span>
              <span>Резултат: {quizScore}</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${((quizIndex) / quizQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          <motion.div 
            key={quizIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 md:p-12 mb-6"
          >
            <h3 className="text-xl md:text-2xl font-medium text-slate-900 dark:text-white mb-10 text-center">
              <MathRenderer content={quizQuestions[quizIndex].question} />
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizQuestions[quizIndex].options.map((option: string, i: number) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === quizQuestions[quizIndex].correctAnswer;
                
                let optionClasses = "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30";
                
                if (selectedAnswer) {
                  if (isSelected && isCorrect) optionClasses = "bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 dark:border-emerald-500 text-emerald-900 dark:text-emerald-100";
                  else if (isSelected && !isCorrect) optionClasses = "bg-red-100 dark:bg-red-900/50 border-red-500 dark:border-red-500 text-red-900 dark:text-red-100";
                  else if (isCorrect) optionClasses = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"; // highlight right answer
                  else optionClasses = "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-50";
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleQuizAnswer(option)}
                    disabled={!!selectedAnswer}
                    className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 text-slate-700 dark:text-slate-300 ${optionClasses}`}
                  >
                    <MathRenderer content={option} inline />
                    {selectedAnswer && isCorrect && <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
                    {selectedAnswer && isSelected && !isCorrect && <X className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
          
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => setActiveTab('library')} className="text-slate-500">
              Откажи квиз
            </Button>
          </div>
        </div>
      )}

      {/* Quiz Finished Screen */}
      {(activeTab === 'quiz' && isQuizFinished) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center mt-8"
        >
          <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-12 h-12 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Квизот е завршен!</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Освоивте {quizScore} од {quizQuestions.length} поени.
          </p>
          <div className="space-y-3">
            <Button onClick={startQuiz} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12">
              <Play className="w-4 h-4 mr-2" /> Обиди се повторно
            </Button>
            <Button variant="outline" onClick={() => setActiveTab('library')} className="w-full rounded-xl h-12">
              Врати се во колекција
            </Button>
          </div>
        </motion.div>
      )}

      {/* Study Mode (Flashcards) */}
      {(activeTab === 'flashcards' && studyCards.length > 0 && !showCompletion) && (
        <div className="max-w-3xl mx-auto relative pt-4">
          {/* Study Progress */}
          <div className="mb-6">
            <div className="flex justify-between items-center text-sm font-medium text-slate-400 dark:text-slate-500 mb-3">
              <span className="flex items-center gap-2">
                <Brain className="w-4 h-4" /> Сесија за учење
              </span>
              <span>{currentIndex + 1} / {studyCards.length}</span>
            </div>
            <div className="flex gap-1 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-300 [width:var(--progress-width)]"
                style={{ '--progress-width': `${(currentIndex / studyCards.length) * 100}%` } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Flashcard 3D Scene */}
          <div 
            className="relative h-[400px] perspective-1000 cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentIndex}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full h-full absolute inset-0"
              >
                <motion.div 
                  className="w-full h-full relative transition-all duration-500 preserve-3d"
                  animate={{ rotateX: isFlipped ? 180 : 0 }}
                >
                  {/* Front Face */}
                  <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-8 sm:p-12 text-center overflow-auto">
                    <div className="absolute top-6 left-6 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400"></div> Прашање
                    </div>
                    <div className="text-2xl sm:text-3xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed mt-4">
                      <MathRenderer content={studyCards[currentIndex].front} />
                    </div>
                    <div className="absolute bottom-6 text-slate-400 font-medium text-sm flex items-center gap-2 animate-pulse bg-slate-50 dark:bg-slate-800/80 px-4 py-2 rounded-full">
                      Кликни или Space за одговор
                    </div>
                  </div>

                  {/* Back Face */}
                  <div className="absolute inset-0 backface-hidden bg-indigo-50 dark:bg-indigo-950/20 rounded-3xl shadow-xl border-2 border-indigo-200 dark:border-indigo-800 flex flex-col items-center justify-center p-8 sm:p-12 text-center rotate-x-180 overflow-auto">
                    <div className="absolute top-6 left-6 text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div> Одговор
                    </div>
                    <div className="text-xl sm:text-2xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed mt-4">
                      <MathRenderer content={studyCards[currentIndex].back} />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isFlipped ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">Обиди се да го одговориш прашањето пред да свртиш.</p>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 w-full sm:w-auto"
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReview(1); }}
                  className="flex-1 sm:flex-none flex flex-col items-center justify-center px-6 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors group"
                >
                  <XCircle className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Тешко (1)</span>
                </button>
                <div className="w-px h-10 bg-slate-100 dark:bg-slate-700 mx-2"></div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReview(3); }}
                  className="flex-1 sm:flex-none flex flex-col items-center justify-center px-6 py-3 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 transition-colors group"
                >
                  <RotateCcw className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Добро (2)</span>
                </button>
                <div className="w-px h-10 bg-slate-100 dark:bg-slate-700 mx-2"></div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReview(5); }}
                  className="flex-1 sm:flex-none flex flex-col items-center justify-center px-6 py-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors group"
                >
                  <CheckCircle2 className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Лесно (3)</span>
                </button>
              </motion.div>
            )}
          </div>
          
          <div className="absolute top-0 right-[-60px] hidden lg:flex flex-col gap-2">
             <Button variant="ghost" size="sm" className="rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100" onClick={() => {setIsStudying(false); setActiveTab('library');}}>
                <X className="w-5 h-5 text-slate-500" />
             </Button>
          </div>
          <div className="mt-8 flex justify-center lg:hidden">
             <Button variant="ghost" className="text-slate-500" onClick={() => {setIsStudying(false); setActiveTab('library');}}>Откажи сесија</Button>
          </div>
        </div>
      )}

      {/* Library Mode */}
      {(activeTab === 'library' && !showCompletion) && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
              <Brain className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
              <p className="text-indigo-100 text-sm font-medium mb-1">Твоја Колекција</p>
              <h3 className="text-4xl font-extrabold">{flashcards.length}</h3>
              <p className="text-indigo-100 text-sm mt-4">Вкупно креирани картички</p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
              <Calendar className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 text-emerald-500 transition-transform group-hover:scale-110" />
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">За повторување денес</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{dueFlashcards.length}</h3>
              {dueFlashcards.length > 0 && (
                <Button 
                  onClick={startStudySession} 
                  className="mt-4 w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                  variant="outline"
                >
                  Започни сесија <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
              <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 text-amber-500 transition-transform group-hover:scale-110" />
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                <BookOpen className="w-5 h-5" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Интерактивен Квиз</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Тестирај го знаењето</h3>
              <Button 
                onClick={startQuiz} 
                disabled={flashcards.length < 4}
                className="mt-2 w-full bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 disabled:opacity-50 border border-amber-200 dark:border-amber-800"
                variant="outline"
              >
                Квиз режим <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-400" />
              Сите картички ({flashcards.length})
            </h3>
            
            {flashcards.length === 0 ? (
              <div className="py-20 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Немате зачувани картички</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Започнете со креирање на вашата прва картичка за учење.</p>
                <Button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-6">
                  <Plus className="w-5 h-5 mr-2" /> Додади картичка
                </Button>
              </div>
            ) : (
              <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                {flashcards.map((card) => (
                  <div key={card.id} className="break-inside-avoid shadow-none">
                    <Card className="group hover:-translate-y-1 transition-all duration-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] uppercase font-bold px-2 py-1 rounded">Q&A</div>
                          <button
                            type="button"
                            onClick={() => card.id && handleDeleteFlashcard(card.id)}
                            aria-label="Избриши картичка"
                            title="Избриши картичка"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            <MathRenderer content={card.front} inline={true} />
                          </div>
                          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">
                            <MathRenderer content={card.back} inline={true} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div
            ref={addModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Креирај Картичка"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <Plus className="w-6 h-6 text-indigo-600" />
                  Креирај Картичка
                </h2>
                <button type="button" onClick={() => setShowAddModal(false)} aria-label="Затвори" title="Затвори" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-white dark:bg-slate-800 shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Front Side */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div> Термин / Прашање
                    </label>
                    <textarea 
                      value={newFront}
                      onChange={(e) => setNewFront(e.target.value)}
                      className="w-full h-40 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-500 outline-none resize-none text-base transition-all"
                      placeholder="Пр: Што претставува Питагоровата теорема?"
                    />
                  </div>
                  {/* Back Side */}
                  <div className="space-y-2">
                     <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Дефиниција / Одговор
                    </label>
                    <textarea 
                      value={newBack}
                      onChange={(e) => setNewBack(e.target.value)}
                      className="w-full h-40 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 focus:border-emerald-500 outline-none resize-none text-base transition-all"
                      placeholder="Пр: a² + b² = c² (Квадратот над хипотенузата е еднаков на збирот од квадратите над катетите)"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowAddModal(false)} className="rounded-xl font-medium">Откажи</Button>
                <Button 
                  onClick={handleAddFlashcard} 
                  disabled={!newFront.trim() || !newBack.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 font-medium shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  Зачувај во колекција
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Match Game UI */}
      {(activeTab === 'match') && (
        <div className="max-w-4xl mx-auto pt-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-sky-500" /> 
              Игра на совпаѓање
            </h2>
            <div className="text-xl font-mono text-slate-600 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl">
              {matchTimeElapsed.toFixed(1)}s
            </div>
          </div>
          
          {isMatchFinished ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 p-10 rounded-3xl text-center shadow-xl border border-slate-200 dark:border-slate-700 mt-8"
            >
              <div className="w-24 h-24 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-sky-500" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Браво!</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                Сите картички ги поврзавте точно за <span className="font-bold text-sky-600">{matchTimeElapsed.toFixed(1)} секунди</span>.
              </p>
              <div className="flex justify-center gap-4">
                <Button onClick={startMatchGame} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl h-12 px-8">
                  Играј повторно
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('library')} className="rounded-xl h-12 px-8">
                  Кон колекција
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                {matchItems.map(item => (
                  !item.isMatched && (
                    <motion.div
                      key={item.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      onClick={() => handleMatchClick(item)}
                      className={`cursor-pointer p-4 h-32 flex items-center justify-center text-center rounded-2xl border-2 transition-all duration-200 shadow-sm
                        ${selectedMatch === item.id 
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 ring-4 ring-sky-500/20' 
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
                        }
                      `}
                    >
                      <div className="text-sm font-medium">
                        <MathRenderer content={item.text} inline />
                      </div>
                    </motion.div>
                  )
                ))}
              </AnimatePresence>
            </div>
          )}
          <div className="flex justify-center mt-8">
            <Button variant="ghost" onClick={() => setActiveTab('library')} className="text-slate-500">
              Откажи
            </Button>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div
            ref={aiModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="AI Генератор"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-purple-50/50 dark:bg-purple-900/10">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  AI Генератор
                </h2>
                <button type="button" onClick={() => setShowAIModal(false)} disabled={isGenerating} aria-label="Затвори" title="Затвори" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-white dark:bg-slate-800 shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 sm:p-8 space-y-4">
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Внесете тема за која сакате вештачката интелигенција автоматски да изгенерира 5 интерактивни картички (flashcards) за учење.
                </p>
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Тема (пр. Основни изводи во математика)</label>
                  <input 
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    disabled={isGenerating}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all font-medium"
                    placeholder="Внеси тема..."
                  />
                </div>
              </div>
              
              <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowAIModal(false)} disabled={isGenerating} className="rounded-xl font-medium">Откажи</Button>
                <Button 
                  onClick={handleAIGeneration} 
                  disabled={!aiTopic.trim() || isGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-8 font-medium shadow-lg shadow-purple-200 dark:shadow-none"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Се генерира...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Генерирај (5)</>
                  )}
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
        .rotate-x-180 { transform: rotateX(180deg); }
      `}</style>
    </div>
  );
};
