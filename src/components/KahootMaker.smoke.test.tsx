import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KahootMaker } from './KahootMaker';

const generateKahootFromFiles = vi.fn();

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'teacher-1' }, userProfile: { role: 'teacher' } }),
}));

vi.mock('@/src/lib/gemini', () => ({
  generateKahootFromFiles: (...args: unknown[]) => generateKahootFromFiles(...args),
}));

vi.mock('@/src/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

const renderMaker = () =>
  render(
    <MemoryRouter>
      <KahootMaker />
    </MemoryRouter>
  );

describe('KahootMaker smoke', () => {
  beforeEach(() => {
    generateKahootFromFiles.mockReset();
  });

  it('renders the generator form and blocks generation with no sources', async () => {
    renderMaker();

    expect(screen.getByText(/MathKahoot/i)).toBeInTheDocument();

    const generate = screen.getByRole('button', { name: /Генерирај|Generate/i });
    fireEvent.click(generate);

    // No files attached: the AI generator must never be called
    await waitFor(() => expect(generateKahootFromFiles).not.toHaveBeenCalled());
    expect(await screen.findByText(/прикачете|attach/i)).toBeInTheDocument();
  });

  it('renders the validated quiz preview with rendered math and per-question time limits', async () => {
    generateKahootFromFiles.mockResolvedValue({
      title: 'Линеарни равенки',
      questions: [
        {
          question: 'Реши $2x + 3 = 7$',
          options: ['$x=2$', '$x=3$', '$x=4$', '$x=5$'],
          correctIndex: 0,
          hint: 'Одземи 3',
          // no timeLimit — the component must default it to 60s
        },
      ],
    });

    const { container } = renderMaker();

    // Attach a source so the generate path is unlocked
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File(['fake'], 'lesson.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('lesson.png')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Генерирај|Generate/i }));

    await waitFor(() => expect(generateKahootFromFiles).toHaveBeenCalledTimes(1));

    // Preview appears with the four options and a time-limit select per question
    const select = await screen.findByRole('combobox');
    expect((select as HTMLSelectElement).value).toBe('60');

    // Math is rendered through MathRenderer, not shown as raw $...$ source
    expect(container.querySelector('.katex')).toBeTruthy();
    expect(container.textContent).not.toContain('$2x + 3 = 7$');
  });

  it('updates only the targeted question time limit without mutating the draft', async () => {
    generateKahootFromFiles.mockResolvedValue({
      title: 'Квиз',
      questions: [
        { question: 'A', options: ['1', '2', '3', '4'], correctIndex: 0, timeLimit: 60 },
        { question: 'B', options: ['1', '2', '3', '4'], correctIndex: 1, timeLimit: 60 },
      ],
    });

    const { container } = renderMaker();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'q.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByText('q.png')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Генерирај|Generate/i }));

    const selects = await screen.findAllByRole('combobox');
    expect(selects).toHaveLength(2);

    fireEvent.change(selects[0], { target: { value: '120' } });

    await waitFor(() => expect((selects[0] as HTMLSelectElement).value).toBe('120'));
    expect((selects[1] as HTMLSelectElement).value).toBe('60');
  });
});
