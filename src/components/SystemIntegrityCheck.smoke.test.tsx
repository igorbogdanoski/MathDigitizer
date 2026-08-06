import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SystemIntegrityCheck } from './SystemIntegrityCheck';

const {
  mockUseAuth,
  mockAddDoc,
  mockGetDoc,
  mockDeleteDoc,
  mockCheckGeminiHealth,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockAddDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockCheckGeminiHealth: vi.fn(),
}));

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/src/lib/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: vi.fn((_db: unknown, _collection: string, id?: string) => ({ id: id ?? 'diag-doc-id' })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
}));

vi.mock('@/src/lib/gemini', () => ({
  checkGeminiHealth: (...args: unknown[]) => mockCheckGeminiHealth(...args),
}));

describe('SystemIntegrityCheck smoke', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockAddDoc.mockReset();
    mockGetDoc.mockReset();
    mockDeleteDoc.mockReset();
    mockCheckGeminiHealth.mockReset();

    mockAddDoc.mockResolvedValue({ id: 'diag-doc-id' });
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    mockDeleteDoc.mockResolvedValue(undefined);
    mockCheckGeminiHealth.mockResolvedValue(true);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/ingestion/diagnostics')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              generatedAt: new Date().toISOString(),
              policyModes: { userInputMode: 'advisory', sourceContentMode: 'advisory' },
              scanner: {
                totalRules: 3,
                bySeverity: { low: 1, medium: 1, high: 1 },
                highSeverityRuleIds: ['rule-high-1'],
              },
              advisories: ['Advisory sample'],
            }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      })
    );
  });

  it('hides ingestion diagnostics controls for non-admin users', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', email: 'teacher@example.com' },
      userProfile: { email: 'teacher@example.com' },
      isLoading: false,
    });

    render(<SystemIntegrityCheck />);

    expect(await screen.findByText('Ingestion diagnostics are restricted to admins.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const diagnosticsCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/api/ingestion/diagnostics'));
    expect(diagnosticsCalls).toHaveLength(0);
  });

  it('shows ingestion diagnostics controls for admin users and fetches diagnostics', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'admin-1', email: 'igor.bogdanoski@mismath.net' },
      userProfile: { email: 'igor.bogdanoski@mismath.net' },
      isLoading: false,
    });

    render(<SystemIntegrityCheck />);

    expect(await screen.findByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preflight: OFF' })).toBeInTheDocument();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => {
      const diagnosticsCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/api/ingestion/diagnostics'));
      expect(diagnosticsCalls.length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Ingestion diagnostics are restricted to admins.')).not.toBeInTheDocument();
  });
});
