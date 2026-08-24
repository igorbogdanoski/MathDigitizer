import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdaptiveTest } from './AdaptiveTest';
import { ToastProvider } from '@/src/contexts/ToastContext';

const getDocs = vi.fn();
const where = vi.fn((field: string, op: string, value: unknown) => ({ field, op, value }));
const limitFn = vi.fn((n: number) => ({ limit: n }));
const query = vi.fn((...args: unknown[]) => ({ constraints: args.slice(1) }));

const TASKS = [
  { id: 't1', title: 'Задача 1', original_text: 'Реши $x+1=2$', solution_steps: ['x=1'], difficulty: 'easy', curriculum_topic: 'Равенки' },
  { id: 't2', title: 'Задача 2', original_text: 'Реши $2x=6$', solution_steps: ['x=3'], difficulty: 'medium', curriculum_topic: 'Равенки' },
];

vi.mock('@/src/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'student-1' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  query: (...args: unknown[]) => query(...args),
  where: (...args: [string, string, unknown]) => where(...args),
  limit: (n: number) => limitFn(n),
  getDocs: (...args: unknown[]) => getDocs(...args),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  updateDoc: vi.fn(),
}));

vi.mock('@/src/contexts/GamificationContext', () => ({
  useGamification: () => ({ awardXP: vi.fn(), updateQuestProgress: vi.fn() }),
}));

vi.mock('@/src/lib/gemini', () => ({
  autoGradeSubmission: vi.fn(),
  generateTargetedPracticeTasks: vi.fn(),
}));

describe('AdaptiveTest smoke', () => {
  beforeEach(() => {
    where.mockClear();
    limitFn.mockClear();
    query.mockClear();
    // mastery query first, then the task queries
    getDocs.mockReset()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValue({ docs: TASKS.map(t => ({ id: t.id, data: () => t })) });
  });

  it('renders a task from a bounded query', async () => {
    render(
      <ToastProvider>
        <AdaptiveTest />
      </ToastProvider>
    );

    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
  });

  it('scopes the mastery read to the signed-in student (regression: whole collection was read)', async () => {
    render(
      <ToastProvider>
        <AdaptiveTest />
      </ToastProvider>
    );

    await waitFor(() => expect(where).toHaveBeenCalled());
    expect(where.mock.calls).toContainEqual(['uid', '==', 'student-1']);
  });

  it('never fetches the tasks collection unbounded', async () => {
    render(
      <ToastProvider>
        <AdaptiveTest />
      </ToastProvider>
    );

    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(2));
    // Every task read carries an explicit limit
    expect(limitFn).toHaveBeenCalled();
    expect(limitFn.mock.calls.every(([n]) => typeof n === 'number' && n > 0)).toBe(true);
  });
});
