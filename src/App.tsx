import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GamificationProvider, useGamification } from './contexts/GamificationContext';
import { ToastProvider } from './contexts/ToastContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { installGlobalObservabilityHandlers, recordRouteView, recordTiming } from './lib/observability';
const Layout = lazy(() => import('./components/Layout').then((m) => ({ default: m.Layout })));
const Home = lazy(() => import('./components/Home').then((m) => ({ default: m.Home })));
const ExtractionEngine = lazy(() => import('./components/ExtractionEngine').then((m) => ({ default: m.ExtractionEngine })));
const SmartOCR = lazy(() => import('./components/SmartOCR').then((m) => ({ default: m.SmartOCR })));
const GraphDigitizer = lazy(() => import('./components/GraphDigitizer').then((m) => ({ default: m.GraphDigitizer })));
const CurriculumAdmin = lazy(() => import('./components/CurriculumAdmin').then((m) => ({ default: m.CurriculumAdmin })));
const Library = lazy(() => import('./components/Library').then((m) => ({ default: m.Library })));
const MaterialsFactory = lazy(() => import('./components/MaterialsFactory'));
const CurriculumFactory = lazy(() => import('./components/CurriculumFactory').then((m) => ({ default: m.CurriculumFactory })));
const CurriculumTestGenerator = lazy(() => import('./components/CurriculumTestGenerator').then((m) => ({ default: m.CurriculumTestGenerator })));
const TodoList = lazy(() => import('./components/TodoList').then((m) => ({ default: m.TodoList })));
const Flashcards = lazy(() => import('./components/Flashcards').then((m) => ({ default: m.Flashcards })));
const AdaptiveTest = lazy(() => import('./components/AdaptiveTest').then((m) => ({ default: m.AdaptiveTest })));
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const TutorChat = lazy(() => import('./components/TutorChat').then((m) => ({ default: m.TutorChat })));
const Classrooms = lazy(() => import('./components/Classrooms').then((m) => ({ default: m.Classrooms })));
const ClassroomDetail = lazy(() => import('./components/ClassroomDetail').then((m) => ({ default: m.ClassroomDetail })));
const SmartGrader = lazy(() => import('./components/SmartGrader').then((m) => ({ default: m.SmartGrader })));
const PedagogueCommandCenter = lazy(() => import('./components/PedagogueCommandCenter').then((m) => ({ default: m.PedagogueCommandCenter })));
const PedagogueEditor = lazy(() => import('./components/library/PedagogueEditor').then((m) => ({ default: m.PedagogueEditor })));
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
const ReloadPrompt = lazy(() => import('./components/ReloadPrompt').then((m) => ({ default: m.ReloadPrompt })));
import { MathTask } from './lib/schema';
import { signInWithGoogle } from './lib/firebase';
const StudentTelemetryView = lazy(() => import('./components/StudentTelemetryView').then((m) => ({ default: m.StudentTelemetryView })));
const StudentDashboard = lazy(() => import('./components/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const GameHost = lazy(() => import('./components/live/GameHost').then((m) => ({ default: m.GameHost })));
const GamePlayer = lazy(() => import('./components/live/GamePlayer').then((m) => ({ default: m.GamePlayer })));
const SummativeExam = lazy(() => import('./components/live/SummativeExam').then((m) => ({ default: m.SummativeExam })));
const TeacherExamsDashboard = lazy(() => import('./components/TeacherExamsDashboard').then((m) => ({ default: m.TeacherExamsDashboard })));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));
const VirtualWhiteboardPage = lazy(() => import('./components/live/VirtualWhiteboardPage').then((m) => ({ default: m.VirtualWhiteboardPage })));
const AIPedagogyCritique = lazy(() => import('./components/AIPedagogyCritique').then((m) => ({ default: m.AIPedagogyCritique })));
const Pricing = lazy(() => import('./components/Pricing').then((m) => ({ default: m.Pricing })));
const SchoolInquiriesDashboard = lazy(() => import('./components/SchoolInquiriesDashboard').then((m) => ({ default: m.SchoolInquiriesDashboard })));
const Gradebook = lazy(() => import('./components/Gradebook').then((m) => ({ default: m.Gradebook })));
const TaskDifferentiation = lazy(() => import('./components/TaskDifferentiation').then((m) => ({ default: m.TaskDifferentiation })));
const EarlyWarningDashboard = lazy(() => import('./components/EarlyWarningDashboard').then((m) => ({ default: m.EarlyWarningDashboard })));
const BillingDashboard = lazy(() => import('./components/BillingDashboard').then((m) => ({ default: m.BillingDashboard })));
const PaymentAdminDashboard = lazy(() => import('./components/PaymentAdminDashboard').then((m) => ({ default: m.PaymentAdminDashboard })));
const BlogOcrMath = lazy(() => import('./components/blog/BlogOcrMath').then((m) => ({ default: m.BlogOcrMath })));
const BlogLatexExtraction = lazy(() => import('./components/blog/BlogLatexExtraction').then((m) => ({ default: m.BlogLatexExtraction })));
const BlogLiveMathKahoot = lazy(() => import('./components/blog/BlogLiveMathKahoot').then((m) => ({ default: m.BlogLiveMathKahoot })));
const IngestionSnapshotFlagProbe = lazy(() => import('./components/dev/IngestionSnapshotFlagProbe').then((m) => ({ default: m.IngestionSnapshotFlagProbe })));
const InkPipelineProbe = lazy(() => import('./components/dev/InkPipelineProbe').then((m) => ({ default: m.InkPipelineProbe })));
const LetterheadProbe = lazy(() => import('./components/dev/LetterheadProbe').then((m) => ({ default: m.LetterheadProbe })));
const ConceptMapProbe = lazy(() => import('./components/dev/ConceptMapProbe').then((m) => ({ default: m.ConceptMapProbe })));

const RouteFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center text-slate-500 text-sm">Loading...</div>
);

// Wrapper for extracting pin from params
const GameHostWrapper = () => {
  const { pin } = useParams();
  return <GameHost sessionPin={pin || ''} />;
};

const GamePlayerWrapper = () => {
  const params = new URLSearchParams(window.location.search);
  const pin = params.get('pin');
  return <GamePlayer sessionPin={pin || undefined} />;
};

const SummativeExamWrapper = () => {
  const { examId } = useParams();
  return <SummativeExam examId={examId || ''} />;
};

const AppRoutes = () => {
  const { user, userProfile } = useAuth();
  const { updateQuestProgress } = useGamification();
  const [activeTutorTask, setActiveTutorTask] = useState<MathTask | null>(null);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home setActiveTab={() => {}} user={user} signInWithGoogle={signInWithGoogle} />} />
          
          {/* Protected Routes */}
          <Route path="extract" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              authFeatureName="Екстракција"
              authFeatureDescription="Најави се бесплатно за да дигитализираш PDF, слики, видеа или ракопис во структурирани задачи."
            >
              <ExtractionEngine setActiveTutorTask={setActiveTutorTask} />
            </ProtectedRoute>
          } />

          <Route path="exams-grading" element={
            <ProtectedRoute allowedRoles={['teacher']} authFeatureName="Dugga">
              <TeacherExamsDashboard />
            </ProtectedRoute>
          } />

          <Route path="smart-ocr" element={
            <ProtectedRoute allowedRoles={['teacher']} authFeatureName="Smart OCR">
              <SmartOCR />
            </ProtectedRoute>
          } />

          <Route path="graph-digitizer" element={
            <ProtectedRoute allowedRoles={['teacher']} authFeatureName="Graph Digitizer">
              <GraphDigitizer />
            </ProtectedRoute>
          } />
          
          <Route path="smart-grader" element={
            <ProtectedRoute allowedRoles={['teacher', 'student']} authFeatureName="AI Градер">
              <SmartGrader />
            </ProtectedRoute>
          } />

          <Route path="analytics" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              requirePro
              proFeatureName="Напредна Аналитика"
              proFeatureDescription="Педагошката аналитика со DOK телеметрија, Knowledge Gap дијагностика и интервенции е достапна само за Pro Teacher. Надгради за комплетен увид во напредокот на учениците."
            >
              <AnalyticsDashboard />
            </ProtectedRoute>
          } />

          <Route path="gradebook" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              authFeatureName="Дневник на оцени"
              authFeatureDescription="Најави се за да управуваш со оценките на твоите ученици."
            >
              <Gradebook />
            </ProtectedRoute>
          } />

          <Route path="differentiation" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              authFeatureName="Диференцијација"
              authFeatureDescription="Најави се за да генерираш диференцирани задачи."
            >
              <TaskDifferentiation />
            </ProtectedRoute>
          } />

          <Route path="early-warning" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              authFeatureName="Early Warning"
              authFeatureDescription="Најави се за да ги видиш учениците во ризик."
            >
              <EarlyWarningDashboard />
            </ProtectedRoute>
          } />

          <Route path="ai-pedagogy" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              requirePro
              proFeatureName="AI Педагогија"
              proFeatureDescription="Сократски прашања, диференцирани стратегии и педагошки критики базирани на Bloom's Taxonomy се Pro-ексклузивни функции."
            >
              <AIPedagogyCritique />
            </ProtectedRoute>
          } />
          
          <Route path="curriculum" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              requirePro
              proFeatureName="Државни Стандарди — Curriculum"
              proFeatureDescription="Пристапот до националните наставни програми (БРО стандарди) и генерирањето задачи по теми е Pro-ексклузивна функција."
            >
              <CurriculumTestGenerator />
            </ProtectedRoute>
          } />
          
          <Route path="library" element={
            <ProtectedRoute
              authFeatureName="Библиотека"
              authFeatureDescription="Најави се бесплатно за да пребаруваш и зачувуваш материјали од Националната библиотека."
            >
              <Library />
            </ProtectedRoute>
          } />
          
          <Route path="factory" element={
            <ProtectedRoute allowedRoles={['teacher']} authFeatureName="Фабрика">
              <MaterialsFactory />
            </ProtectedRoute>
          } />
          
          <Route path="mass-factory" element={
            <ProtectedRoute
              allowedRoles={['teacher']}
              requirePro
              proFeatureName="PDF Фабрика (Batch)"
              proFeatureDescription="Масовното генерирање на работни листови и Curriculum Factory за batch uploads е достапно само за Pro Teacher корисници."
              authFeatureName="PDF Фабрика"
            >
              <CurriculumFactory />
            </ProtectedRoute>
          } />
          
          <Route path="classrooms" element={
            <ProtectedRoute authFeatureName="Училници">
              <Classrooms />
            </ProtectedRoute>
          } />
          
          <Route path="classrooms/:id" element={
            <ProtectedRoute>
              <ClassroomDetail />
            </ProtectedRoute>
          } />
          
          <Route path="todo" element={
            <ProtectedRoute allowedRoles={['student']}>
              <TodoList user={user} onTaskComplete={() => updateQuestProgress('solve')} />
            </ProtectedRoute>
          } />
          
          <Route path="flashcards" element={
            <ProtectedRoute allowedRoles={['student', 'teacher']} authFeatureName="Флешкарти">
              <Flashcards onReviewComplete={() => updateQuestProgress('flashcard')} />
            </ProtectedRoute>
          } />

          <Route path="adaptive-test" element={
            <ProtectedRoute allowedRoles={['student']}>
              <AdaptiveTest />
            </ProtectedRoute>
          } />
          
          <Route path="dashboard" element={
            <ProtectedRoute authFeatureName="Профил">
              <Dashboard userProfile={userProfile} />
            </ProtectedRoute>
          } />

          <Route path="billing" element={
            <ProtectedRoute authFeatureName="Billing" authFeatureDescription="Најави се за да ја видиш твојата претплата и историја на плаќања.">
              <BillingDashboard />
            </ProtectedRoute>
          } />

          <Route path="payment-admin" element={
            <ProtectedRoute allowedRoles={['teacher']} authFeatureName="Payment Admin">
              <PaymentAdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="student-dashboard" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          } />

          <Route path="students/:studentId" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <StudentTelemetryView />
            </ProtectedRoute>
          } />
          
          <Route path="live-board" element={
            <ProtectedRoute authFeatureName="Виртуелна Табла">
              <VirtualWhiteboardPage />
            </ProtectedRoute>
          } />

          <Route path="school-inquiries" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <SchoolInquiriesDashboard />
            </ProtectedRoute>
          } />

          <Route path="curriculum-admin" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <CurriculumAdmin />
            </ProtectedRoute>
          } />
        </Route>
        
        {/* Fullscreen Game Routes (No Layout) */}
        <Route path="/live/:pin/host" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <GameHostWrapper />
          </ProtectedRoute>
        } />
        <Route path="/play" element={<GamePlayerWrapper />} />
        <Route path="/exam/:examId" element={<SummativeExamWrapper />} />
        <Route path="/pricing" element={<Pricing />} />

        {import.meta.env.DEV && (
          <Route path="/__e2e__/ingestion-snapshot" element={<IngestionSnapshotFlagProbe />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/__e2e__/ink-pipeline" element={<InkPipelineProbe />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/__e2e__/letterhead" element={<LetterheadProbe />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/__e2e__/concept-map" element={<ConceptMapProbe />} />
        )}

        {/* Public blog posts — no auth required */}
        <Route path="/blog/ocr-matematika" element={<BlogOcrMath />} />
        <Route path="/blog/latex-ekstrakcija" element={<BlogLatexExtraction />} />
        <Route path="/blog/live-mathkahoot" element={<BlogLiveMathKahoot />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {activeTutorTask && (
        <TutorChat task={activeTutorTask} onClose={() => setActiveTutorTask(null)} />
      )}
      
      <ReloadPrompt />
      <PedagogueCommandCenter />
      <PedagogueEditor />
      </Suspense>
    </>
  );
};

const ObservabilityBridge = () => {
  const location = useLocation();
  const lastRouteRef = useRef<string>(`${location.pathname}${location.search}`);
  const routeEnteredAtRef = useRef<number>(performance.now());
  const didMountRef = useRef(false);

  useEffect(() => {
    installGlobalObservabilityHandlers();
  }, []);

  useEffect(() => {
    const currentRoute = `${location.pathname}${location.search}`;
    const now = performance.now();
    const previousRoute = lastRouteRef.current;

    if (!didMountRef.current) {
      recordRouteView(currentRoute);
      didMountRef.current = true;
      lastRouteRef.current = currentRoute;
      routeEnteredAtRef.current = now;
      return;
    }

    if (previousRoute !== currentRoute) {
      recordTiming('route-visibility', now - routeEnteredAtRef.current, { path: previousRoute });
      recordRouteView(currentRoute);
      lastRouteRef.current = currentRoute;
      routeEnteredAtRef.current = now;
    }
  }, [location.pathname, location.search]);

  return null;
};

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ToastProvider>
          <AccessibilityProvider>
            <AuthProvider>
              <GamificationProvider>
                <Router>
                  <ObservabilityBridge />
                  <AppRoutes />
                </Router>
              </GamificationProvider>
            </AuthProvider>
          </AccessibilityProvider>
        </ToastProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
