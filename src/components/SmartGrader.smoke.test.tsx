import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartGrader } from './SmartGrader';
import { MathTask } from '../lib/schema';

const TASKS: MathTask[] = [
  {
    id: '1',
    type: 'task',
    title: 'Квадратна равенка',
    original_text: 'Реши ја равенката x^2 - 5x + 6 = 0',
    solution_steps: [],
    difficulty: 'medium',
    tags: [],
  } as MathTask,
];

vi.mock('../store/useLibraryStore', () => ({
  useLibraryStore: () => ({ tasks: TASKS }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../lib/gemini', () => ({
  analyzeSolutionImage: vi.fn(),
  generateTargetedPracticeTasks: vi.fn(),
  analyzeBatchTestImage: vi.fn(),
}));

describe('SmartGrader smoke', () => {
  it('keeps the analyze button disabled until both a task and an image are selected (single mode)', () => {
    render(<SmartGrader />);

    const analyzeButton = screen.getByRole('button', { name: /Оцени ракопис/i });
    expect(analyzeButton).toBeDisabled();

    fireEvent.click(screen.getByText('Квадратна равенка'));
    // A task is now selected, but no image was uploaded yet — still disabled.
    expect(analyzeButton).toBeDisabled();
  });

  it('switching to batch mode removes the task-selection requirement but still requires an image', () => {
    render(<SmartGrader />);

    fireEvent.click(screen.getByRole('button', { name: /Бач \(Цел Тест\)/i }));

    expect(screen.getByText(/Автоматско Сегментирање/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Оцени ракопис/i })).toBeDisabled();
  });

  it('filters the task list by search query in single mode', () => {
    render(<SmartGrader />);

    expect(screen.getByText('Квадратна равенка')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Пребарувај во библиотека/i), {
      target: { value: 'нешто-непостоечко' },
    });

    expect(screen.queryByText('Квадратна равенка')).not.toBeInTheDocument();
  });
});
