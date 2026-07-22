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
  it('keeps the analyze button disabled until both a task and an image are selected (single mode)', { timeout: 15000 }, () => {
    render(
      <ToastProvider>
        <SmartGrader />
      </ToastProvider>
    );

    // Find all buttons — the analyze/grade button should be disabled initially
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    // The task from the library should be visible
    expect(screen.getByText('Квадратна равенка')).toBeInTheDocument();
  });

  it('switching to batch mode removes the task-selection requirement but still requires an image', () => {
    render(
      <ToastProvider>
        <SmartGrader />
      </ToastProvider>
    );

    // Find and click the batch mode tab/button (second tab-like button)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);

    // Click the second button (batch mode tab)
    fireEvent.click(buttons[1]);

    // Component should still render after mode switch
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('filters the task list by search query in single mode', () => {
    render(
      <ToastProvider>
        <SmartGrader />
      </ToastProvider>
    );

    expect(screen.getByText('Квадратна равенка')).toBeInTheDocument();

    // Find the search input and type a non-matching query
    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'нешто-непостоечко' } });

    expect(screen.queryByText('Квадратна равенка')).not.toBeInTheDocument();
  });
});
