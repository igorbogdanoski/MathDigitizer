import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { Dashboard } from './components/Dashboard';
import { TutorChat } from './components/TutorChat';
import { Classrooms } from './components/Classrooms';
import { ClassroomDetail } from './components/ClassroomDetail';
import { PedagogueCommandCenter } from './components/PedagogueCommandCenter';
import { PedagogueEditor } from './components/library/PedagogueEditor';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ReloadPrompt } from './components/ReloadPrompt';
import { MathTask } from './lib/schema';
import { signInWithGoogle } from './lib/firebase';
import { StudentTelemetryView } from './components/StudentTelemetryView';

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

          <Route path="smart-ocr" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <SmartOCR />
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
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
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
    <ToastProvider>
      <AuthProvider>
        <GamificationProvider>
          <Router>
            <AppRoutes />
          </Router>
        </GamificationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
