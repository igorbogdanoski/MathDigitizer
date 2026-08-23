import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, addDoc, doc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { TaskAttempt, UserProfile, MathTask, InterventionPlan } from '../lib/schema';
import { ChevronLeft, BrainCircuit, Activity, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KnowledgeGraphVisualizer } from './KnowledgeGraphVisualizer';
import { useLibraryStore } from '../store/useLibraryStore';
import { generateInterventionTasks } from '../lib/gemini';

export const StudentTelemetryView: React.FC = () => {
  const { t } = useTranslation('teacherDashboard');
  const { studentId } = useParams<{ studentId: string }>();
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [studentProfile, setStudentProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [interventionTasks, setInterventionTasks] = useState<MathTask[]>([]);
  const [interventions, setInterventions] = useState<InterventionPlan[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const libraryTasks = useLibraryStore((state) => state.tasks);

  useEffect(() => {
    if (!studentId) return;
    setIsLoading(true);

    // Real profile from `users` (Phase 7.3) — this was a mock that invented an
    // email and a display name for every student a teacher opened.
    getDoc(doc(db, 'users', studentId))
      .then(snap => {
        setStudentProfile(snap.exists()
          ? (snap.data() as UserProfile)
          : {
              // The student may never have signed in (a Kahoot guest uid).
              uid: studentId,
              role: 'student',
              displayName: t('telemetry.studentFallbackName', { id: studentId.substring(0, 4) }),
              email: '',
              createdAt: '',
            });
      })
      .catch(err => console.warn('Failed to load student profile', err));

    // Intervention plans the teacher has assigned, newest first (Phase 7.3)
    getDocs(query(
      collection(db, 'intervention_plans'),
      where('student_id', '==', studentId),
      orderBy('created_at', 'desc'),
      limit(10)
    ))
      .then(snap => setInterventions(snap.docs.map(d => ({ id: d.id, ...d.data() } as InterventionPlan))))
      .catch(err => console.warn('Failed to load intervention plans', err));

    const qAttempts = query(
      collection(db, 'task_attempts'),
      where('user_id', '==', studentId),
      orderBy('start_time', 'desc')
    );
    
    const unsubscribe = onSnapshot(qAttempts, (snapshot) => {
      const fetchedAttempts = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TaskAttempt));
      setAttempts(fetchedAttempts);
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to student telemetry:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [studentId]);

  /**
   * Persists the assignment (Phase 7.3): the button previously did nothing, so
   * the intervention history could only ever be placeholder content.
   */
  const assignIntervention = async (task: MathTask) => {
    const teacher = auth.currentUser;
    if (!studentId || !teacher) return;

    setIsAssigning(true);
    try {
      const plan: Omit<InterventionPlan, 'id'> = {
        student_id: studentId,
        teacher_uid: teacher.uid,
        reason: stats?.struggleTopic?.name || t('telemetry.fallbackStruggle'),
        action: task.title,
        kind: 'targeted_tasks',
        ...(task.id ? { task_ids: [task.id] } : {}),
        created_at: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'intervention_plans'), plan);
      setInterventions(prev => [{ id: docRef.id, ...plan }, ...prev]);
    } catch (err) {
      console.error('Failed to save intervention plan', err);
    } finally {
      setIsAssigning(false);
    }
  };

  const stats = useMemo(() => {
    if (attempts.length === 0) return null;
    
    const completed = attempts.filter(a => a.status === 'completed').length;
    const totalMistakes = attempts.reduce((acc, curr) => acc + curr.mistake_count, 0);
    const totalHints = attempts.reduce((acc, curr) => acc + curr.total_hints_used, 0);
    
    const topics: Record<string, { mistakes: number, count: number }> = {};
    attempts.forEach(a => {
      const topic = a.curriculum_topic || t('telemetry.defaultTopic');
      if (!topics[topic]) topics[topic] = { mistakes: 0, count: 0 };
      topics[topic].mistakes += a.mistake_count;
      topics[topic].count += 1;
    });

    const struggleTopic = Object.entries(topics)
      .sort((a, b) => (b[1].mistakes / b[1].count) - (a[1].mistakes / a[1].count))[0];

    return {
      totalAttempts: attempts.length,
      completionRate: Math.round((completed / attempts.length) * 100),
      avgMistakes: (totalMistakes / attempts.length).toFixed(1),
      avgHints: (totalHints / attempts.length).toFixed(1),
      struggleTopic: struggleTopic ? { name: struggleTopic[0], avg: (struggleTopic[1].mistakes / struggleTopic[1].count).toFixed(1) } : null
    };
  }, [attempts]);

  const chartData = useMemo(() => {
    return attempts.slice(0, 15).reverse().map((a, index) => ({
      name: t('telemetry.attemptLabel', { index: index + 1 }),
      mistakes: a.mistake_count,
      hints: a.total_hints_used,
    }));
  }, [attempts]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in pb-12">
        <Skeleton className="w-1/3 h-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="w-full h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/dashboard">
          <Button variant="outline" size="sm" className="hidden md:flex gap-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {t('telemetry.backToDashboard')}
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            {t('telemetry.title')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {t('telemetry.subtitle', { name: studentProfile?.displayName })}<span className="font-mono text-xs">{studentId}</span>
          </p>
        </div>
      </div>

      {attempts.length === 0 ? (
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-800">
          <CardContent className="p-12 text-center text-slate-500">
             <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" />
             <p className="text-lg">{t('telemetry.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg relative overflow-hidden bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('telemetry.completionRate')}</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats?.completionRate}%</h3>
                <p className="text-xs text-slate-400 mt-2">{t('telemetry.totalAttempts', { count: stats?.totalAttempts })}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg relative overflow-hidden bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('telemetry.mistakesPerTask')}</p>
                <h3 className="text-3xl font-black text-red-600 dark:text-red-400">{stats?.avgMistakes}</h3>
                <p className="text-xs text-slate-400 mt-2">{t('telemetry.acrossTopics')}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg relative overflow-hidden bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('telemetry.socraticHints')}</p>
                <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats?.avgHints}</h3>
                <p className="text-xs text-slate-400 mt-2">{t('telemetry.avgHintUse')}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                   <p className="text-sm font-bold text-indigo-100 uppercase tracking-wider mb-1">{t('telemetry.criticalTopic')}</p>
                   <h3 className="text-xl font-bold line-clamp-2">{stats?.struggleTopic?.name || t('telemetry.none')}</h3>
                </div>
                <p className="text-xs text-indigo-100 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('telemetry.avgMistakes', { count: stats?.struggleTopic?.avg })}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-0 shadow-xl dark:bg-slate-800/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    {t('telemetry.chartTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="mistakes" name={t('telemetry.seriesMistakes')} stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="hints" name={t('telemetry.seriesHints')} stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl dark:bg-slate-800/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    {t('telemetry.attemptHistory')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                    {attempts.map(attempt => (
                      <div key={attempt.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            {attempt.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-400" />
                            )}
                            <h4 className="font-semibold text-slate-900 dark:text-white line-clamp-1 max-w-sm">
                              {attempt.curriculum_topic || t('telemetry.mathProblem')}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 flex gap-3">
                            <span>{new Date(attempt.start_time).toLocaleString('mk-MK')}</span>
                            {attempt.end_time && (
                              <span>
                                {t('telemetry.minutes', { count: Math.round((new Date(attempt.end_time).getTime() - new Date(attempt.start_time).getTime()) / 60000) })}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-4">
                           <div className="text-center bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">
                             <div className="text-red-600 dark:text-red-400 font-bold">{attempt.mistake_count}</div>
                             <div className="text-[10px] text-red-500/70 uppercase">{t('telemetry.mistakes')}</div>
                           </div>
                           <div className="text-center bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg">
                             <div className="text-amber-600 dark:text-amber-400 font-bold">{attempt.total_hints_used}</div>
                             <div className="text-[10px] text-amber-500/70 uppercase">{t('telemetry.hints')}</div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 border-0 shadow-xl rounded-2xl bg-gradient-to-b from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 p-6 flex flex-col">
               <div className="flex items-center gap-2 mb-6">
                 <BrainCircuit className="w-6 h-6 text-indigo-600" />
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('telemetry.aiProfile')}</h3>
               </div>
               
               <div className="flex-1 space-y-6">
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                   <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">{t('telemetry.learningAnalysis')}</h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                     <Trans
                       t={t}
                       i18nKey="telemetry.learningAnalysisBody"
                       values={{ topic: stats?.struggleTopic?.name || t('telemetry.fallbackStruggle') }}
                       components={{ strong: <strong /> }}
                     />
                   </p>
                 </div>

                   <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                   <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-2 uppercase tracking-wide">{t('telemetry.recommendation')}</h4>
                   <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-2">
                     <li className="flex items-start gap-2">
                       <span className="text-emerald-500 font-bold">•</span>
                       {t('telemetry.recommendationAssign', { topic: stats?.struggleTopic?.name || t('telemetry.fallbackArea') })}
                     </li>
                     <li className="flex items-start gap-2">
                       <span className="text-emerald-500 font-bold">•</span>
                       {t('telemetry.recommendationSocratic')}
                     </li>
                   </ul>
                 </div>
                 
                 <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2 uppercase tracking-wide">{t('telemetry.recommendedResources')}</h4>
                    <div className="space-y-3 mt-3">
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{t('telemetry.resourceVisualization', { topic: stats?.struggleTopic?.name || t('telemetry.fallbackConcepts') })}</p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">{t('telemetry.resourceInteractive')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                          <BrainCircuit className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{t('telemetry.resourceTraining', { topic: stats?.struggleTopic?.name || t('telemetry.fallbackLogic') })}</p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">{t('telemetry.resourceQuestionSet')}</p>
                        </div>
                      </div>
                    </div>
                 </div>
                 
                 <div className="h-64 my-6">
                    <KnowledgeGraphVisualizer struggleTopic={stats?.struggleTopic?.name} />
                 </div>
                 
                 <div className="pt-2">
                   <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">{t('telemetry.interventionHistory')}</h4>
                   {interventions.length === 0 ? (
                     <p className="text-xs text-slate-500">{t('telemetry.noInterventions')}</p>
                   ) : (
                     <ol className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 pl-4 space-y-4">
                       {interventions.map(plan => (
                         <li key={plan.id} className="relative">
                           <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                             plan.resolved_at ? 'bg-emerald-500' : 'bg-indigo-500'
                           }`} />
                           <p className="text-xs font-bold text-slate-800 dark:text-white">{plan.action}</p>
                           <p className="text-[10px] text-slate-500">
                             {new Date(plan.created_at).toLocaleDateString('mk-MK')} • {plan.reason}
                           </p>
                         </li>
                       ))}
                     </ol>
                   )}
                 </div>
               </div>
               
               <Button 
                 onClick={async () => {
                   if (!stats?.struggleTopic) return;
                   setIsGenerating(true);
                   try {
                     const struggleTopicName = stats.struggleTopic.name.toLowerCase();
                     const retrievalTasks = libraryTasks.filter((task) => {
                       const topic = (task.curriculum_topic || '').toLowerCase();
                       const tags = (task.tags || []).join(' ').toLowerCase();
                       const title = (task.title || '').toLowerCase();
                       return topic.includes(struggleTopicName) || tags.includes(struggleTopicName) || title.includes(struggleTopicName);
                     });

                     const tasks = await generateInterventionTasks(
                       stats.struggleTopic.name, 
                       t('telemetry.interventionPrompt', { avg: stats.struggleTopic.avg }),
                       {
                         strategy: 'sos',
                         retrievalTasks: retrievalTasks.length > 0 ? retrievalTasks : libraryTasks
                       }
                     );
                     
                     // Optionally redirect to intervention or show in UI
                     setInterventionTasks(tasks);
                   } catch (e) {
                     console.error(e);
                   } finally {
                     setIsGenerating(false);
                   }
                 }}
                 disabled={isGenerating || !stats?.struggleTopic}
                 className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
               >
                 {isGenerating ? t('telemetry.generating') : t('telemetry.generateIntervention')}
               </Button>
            </div>
          </div>
          
          {interventionTasks.length > 0 && (
             <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('telemetry.interventionSet')}</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {interventionTasks.map((task, idx) => (
                   <Card key={idx} className="border-0 shadow-xl bg-white dark:bg-slate-800">
                     <CardHeader>
                       <CardTitle className="text-sm text-indigo-600 dark:text-indigo-400">{t('telemetry.taskNumber', { index: idx + 1, title: task.title })}</CardTitle>
                     </CardHeader>
                     <CardContent>
                       <p className="text-xs text-slate-600 dark:text-slate-300 italic mb-4">{task.original_text}</p>
                       <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                         <p className="text-[10px] font-bold text-slate-500 uppercase">{t('telemetry.scaffolding')}</p>
                         <p className="text-xs text-slate-700 dark:text-slate-400 mt-1">{task.hints?.[0]}</p>
                       </div>
                       <Button
                         size="sm"
                         variant="outline"
                         disabled={isAssigning}
                         onClick={() => assignIntervention(task)}
                         className="w-full mt-4 text-xs font-bold"
                       >
                         {isAssigning ? t('telemetry.assigning') : t('telemetry.assignToStudent')}
                       </Button>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             </div>
          )}
        </>
      )}
    </div>
  );
};
