import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Classroom, Assignment, MathTask, StudentProgress, TaskAttempt, UserStats } from '../lib/schema';
import { AssignmentCard } from './student/AssignmentCard';
import { TaskSolveModal } from './student/TaskSolveModal';
import { KnowledgePath } from './student/KnowledgePath';
import { SEO } from './SEO';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Zap, Flame, Trophy, ClipboardList, TrendingUp, Map, Loader2, RefreshCw } from 'lucide-react';

type Tab = 'assignments' | 'progress' | 'knowledge';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('assignments');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Record<string, MathTask>>({});
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [completedAttempts, setCompletedAttempts] = useState<TaskAttempt[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSolve, setActiveSolve] = useState<{ task: MathTask; assignmentId: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Classrooms this student belongs to
      const classSnap = await getDocs(
        query(collection(db, 'classrooms'), where('studentIds', 'array-contains', user.uid))
      );
      const fetchedClassrooms = classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Classroom));
      setClassrooms(fetchedClassrooms);

      // 2. Assignments for those classrooms
      let fetchedAssignments: Assignment[] = [];
      if (fetchedClassrooms.length > 0) {
        const classroomIds = fetchedClassrooms.map(c => c.id!).slice(0, 30);
        const assignSnap = await getDocs(
          query(collection(db, 'assignments'), where('classroomId', 'in', classroomIds))
        );
        fetchedAssignments = assignSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
        setAssignments(fetchedAssignments);

        // 3. Fetch MathTask docs for all taskIds in batches of 10
        const allTaskIds = [...new Set(fetchedAssignments.flatMap(a => a.taskIds))];
        const taskMap: Record<string, MathTask> = {};
        for (let i = 0; i < allTaskIds.length; i += 10) {
          const batch = allTaskIds.slice(i, i + 10);
          if (batch.length === 0) continue;
          const taskSnap = await getDocs(
            query(collection(db, 'tasks'), where('__name__', 'in', batch))
          );
          taskSnap.docs.forEach(d => { taskMap[d.id] = { id: d.id, ...d.data() } as MathTask; });
        }
        setTasks(taskMap);
      }

      // 4. StudentProgress — handled by onSnapshot below, skip here

      // 5. Completed task_attempts (last 20)
      try {
        const attemptsSnap = await getDocs(
          query(
            collection(db, 'task_attempts'),
            where('user_id', '==', user.uid),
            where('status', '==', 'completed'),
            orderBy('end_time', 'desc'),
            limit(20)
          )
        );
        setCompletedAttempts(attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TaskAttempt)));
      } catch {
        // Composite index may not exist yet — fallback without orderBy
        const attemptsSnap = await getDocs(
          query(collection(db, 'task_attempts'), where('user_id', '==', user.uid), where('status', '==', 'completed'))
        );
        setCompletedAttempts(attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TaskAttempt)).slice(0, 20));
      }

      // 6. UserStats
      const statsSnap = await getDoc(doc(db, 'user_stats', user.uid));
      if (statsSnap.exists()) setUserStats(statsSnap.data() as UserStats);
    } catch (err) {
      console.error('StudentDashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time listener for student_progress
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'student_progress'), where('studentId', '==', user.uid)),
      snap => setStudentProgress(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentProgress)))
    );
    return unsub;
  }, [user]);

  const refreshProgress = useCallback(() => {}, []);

  const completedTaskIdSet = useMemo(
    () => new Set(studentProgress.filter(p => p.status === 'completed').map(p => p.taskId)),
    [studentProgress]
  );

  const pendingAssignments = useMemo(
    () => assignments.filter(a => a.taskIds.some(tid => !completedTaskIdSet.has(tid))),
    [assignments, completedTaskIdSet]
  );

  const completedAssignmentsCount = useMemo(
    () => assignments.filter(a => a.taskIds.length > 0 && a.taskIds.every(tid => completedTaskIdSet.has(tid))).length,
    [assignments, completedTaskIdSet]
  );

  const avgMistakes = useMemo(() => {
    if (completedAttempts.length === 0) return 0;
    return Math.round(completedAttempts.reduce((s, a) => s + (a.mistake_count ?? 0), 0) / completedAttempts.length * 10) / 10;
  }, [completedAttempts]);

  const favTopic = useMemo(() => {
    const counts: Record<string, number> = {};
    completedAttempts.forEach(a => { if (a.curriculum_topic) counts[a.curriculum_topic] = (counts[a.curriculum_topic] ?? 0) + 1; });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [completedAttempts]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'assignments', label: 'Мои Задачи', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'progress', label: 'Мој Напредок', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'knowledge', label: 'Знаење Пат', icon: <Map className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <SEO title="Студентска Табла" description="Управувај со твоите задачи и следи го напредокот." keywords="ученик, задачи, напредок, математика" />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header stats */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex items-center gap-3">
            {user?.photoURL && (
              <img src={user.photoURL} alt="Профил" className="w-10 h-10 rounded-full border-2 border-indigo-200 shrink-0" referrerPolicy="no-referrer" />
            )}
            <h1 className="text-2xl font-black text-slate-800">Добредојде назад! 👋</h1>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 text-center">
              <Zap className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
              <p className="text-xl font-black text-indigo-700">{userStats?.xp ?? 0}</p>
              <p className="text-xs text-indigo-500 font-medium">XP</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 text-center">
              <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-black text-orange-700">{userStats?.streak ?? 0}</p>
              <p className="text-xs text-orange-500 font-medium">Стрик</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
              <Trophy className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-xl font-black text-emerald-700">{completedTaskIdSet.size}</p>
              <p className="text-xs text-emerald-500 font-medium">Решени</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Мои Задачи */}
        {activeTab === 'assignments' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {classrooms.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-500">Не си во ниту еден клас.</p>
                <p className="text-sm text-slate-400">Побарај покана код од твојот наставник.</p>
                <Link to="/classrooms" className="inline-block mt-2 text-sm text-indigo-600 font-semibold hover:underline">
                  Придружи се на клас →
                </Link>
              </div>
            ) : pendingAssignments.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <p className="font-semibold text-slate-700">Сè е завршено! Одлична работа! 🎉</p>
                <p className="text-sm text-slate-400">Нема нерешени задачи.</p>
              </div>
            ) : (
              pendingAssignments.map(assignment => {
                const assignmentTasks = assignment.taskIds
                  .map(tid => tasks[tid])
                  .filter((t): t is MathTask => !!t);
                return (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    tasks={assignmentTasks}
                    completedTaskIds={completedTaskIdSet}
                    onSolveTask={(task, assignmentId) => setActiveSolve({ task, assignmentId })}
                  />
                );
              })
            )}
            {completedAssignmentsCount > 0 && (
              <p className="text-center text-sm text-slate-400 pt-2">
                + {completedAssignmentsCount} завршен{completedAssignmentsCount === 1 ? 'о' : 'и'} задани{completedAssignmentsCount === 1 ? 'е' : 'ја'}
              </p>
            )}
          </motion.div>
        )}

        {/* Tab: Мој Напредок */}
        {activeTab === 'progress' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                <p className="text-2xl font-black text-slate-700">{completedAttempts.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Обиди</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                <p className="text-2xl font-black text-slate-700">{avgMistakes}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Просечни грешки</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                <p className="text-sm font-bold text-slate-700 leading-tight line-clamp-2" title={favTopic ?? ''}>{favTopic ?? '—'}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Омилена тема</p>
              </div>
            </div>

            {/* Flashcards CTA */}
            <Link to="/flashcards" className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl p-4 transition-colors">
              <BookOpen className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold text-sm">Повтори со Флешкарти</p>
                <p className="text-xs text-indigo-200">Вежбај со спасед репетишн систем</p>
              </div>
            </Link>

            {/* Attempts list */}
            {completedAttempts.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Нема завршени задачи уште. Реши некоја задача за да видиш напредок!
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Последни обиди</h3>
                {completedAttempts.map((attempt, i) => {
                  const taskInfo = attempt.task_id ? tasks[attempt.task_id] : null;
                  const date = attempt.end_time ? new Date(attempt.end_time).toLocaleDateString('mk-MK', { day: 'numeric', month: 'short' }) : '';
                  return (
                    <div key={attempt.id ?? i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{taskInfo?.title ?? attempt.task_id}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {attempt.curriculum_topic && (
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">{attempt.curriculum_topic}</span>
                          )}
                          <span className="text-xs text-slate-400">{date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        {attempt.mistake_count !== undefined && (
                          <span className={`text-xs font-bold ${attempt.mistake_count === 0 ? 'text-emerald-600' : 'text-orange-500'}`}>
                            {attempt.mistake_count === 0 ? '✓ Без грешки' : `${attempt.mistake_count} грешки`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Знаење Пат */}
        {activeTab === 'knowledge' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <KnowledgePath completedAttempts={completedAttempts} userXP={userStats?.xp ?? 0} />
          </motion.div>
        )}

        {/* Refresh button */}
        <div className="flex justify-center pt-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Освежи
          </button>
        </div>
      </div>

      {/* TaskSolveModal */}
      {activeSolve && (
        <TaskSolveModal
          task={activeSolve.task}
          assignmentId={activeSolve.assignmentId}
          onClose={() => setActiveSolve(null)}
          onComplete={async () => {
            setActiveSolve(null);
            await refreshProgress();
          }}
        />
      )}
    </>
  );
};
