import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { ToastProvider } from '@/src/contexts/ToastContext';

const { mockGetDocs, mockUseAuth } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/src/lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('@/src/lib/gemini', () => ({
  generateInterventionPlan: vi.fn(),
}));

describe('AnalyticsDashboard smoke', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockUseAuth.mockReset();
  });

  it('shows the Pro feature gate for non-Pro users instead of the analytics dashboard', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, userProfile: { role: 'teacher' } });
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(
      <ToastProvider>
        <MemoryRouter>
          <AnalyticsDashboard />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText(/Advanced Analytics/i)).toBeInTheDocument();
  });

  it('shows an empty-data state for Pro users with no graded submissions yet', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, userProfile: { role: 'teacher', isPro: true } });
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(
      <ToastProvider>
        <MemoryRouter>
          <AnalyticsDashboard />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText(/Отсуство на емпириски податоци/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart Grader/i)).toBeInTheDocument();
  });
});
