import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { TaskAttempt, UserProfile, MathTask } from '../lib/schema';
import { ChevronLeft, BrainCircuit, Activity, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KnowledgeGraphVisualizer } from './KnowledgeGraphVisualizer';
import { useLibraryStore } from '../store/useLibraryStore';
import { generateInterventionTasks } from '../lib/gemini';

export const StudentTelemetryView: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [studentProfile, setStudentProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [interventionTasks, setInterventionTasks] = useState<MathTask[]>([]);
  const libraryTasks = useLibraryStore((state) => state.tasks);

  useEffect(() => {
    if (!studentId) return;
    setIsLoading(true);

    // Mock student profile setup
    setStudentProfile({
      uid: studentId,
      role: 'student',
      displayName: `Ученик ${studentId.substring(0, 4)}...`,
      email: 'student@example.com',
      createdAt: new Date().toISOString()
    });

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

  const stats = useMemo(() => {
    if (attempts.length === 0) return null;
    
    const completed = attempts.filter(a => a.status === 'completed').length;
    const totalMistakes = attempts.reduce((acc, curr) => acc + curr.mistake_count, 0);
    const totalHints = attempts.reduce((acc, curr) => acc + curr.total_hints_used, 0);
    
    const topics: Record<string, { mistakes: number, count: number }> = {};
    attempts.forEach(a => {
      const topic = a.curriculum_topic || 'Општа Математика';
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
      name: `Обид ${index + 1}`,
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
            <ChevronLeft className="w-4 h-4" /> Назад кон Табла
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            Телеметрија на Студент
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {studentProfile?.displayName} • ИД: <span className="font-mono text-xs">{studentId}</span>
          </p>
        </div>
      </div>

      {attempts.length === 0 ? (
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-800">
          <CardContent className="p-12 text-center text-slate-500">
             <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" />
             <p className="text-lg">Нема телеметриски податоци за овој студент.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg relative overflow-hidden bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Стапка на Завршување</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats?.completionRate}%</h3>
                <p className="text-xs text-slate-400 mt-2">Вкупно {stats?.totalAttempts} обиди</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg relative overflow-hidden bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Грешки по задача</p>
                <h3 className="text-3xl font-black text-red-600 dark:text-red-400">{stats?.avgMistakes}</h3>
                <p className="text-xs text-slate-400 mt-2">просек низ сите теми</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg relative overflow-hidden bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Сократски Помоши</p>
                <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats?.avgHints}</h3>
                <p className="text-xs text-slate-400 mt-2">просечно користење хинтови</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                   <p className="text-sm font-bold text-indigo-100 uppercase tracking-wider mb-1">Критична Тема</p>
                   <h3 className="text-xl font-bold line-clamp-2">{stats?.struggleTopic?.name || 'Нема'}</h3>
                </div>
                <p className="text-xs text-indigo-100 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {stats?.struggleTopic?.avg} грешки во просек
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
                    Грешки и Помош со тек на време (последни 15)
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
                        <Line type="monotone" dataKey="mistakes" name="Грешки" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="hints" name="Помош" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl dark:bg-slate-800/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    Историја на Обиди
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
                              {attempt.curriculum_topic || 'Математички проблем'}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 flex gap-3">
                            <span>{new Date(attempt.start_time).toLocaleString('mk-MK')}</span>
                            {attempt.end_time && (
                              <span>
                                {Math.round((new Date(attempt.end_time).getTime() - new Date(attempt.start_time).getTime()) / 60000)} мин.
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-4">
                           <div className="text-center bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">
                             <div className="text-red-600 dark:text-red-400 font-bold">{attempt.mistake_count}</div>
                             <div className="text-[10px] text-red-500/70 uppercase">Грешки</div>
                           </div>
                           <div className="text-center bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg">
                             <div className="text-amber-600 dark:text-amber-400 font-bold">{attempt.total_hints_used}</div>
                             <div className="text-[10px] text-amber-500/70 uppercase">Хинтови</div>
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
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white">AI Профил</h3>
               </div>
               
               <div className="flex-1 space-y-6">
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                   <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Анализа на Учење</h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                     Студентот манифестира консистентен проблем со <strong>{stats?.struggleTopic?.name || 'комплексни логички операции'}</strong>. 
                     Бројот на грешки е поголем од референтните вредности, што укажува на концептуална дупка.
                   </p>
                 </div>

                   <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                   <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-2 uppercase tracking-wide">Педагошка Препорака</h4>
                   <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-2">
                     <li className="flex items-start gap-2">
                       <span className="text-emerald-500 font-bold">•</span>
                       Додели базични задачи од {stats?.struggleTopic?.name || 'оваа област'}.
                     </li>
                     <li className="flex items-start gap-2">
                       <span className="text-emerald-500 font-bold">•</span>
                       Поттикни користење на Сократски дијалог наместо брзо погодување.
                     </li>
                   </ul>
                 </div>
                 
                 <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2 uppercase tracking-wide">AI Препорачани Ресурси</h4>
                    <div className="space-y-3 mt-3">
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Визуелизација на {stats?.struggleTopic?.name || 'концепти'}</p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">Интерактивен модул</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                          <BrainCircuit className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Тренинг за {stats?.struggleTopic?.name || 'логика'}</p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">Сет од 5 лесни прашања</p>
                        </div>
                      </div>
                    </div>
                 </div>
                 
                 <div className="h-64 my-6">
                    <KnowledgeGraphVisualizer struggleTopic={stats?.struggleTopic?.name} />
                 </div>
                 
                 <div className="pt-2">
                   <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">Историја на Интервенции</h4>
                   <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 pl-4 space-y-4">
                     <div className="relative">
                       <div className="absolute -left-[21px] top-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                       <p className="text-xs font-bold text-slate-800 dark:text-white">Автоматски тест: Основни операции</p>
                       <p className="text-[10px] text-slate-500">Пред 2 дена • Успешност 85%</p>
                     </div>
                     <div className="relative">
                       <div className="absolute -left-[21px] top-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                       <p className="text-xs font-bold text-slate-800 dark:text-white">Порака од наставник</p>
                       <p className="text-[10px] text-slate-500">Пред 5 дена • Прочитано</p>
                     </div>
                   </div>
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
                       `Ученикот има просек од ${stats.struggleTopic.avg} грешки по задача и бара премногу помош. Потребни се полесни задачи за враќање кон основите.`,
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
                 {isGenerating ? 'Генерирање...' : 'Генерирај Нова Интервенција'}
               </Button>
            </div>
          </div>
          
          {interventionTasks.length > 0 && (
             <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Специјализиран Интервентен Сет</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {interventionTasks.map((task, idx) => (
                   <Card key={idx} className="border-0 shadow-xl bg-white dark:bg-slate-800">
                     <CardHeader>
                       <CardTitle className="text-sm text-indigo-600 dark:text-indigo-400">Задача {idx + 1}: {task.title}</CardTitle>
                     </CardHeader>
                     <CardContent>
                       <p className="text-xs text-slate-600 dark:text-slate-300 italic mb-4">{task.original_text}</p>
                       <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                         <p className="text-[10px] font-bold text-slate-500 uppercase">Олеснување (Scaffolding)</p>
                         <p className="text-xs text-slate-700 dark:text-slate-400 mt-1">{task.hints?.[0]}</p>
                       </div>
                       <Button size="sm" variant="outline" className="w-full mt-4 text-xs font-bold">
                         Додели на Ученик
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
