import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, HomeIcon, Wand2, Factory, BookOpen, Library as LibraryIcon, CheckCircle, Brain, Trophy, Sun, Moon, LogOut, LogIn, Users, ScanLine, Menu, X, Zap, Layers, Monitor, Type, Palette, MoreHorizontal, ChevronDown, GraduationCap, Inbox, Settings as SettingsIcon, Check, Sparkles, TrendingUp, AlertTriangle, Search } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { signInWithGoogle, logOut } from '../lib/firebase';
import { RoleSelection } from './RoleSelection';
import { OnboardingWizard } from './OnboardingWizard';
import { GlobalAITutor } from './GlobalAITutor';
import { CommandPalette, type CommandPaletteItem } from './CommandPalette';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SEO } from './SEO';
import { getRouteSeo } from '../lib/seo';
import { isOnTrial, trialDaysRemaining, hasProAccess } from '../lib/saas';
import { trackTrialExpired, trackTrialUrgency } from '../lib/analytics';

import { motion, AnimatePresence } from 'motion/react';

type ToolGroupKey = 'digitize' | 'generate' | 'teach' | 'analyze' | 'admin';

const TOOL_GROUP_ORDER: ToolGroupKey[] = ['digitize', 'generate', 'teach', 'analyze', 'admin'];

// Tool group labels are translated via useTranslation in the component

