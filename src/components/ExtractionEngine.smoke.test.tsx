import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ExtractionEngine } from './ExtractionEngine';
import { ToastProvider } from '@/src/contexts/ToastContext';

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, userProfile: null }),
}));

vi.mock('@/src/contexts/GamificationContext', () => ({
  useGamification: () => ({ awardXP: vi.fn(), updateQuestProgress: vi.fn() }),
}));

vi.mock('@/src/lib/saas', () => ({
  hasProAccess: () => false,
}));

vi.mock('@/src/store/useLibraryStore', () => ({
  useLibraryStore: () => ({ setEditingTask: vi.fn(), setOnTaskUpdated: vi.fn() }),
}));

vi.mock('@/src/lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('@/src/lib/gemini', () => ({
  extractMathTasksFromUrl: vi.fn(),
  generateImage: vi.fn(),
  generateMathGraphicConfig: vi.fn(),
  advancedMultimodalExtraction: vi.fn(),
  enrichTaskPedagogy: vi.fn(),
  generateTaskEmbedding: vi.fn(),
}));

vi.mock('@/src/lib/export', () => ({
  exportToJson: vi.fn(),
  exportToLatex: vi.fn(),
  exportToMarkdown: vi.fn(),
  exportToTxt: vi.fn(),
}));

describe('ExtractionEngine smoke', () => {
  it('renders the multimodal extractor and keeps submit disabled with no source', () => {
    render(
      <ToastProvider>
        <HelmetProvider>
          <MemoryRouter>
            <ExtractionEngine setActiveTutorTask={vi.fn()} />
          </MemoryRouter>
        </HelmetProvider>
      </ToastProvider>
    );

    expect(screen.getByText(/Multimodal AI Екстрактор/i)).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /Процесирај/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit once a URL is entered, and disables again after switching to an empty text source', () => {
    render(
      <ToastProvider>
        <HelmetProvider>
          <MemoryRouter>
            <ExtractionEngine setActiveTutorTask={vi.fn()} />
          </MemoryRouter>
        </HelmetProvider>
      </ToastProvider>
    );

    const urlInput = screen.getByPlaceholderText(/Вметнете еден или повеќе линкови/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=abc123' } });

    const submitButton = screen.getByRole('button', { name: /Процесирај/i });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Текст \/ Рачен Транскрипт/i }));
    expect(screen.getByRole('button', { name: /Процесирај/i })).toBeDisabled();
  });
});
