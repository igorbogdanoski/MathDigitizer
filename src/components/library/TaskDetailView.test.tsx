import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskDetailView } from './TaskDetailView';
import { MathTask } from '../../lib/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../contexts/ToastContext';

const mockTask: MathTask = {
  id: 'test-id-1',
  title: 'Тест Задача',
  original_text: 'Ова е текст на тест задачата.',
  difficulty: 'medium',
  tags: ['Алгебра', 'Равенки'],
  solution_steps: ['Чекор 1', 'Чекор 2'],
  latex_formulas: ['x = 2'],
  created_at: new Date().toISOString(),
  illustration_prompt: 'Draw a graph',
  source_url: ''
};

const queryClient = new QueryClient();

describe('TaskDetailView Component', () => {
  it('renders task details correctly', { timeout: 15000 }, () => {
    render(
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <TaskDetailView task={mockTask} taskId="test-id-1" />
        </QueryClientProvider>
      </ToastProvider>
    );

    // The component renders with the correct test id
    expect(screen.getByTestId('task-detail-test-id-1')).toBeInTheDocument();

    // Section header is always rendered (hardcoded, not i18n)
    expect(screen.getByText('Текст на задачата')).toBeInTheDocument();

    // DoK level indicator is rendered
    expect(screen.getByText('DoK Level')).toBeInTheDocument();
  });
});
