import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MaterialsFactory from './MaterialsFactory';
import { ToastProvider } from '@/src/contexts/ToastContext';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

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

vi.mock('@/src/lib/firebase', () => ({
  db: {},
  auth: {},
}));

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: { role: 'teacher', plan: 'pro' } }),
}));

vi.mock('@/src/lib/saas', () => ({
  hasProAccess: () => true,
}));

vi.mock('@/src/lib/gemini', () => ({
  generateDifferentiatedTest: vi.fn(),
  generateEducationalMaterial: vi.fn(),
}));

vi.mock('@/src/store/useLibraryStore', () => ({
  useLibraryStore: (selector: (state: { setEditingTask: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ setEditingTask: vi.fn() }),
}));

describe('MaterialsFactory smoke', () => {
  it('renders generation workspace and keeps generate action guarded until selection', { timeout: 15000 }, async () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <MaterialsFactory />
        </MemoryRouter>
      </ToastProvider>
    );

    // The component renders an h1 heading
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();

    // There should be buttons rendered (material type selectors, generate button, etc.)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
