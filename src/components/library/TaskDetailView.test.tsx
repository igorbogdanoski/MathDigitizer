import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskDetailView } from './TaskDetailView';
import { MathTask } from '../../lib/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockTask: MathTask = {
  id: 'test-id-1',
  title: 'Тест Задача',
  original_text: 'Ова е текст на тест задачата.',
  difficulty: 'medium',
  tags: ['Алгебра', 'Равенки'],
  solution_steps: ['Чекор 1', 'Чекор 2'],
  latex_formulas: ['x = 2'],
  created_at: new Date().toISOString(),
  nanobanana_prompt: 'Draw a graph',
  source_url: ''
};

const queryClient = new QueryClient();

describe('TaskDetailView Component', () => {
  it('renders task details correctly', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TaskDetailView task={mockTask} taskId="test-id-1" />
      </QueryClientProvider>
    );

    expect(screen.getByText('Текст на задачата')).toBeInTheDocument();
    expect(screen.getByText('Ова е текст на тест задачата.')).toBeInTheDocument();
    expect(screen.getByText('Решение')).toBeInTheDocument();
    expect(screen.getByText('Чекор 1')).toBeInTheDocument();
    expect(screen.getByText('Чекор 2')).toBeInTheDocument();
    expect(screen.getByText('Издвоени Формули')).toBeInTheDocument();
  });
});
