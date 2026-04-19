import React, { useState, useEffect, useMemo } from 'react';
import { Users, BookOpen, TrendingUp, AlertTriangle, Award, BarChart3, ChevronRight, BrainCircuit, Target, CheckCircle2, Activity, Zap, Cpu, Sparkles, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Classroom, UserProfile, TaskAttempt } from '../lib/schema';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { Skeleton } from './ui/Skeleton';
import { useLibraryStore } from '../store/useLibraryStore';
import { SystemIntegrityCheck } from './SystemIntegrityCheck';

interface TeacherDashboardProps {
  userProfile: UserProfile;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ userProfile }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analytics' | 'diagnostics'>('analytics');
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;
    
    setIsLoading(true);

    // Real-time listener for Classrooms
    const qClass = query(collection(db, 'classrooms'), where('teacherId', '==', auth.currentUser.uid));
    const unsubscribeClassrooms = onSnapshot(qClass, (snapshot) => {
      const fetchedClassrooms = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Classroom));
      setClassrooms(fetchedClassrooms);
      // We will set loading to false here or rely on attempts below
    }, (error) => {
      console.error("Error listening to classrooms:", error);
    });

    // Real-time listener for Attempts
    const qAttempts = query(collection(db, 'task_attempts'), orderBy('start_time', 'desc'), limit(100));
    const unsubscribeAttempts = onSnapshot(qAttempts, (snapshot) => {
      const fetchedAttempts = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TaskAttempt));
      setAttempts(fetchedAttempts);
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to attempts:", error);
      setIsLoading(false);
    });

    return () => {
      unsubscribeClassrooms();
      unsubscribeAttempts();
    };
  }, []);

  // Compute Cognitive Telemetry Metrics
  const telemetryStats = useMemo(() => {
    const total = attempts.length;
    if (total === 0) return null;

    const completed = attempts.filter(a => a.status === 'completed').length;
    const completionRate = Math.round((completed / total) * 100);
    
    // Group struggles by topic
    const topicMistakes: Record<string, { mistakes: number, hints: number, count: number }> = {};
    attempts.forEach(a => {
      const topic = a.curriculum_topic || 'Општа Математика';
      if (!topicMistakes[topic]) topicMistakes[topic] = { mistakes: 0, hints: 0, count: 0 };
      topicMistakes[topic].mistakes += a.mistake_count;
      topicMistakes[topic].hints += a.total_hints_used;
      topicMistakes[topic].count += 1;
    });

    const struggleTopics = Object.entries(topicMistakes).map(([topic, data]) => ({
      topic,
      avgMistakes: parseFloat((data.mistakes / data.count).toFixed(1)),
      avgHints: parseFloat((data.hints / data.count).toFixed(1)),
      totalAttempts: data.count,
      cognitiveLoad: parseFloat(((data.mistakes * 1.5 + data.hints * 2) / data.count).toFixed(1)) // Custom heuristic score
    })).sort((a, b) => b.cognitiveLoad - a.cognitiveLoad).slice(0, 4);

    return { total, completionRate, struggleTopics };
  }, [attempts]);

  // Mock data for overall analytics
  const classPerformanceData = [
    { name: 'Мат 8-1', score: 85, target: 80 },
    { name: 'Мат 8-2', score: 72, target: 80 },
    { name: 'Мат 9-1', score: 90, target: 85 },
    { name: 'Мат 9-3', score: 65, target: 85 },
  ];

  const weeklyActivityData = useMemo(() => {
    const days = ['Нед', 'Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб'];
    const past7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { 
        day: days[d.getDay()], 
        dateString: d.toISOString().split('T')[0],
        tasks: 0 
      };
    });

    attempts.forEach(a => {
      const dateStr = a.start_time.split('T')[0];
      const match = past7Days.find(d => d.dateString === dateStr);
      if (match) {
        match.tasks += 1;
      }
    });

    return past7Days.map(({ day, tasks }) => ({ day, tasks }));
  }, [attempts]);

  // We will build strugglingStudents state based on actual attempts rather than mock data.
  const strugglingStudents = useMemo(() => {
    // Collect users who have high mistake counts across attempts.
    const studentMistakes: Record<string, { userId: string, mistakes: number, topic: string, attempts: number }> = {};
    attempts.forEach(a => {
      if (!studentMistakes[a.user_id]) {
        studentMistakes[a.user_id] = { userId: a.user_id, mistakes: 0, topic: a.curriculum_topic || 'Општа Математика', attempts: 0 };
      }
      studentMistakes[a.user_id].mistakes += a.mistake_count;
      studentMistakes[a.user_id].attempts += 1;
      // Heuristic: Keep the topic from the attempt with the highest mistakes
      if (a.mistake_count > (studentMistakes[a.user_id].mistakes / Math.max(1, studentMistakes[a.user_id].attempts))) {
         studentMistakes[a.user_id].topic = a.curriculum_topic || 'Општа Математика';
      }
    });

    return Object.values(studentMistakes)
      .filter(s => s.mistakes > 0)
      .sort((a, b) => b.mistakes - a.mistakes)
      .slice(0, 4)
      .map((s, index) => ({
        id: s.userId,
        name: `Ученик ${s.userId.substring(0, 4)}...`, // We don't have user profiles joined here, so using ID mask
        class: s.attempts > 3 ? 'Висока активност' : 'Ниска активност',
        topic: s.topic,
        score: Math.max(0, 100 - (s.mistakes * 5)) // Mock score drop based on mistakes
      }));
  }, [attempts]);

  const totalStudents = classrooms.reduce((acc, cls) => acc + cls.studentIds.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="w-64 h-10" />
            <Skeleton className="w-96 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="w-full h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const handleGenerateIntervention = (topic: string) => {
    navigate(`/factory?intervention=${encodeURIComponent(topic)}`);
  };

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in duration-500 pb-12">
      {/* Strategic Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:32px_32px]"></div>
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-indigo-200 tracking-wide uppercase mb-4">
            <Activity className="w-4 h-4" /> Телеметрија во реално време
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2">
            Когнитивен Центар
          </h2>
          <p className="text-indigo-200 text-lg max-w-xl leading-relaxed">
            Добредојдовте, Проф. {userProfile.displayName}. Системот анализира {telemetryStats?.total || 0} неодамнешни студентски обиди.
          </p>
        </div>
        
        <div className="relative z-10 flex flex-wrap gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            className={`border-white/10 text-white hover:bg-white/10 rounded-xl transition-all h-12 font-bold ${activeTab === 'analytics' ? 'bg-white/20 ring-1 ring-white/40' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 className="w-5 h-5 mr-2" /> Аналитика
          </Button>
          <Button 
            variant="outline" 
            className={`border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/20 rounded-xl transition-all h-12 font-bold ${activeTab === 'diagnostics' ? 'bg-indigo-500/30 ring-1 ring-indigo-500/50' : ''}`}
            onClick={() => setActiveTab('diagnostics')}
          >
            <ShieldCheck className="w-5 h-5 mr-2" /> Системски Пулс
          </Button>
          <Link to="/factory" className="w-full md:w-auto">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 border-0 h-12 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105">
              <Zap className="w-5 h-5 mr-2" />
              Фабрика
            </Button>
          </Link>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'analytics' ? (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Dynamic Telemetry KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none dark:bg-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-24 h-24" />
          </div>
          <CardContent className="p-6 relative z-10">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Активни Ученици</p>
            <h3 className="text-4xl font-black text-slate-900 dark:text-white mb-2">{totalStudents}</h3>
            <div className="flex items-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span>Синхронизирано</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none dark:bg-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target className="w-24 h-24" />
          </div>
          <CardContent className="p-6 relative z-10">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Стапка на Завршување</p>
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-4xl font-black text-slate-900 dark:text-white">{telemetryStats?.completionRate || 0}%</h3>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${telemetryStats?.completionRate || 0}%` }} 
                transition={{ duration: 1, delay: 0.2 }}
                className="bg-indigo-600 h-full rounded-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 border-0 shadow-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white relative overflow-hidden group">
          <div className="absolute inset-0 bg-[#000000] opacity-10 mix-blend-overlay"></div>
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
            <BrainCircuit className="w-32 h-32" />
          </div>
          <CardContent className="p-6 relative z-10 h-full flex flex-col justify-between">
            <div>
              <p className="text-sm font-bold text-orange-100 uppercase tracking-wider mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Когнитивен Аларм
              </p>
              <h3 className="text-2xl font-bold mb-1">
                {telemetryStats?.struggleTopics[0]?.topic || 'Нема податоци'}
              </h3>
              <p className="text-orange-100 text-sm">
                Највисок когнитивен товар. Просек {telemetryStats?.struggleTopics[0]?.avgMistakes || 0} грешки по задача.
              </p>
            </div>
            {telemetryStats?.struggleTopics[0] && (
              <Button 
                onClick={() => handleGenerateIntervention(telemetryStats.struggleTopics[0].topic)}
                className="mt-4 bg-white text-orange-600 hover:bg-orange-50 font-bold border-0 w-max shadow-lg focus:ring-4 focus:ring-white/20"
              >
                Генерирај Интервентен Тест
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Cognitive Hotspots */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Неврални Слабости</h3>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence>
              {telemetryStats?.struggleTopics.map((item, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={item.topic} 
                  className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-amber-500'}`}></div>
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-slate-900 dark:text-white">{item.topic}</h4>
                    <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full px-2 py-1">
                      {item.totalAttempts} обиди
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20">
                      <p className="text-red-500 font-medium mb-1">Грешки / Зад.</p>
                      <p className="text-2xl font-black text-red-700 dark:text-red-400">{item.avgMistakes}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/20">
                      <p className="text-amber-600 font-medium mb-1">Сократски Помоши</p>
                      <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{item.avgHints}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {(!telemetryStats?.struggleTopics || telemetryStats.struggleTopics.length === 0) && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
                <p>Нема доволно податоци за телеметрија. Учениците треба да решаваат задачи преку Интерактивниот Солвер.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Deep Analytics Charts */}
        <div className="lg:col-span-2 space-y-6">
           <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none dark:bg-slate-800/80">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700/50 pb-6">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Телеметрија на Активност (Последни 7 дена)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyActivityData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '5 5' }}
                    />
                    <Area type="monotone" dataKey="tasks" name="Интерактивни Решавања" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorTasks)" activeDot={{ r: 8, strokeWidth: 0, fill: '#4f46e5' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none dark:bg-slate-800/80">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Студенти на кои им треба внимание
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {strugglingStudents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
                    <p>Нема детектирано ученици со потешкотии од последната телеметрија.</p>
                  </div>
                ) : (
                  strugglingStudents.map((student) => (
                    <Link to={`/students/${student.id}`} key={student.id} className="block group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                            {student.name.charAt(7)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{student.name}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{student.class} • Проблем со: <span className="font-medium text-amber-600 dark:text-amber-400">{student.topic}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">{student.score}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">просек</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 opacity-50" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none dark:bg-slate-800/80 mt-6">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-purple-600" />
                Телеметриски AI Асистент
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="px-5 py-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/60 shadow-sm">
                <h4 className="font-bold text-purple-900 dark:text-purple-300 mb-2 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> 
                  Синтеза на податоци
                </h4>
                <p className="text-sm text-purple-800 dark:text-purple-400 leading-relaxed">
                  <strong>Инсајт:</strong> Базирано на последните 100 телеметриски логови, вашите ученици најмногу време трошат на {telemetryStats?.struggleTopics[0]?.topic || 'општи'} проблеми. Нивните главни катализатори за помош се сократските прашања. 
                </p>
                <Button 
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all hover:scale-[1.02]"
                  onClick={() => showToast('AI модулот не е врзан за продукција во оваа тест фаза.', 'info')}
                >
                  Адаптирај Следна Лекција
                </Button>
              </div>

              <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mt-4">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Здравје на училницата</p>
                  <p className="text-xs text-slate-500 leading-relaxed">Стапката на завршување од {telemetryStats?.completionRate || 0}% е во рамки на стандардите. Интерактивниот солвер ја намалил стапката на откажување за 14%.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </motion.div>
    ) : (
      <div className="animate-in fade-in duration-700">
        <SystemIntegrityCheck />
      </div>
    )}
  </AnimatePresence>
</div>
  );
}