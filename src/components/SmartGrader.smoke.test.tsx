import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartGrader } from './SmartGrader';
import { ToastProvider } from '@/src/contexts/ToastContext';

const { TASKS } = vi.hoisted(() => ({
  TASKS: [
    {
      id: '1',
      type: 'task',
      title: 'Квадратна равенка',
      original_text: 'Реши ја равенката x^2 - 5x + 6 = 0',
      solution_steps: [],
      latex_formulas: [],
      source_url: '',
      difficulty: 'medium',
      tags: [],
    },
  ],
}));

vi.mock('@/src/store/useLibraryStore', () => ({
  useLibraryStore: () => ({ tasks: TASKS }),
}));

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));

vi.mock('@/src/lib/firebase', () => ({
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

vi.mock('@/src/lib/gemini', () => ({
  analyzeSolutionImage: vi.fn(),
  generateTargetedPracticeTasks: vi.fn(),
  analyzeBatchTestImage: vi.fn(),
}));

describe('SmartGrader smoke', () => {
  it('keeps the analyze button disabled until both a task and an image are selected (single mode)', () => {
    render(
      <ToastProvider>
        <SmartGrader />
      </ToastProvider>
    );

    const analyzeButton = screen.getByRole('button', { name: /Оцени ракопис/i });
    expect(analyzeButton).toBeDisabled();

    fireEvent.click(screen.getByText('Квадратна равенка'));
    // A task is now selected, but no image was uploaded yet — still disabled.
    expect(analyzeButton).toBeDisabled();
  });

  it('switching to batch mode removes the task-selection requirement but still requires an image', () => {
    render(
      <ToastProvider>
        <SmartGrader />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Бач \(Цел Тест\)/i }));

    expect(screen.getByText(/Автоматско Сегментирање/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Оцени ракопис/i })).toBeDisabled();
  });

  it('filters the task list by search query in single mode', () => {
    render(
      <ToastProvider>
        <SmartGrader />
      </ToastProvider>
    );

    expect(screen.getByText('Квадратна равенка')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Пребарувај во библиотека/i), {
      target: { value: 'нешто-непостоечко' },
    });

    expect(screen.queryByText('Квадратна равенка')).not.toBeInTheDocument();
  });
});
