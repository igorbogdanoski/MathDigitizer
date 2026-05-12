import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MathTask } from '../lib/schema';
import { Card, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { MathRenderer } from './MathRenderer';
import { History, Search, Filter, BookOpen, Loader2, Image as ImageIcon, ChevronDown, ChevronUp, Copy, Check, ArrowUpDown, X, History as HistoryIcon, Info, Plus, Play, Pause, RotateCcw, Download, Trash2, MessageCircleQuestion, FileText, CheckSquare, Square, Activity, Brain, Sparkles, FileSpreadsheet, GripVertical, Layers, LayoutDashboard } from 'lucide-react';
import { generateImage, generateSimilarTask, generateDifferentiatedTasks } from '../lib/gemini';
import { exportToMarkdown } from '../lib/export';
import { deleteDoc, doc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { TutorChat } from './TutorChat';
import { TestGenerator } from './TestGenerator';
import { InteractiveSolver } from './InteractiveSolver';
import { CreateTaskModal } from './library/CreateTaskModal';
import { LessonPlanGenerator } from './LessonPlanGenerator';
import { KnowledgeModelModal } from './library/KnowledgeModelModal';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTaskActions } from '../hooks/useTaskActions';
import { TaskFilters } from './library/TaskFilters';
import { TaskCard } from './library/TaskCard';
import { TaskDetailView } from './library/TaskDetailView';
import { useLibraryStore } from '../store/useLibraryStore';
import { Skeleton } from './ui/Skeleton';

import { useRealtimeTasks } from '../hooks/useRealtimeTasks';

export const Library: React.FC = () => {
  const store = useLibraryStore();
  const filters = useTaskFilters();
  const actions = useTaskActions();
  const { sortedAndFilteredTasks } = filters;

  const parentRef = useRef<HTMLDivElement>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLessonPlanModal, setShowLessonPlanModal] = useState(false);
  const [showManipulativesModal, setShowManipulativesModal] = useState(false);
  const [manipulativeType, setManipulativeType] = useState<'algebra-tiles' | 'geogebra-3d'>('algebra-tiles');
  const [isGeneratingKahoot, setIsGeneratingKahoot] = useState(false);

  useEffect(() => {
    const handleOpenModal = () => setShowCreateModal(true);
    const handleOpenLessonPlan = () => setShowLessonPlanModal(true);
    const handleOpenManipulatives = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail?.type) {
           setManipulativeType(customEvent.detail.type);
        }
        setShowManipulativesModal(true);
    };
    
    // Create Kahoot handler

    const handleLiveSession = async () => {
      const selected = getSelectedTasks();
      if (selected.length === 0) return;
      
      setIsGeneratingKahoot(true);
      try {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        // Import generateKahootFromTasks dynamically or statically
        const { generateKahootFromTasks } = await import('../lib/gemini');
        
        const quiz_data = await generateKahootFromTasks(selected);
        
        if (!quiz_data) throw new Error("Failed to generate Kahoot.");

        await setDoc(doc(db, 'live_sessions', pin), {
          id: pin,
          teacher_uid: auth.currentUser?.uid || 'anonymous',
          status: 'lobby',
          quiz_data: quiz_data,
          participants: {},
          current_question_index: 0,
          created_at: Date.now()
        });
        
        window.open(`/live/${pin}/host`, '_blank');
      } catch (err) {
        console.error("Error creating live session:", err);
        alert("Грешка при креирање на жива училница.");
      } finally {
        setIsGeneratingKahoot(false);
      }
    };
    
    // Create Quizlet / Flashcards handler
    const handleExportFlashcards = async () => {
      const selected = getSelectedTasks();
      if (selected.length === 0) return;
      if (!auth.currentUser) return;
      
      let created = 0;
      for (const task of selected) {
        try {
          await addDoc(collection(db, 'flashcards'), {
            front: task.original_text,
            back: task.solution_steps.join('\n'),
            user_uid: auth.currentUser.uid,
            created_at: new Date().toISOString(),
            ease_factor: 2.5,
            interval: 0,
            next_review: new Date().toISOString(),
            source_task_id: task.id || null
          });
          created++;
        } catch (e) {
          console.error("Грешка при зачувување на флешкарта:", e);
        }
      }
      alert(`Успешно се генерирани ${created} флешкарти! Пренасочување...`);
      window.location.href = '/flashcards';
    };
    
    document.addEventListener('open-create-task-modal', handleOpenModal);
    document.addEventListener('open-lesson-plan-modal', handleOpenLessonPlan);
    document.addEventListener('generate-live-session', handleLiveSession);
    document.addEventListener('open-manipulatives', handleOpenManipulatives);
    document.addEventListener('export-to-flashcards', handleExportFlashcards);
    
    return () => {
      document.removeEventListener('open-create-task-modal', handleOpenModal);
      document.removeEventListener('open-lesson-plan-modal', handleOpenLessonPlan);
      document.removeEventListener('generate-live-session', handleLiveSession);
      document.removeEventListener('open-manipulatives', handleOpenManipulatives);
      document.removeEventListener('export-to-flashcards', handleExportFlashcards);
    };
  }, [store.selectedForTest]);

  // Use the new real-time hook
  useRealtimeTasks();

  const rowVirtualizer = useVirtualizer({
    count: sortedAndFilteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,
    overscan: 5,
  });

  const getSelectedTasks = () => {
    return store.tasks.filter(t => t.id && store.selectedForTest.has(t.id));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      // Use useLibraryStore.getState() to avoid infinite dependencies
      const state = useLibraryStore.getState();
      if (Object.keys(state.timerActive).length === 0) return;
      
      const newTimer = Object.keys(state.timerActive).reduce((acc, taskId) => {
        if (state.timerActive[taskId]) {
          acc[taskId] = (state.practiceTimer[taskId] || 0) + 1;
        } else {
          acc[taskId] = state.practiceTimer[taskId] || 0;
        }
        return acc;
      }, {} as Record<string, number>);
      
      // Update store only if values changed
      state.setPracticeTimer(newTimer);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (store.selectedTaskId) {
      setTimeout(() => {
        document.getElementById(`solution-${store.selectedTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [store.selectedTaskId]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    store.setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    store.setDraggedTaskId(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (!store.draggedTaskId || store.draggedTaskId === targetTaskId) return;

    let currentOrder = filters.customOrder.length > 0 ? filters.customOrder : sortedAndFilteredTasks.map(t => t.id!);
    const missingIds = sortedAndFilteredTasks.map(t => t.id!).filter(id => !currentOrder.includes(id));
    currentOrder = [...currentOrder, ...missingIds];

    const draggedIdx = currentOrder.indexOf(store.draggedTaskId);
    const targetIdx = currentOrder.indexOf(targetTaskId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, store.draggedTaskId);

    filters.setCustomOrder(newOrder);
    localStorage.setItem('libraryCustomOrder', JSON.stringify(newOrder));
  };

  const handleExportCSV = () => {
    const tasksToExport = store.isSelectionMode && store.selectedForTest.size > 0
      ? sortedAndFilteredTasks.filter(t => t.id && store.selectedForTest.has(t.id))
      : sortedAndFilteredTasks;

    if (tasksToExport.length === 0) return;

    const headers = ['Наслов', 'Тип', 'Текст', 'Решение', 'Тежина', 'DoK', 'Одделение', 'Тема', 'Тагови', 'Извор'];
    const rows = tasksToExport.map(t => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.type || '').replace(/"/g, '""')}"`,
      `"${(t.original_text || '').replace(/"/g, '""')}"`,
      `"${(t.solution_steps || []).join('\\n').replace(/"/g, '""')}"`,
      `"${(t.difficulty || '').replace(/"/g, '""')}"`,
      `"${t.dok_level || ''}"`,
      `"${(t.grade_level || '').replace(/"/g, '""')}"`,
      `"${(t.curriculum_topic || '').replace(/"/g, '""')}"`,
      `"${(t.tags || []).join(', ').replace(/"/g, '""')}"`,
      `"${(t.source_url || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8,\\uFEFF" + [headers.join(','), ...rows].join('\\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "math_tasks_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (store.isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] space-y-4 animate-in fade-in duration-500">
        {/* Toolbar Skeleton */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex gap-4 w-full max-w-2xl">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32 shrink-0" />
            <Skeleton className="h-10 w-32 shrink-0" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
        
        {/* List Skeleton */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="w-full h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isGeneratingKahoot && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white animate-in fade-in">
           <div className="w-16 h-16 border-4 border-indigo-500 border-t-white rounded-full animate-spin mb-6"></div>
           <h2 className="text-3xl font-black mb-2 tracking-tight">AI-то генерира Kahoot...</h2>
           <p className="text-slate-200 font-bold max-w-md text-center opacity-80">
             Се извлекуваат погрешните одговори и дистракторите специфични за вашите задачи. Може да потрае неколку секунди.
           </p>
        </div>
      )}
      
      {/* Filters & Search */}
      <TaskFilters 
        filters={filters}
        tasks={store.tasks}
        isSelectionMode={store.isSelectionMode}
        setIsSelectionMode={store.setIsSelectionMode}
        selectedForTest={store.selectedForTest}
        setSelectedForTest={store.setSelectedForTest}
        setShowTestGenerator={store.setShowTestGenerator}
        handleExportCSV={handleExportCSV}
      />

      {/* Task List & Side-by-Side View */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: List */}
        <div 
          ref={parentRef}
          className={`flex-1 w-full max-h-[calc(100vh-12rem)] overflow-y-auto pr-2 ${store.selectedTaskId ? 'lg:w-1/3 lg:flex-none' : ''}`}
        >
          {sortedAndFilteredTasks.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Не се пронајдени задачи кои одговараат на пребарувањето.</p>
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const index = virtualRow.index;
                const task = sortedAndFilteredTasks[index];
                const taskId = task.id || String(index);
                const isSelected = store.selectedTaskId === taskId;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: '1rem',
                    }}
                  >
                    <TaskCard
                      task={task}
                      taskId={taskId}
                      isSelected={isSelected}
                      isDeleting={actions.deletingTaskIds.has(taskId)}
                      isSelectionMode={store.isSelectionMode}
                      isSelectedForTest={store.selectedForTest.has(taskId)}
                      onSelect={() => store.setSelectedTaskId(isSelected ? null : taskId)}
                      onToggleSelection={(e) => { e.stopPropagation(); store.toggleTaskSelection(taskId); }}
                      onDelete={(e) => actions.handleDeleteTask(taskId, e)}
                      onEdit={(e) => { e.stopPropagation(); store.setEditingTask(task); }}
                      onDragStart={(e) => handleDragStart(e, taskId)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, taskId)}
                      renderDetailContent={() => <TaskDetailView task={task} taskId={taskId} />}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detail (Desktop only) */}
        {store.selectedTaskId && (
          <div className="hidden lg:block lg:w-2/3 sticky top-24">
            {(() => {
              const task = sortedAndFilteredTasks.find(t => (t.id || String(sortedAndFilteredTasks.indexOf(t))) === store.selectedTaskId);
              if (!task) return null;
              const index = sortedAndFilteredTasks.indexOf(task);
              return (
                <Card className="overflow-hidden border-slate-200 shadow-lg">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <span className="font-semibold text-slate-800 text-lg">
                      {task.type === 'theory' ? `Теорија: ${task.title}` : task.title}
                    </span>
                    <button 
                      onClick={() => store.setSelectedTaskId(null)} 
                      className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                      title="Затвори"
                    >
                      <X className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>
                  <CardContent className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
                    <TaskDetailView task={task} taskId={task.id || String(index)} />
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}
      </div>

      {/* Tutor Chat Modal */}
      {store.activeTutorTask && (
        <TutorChat 
          task={store.activeTutorTask} 
          onClose={() => store.setActiveTutorTask(null)} 
        />
      )}

      {store.activeSolverTask && (
        <InteractiveSolver 
          task={store.activeSolverTask} 
          onClose={() => store.setActiveSolverTask(null)}
          onComplete={(xp) => {
            // XP awarding logic is handled in App.tsx via a global function or similar
            // For now, we'll just alert or assume it's handled
            alert(`Браво! Освоивте ${xp} XP за интерактивно решавање!`);
          }}
        />
      )}

      {store.activeKnowledgeModelTask && (
        <KnowledgeModelModal
          task={store.activeKnowledgeModelTask}
          onClose={() => store.setActiveKnowledgeModelTask(null)}
        />
      )}

      <AnimatePresence>
        {store.activeGraphTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Интерактивен График</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">{store.activeGraphTask.title}</p>
                  </div>
                </div>
                <button onClick={() => store.setActiveGraphTask(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 bg-white">
                <iframe 
                  src="https://www.desmos.com/calculator" 
                  className="w-full h-full border-none"
                  title="Desmos Graphing Calculator"
                />
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 italic">
                Совет: Копирајте ја функцијата од задачата и внесете ја во калкулаторот лево.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Test Generator Modal */}
      {store.showTestGenerator && (
        <TestGenerator 
          selectedTasks={getSelectedTasks()} 
          allTasks={store.tasks}
          onClose={() => store.setShowTestGenerator(false)} 
        />
      )}

      {/* Zoomed Image Modal */}
      <AnimatePresence>
        {store.zoomedImage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => store.setZoomedImage(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => store.setZoomedImage(null)} 
                className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300 transition-colors bg-slate-800/50 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={store.zoomedImage} 
                alt="Зумирана визуелизација" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mathigon / GeoGebra Manipulatives Modal */}
      <AnimatePresence>
        {showManipulativesModal && (
           <div className="fixed inset-0 z-[100] flex flex-col p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowManipulativesModal(false)}>
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full h-full flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden"
               onClick={(e) => e.stopPropagation()}
             >
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manipulativeType === 'geogebra-3d' ? 'bg-rose-100 text-rose-600' : 'bg-pink-100 text-pink-600'}`}>
                     {manipulativeType === 'geogebra-3d' ? <Layers className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 dark:text-white">
                        {manipulativeType === 'geogebra-3d' ? 'GeoGebra 3D Калкулатор' : 'Алгебарски Плочки (MathStudio)'}
                     </h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-lg">
                        {manipulativeType === 'geogebra-3d' 
                           ? 'Отворен е GeoGebra 3D Калкулатор. Идеален за просторна геометрија, стереометрија и вектори.'
                           : 'Отворен е Polypad. Користете плочки за геометрија, дропки и алгебра.'}
                     </p>
                   </div>
                 </div>
                 <button onClick={() => setShowManipulativesModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                   <X className="w-5 h-5" />
                 </button>
               </div>
               <div className="flex-1 bg-white relative">
                 {manipulativeType === 'geogebra-3d' ? (
                   <iframe 
                     src="https://www.geogebra.org/3d?embed" 
                     className="w-full h-full border-none absolute inset-0"
                     title="GeoGebra 3D"
                   />
                 ) : (
                   <iframe 
                     src="https://mathigon.org/polypad/embed" 
                     className="w-full h-full border-none absolute inset-0"
                     title="Mathigon Polypad Virtual Manipulatives"
                   />
                 )}
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Manual Task Modal */}
      {showCreateModal && (
        <CreateTaskModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}

      {/* Lesson Plan Generator Modal */}
      {showLessonPlanModal && (
        <LessonPlanGenerator 
          selectedTasks={getSelectedTasks()}
          onClose={() => setShowLessonPlanModal(false)}
        />
      )}
    </div>
  );
};
