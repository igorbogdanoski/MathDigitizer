import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('teacher' | 'student')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userProfile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500">Се вчитува...</p>
      </div>
    );
  }

  if (!user) {
    // Redirect to home if not logged in
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
    // Redirect to dashboard if user role is not allowed for this route
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
