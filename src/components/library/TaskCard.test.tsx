import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard';
import { MathTask } from '../../lib/schema';

const mockTask: MathTask = {
  id: 'test-id-1',
  title: 'Тест Задача',
  original_text: 'Ова е текст на тест задачата.',
  difficulty: 'medium',
  tags: ['Алгебра', 'Равенки'],
  solution_steps: ['Чекор 1', 'Чекор 2'],
  latex_formulas: ['x = 2'],
  created_at: new Date().toISOString(),
  illustration_prompt: '',
  source_url: ''
};

describe('TaskCard Component', () => {
  it('renders task title and original text correctly', () => {
    render(
      <TaskCard 
        task={mockTask}
        taskId="test-id-1"
        isSelected={false}
        isDeleting={false}
        isSelectionMode={false}
        isSelectedForTest={false}
        onSelect={vi.fn()}
        onToggleSelection={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
      />
    );

    expect(screen.getByText('Тест Задача')).toBeInTheDocument();
    expect(screen.getByText('Ова е текст на тест задачата.')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('Алгебра')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelectMock = vi.fn();
    render(
      <TaskCard 
        task={mockTask}
        taskId="test-id-1"
        isSelected={false}
        isDeleting={false}
        isSelectionMode={false}
        isSelectedForTest={false}
        onSelect={onSelectMock}
        onToggleSelection={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('task-card-test-id-1'));
    expect(onSelectMock).toHaveBeenCalledTimes(1);
  });

  it('shows selection checkbox when in selection mode', () => {
    const onToggleSelectionMock = vi.fn();
    render(
      <TaskCard 
        task={mockTask}
        taskId="test-id-1"
        isSelected={false}
        isDeleting={false}
        isSelectionMode={true}
        isSelectedForTest={true}
        onSelect={vi.fn()}
        onToggleSelection={onToggleSelectionMock}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
      />
    );

    const checkbox = screen.getByTestId('task-select-test-id-1');
    expect(checkbox).toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(onToggleSelectionMock).toHaveBeenCalledTimes(1);
  });
});
