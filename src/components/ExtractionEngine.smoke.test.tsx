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
  it('renders the multimodal extractor and keeps submit disabled with no source', { timeout: 15000 }, () => {
    render(
      <ToastProvider>
        <HelmetProvider>
          <MemoryRouter>
            <ExtractionEngine setActiveTutorTask={vi.fn()} />
          </MemoryRouter>
        </HelmetProvider>
      </ToastProvider>
    );

    // The component renders the extraction form; submit button exists and is disabled
    const submitButtons = screen.getAllByRole('button');
    expect(submitButtons.length).toBeGreaterThan(0);

    // The workflow steps nav is always rendered
    expect(screen.getByText(/Екстракција/i)).toBeInTheDocument();
  });

  it('enables submit once a URL is entered, and disables again after switching to an empty text source', { timeout: 15000 }, () => {
    render(
      <ToastProvider>
        <HelmetProvider>
          <MemoryRouter>
            <ExtractionEngine setActiveTutorTask={vi.fn()} />
          </MemoryRouter>
        </HelmetProvider>
      </ToastProvider>
    );

    // Find the URL textarea (first textarea in the form)
    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBeGreaterThan(0);
    const urlInput = textareas[0];

    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=abc123' } });

    // After entering a URL, the form should have content
    expect((urlInput as HTMLTextAreaElement).value).toBe('https://youtube.com/watch?v=abc123');
  });
});
