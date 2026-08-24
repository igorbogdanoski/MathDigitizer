import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { getSkills, auth } = vi.hoisted(() => ({
  getSkills: vi.fn(),
  auth: { value: { user: { uid: 'teacher1' }, userProfile: { role: 'teacher' } } },
}));

vi.mock('@/src/lib/knowledge/store', () => ({ getChapterSkills: getSkills }));
vi.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

import { TextbookGradingHint } from './TextbookGradingHint';

const ACTION = /Внеси учебник|Import a textbook|Importo një tekst/;

const show = () => render(
  <MemoryRouter><TextbookGradingHint /></MemoryRouter>
);

/**
 * The hint exists because textbook import is not a destination — nobody sits
 * down wanting to import one. It is an enhancement to grading, so it is offered
 * at the screen where the difference shows, and only while it would make one.
 */
describe('TextbookGradingHint', () => {
  beforeEach(() => {
    localStorage.clear();
    getSkills.mockReset().mockResolvedValue([]);
    auth.value = { user: { uid: 'teacher1' }, userProfile: { role: 'teacher' } };
  });

  it('explains what importing changes, not just that it exists', async () => {
    show();

    // The reason is the whole point: a tile would say the name and none of it.
    expect(await screen.findByText(/ЗОШТО|WHY|PSE/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ACTION })).toHaveAttribute('href', '/textbooks');
  });

  it('says nothing once a textbook is imported', async () => {
    getSkills.mockResolvedValue([{ bookId: 'b1', chapterIndex: 0 }]);
    show();

    await waitFor(() => expect(getSkills).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: ACTION })).not.toBeInTheDocument();
  });

  it('stays dismissed once refused', async () => {
    // An offer that cannot be refused is an advertisement.
    const { unmount } = show();

    fireEvent.click(await screen.findByRole('button', { name: /Затвори|Dismiss|Mbyll/ }));
    expect(screen.queryByRole('link', { name: ACTION })).not.toBeInTheDocument();

    unmount();
    show();

    await waitFor(() => expect(getSkills).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: ACTION })).not.toBeInTheDocument();
  });

  it('says nothing to a student', async () => {
    auth.value = { user: { uid: 's1' }, userProfile: { role: 'student' } } as never;
    show();

    await waitFor(() => expect(getSkills).not.toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: ACTION })).not.toBeInTheDocument();
  });

  it('says nothing when nobody is signed in', async () => {
    auth.value = { user: null, userProfile: null } as never;
    show();

    await waitFor(() => expect(getSkills).not.toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: ACTION })).not.toBeInTheDocument();
  });

  it('stays quiet rather than failing the screen when the check errors', async () => {
    // A hint is not worth a broken grading screen.
    getSkills.mockRejectedValue(new Error('offline'));
    show();

    await waitFor(() => expect(getSkills).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: ACTION })).not.toBeInTheDocument();
  });
});
