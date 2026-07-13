import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsDashboard } from './AnalyticsDashboard';

const mockGetDocs = vi.fn();
const mockHasProAccess = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { role: 'teacher' } }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../lib/saas', () => ({
  hasProAccess: (...args: unknown[]) => mockHasProAccess(...args),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('../lib/gemini', () => ({
  generateInterventionPlan: vi.fn(),
}));

describe('AnalyticsDashboard smoke', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockHasProAccess.mockReset();
  });

  it('shows the Pro feature gate for non-Pro users instead of the analytics dashboard', () => {
    mockHasProAccess.mockReturnValue(false);
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(
      <MemoryRouter>
        <AnalyticsDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/Advanced Analytics/i)).toBeInTheDocument();
  });

  it('shows an empty-data state for Pro users with no graded submissions yet', async () => {
    mockHasProAccess.mockReturnValue(true);
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(
      <MemoryRouter>
        <AnalyticsDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Отсуство на емпириски податоци/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart Grader/i)).toBeInTheDocument();
  });
});
