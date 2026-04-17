export interface SRSData {
  interval: number;
  easeFactor: number;
  nextReview: string;
}

/**
 * SuperMemo-2 (SM-2) Algorithm Implementation
 * 
 * @param quality Quality of response (0-5)
 *  5: perfect response
 *  4: correct response after a hesitation
 *  3: correct response recalled with serious difficulty
 *  2: incorrect response; where the correct one seemed easy to recall
 *  1: incorrect response; the correct one remembered
 *  0: complete blackout
 * @param previousInterval Previous interval in days
 * @param previousEaseFactor Previous ease factor (default 2.5)
 * @returns New SRS data
 */
export function calculateSM2(
  quality: number,
  previousInterval: number,
  previousEaseFactor: number
): SRSData {
  let newInterval = 0;
  let newEaseFactor = previousEaseFactor;

  // Calculate new ease factor
  newEaseFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3;
  }

  // Calculate new interval
  if (quality >= 3) {
    if (previousInterval === 0) {
      newInterval = 1;
    } else if (previousInterval === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(previousInterval * previousEaseFactor);
    }
  } else {
    // If the user failed, reset the interval
    newInterval = 1;
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReview: nextReviewDate.toISOString()
  };
}
