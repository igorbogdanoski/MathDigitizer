import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TutorChat } from './TutorChat';

const { mockSendMessage, mockGetTutorChatSession } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockGetTutorChatSession: vi.fn(),
}));

vi.mock('@/src/lib/gemini', () => ({
  getTutorChatSession: (...args: unknown[]) => mockGetTutorChatSession(...args),
  analyzeSolutionImage: vi.fn(),
  generateSpeech: vi.fn(),
}));

vi.mock('@/src/store/useLibraryStore', () => ({
  useLibraryStore: () => ({ tasks: [] }),
}));

vi.mock('@/src/components/MathRenderer', () => ({
  MathRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/src/components/InteractiveCanvas', () => ({
  InteractiveCanvas: () => <div>Canvas</div>,
}));

describe('TutorChat smoke', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    mockSendMessage.mockReset();
    mockGetTutorChatSession.mockReset();
    mockSendMessage.mockResolvedValue({ text: 'Одлично, продолжи со следниот чекор.' });
    mockGetTutorChatSession.mockResolvedValue({ sendMessage: mockSendMessage });
  });

  it('initializes chat and responds to user message', { timeout: 15000 }, async () => {
    render(
      <TutorChat
        task={{
          id: 'task-1',
          title: 'Линеарна равенка',
          original_text: 'Реши ја равенката $x + 2 = 5$.',
          solution_steps: ['Одземи 2 од двете страни'],
          latex_formulas: ['x+2=5'],
          source_url: '',
          tags: ['алгебра'],
          difficulty: 'easy',
        }}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText(/Здраво!/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Внеси твое размислување или формула овде...');
    fireEvent.change(input, { target: { value: 'Мој чекор е x = 3' } });

    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({ message: 'Мој чекор е x = 3' });
    });

    expect(await screen.findByText('Одлично, продолжи со следниот чекор.')).toBeInTheDocument();
  });
});
