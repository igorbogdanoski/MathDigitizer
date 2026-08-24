import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Flashcards } from './Flashcards';
import { ToastProvider } from '@/src/contexts/ToastContext';

const updateDoc = vi.fn();
const getDocs = vi.fn();

const CARDS = [
  {
    id: 'c1',
    front: 'Што е $2+2$?',
    back: '$4$',
    user_uid: 'u1',
    deck: 'Аритметика',
    // due: never reviewed, so it has no next_review at all
  },
  {
    id: 'c2',
    front: 'Изводот на $x^2$?',
    back: '$2x$',
    user_uid: 'u1',
    deck: 'Изводи',
    phase: 'review',
    interval: 10,
    ease_factor: 2.5,
    lapses: 0,
    next_review: '2020-01-01T00:00:00.000Z', // long overdue
  },
];

vi.mock('@/src/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  doc: (_db: unknown, _col: string, id: string) => ({ id }),
  addDoc: vi.fn().mockResolvedValue({ id: 'new' }),
  deleteDoc: vi.fn(),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  getDocs: (...args: unknown[]) => getDocs(...args),
}));

vi.mock('@/src/lib/gemini', () => ({
  generateFlashcards: vi.fn(),
  generateSpeech: vi.fn(),
}));

const renderCards = () =>
  render(
    <ToastProvider>
      <Flashcards />
    </ToastProvider>
  );

/** Waits for the Firestore-backed library to render. */
const waitForLibrary = async () => {
  await waitFor(() => expect(screen.getAllByText('Аритметика').length).toBeGreaterThan(0));
};

const deckSelect = () => screen.getByRole('combobox') as HTMLSelectElement;

describe('Flashcards smoke', () => {
  beforeEach(() => {
    updateDoc.mockReset().mockResolvedValue(undefined);
    getDocs.mockReset().mockResolvedValue({
      docs: CARDS.map(card => ({ id: card.id, data: () => card })),
    });
  });

  it('lists the collection and derives the deck filter from the cards', async () => {
    renderCards();
    await waitForLibrary();

    const options = Array.from(deckSelect().querySelectorAll('option')).map(o => o.value);
    expect(options).toEqual(expect.arrayContaining(['', 'Аритметика', 'Изводи']));
  });

  it('filters the library down to a single deck', async () => {
    const { container } = renderCards();
    await waitForLibrary();

    fireEvent.change(deckSelect(), { target: { value: 'Изводи' } });

    await waitFor(() => {
      // Only the <option> keeps the name; the card badge is gone
      expect(screen.getAllByText('Аритметика')).toHaveLength(1);
    });
    expect(container.textContent).toContain('2x');
  });

  it('schedules a failed card minutes away, not a day away (FSRS learning steps)', async () => {
    const { container } = renderCards();
    await waitForLibrary();

    fireEvent.click(screen.getByRole('button', { name: /Start session|Започни|Fillo/i }));

    // Reveal the answer, then fail the card
    const card = await waitFor(() => {
      const el = container.querySelector('[class*="cursor-pointer"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.click(card);

    fireEvent.click(await screen.findByText(/Again|Повтори|Përsërit/));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());

    const [, update] = updateDoc.mock.calls[0] as [unknown, Record<string, any>];
    const minutesAway = (Date.parse(update.next_review) - Date.now()) / 60_000;

    expect(update.phase).toMatch(/learning|relearning/);
    expect(minutesAway).toBeLessThan(30);
    expect(update).toHaveProperty('lapses');
  });

  it('records a lapse when a graduated card is forgotten', async () => {
    // Only the mature card is due, so the session starts on it
    getDocs.mockResolvedValue({ docs: [{ id: CARDS[1].id, data: () => CARDS[1] }] });

    const { container } = renderCards();
    await waitFor(() => expect(screen.getAllByText('Изводи').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /Start session|Започни|Fillo/i }));

    const card = await waitFor(() => {
      const el = container.querySelector('[class*="cursor-pointer"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.click(card);
    fireEvent.click(await screen.findByText(/Again|Повтори|Përsërit/));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const [, update] = updateDoc.mock.calls[0] as [unknown, Record<string, any>];

    expect(update.phase).toBe('relearning');
    expect(update.lapses).toBe(1);
  });
});
