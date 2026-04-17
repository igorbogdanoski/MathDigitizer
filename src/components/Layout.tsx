import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { BrainCircuit, HomeIcon, Wand2, Factory, Library as LibraryIcon, CheckCircle, Brain, Trophy, Sun, Moon, LogOut, LogIn, Users, ScanLine, Menu, X } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, logOut } from '../lib/firebase';
import { RoleSelection } from './RoleSelection';

export const Layout: React.FC = () => {
  const { user, userProfile, isLoading, setUserProfile } = useAuth();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      if (newTheme) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newTheme;
    });
  };

  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Почетна', show: true },
    { path: '/smart-ocr', icon: ScanLine, label: 'Smart OCR', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/extract', icon: Wand2, label: 'Видео & URL', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/factory', icon: Factory, label: 'За Наставници', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/classrooms', icon: Users, label: 'Училници', show: !!userProfile },
    { path: '/library', icon: LibraryIcon, label: 'Библиотека', show: true },
    { path: '/dashboard', icon: Trophy, label: 'Профил', show: true },
  ].filter(item => item.show);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-sans transition-colors duration-300 relative">
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl shadow-sm shadow-blue-500/20 hidden sm:flex">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent leading-none">
                  MathDigitizer <span className="text-blue-600 dark:text-blue-400">Pro</span>
                </h1>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  од Игор Богданоски
                </span>
              </div>
            </Link>
          </div>
          
          <nav className="flex-1 max-w-3xl hidden lg:flex justify-center">
            <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto no-scrollbar shadow-inner gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                      isActive 
                        ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors bg-white shadow-sm border border-slate-200 dark:border-slate-700"
              title={isDarkMode ? "Светла тема" : "Темна тема"}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 pl-1.5 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => logOut()} 
                  className="text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 px-2 sm:px-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                  title="Одјави се"
                >
                  <LogOut className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Одјави се</span>
                </Button>
              </div>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                onClick={signInWithGoogle} 
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
              >
                <LogIn className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Најави се</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Details Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-white dark:bg-slate-900 lg:hidden overflow-y-auto animate-in slide-in-from-top-2 fade-in">
          <div className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 text-base font-medium rounded-xl transition-colors ${
                    isActive 
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5 bg-white dark:bg-slate-800 rounded-lg p-0.5 shadow-sm" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Mobile Profile Display */}
            {user && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-slate-200 shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {userProfile?.role === 'teacher' ? 'Наставник' : 'Ученик'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-0">
        {user && !userProfile && !isLoading && (
          <RoleSelection user={user} onComplete={(profile) => setUserProfile(profile)} />
        )}
        <Outlet />
      </main>
    </div>
  );
};
