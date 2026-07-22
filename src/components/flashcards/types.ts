export type StudyMode = 'library' | 'flashcards' | 'quiz' | 'match';

export interface SessionStats {
  reviewed: number;
  hard: number;
  good: number;
  easy: number;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  correctAnswer: string;
  options: string[];
}

export interface MatchItem {
  id: string;
  text: string;
  type: 'front' | 'back';
  cardId: string;
  isMatched: boolean;
}
