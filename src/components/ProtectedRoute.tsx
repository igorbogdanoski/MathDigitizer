import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('teacher' | 'student')[];
  requirePro?: boolean;
  proFeatureName?: string;
  proFeatureDescription?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requirePro,
  proFeatureName = 'Pro функционалност',
  proFeatureDescription = 'Оваа алатка е достапна само за Pro Teacher корисници. Надгради за да добиеш пристап.',
}) => {
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
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
    const fallback = userProfile.role === 'student' ? '/student-dashboard' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  if (requirePro && !hasProAccess(userProfile)) {
    return <ProFeatureGate featureName={proFeatureName} description={proFeatureDescription} />;
  }

  return <>{children}</>;
};
