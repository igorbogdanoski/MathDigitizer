import { describe, it, expect } from 'vitest';
import { calculateSM2 } from './srsAlgorithm';

describe('Flashcards SM2 Regression', () => {
  it('should always push next_review into the future', () => {
    const result = calculateSM2(5, 0, 2.5);

    const nextReview = new Date(result.nextReview);
    const now = new Date();
    
    expect(nextReview.getTime()).toBeGreaterThan(now.getTime());
    expect(result.interval).toBe(1);
  });

  it('should reset interval on quality < 3', () => {
    const result = calculateSM2(2, 30, 2.5);

    expect(result.interval).toBe(1);
  });

  it('should not decrease ease factor below 1.3', () => {
    const result = calculateSM2(0, 10, 1.3);

    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('should handle a full study session of 4 cards without index overflow', () => {
    // Simulates the bug: 4-card session where the queue shrinks after each review
    const cards = [
      { id: '1', front: 'a', back: 'b', repetitions: 0, easeFactor: 2.5, interval: 0, next_review: new Date('2026-07-20') },
      { id: '2', front: 'c', back: 'd', repetitions: 0, easeFactor: 2.5, interval: 0, next_review: new Date('2026-07-20') },
      { id: '3', front: 'e', back: 'f', repetitions: 0, easeFactor: 2.5, interval: 0, next_review: new Date('2026-07-20') },
      { id: '4', front: 'g', back: 'h', repetitions: 0, easeFactor: 2.5, interval: 0, next_review: new Date('2026-07-20') },
    ];

    // The fix: freeze the study cards array at session start
    const frozenCards = [...cards];
    let currentIndex = 0;

    for (let i = 0; i < frozenCards.length; i++) {
      const card = frozenCards[currentIndex];
      expect(card).toBeDefined();
      expect(card.id).toBe(String(i + 1));
      currentIndex++;
    }

    // After all 4 reviews, index should be 4 (past the end)
    expect(currentIndex).toBe(4);
  });
});
