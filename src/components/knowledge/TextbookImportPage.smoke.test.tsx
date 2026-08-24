import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { extract, getSkills, saveSkills, removeBook, distil } = vi.hoisted(() => ({
  extract: vi.fn(),
  getSkills: vi.fn(),
  saveSkills: vi.fn(),
  removeBook: vi.fn(),
  distil: vi.fn(),
}));

vi.mock('@/src/lib/documents/extractText', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/documents/extractText')>();
  return { ...actual, extractDocumentText: extract };
});
vi.mock('@/src/lib/knowledge/store', () => ({
  getChapterSkills: getSkills,
  saveChapterSkills: saveSkills,
  deleteBook: removeBook,
  bookIdFor: (owner: string, title: string) => `${owner}:${title}`,
  KNOWLEDGE_COLLECTION: 'knowledge_skills',
}));
vi.mock('@/src/lib/knowledge/context', () => ({
  buildKnowledgeContextBlock: vi.fn(),
  invalidateKnowledgeCache: vi.fn(),
}));
vi.mock('@/src/lib/ai/knowledge', () => ({ distilBook: distil }));
vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'teacher1' }, userProfile: { role: 'teacher' } }),
}));
vi.mock('@/src/contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { TextbookImportPage } from './TextbookImportPage';

const DISTIL = /Внеси во базата|Add to the knowledge base|Shto në bazën/;
const BASIS = /На која основа|On what basis|Mbi çfarë baze/;

const body = (label: string) => `${label} `.repeat(80) + '\n';
const bookText =
  `ТЕМА 1: ДРОПКИ\n${body('дропки')}` +
  `ТЕМА 2: ПРОЦЕНТИ\n${body('проценти')}` +
  `ТЕМА 3: РАВЕНКИ\n${body('равенки')}`;

const pickFile = async () => {
  const input = document.getElementById('textbook-file') as HTMLInputElement;
  const file = new File(['x'], 'Математика 5.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
};

/**
 * Phase 10's pipeline was written and tested before any screen could reach it.
 * These assert the connection, and the one rule that must not be bypassable:
 * nothing is distilled without a sound right-to-use declaration.
 */
describe('TextbookImportPage', () => {
  beforeEach(() => {
    extract.mockReset().mockResolvedValue({
      text: bookText, pageCount: 12, source: 'pdf', empty: false, invisiblesRemoved: 0,
    });
    getSkills.mockReset().mockResolvedValue([]);
    saveSkills.mockReset().mockResolvedValue(1);
    removeBook.mockReset().mockResolvedValue(1);
    distil.mockReset().mockResolvedValue([{ chapterIndex: 0, bookId: 'b', bookTitle: 'Математика 5' }]);
  });

  it('reads a file and reports what it found', async () => {
    render(<TextbookImportPage />);
    await pickFile();

    expect(await screen.findByText('Математика 5')).toBeInTheDocument();
    expect(await screen.findByText(/12/)).toBeInTheDocument();
  });

  it('will not distil until the teacher declares a basis', async () => {
    // The gate that matters. `distilBook` throws without a declaration; this
    // makes sure the screen never reaches that point in the first place.
    render(<TextbookImportPage />);
    await pickFile();

    const button = await screen.findByRole('button', { name: DISTIL });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(distil).not.toHaveBeenCalled();
  });

  it('distils once a basis that needs no note is chosen', async () => {
    render(<TextbookImportPage />);
    await pickFile();

    fireEvent.change(await screen.findByLabelText(BASIS), { target: { value: 'own_work' } });

    const button = await screen.findByRole('button', { name: DISTIL });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(distil).toHaveBeenCalledTimes(1));
    expect(distil.mock.calls[0][1].usage).toMatchObject({ basis: 'own_work', declaredBy: 'teacher1' });
  });

  it('holds an open licence back until it is named', async () => {
    // CC BY and CC BY-NC-ND permit very different things; "open licence" on its
    // own is a hope, not a declaration.
    render(<TextbookImportPage />);
    await pickFile();

    fireEvent.change(await screen.findByLabelText(BASIS), { target: { value: 'open_licence' } });
    await waitFor(() => expect(screen.getByRole('button', { name: DISTIL })).toBeDisabled());

    fireEvent.change(screen.getByLabelText(/Наведете ја лиценцата|Name the licence|Emërtoni licencën/), {
      target: { value: 'CC BY 4.0' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: DISTIL })).toBeEnabled());
  });

  it('says so when the file yields no text', async () => {
    extract.mockResolvedValue({ text: '', pageCount: 3, source: 'pdf', empty: true, invisiblesRemoved: 0 });
    render(<TextbookImportPage />);
    await pickFile();

    await waitFor(() => expect(screen.queryByRole('button', { name: DISTIL })).not.toBeInTheDocument());
  });

  it('warns when the document carried hidden characters', async () => {
    extract.mockResolvedValue({
      text: bookText, pageCount: 5, source: 'pdf', empty: false, invisiblesRemoved: 340,
    });
    render(<TextbookImportPage />);
    await pickFile();

    expect(await screen.findByText(/340/)).toBeInTheDocument();
  });

  it('lists the books already imported', async () => {
    getSkills.mockResolvedValue([
      { bookId: 'b1', bookTitle: 'Алгебра I', chapterIndex: 0 },
      { bookId: 'b1', bookTitle: 'Алгебра I', chapterIndex: 1 },
    ]);

    render(<TextbookImportPage />);
    expect(await screen.findByText('Алгебра I')).toBeInTheDocument();
  });
});
