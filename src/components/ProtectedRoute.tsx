import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';
import { AuthRequiredGate } from './AuthRequiredGate';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('teacher' | 'student')[];
  requirePro?: boolean;
  proFeatureName?: string;
  proFeatureDescription?: string;
  /** Human-readable label shown on the sign-in gate, e.g. "Библиотека". */
  authFeatureName?: string;
  authFeatureDescription?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requirePro,
  proFeatureName = 'Pro функционалност',
  proFeatureDescription = 'Оваа алатка е достапна само за Pro Teacher корисници. Надгради за да добиеш пристап.',
  authFeatureName,
  authFeatureDescription,
}) => {
  const { user, userProfile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500">Се вчитува...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthRequiredGate featureName={authFeatureName} description={authFeatureDescription} />;
  }

  if (allowedRoles) {
    // Profile not loaded yet (mid-onboarding, or the fetch failed and left
    // userProfile null) — block rendering rather than silently letting the
    // role check no-op and falling through to the protected content below.
    if (!userProfile) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-500">Се вчитува...</p>
        </div>
      );
    }
    if (!allowedRoles.includes(userProfile.role)) {
      const fallback = userProfile.role === 'student' ? '/student-dashboard' : '/dashboard';
      return <Navigate to={fallback} replace />;
    }
  }

  if (requirePro && !hasProAccess(userProfile)) {
    return <ProFeatureGate featureName={proFeatureName} description={proFeatureDescription} />;
  }

  return <>{children}</>;
};
