import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaterialsFactory from './MaterialsFactory';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  orderBy: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  auth: {},
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: { role: 'teacher', plan: 'pro' } }),
}));

vi.mock('../lib/saas', () => ({
  hasProAccess: () => true,
}));

vi.mock('../lib/gemini', () => ({
  generateDifferentiatedTest: vi.fn(),
  generateEducationalMaterial: vi.fn(),
}));

vi.mock('../store/useLibraryStore', () => ({
  useLibraryStore: (selector: (state: { setEditingTask: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ setEditingTask: vi.fn() }),
}));

describe('MaterialsFactory smoke', () => {
  it('renders generation workspace and keeps generate action guarded until selection', async () => {
    render(
      <MemoryRouter>
        <MaterialsFactory />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /Materials\s*Factory/i })
    ).toBeInTheDocument();

    const generateButton = screen.getByRole('button', { name: 'Генерирај Материјал' });
    expect(generateButton).toBeDisabled();
  });
});
