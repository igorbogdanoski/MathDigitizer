import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Plus, Loader2, Sparkles, Layers, Trophy, Activity, X } from 'lucide-react';
import { Button } from './ui/Button';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { Flashcard } from '../lib/schema';
import { motion, AnimatePresence } from 'motion/react';
import {
  CardSchedule,
  ReviewGrade,
  dueCards,
  gradeFromOutcome,
  scheduleReview,
} from '../lib/fsrsLite';
import { generateFlashcards, generateSpeech } from '../lib/gemini';
import { useToast } from '../contexts/ToastContext';
import { useModalA11y } from '../hooks/useModalA11y';
// NOTE: import the barrel via its explicit index path — on case-insensitive
// filesystems (Windows) a bare './flashcards' specifier would resolve to this
// very file ('Flashcards.tsx') instead of the './flashcards/' directory.
import {
  FlashcardStudyView,
  StudyCompletionView,
  QuizView,
  MatchGameView,
  FlashcardLibraryView,
  AddFlashcardModal,
} from './flashcards/index';
import type { StudyMode, SessionStats, QuizQuestion, MatchItem } from './flashcards/index';

interface FlashcardsProps {
  onReviewComplete?: () => void;
}

export const Flashcards: React.FC<FlashcardsProps> = ({ onReviewComplete }) => {
  const { t } = useTranslation('flashcards');
  const { showToast } = useToast();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<StudyMode>('library');

  // Flashcard Study State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ reviewed: 0, hard: 0, good: 0, easy: 0 });
  const [showCompletion, setShowCompletion] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newDeck, setNewDeck] = useState('');
  const [deckFilter, setDeckFilter] = useState('');

  // AI Modal State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const addModalRef = useModalA11y<HTMLDivElement>(() => setShowAddModal(false), showAddModal);
  const aiModalRef = useModalA11y<HTMLDivElement>(() => setShowAIModal(false), showAIModal);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);

  // Match State
  const [matchItems, setMatchItems] = useState<MatchItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [matchStartTime, setMatchStartTime] = useState<number>(0);
  /** When the current quiz question appeared — response time grades the card. */
  const quizQuestionStartRef = useRef<number>(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [matchTimeElapsed, setMatchTimeElapsed] = useState<number>(0);
  const [isMatchFinished, setIsMatchFinished] = useState(false);

  // Calculate due flashcards (learning steps make this sub-day, so it uses the
  // scheduler's own rule rather than a date comparison here)
  const dueFlashcards = useMemo(() => dueCards(flashcards), [flashcards]);

  const [frozenStudyCards, setFrozenStudyCards] = useState<Flashcard[]>([]);
  const studyCards = isStudying ? frozenStudyCards : flashcards;

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
        if (e.key === '1') handleReview('again');
        if (e.key === '2') handleReview('hard');
        if (e.key === '3') handleReview('good');
        if (e.key === '4') handleReview('easy');
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
        phase: 'learning',
        step: 0,
        lapses: 0,
        next_review: new Date().toISOString(),
        ...(newDeck.trim() ? { deck: newDeck.trim() } : {})
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
    if (!window.confirm(t('confirmDelete'))) return;
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
    setFrozenStudyCards([...dueFlashcards]);
    setIsStudying(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowCompletion(false);
    setSessionStats({ reviewed: 0, hard: 0, good: 0, easy: 0 });
    setActiveTab('flashcards');
  };

  /** Current FSRS-lite state of a card, defaulted for pre-FSRS documents. */
  const scheduleOf = (card: Flashcard): CardSchedule => ({
    phase: card.phase ?? (card.interval && card.interval > 0 ? 'review' : 'learning'),
    step: card.step ?? 0,
    interval: card.interval ?? 0,
    easeFactor: card.ease_factor ?? 2.5,
    lapses: card.lapses ?? 0,
    nextReview: card.next_review ?? new Date().toISOString(),
  });

  /** Applies one review to a card and persists the new schedule. */
  const applyReview = async (card: Flashcard, grade: ReviewGrade) => {
    if (!card.id) return;
    const next = scheduleReview(scheduleOf(card), grade);

    const update = {
      phase: next.phase,
      step: next.step,
      interval: next.interval,
      ease_factor: next.easeFactor,
      lapses: next.lapses,
      next_review: next.nextReview,
    };

    await updateDoc(doc(db, 'flashcards', card.id), update);
    setFlashcards(prev => prev.map(c => (c.id === card.id ? { ...c, ...update } : c)));
  };

  const handleReview = async (grade: ReviewGrade) => {
    const card = studyCards[currentIndex];
    if (!card.id) return;

    // Update Stats
    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      hard: prev.hard + (grade === 'again' || grade === 'hard' ? 1 : 0),
      good: prev.good + (grade === 'good' ? 1 : 0),
      easy: prev.easy + (grade === 'easy' ? 1 : 0),
    }));

    try {
      await applyReview(card, grade);

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
      showToast(t('quizMinCards'), 'error');
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
    quizQuestionStartRef.current = Date.now();
    setQuizIndex(0);
    setQuizScore(0);
    setIsQuizFinished(false);
    setSelectedAnswer(null);
    setActiveTab('quiz');
  };

  const handleQuizAnswer = (answer: string) => {
    if (selectedAnswer) return; // Prevent clicking again
    setSelectedAnswer(answer);

    const question = quizQuestions[quizIndex];
    const isCorrect = answer === question.correctAnswer;
    if (isCorrect) setQuizScore(prev => prev + 1);

    // Quiz answers feed the same scheduler as the flashcard reviews — the mode
    // is practice with consequences, not a throwaway game.
    const card = flashcards.find(c => c.id === question.id);
    if (card) {
      const elapsed = quizQuestionStartRef.current ? Date.now() - quizQuestionStartRef.current : undefined;
      applyReview(card, gradeFromOutcome(isCorrect, elapsed))
        .catch(err => console.warn('Failed to record quiz review', err));
    }
    quizQuestionStartRef.current = Date.now();

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
      showToast(t('matchMinCards'), 'error');
      return;
    }

    const shuffled = [...flashcards].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(6, flashcards.length));

    const items: MatchItem[] = [];

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

  /** Match-game outcomes feed the scheduler, like every other review mode. */
  const recordMatchOutcome = (cardId: string, correct: boolean) => {
    const card = flashcards.find(c => c.id === cardId);
    if (!card) return;
    applyReview(card, gradeFromOutcome(correct))
      .catch(err => console.warn('Failed to record match review', err));
  };

  /** Reads a card side aloud using the existing speech generator. */
  const handleSpeak = async (text: string) => {
    if (!text.trim() || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audioUrl = await generateSpeech(text);
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch (err) {
      console.error('TTS failed', err);
      showToast(t('ttsError'), 'error');
      setIsSpeaking(false);
    }
  };

  const handleMatchClick = (item: MatchItem) => {
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
      recordMatchOutcome(item.cardId, true);

      if (newItems.every(i => i.isMatched)) {
        setIsMatchFinished(true);
        if (onReviewComplete) onReviewComplete();
      }
    } else {
      // Wrong pairing — the card the student reached for was not recalled
      recordMatchOutcome(selectedItem.cardId, false);
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
        showToast(t('aiCreated', { count: created }), 'success');
      }
    } catch (e) {
      showToast(t('aiError'), 'error');
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500">{t('loadingCards')}</p>
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
              {t('quizletTitle')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {t('quizletSubtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setShowAIModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t('aiCardLibrary')}
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('newCard')}
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
              {t('collection', { count: flashcards.length })}
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
              {t('smartStudy', { count: dueFlashcards.length })}
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
              {t('quizMode')}
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
              {t('matchGame')}
            </button>
          </div>
        )}
      </div>

      {/* Completion Screen */}
      <AnimatePresence>
        {showCompletion && (
          <StudyCompletionView
            sessionStats={sessionStats}
            onBackToLibrary={() => { setShowCompletion(false); setActiveTab('library'); }}
          />
        )}
      </AnimatePresence>

      {/* Quiz Mode (active quiz + finished screen) */}
      {activeTab === 'quiz' && (isQuizFinished || quizQuestions.length > 0) && (
        <QuizView
          quizQuestions={quizQuestions}
          quizIndex={quizIndex}
          quizScore={quizScore}
          selectedAnswer={selectedAnswer}
          isFinished={isQuizFinished}
          onAnswer={handleQuizAnswer}
          onCancel={() => setActiveTab('library')}
          onRestart={startQuiz}
          onBackToLibrary={() => setActiveTab('library')}
        />
      )}

      {/* Study Mode (Flashcards) */}
      {(activeTab === 'flashcards' && studyCards.length > 0 && !showCompletion) && (
        <FlashcardStudyView
          studyCards={studyCards}
          currentIndex={currentIndex}
          isFlipped={isFlipped}
          onFlip={() => setIsFlipped(!isFlipped)}
          onReview={handleReview}
          onExit={() => {setIsStudying(false); setActiveTab('library');}}
          onSpeak={handleSpeak}
          isSpeaking={isSpeaking}
        />
      )}

      {/* Library Mode */}
      {(activeTab === 'library' && !showCompletion) && (
        <FlashcardLibraryView
          flashcards={flashcards}
          dueCount={dueFlashcards.length}
          onStartStudy={startStudySession}
          onStartQuiz={startQuiz}
          onShowAddModal={() => setShowAddModal(true)}
          onDeleteFlashcard={handleDeleteFlashcard}
          deckFilter={deckFilter}
          onDeckFilterChange={setDeckFilter}
        />
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddFlashcardModal
            modalRef={addModalRef}
            newFront={newFront}
            newBack={newBack}
            onFrontChange={setNewFront}
            onBackChange={setNewBack}
            newDeck={newDeck}
            onDeckChange={setNewDeck}
            existingDecks={Array.from(new Set(flashcards.map(c => c.deck?.trim()).filter(Boolean))) as string[]}
            onSave={handleAddFlashcard}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Match Game UI */}
      {(activeTab === 'match') && (
        <MatchGameView
          matchItems={matchItems}
          selectedMatch={selectedMatch}
          matchTimeElapsed={matchTimeElapsed}
          isMatchFinished={isMatchFinished}
          onMatchClick={handleMatchClick}
          onRestart={startMatchGame}
          onExit={() => setActiveTab('library')}
        />
      )}

      {/* AI Generate Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div
            ref={aiModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('aiGenerator')}
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
                  {t('aiGenerator')}
                </h2>
                <button type="button" onClick={() => setShowAIModal(false)} disabled={isGenerating} aria-label={t('close')} title={t('close')} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-white dark:bg-slate-800 shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-4">
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('aiGeneratorDesc')}
                </p>
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('aiTopicLabel')}</label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    disabled={isGenerating}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all font-medium"
                    placeholder={t('aiTopicPlaceholder')}
                  />
                </div>
              </div>

              <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowAIModal(false)} disabled={isGenerating} className="rounded-xl font-medium">{t('cancel')}</Button>
                <Button
                  onClick={handleAIGeneration}
                  disabled={!aiTopic.trim() || isGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-8 font-medium shadow-lg shadow-purple-200 dark:shadow-none"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('generating')}</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> {t('generate5')}</>
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
