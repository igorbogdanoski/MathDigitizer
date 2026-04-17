import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateSM2 } from './srsAlgorithm';

describe('SM-2 Algorithm', () => {
  beforeEach(() => {
    // Mock the date so we can predictably test nextReview
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes correctly on first successful review (quality 4)', () => {
    const result = calculateSM2(4, 0, 2.5);
    expect(result.interval).toBe(1);
    // Ease factor should slightly decrease for quality 4
    // 2.5 + (0.1 - (1) * (0.08 + 1 * 0.02)) = 2.5 + (0.1 - 0.1) = 2.5
    expect(result.easeFactor).toBe(2.5);
    expect(result.nextReview).toBe(new Date('2026-04-14T12:00:00Z').toISOString());
  });

  it('increases interval to 6 on second successful review (quality 5)', () => {
    const result = calculateSM2(5, 1, 2.5);
    expect(result.interval).toBe(6);
    // Ease factor should increase for quality 5
    // 2.5 + (0.1 - 0) = 2.6
    expect(result.easeFactor).toBe(2.6);
    expect(result.nextReview).toBe(new Date('2026-04-19T12:00:00Z').toISOString());
  });

  it('multiplies interval by ease factor on subsequent successful reviews', () => {
    const result = calculateSM2(4, 6, 2.6);
    // 6 * 2.6 = 15.6 -> rounded to 16
    expect(result.interval).toBe(16);
    expect(result.easeFactor).toBe(2.6);
    expect(result.nextReview).toBe(new Date('2026-04-29T12:00:00Z').toISOString());
  });

  it('resets interval to 1 on failed review (quality < 3)', () => {
    const result = calculateSM2(2, 16, 2.6);
    expect(result.interval).toBe(1);
    // Ease factor should decrease heavily
    // 2.6 + (0.1 - 3 * (0.08 + 3 * 0.02)) = 2.6 + (0.1 - 3 * 0.14) = 2.6 - 0.32 = 2.28
    expect(result.easeFactor).toBeCloseTo(2.28, 2);
    expect(result.nextReview).toBe(new Date('2026-04-14T12:00:00Z').toISOString());
  });

  it('does not let ease factor drop below 1.3', () => {
    const result = calculateSM2(0, 10, 1.4);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(1.3); // Should cap at 1.3
  });
});
