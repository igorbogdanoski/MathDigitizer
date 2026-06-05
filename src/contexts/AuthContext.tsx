import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../lib/schema';
import { captureError } from '../lib/observability';
import { identifyUser, clearUserIdentity } from '../lib/analytics';
import { hasProAccess } from '../lib/saas';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isLoading: true,
  setUserProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for redirect result first
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect error", error);
      if (error.code === 'auth/unauthorized-domain') {
        showToast("Доменот не е дозволен во Firebase. Додадете го во Firebase Console → Authentication → Authorized Domains.", 'error');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            identifyUser(currentUser.uid, profile.role, hasProAccess(profile));
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          captureError(error, { name: 'auth.fetch-user-profile', path: '/auth', details: { uid: currentUser.uid } });
        }
      } else {
        setUserProfile(null);
        clearUserIdentity();
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, isLoading, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