export const Layout: React.FC = () => {
  const { t } = useTranslation('navigation');
  const { user, userProfile, isLoading, setUserProfile } = useAuth();
  const { dyslexiaMode, toggleDyslexiaMode, dyscalculiaMode, toggleDyscalculiaMode } = useAccessibility();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [trialExpiredDismissed, setTrialExpiredDismissed] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isAccessibilityMenuOpen, setIsAccessibilityMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const accessibilityMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const routeSeo = getRouteSeo(location.pathname);

  // Close click-toggled dropdowns when clicking/tapping outside of them —
  // needed because these no longer rely on CSS hover (which doesn't work
  // reliably on touch devices like classroom tablets).
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(target)) setIsToolsMenuOpen(false);
      if (accessibilityMenuRef.current && !accessibilityMenuRef.current.contains(target)) setIsAccessibilityMenuOpen(false);
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) setIsAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (userProfile && !localStorage.getItem('onboarding_complete')) {
      setShowOnboarding(true);
    }
  }, [userProfile]);

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
    { path: '/', icon: HomeIcon, label: t('home'), show: true },
    { path: '/pricing', icon: Zap, label: t('pricing'), show: true },
    { path: '/smart-ocr', icon: ScanLine, label: 'Smart OCR', show: !userProfile || userProfile.role === 'teacher' },
    { path: '/extract', icon: Wand2, label: t('extraction'), show: !userProfile || userProfile.role === 'teacher' },
    { path: '/library', icon: LibraryIcon, label: t('library'), show: true },
    { path: '/student-dashboard', icon: BookOpen, label: t('studentDashboard'), show: userProfile?.role === 'student' },
    { path: '/dashboard', icon: Trophy, label: t('dashboard'), show: !!userProfile && userProfile.role !== 'student' },
  ].filter(item => item.show);

  const toolItems = [
    { path: '/curriculum', icon: BookOpen, label: 'Државни Стандарди', show: userProfile?.role === 'teacher', group: 'digitize' as ToolGroupKey },
    { path: '/graph-digitizer', icon: TrendingUp, label: 'Graph Digitizer', show: !userProfile || userProfile.role === 'teacher', group: 'digitize' as ToolGroupKey },
    { path: '/curriculum-admin', icon: BookOpen, label: 'Curriculum БРО', show: userProfile?.role === 'teacher', group: 'digitize' as ToolGroupKey },
    { path: '/factory', icon: Factory, label: 'Фабрика', show: !userProfile || userProfile.role === 'teacher', group: 'generate' as ToolGroupKey },
    { path: '/mass-factory', icon: Layers, label: 'PDF Фабрика', show: !userProfile || userProfile.role === 'teacher', group: 'generate' as ToolGroupKey },
    { path: '/live-board', icon: Monitor, label: 'В. Табла', show: true, group: 'teach' as ToolGroupKey },
    { path: '/classrooms', icon: Users, label: 'Училници', show: !!userProfile, group: 'teach' as ToolGroupKey },
    { path: '/exams-grading', icon: Trophy, label: 'Dugga', show: !userProfile || userProfile.role === 'teacher', group: 'teach' as ToolGroupKey },
    { path: '/adaptive-test', icon: Zap, label: 'Адаптивен Тест', show: userProfile?.role === 'student', group: 'teach' as ToolGroupKey },
    { path: '/flashcards', icon: Brain, label: 'Флешкарти', show: !!userProfile, group: 'teach' as ToolGroupKey },
    { path: '/analytics', icon: BrainCircuit, label: 'Аналитика', show: userProfile?.role === 'teacher', group: 'analyze' as ToolGroupKey },
    { path: '/gradebook', icon: BookOpen, label: 'Дневник', show: userProfile?.role === 'teacher', group: 'analyze' as ToolGroupKey },
    { path: '/differentiation', icon: Layers, label: 'Диференцијација', show: userProfile?.role === 'teacher', group: 'analyze' as ToolGroupKey },
    { path: '/early-warning', icon: AlertTriangle, label: 'Early Warning', show: userProfile?.role === 'teacher', group: 'analyze' as ToolGroupKey },
    { path: '/ai-pedagogy', icon: GraduationCap, label: 'AI Педагогија', show: userProfile?.role === 'teacher', group: 'analyze' as ToolGroupKey },
    { path: '/smart-grader', icon: Brain, label: 'AI Градер', show: true, group: 'analyze' as ToolGroupKey },
    { path: '/school-inquiries', icon: Inbox, label: 'School Leads', show: userProfile?.role === 'teacher', group: 'admin' as ToolGroupKey },
  ].filter(item => item.show);

  const getGroupLabel = (group: ToolGroupKey): string => {
    const labels: Record<ToolGroupKey, string> = {
      digitize: t('digitization'),
      generate: t('generation'),
      teach: t('teaching'),
      analyze: t('analysis'),
      admin: t('administration'),
    };
    return labels[group];
  };

  const groupedToolItems = TOOL_GROUP_ORDER.map((groupKey) => ({
    key: groupKey,
    label: getGroupLabel(groupKey),
    items: toolItems.filter((item) => item.group === groupKey),
  })).filter((group) => group.items.length > 0);

  const commandPaletteItems: CommandPaletteItem[] = [
    ...mainNavItems.map((item) => ({ path: item.path, icon: item.icon, label: item.label, groupLabel: 'Главно' })),
    ...toolItems.map((item) => ({ path: item.path, icon: item.icon, label: item.label, groupLabel: getGroupLabel(item.group) })),
  ];

  // Global "go to anything" shortcut — Ctrl/Cmd+K.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsToolsMenuOpen(false);
    setIsAccessibilityMenuOpen(false);
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans transition-colors duration-300 relative selection:bg-indigo-300/30">
      {/* Ambient dark-mode glow — shared across every route so individual
          pages don't need to each reimplement the Home-hero aesthetic. */}
      <div className="hidden dark:block fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[28rem] h-[28rem] bg-cyan-500/5 rounded-full blur-[140px]" />
      </div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Прескокни на главна содржина
      </a>
      <SEO
        title={routeSeo.title}
        description={routeSeo.description}
        keywords={routeSeo.keywords}
        canonical={routeSeo.canonical}
        noindex={routeSeo.noindex}
        structuredData={routeSeo.structuredData}
      />
      {(() => {
        if (!userProfile || hasProAccess(userProfile) || !userProfile.trialStartedAt) return null;

        const daysLeft = trialDaysRemaining(userProfile);
        const isExpired = daysLeft === 0;

        if (isExpired) {
          if (trialExpiredDismissed) return null;
          // Fire analytics once — safe because identityUser already called in AuthContext
          void (typeof trackTrialExpired === 'function' && trackTrialExpired());
          return (
            <div className="bg-rose-600 text-white text-sm py-2.5 px-4 flex items-center justify-center gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Твојот Pro Trial истече.</span>
              <span className="hidden sm:inline text-rose-100">Надгради сега за да го задржиш пристапот до Pro функции.</span>
              <Link to="/pricing" className="bg-white text-rose-700 font-black px-3 py-0.5 rounded-lg text-xs hover:bg-rose-50 transition-colors ml-1">
                Надгради
              </Link>
              <button
                type="button"
                onClick={() => setTrialExpiredDismissed(true)}
                className="ml-auto p-1 rounded hover:bg-rose-500 transition-colors"
                aria-label="Затвори"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }

        // Active trial — urgency escalation
        if (daysLeft <= 2) {
          void (typeof trackTrialUrgency === 'function' && trackTrialUrgency(daysLeft));
        }
        const isUrgent = daysLeft <= 2;
        const isCritical = daysLeft === 1;

        return (
          <div className={`text-white text-sm text-center py-2 px-4 flex items-center justify-center gap-2 transition-colors ${
            isCritical ? 'bg-rose-600' : isUrgent ? 'bg-amber-500' : 'bg-indigo-600'
          }`}>
            {isCritical ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" />}
            <span>
              {isCritical
                ? <>Последен ден! Твојот Pro Trial истекува <strong>денес</strong>.</>
                : isUrgent
                ? <>Само уште <strong>{daysLeft} {daysLeft === 1 ? 'ден' : 'дена'}</strong> Pro Trial. Не изгуби пристап!</>
                : <>Користиш Pro Trial — уште <strong>{daysLeft} {daysLeft === 1 ? 'ден' : 'дена'}</strong> бесплатно.</>
              }
            </span>
            <Link
              to="/pricing"
              className={`underline font-semibold ml-1 transition-colors ${
                isCritical ? 'hover:text-rose-200' : isUrgent ? 'hover:text-amber-200' : 'hover:text-indigo-200'
              }`}
            >
              Надгради
            </Link>
          </div>
        );
      })()}

      <header className="sticky top-0 z-50 transition-colors duration-300 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              type="button"
              aria-label={isMobileMenuOpen ? "Затвори мени" : "Отвори мени"}
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
          
          <nav className="flex-1 hidden lg:flex justify-start ml-4 2xl:ml-8 overflow-visible">
             <div className="flex items-center gap-0.5 2xl:gap-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 2xl:gap-2 px-2 2xl:px-3 py-2 text-sm font-semibold rounded-xl transition-all duration-300 relative whitespace-nowrap flex-shrink-0 ${
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
                <div ref={toolsMenuRef} className="relative ml-1 z-[100]">
                  <button
                    type="button"
                    onClick={() => setIsToolsMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isToolsMenuOpen}
                    className="flex items-center gap-1.5 px-2 2xl:px-3 py-2 text-sm font-semibold rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span>Алатки</span>
                    <ChevronDown className={`w-3 h-3 opacity-50 transition-transform duration-300 ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div
                    className={`absolute top-10 left-0 pt-2 transition-all duration-200 min-w-[240px] ${isToolsMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
                  >
                    <div className="w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
                      {groupedToolItems.map((toolGroup, groupIndex) => (
                        <div key={toolGroup.key} className={groupIndex > 0 ? 'mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/60' : ''}>
                          <div className="px-4 py-1 mb-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{toolGroup.label}</div>
                          {toolGroup.items.map((item) => {
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
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick search / command palette trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
              title="Брзо пребарување"
              aria-label="Отвори брзо пребарување"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Пребарај</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-bold">Ctrl K</kbd>
            </button>

            {/* Language switcher */}
            <LanguageSwitcher />

            {/* Quick theme toggle (always visible, instant feedback) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title={isDarkMode ? "Светла тема" : "Темна тема"}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Accessibility settings dropdown */}
            <div ref={accessibilityMenuRef} className="relative z-[100]">
              <button
                type="button"
                onClick={() => setIsAccessibilityMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isAccessibilityMenuOpen}
                className={`p-2 rounded-full transition-colors ${(dyslexiaMode || dyscalculiaMode) ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title="Пристапност"
                aria-label="Accessibility settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <div className={`absolute top-10 right-0 pt-2 transition-all duration-200 min-w-[260px] ${isAccessibilityMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                <div className="w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2">
                  <div className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-slate-400">Пристапност</div>
                  <button
                    type="button"
                    onClick={toggleDyslexiaMode}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Type className="w-4 h-4 opacity-70" />
                      Дислексија фонт
                    </span>
                    {dyslexiaMode && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleDyscalculiaMode}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Palette className="w-4 h-4 opacity-70" />
                      Дискалкулија мод
                    </span>
                    {dyscalculiaMode && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>

            {user ? (
              <div ref={accountMenuRef} className="relative z-[100]">
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={user.email ?? ''}
                  aria-label="Account menu"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-700 shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                <div className={`absolute top-12 right-0 pt-2 transition-all duration-200 min-w-[280px] ${isAccountMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                  <div className="w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center text-base font-bold">
                          {user.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {user.displayName || user.email?.split('@')[0]}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {user.email}
                        </div>
                        {userProfile?.role && (
                          <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${userProfile.role === 'teacher' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                            {userProfile.role === 'teacher' ? 'Наставник' : 'Ученик'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <Trophy className="w-4 h-4 opacity-70" />
                        Профил
                      </Link>
                      <button
                        type="button"
                        onClick={() => logOut()}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Одјави се
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={signInWithGoogle}
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
              <div className="mt-6 space-y-4">
                {groupedToolItems.map((toolGroup) => (
                  <div key={toolGroup.key}>
                    <div className="px-4 mb-2 text-xs font-bold tracking-widest uppercase text-slate-400">{toolGroup.label}</div>
                    {toolGroup.items.map((item) => {
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
                ))}
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

      <main id="main-content" className="flex-1 w-full max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 relative z-0 flex flex-col">
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
      
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={commandPaletteItems}
      />

      {/* Global AI Pedagogical Assistant (only for logged in users) */}
      {userProfile && <GlobalAITutor />}

      {/* Onboarding wizard — shown only on first login */}
      {showOnboarding && userProfile && (
        <OnboardingWizard
          userName={userProfile.displayName?.split(' ')[0] ?? 'Наставник'}
          onComplete={() => {
            localStorage.setItem('onboarding_complete', 'true');
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
};
