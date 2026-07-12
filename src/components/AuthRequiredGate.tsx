import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { signInWithGoogle } from '../lib/firebase';
import { useToast } from '../contexts/ToastContext';

interface AuthRequiredGateProps {
  featureName?: string;
  description?: string;
}

/**
 * Rendered in place of a protected route's content when the visitor is not
 * signed in. This replaces the old silent `Navigate to="/"` behaviour so the
 * user always understands why a page requires an account, and never loses
 * their place in the app — signing in here re-renders this same route.
 */
export const AuthRequiredGate: React.FC<AuthRequiredGateProps> = ({
  featureName = 'оваа страница',
  description = 'Најави се бесплатно за да продолжиш. Ова трае неколку секунди и не бара кредитна картичка.',
}) => {
  const { showToast } = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign-in failed', error);
      showToast('Најавата не успеа. Обиди се повторно.', 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-400" />

          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-5">
              <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">
              Потребна е најава
            </p>
            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-3">
              Најави се за да пристапиш до {featureName}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-7 leading-relaxed text-sm">
              {description}
            </p>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {isSigningIn ? 'Се најавува...' : 'Најави се со Google'}
              </Button>
              <Link to="/">
                <Button variant="outline" className="w-full font-bold h-11 rounded-xl border-slate-300 dark:border-slate-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Назад на почетна
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
