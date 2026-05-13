import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const mockUseAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute smoke', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('redirects unauthenticated users to home', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/" element={<div>Home page</div>} />
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <div>Private page</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('blocks route when role is not allowed', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' },
      userProfile: { role: 'student' },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/teacher-only']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
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
    );

    expect(screen.getByText('Teacher page')).toBeInTheDocument();
  });
});
