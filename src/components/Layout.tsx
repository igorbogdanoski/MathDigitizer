import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { BrainCircuit, HomeIcon, Wand2, Factory, BookOpen, Library as LibraryIcon, CheckCircle, Brain, Trophy, Sun, Moon, LogOut, LogIn, Users, ScanLine, Menu, X, Zap, Layers, Monitor, Type, Palette, MoreHorizontal, ChevronDown, Bug } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { signInWithGoogle, logOut } from '../lib/firebase';
import { RoleSelection } from './RoleSelection';
import { GlobalAITutor } from './GlobalAITutor';

import { motion, AnimatePresence } from 'motion/react';

export const Layout: React.FC = () => {
  const { user, userProfile, isLoading, setUserProfile } = useAuth();
  const { dyslexiaMode, toggleDyslexiaMode, dyscalculiaMode, toggleDyscalculiaMode } = useAccessibility();
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

  const mainNavItems = [
    { path: '/', icon: HomeIcon, label: 'Почетна', show: true },
    { path: '/smart-ocr', icon: ScanLine, label: 'Smart OCR', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/extract', icon: Wand2, label: 'Екстракција', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/library', icon: LibraryIcon, label: 'Библиотека', show: true },
    { path: '/dashboard', icon: Trophy, label: 'Профил', show: !!userProfile },
  ].filter(item => item.show);

  const toolItems = [
    { path: '/curriculum', icon: BookOpen, label: 'Државни Стандарди', show: userProfile?.role === 'teacher' },
    { path: '/smart-grader', icon: Brain, label: 'AI Градер', show: true },
    { path: '/analytics', icon: BrainCircuit, label: 'Аналитика', show: userProfile?.role === 'teacher' },
    { path: '/flashcards', icon: Brain, label: 'Флешкарти', show: !!userProfile },
    { path: '/adaptive-test', icon: Zap, label: 'Адаптивен Тест', show: userProfile?.role === 'student' },
    { path: '/factory', icon: Factory, label: 'Фабрика', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/mass-factory', icon: Layers, label: 'PDF Фабрика', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/ai-pedagogy', icon: Bug, label: 'AI Педагогија', show: userProfile?.role === 'teacher' },
    { path: '/live-board', icon: Monitor, label: 'В. Табла', show: true },
    { path: '/classrooms', icon: Users, label: 'Училници', show: !!userProfile },
    { path: '/exams-grading', icon: Trophy, label: 'Dugga', show: !userProfile || userProfile.role === 'teacher' },
  ].filter(item => item.show);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-sans transition-colors duration-300 relative selection:bg-indigo-300/30">
      <header className="sticky top-0 z-50 transition-colors duration-300 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            <Link to="/" className="flex items-center gap-3 flex-shrink-0 group">
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] group-hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] group-hover:scale-105 transition-all duration-300 hidden sm:flex">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-heading font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent leading-none">
                  MathDigitizer <span className="bg-gradient-to-br from-indigo-500 to-blue-500 bg-clip-text text-transparent">Pro</span>
                </h1>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 mt-1">
                  EdTech Platform
                </span>
              </div>
            </Link>
          </div>
          
          <nav className="flex-1 hidden lg:flex justify-start ml-8 overflow-visible">
             <div className="flex items-center gap-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl transition-all duration-300 relative whitespace-nowrap flex-shrink-0 ${
                      isActive 
                        ? 'text-indigo-600 dark:text-indigo-400' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {isActive && (
                       <motion.div layoutId="nav-pill" className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl" transition={{ type: "spring", stiffness: 350, damping: 30 }} />
                    )}
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}

              {toolItems.length > 0 && (
                <div className="relative group ml-1 z-[100]">
                  <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                    <span>Алатки</span>
                    <ChevronDown className="w-3 h-3 opacity-50 group-hover:rotate-180 transition-transform duration-300" />
                  </button>
                  <div className="absolute top-10 left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 min-w-[200px]">
                    <div className="w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
                      <div className="px-3 py-1 mb-1 text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Сите Алатки</div>
                      {toolItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors mx-1 rounded-lg ${
                              isActive 
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' 
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4 opacity-70" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button 
              onClick={toggleDyslexiaMode} 
              className={`p-2 rounded-full transition-colors shadow-sm border ${dyslexiaMode ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-400'}`}
              title="Дислексија Фонт"
            >
              <Type className="w-4 h-4" />
            </button>
            <button 
              onClick={toggleDyscalculiaMode} 
              className={`p-2 rounded-full transition-colors shadow-sm border ${dyscalculiaMode ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-400'}`}
              title="Дискалкулија Мод"
            >
              <Palette className="w-4 h-4" />
            </button>
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
          <div className="p-4 space-y-1 pb-10">
            {mainNavItems.map((item) => {
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
            
            {toolItems.length > 0 && (
              <div className="mt-6">
                <div className="px-4 mb-2 text-xs font-bold tracking-widest uppercase text-slate-400">Алатки</div>
                {toolItems.map((item) => {
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
                      <Icon className="w-5 h-5 bg-white dark:bg-slate-800 rounded-lg p-0.5 shadow-sm border border-slate-200 dark:border-slate-700" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

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

      <main className="flex-1 w-full max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 relative z-0 flex flex-col">
        {user && !userProfile && !isLoading && (
          <RoleSelection user={user} onComplete={(profile) => setUserProfile(profile)} />
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex-1 flex flex-col"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Global AI Pedagogical Assistant (only for logged in users) */}
      {userProfile && <GlobalAITutor />}
    </div>
  );
};
