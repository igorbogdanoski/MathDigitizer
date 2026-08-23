import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { SmartOCR } from './SmartOCR';
import { ToastProvider } from '@/src/contexts/ToastContext';

const extractMathTasksFromImage = vi.fn();
const addDoc = vi.fn();
const generateTaskEmbedding = vi.fn();
const classifyTaskCurriculum = vi.fn();

vi.mock('@/src/lib/gemini', () => ({
  extractMathTasksFromImage: (...a: unknown[]) => extractMathTasksFromImage(...a),
  extractMathTasksFromPdf: vi.fn(),
  enrichTaskPedagogy: vi.fn(),
  generateTaskEmbedding: (...a: unknown[]) => generateTaskEmbedding(...a),
  classifyTaskCurriculum: (...a: unknown[]) => classifyTaskCurriculum(...a),
}));

vi.mock('@/src/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'teacher-1' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: (...a: unknown[]) => addDoc(...a),
  updateDoc: vi.fn(),
}));

const ocrTask = (over: Record<string, unknown> = {}) => ({
  title: 'Линеарна равенка',
  original_text: 'Реши ја равенката $2x+3=7$.',
  solution_steps: ['Одземи 3: $2x=4$', 'Подели со 2: $x=2$'],
  difficulty: 'easy',
  type: 'task',
  curriculum_topic: 'Линеарни равенки',
  tags: ['равенки'],
  ...over,
});

const renderOcr = () =>
  render(
    <ToastProvider>
      <HelmetProvider>
        <MemoryRouter>
          <SmartOCR />
        </MemoryRouter>
      </HelmetProvider>
    </ToastProvider>
  );

/** Drops a single image file on the hidden file input to trigger a scan. */
const dropImage = (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { files: [new File(['x'], 'task.png', { type: 'image/png' })] } });
};

describe('SmartOCR smoke', () => {
  beforeEach(() => {
    extractMathTasksFromImage.mockReset();
    addDoc.mockReset().mockResolvedValue({ id: 'doc-1' });
    generateTaskEmbedding.mockReset().mockResolvedValue([0.1, 0.2]);
    classifyTaskCurriculum.mockReset().mockResolvedValue([]);
  });

  it('renders the scanner with the Albanian output language available', () => {
    renderOcr();
    const languageSelect = screen.getAllByRole('combobox')[0];
    const values = Array.from(languageSelect.querySelectorAll('option')).map(o => (o as HTMLOptionElement).value);
    expect(values).toContain('al');
  });

  it('passes the selected visualization mode through to the extractor', async () => {
    extractMathTasksFromImage.mockResolvedValue([ocrTask()]);
    const { container } = renderOcr();

    const vizSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(vizSelect, { target: { value: 'tikz' } });

    dropImage(container);

    await waitFor(() => expect(extractMathTasksFromImage).toHaveBeenCalledTimes(1));
    expect(extractMathTasksFromImage.mock.calls[0][5]).toBe('tikz');
  });

  it('keeps every task from a single scan instead of only the first', async () => {
    extractMathTasksFromImage.mockResolvedValue([
      ocrTask({ title: 'Прва' }),
      ocrTask({ title: 'Втора', original_text: 'Пресметај $5\\cdot 4$.' }),
      ocrTask({ title: 'Трета', original_text: 'Најди $x$ ако $x-1=0$.' }),
    ]);

    const { container } = renderOcr();
    dropImage(container);

    // A tab per extracted task appears
    const tabs = await screen.findAllByRole('tab');
    expect(tabs).toHaveLength(3);

    // Switching tabs loads that task into the editor
    fireEvent.click(tabs[1]);
    await waitFor(() => {
      const editor = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(editor.value).toContain('5\\cdot 4');
    });
  });

  it('blocks saving invalid LaTeX and lists the failing segments', async () => {
    extractMathTasksFromImage.mockResolvedValue([ocrTask()]);
    const { container } = renderOcr();
    dropImage(container);

    const editor = (await waitFor(() => {
      const el = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(el.value).toContain('2x+3=7');
      return el;
    })) as HTMLTextAreaElement;

    // A typo'd command survives sanitizeLatex's auto-repairs and must be caught
    fireEvent.change(editor, { target: { value: 'Реши $\\fracc{1}{2}$' } });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/LaTeX/i);

    const saveButton = screen.getByRole('button', { name: /Зачувај|Save/i });
    expect(saveButton).toBeDisabled();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('saves the statement and the solution into separate fields, with embedding', async () => {
    extractMathTasksFromImage.mockResolvedValue([ocrTask()]);
    const { container } = renderOcr();
    dropImage(container);

    await waitFor(() => {
      const el = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(el.value).toContain('2x+3=7');
    });

    fireEvent.click(screen.getByRole('button', { name: /Зачувај|Save/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

    const payload = addDoc.mock.calls[0][1] as Record<string, any>;
    expect(payload.original_text).toBe('Реши ја равенката $2x+3=7$.');
    expect(payload.original_text).not.toContain('Подели со 2');
    expect(payload.solution_steps).toEqual(['Одземи 3: $2x=4$', 'Подели со 2: $x=2$']);
    expect(payload.author_uid).toBe('teacher-1');
    expect(payload.embedding).toEqual([0.1, 0.2]);
    expect(classifyTaskCurriculum).toHaveBeenCalled();
  });
});
