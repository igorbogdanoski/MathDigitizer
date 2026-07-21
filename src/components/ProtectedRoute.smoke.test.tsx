import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { ToastProvider } from '@/src/contexts/ToastContext';

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/src/lib/firebase', () => ({
  signInWithGoogle: vi.fn(),
}));

describe('ProtectedRoute smoke', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('shows an in-place sign-in gate for unauthenticated users instead of redirecting', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      isLoading: false,
    });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/private']}>
          <Routes>
            <Route path="/" element={<div>Home page</div>} />
            <Route
              path="/private"
              element={
                <ProtectedRoute authFeatureName="Приватна страница">
                  <div>Private page</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.queryByText('Home page')).not.toBeInTheDocument();
    expect(screen.queryByText('Private page')).not.toBeInTheDocument();
    expect(screen.getByText(/Најави се со Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Приватна страница/i)).toBeInTheDocument();
  });

  it('blocks route when role is not allowed — student goes to /student-dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' },
      userProfile: { role: 'student' },
      isLoading: false,
    });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/teacher-only']}>
          <Routes>
            <Route path="/student-dashboard" element={<div>Student dashboard page</div>} />
            <Route
              path="/teacher-only"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <div>Teacher page</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Student dashboard page')).toBeInTheDocument();
  });

  it('blocks route when role is not allowed — teacher goes to /dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' },
      userProfile: { role: 'teacher' },
      isLoading: false,
    });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/student-only']}>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard page</div>} />
            <Route
              path="/student-only"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <div>Student page</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('renders protected content for allowed role', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' },
      userProfile: { role: 'teacher' },
      isLoading: false,
    });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/teacher-only']}>
          <Routes>
            <Route
              path="/teacher-only"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <div>Teacher page</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Teacher page')).toBeInTheDocument();
  });
});
