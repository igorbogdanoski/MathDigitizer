import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GamificationProvider, useGamification } from './contexts/GamificationContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { ExtractionEngine } from './components/ExtractionEngine';
import { SmartOCR } from './components/SmartOCR';
import { Library } from './components/Library';
import MaterialsFactory from './components/MaterialsFactory';
import { TodoList } from './components/TodoList';
import { Flashcards } from './components/Flashcards';
import { AdaptiveTest } from './components/AdaptiveTest';
import { Dashboard } from './components/Dashboard';
import { TutorChat } from './components/TutorChat';
import { Classrooms } from './components/Classrooms';
import { ClassroomDetail } from './components/ClassroomDetail';
import { SmartGrader } from './components/SmartGrader';
import { PedagogueCommandCenter } from './components/PedagogueCommandCenter';
import { PedagogueEditor } from './components/library/PedagogueEditor';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ReloadPrompt } from './components/ReloadPrompt';
import { MathTask } from './lib/schema';
import { signInWithGoogle } from './lib/firebase';
import { StudentTelemetryView } from './components/StudentTelemetryView';
import { GameHost } from './components/live/GameHost';
import { GamePlayer } from './components/live/GamePlayer';
import { SummativeExam } from './components/live/SummativeExam';
import { TeacherExamsDashboard } from './components/TeacherExamsDashboard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { useParams } from 'react-router-dom';

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
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home setActiveTab={() => {}} user={user} signInWithGoogle={signInWithGoogle} />} />
          
          {/* Protected Routes */}
          <Route path="extract" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <ExtractionEngine setActiveTutorTask={setActiveTutorTask} />
            </ProtectedRoute>
          } />

          <Route path="exams-grading" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherExamsDashboard />
            </ProtectedRoute>
          } />

          <Route path="smart-ocr" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <SmartOCR />
            </ProtectedRoute>
          } />
          
          <Route path="smart-grader" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <SmartGrader />
            </ProtectedRoute>
          } />

          <Route path="analytics" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <AnalyticsDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="library" element={
            <ProtectedRoute>
              <Library />
            </ProtectedRoute>
          } />
          
          <Route path="factory" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <MaterialsFactory />
            </ProtectedRoute>
          } />
          
          <Route path="classrooms" element={
            <ProtectedRoute>
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
            <ProtectedRoute allowedRoles={['student']}>
              <Flashcards onReviewComplete={() => updateQuestProgress('flashcard')} />
            </ProtectedRoute>
          } />

          <Route path="adaptive-test" element={
            <ProtectedRoute allowedRoles={['student']}>
              <AdaptiveTest />
            </ProtectedRoute>
          } />
          
          <Route path="dashboard" element={
            <ProtectedRoute>
              <Dashboard userProfile={userProfile} />
            </ProtectedRoute>
          } />
          
          <Route path="students/:studentId" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <StudentTelemetryView />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {activeTutorTask && (
        <TutorChat task={activeTutorTask} onClose={() => setActiveTutorTask(null)} />
      )}
      
      <ReloadPrompt />
      <PedagogueCommandCenter />
      <PedagogueEditor />
    </>
  );
};

export default function App() {
  return (
    <HelmetProvider>
      <ToastProvider>
        <AuthProvider>
          <GamificationProvider>
            <Router>
              <AppRoutes />
            </Router>
          </GamificationProvider>
        </AuthProvider>
      </ToastProvider>
    </HelmetProvider>
  );
}
