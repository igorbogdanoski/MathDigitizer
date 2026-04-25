import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Classroom, Assignment, UserProfile, MathTask } from '../lib/schema';
import { BookOpen, Users, ArrowLeft, Loader2, Plus, Calendar, CheckCircle2, Circle, X, PieChart as PieChartIcon, BrainCircuit, Activity, AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { LiveCanvas } from './LiveCanvas';
import { LiveClassroomMonitor } from './LiveClassroomMonitor';

const classMasteryData = [
  { subject: 'Алгебра', A: 75, fullMark: 100 },
  { subject: 'Геометрија', A: 60, fullMark: 100 },
  { subject: 'Тригонометрија', A: 50, fullMark: 100 },
  { subject: 'Статистика', A: 80, fullMark: 100 },
  { subject: 'Логика', A: 85, fullMark: 100 },
  { subject: 'Анализа', A: 45, fullMark: 100 },
];

export const ClassroomDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assignments' | 'canvas' | 'telemetry' | 'live'>('telemetry'); // Default to telemetry for the wow factor

  // Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [libraryTasks, setLibraryTasks] = useState<MathTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    fetchClassroomData();
  }, [id, user]);

  const fetchClassroomData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch classroom
      const classDoc = await getDoc(doc(db, 'classrooms', id!));
      if (!classDoc.exists()) {
        setIsLoading(false);
        return;
      }
      const classData = { id: classDoc.id, ...classDoc.data() } as Classroom;
      setClassroom(classData);

      // 2. Fetch assignments
      const assignQ = query(collection(db, 'assignments'), where('classroomId', '==', id));
      const assignSnap = await getDocs(assignQ);
      setAssignments(assignSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));

      // 3. Fetch students if teacher
      if (userProfile?.role === 'teacher' && classData.studentIds.length > 0) {
        const studentsData: UserProfile[] = [];
        for (const studentId of classData.studentIds) {
          const sDoc = await getDoc(doc(db, 'users', studentId));
          if (sDoc.exists()) {
            studentsData.push(sDoc.data() as UserProfile);
          }
        }
        setStudents(studentsData);
      }
    } catch (error) {
      console.error("Error fetching classroom details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAssignModal = async () => {
    setIsAssignModalOpen(true);
    if (libraryTasks.length === 0) {
      try {
        const q = query(collection(db, 'tasks'));
        const snap = await getDocs(q);
        setLibraryTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as MathTask)));
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentTitle || !dueDate || selectedTaskIds.size === 0 || !id) return;
    setIsSubmitting(true);
    try {
      const newAssignment = {
        classroomId: id,
        title: assignmentTitle,
        taskIds: Array.from(selectedTaskIds),
        dueDate: new Date(dueDate).toISOString(),
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'assignments'), newAssignment);
      setAssignments([...assignments, { id: docRef.id, ...newAssignment } as Assignment]);
      setIsAssignModalOpen(false);
      setAssignmentTitle('');
      setDueDate('');
      setSelectedTaskIds(new Set());
    } catch (error) {
      console.error("Error creating assignment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTaskIds);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTaskIds(newSelected);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500">Се вчитува училницата...</p>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-900">Училницата не е пронајдена</h2>
        <Link to="/classrooms" className="text-indigo-600 hover:underline mt-4 inline-block">Назад кон сите училници</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/classrooms" className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </Link>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">{classroom.name}</h2>
          {userProfile?.role === 'teacher' && (
            <p className="text-sm font-mono text-indigo-600 dark:text-indigo-400 mt-1">
              Код за покана: <span className="font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">{classroom.inviteCode}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'telemetry' 
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          Cognitive Matrix
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'assignments' 
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          Задачи и Тестови
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'canvas' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
          Интерактивна Табла (Мултиплеер)
        </button>
        {userProfile?.role === 'teacher' && (
          <button
            onClick={() => setActiveTab('live')}
            className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'live' 
                ? 'border-red-600 text-red-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Activity className="w-4 h-4 animate-pulse text-red-500" />
            Монитор во Живо
          </button>
        )}
      </div>

      {activeTab === 'canvas' ? (
        <div className="h-[600px] w-full">
          <LiveCanvas classroomId={id!} />
        </div>
      ) : activeTab === 'live' ? (
        <LiveClassroomMonitor />
      ) : activeTab === 'telemetry' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl flex items-center justify-between">
              <div>
                 <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                   <BrainCircuit className="w-6 h-6" /> Cognitive Class Telemetry
                 </h2>
                 <p className="text-indigo-200">
                   Анализа на размислувањето и развојот на интелигенцијата на класот низ Блумовата Таксономија и DOK (Depth of Knowledge) нивоата.
                 </p>
              </div>
              <div className="hidden md:flex gap-4">
                 <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center min-w-[120px]">
                    <div className="text-3xl font-black">74%</div>
                    <div className="text-xs uppercase tracking-widest text-indigo-200 mt-1">Class Health</div>
                 </div>
                 <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center min-w-[120px]">
                    <div className="text-3xl font-black">1.8</div>
                    <div className="text-xs uppercase tracking-widest text-indigo-200 mt-1">Avg DOK</div>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* DoK Progress */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl"></div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 relative z-10 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Depth of Knowledge (DOK) Развој
                </h3>
                <div className="space-y-6 relative z-10">
                   {[
                     { level: 1, label: 'Меморија и Репродукција', match: 90, color: 'bg-emerald-500' },
                     { level: 2, label: 'Вештини и Концепти', match: 65, color: 'bg-blue-500' },
                     { level: 3, label: 'Стратешко размислување', match: 30, color: 'bg-amber-500' },
                     { level: 4, label: 'Проширено размислување', match: 12, color: 'bg-red-500' },
                   ].map(item => (
                     <div key={item.level}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Level {item.level}: {item.label}</span>
                          <span className="font-black text-slate-900 dark:text-white">{item.match}%</span>
                        </div>
                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                           <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.match}%` }}></div>
                        </div>
                     </div>
                   ))}
                </div>
                <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    Класот одлично ги меморира правилата (DOK 1), но има огромен пад при стратешко логичко размислување (DOK 3). Апликацијата препорачува да генерирате задачи од DOK 2 и DOK 3 ниво.
                  </p>
                </div>
              </div>

              {/* Comparative Analytics: Live vs Deep Work */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-1 lg:col-span-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                     <BrainCircuit className="w-5 h-5 text-indigo-500" /> 
                     Компаративна Анализа на Изведба
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-slate-500 px-3 py-1 rounded-full">Тренд</span>
                </h3>
                <p className="text-sm text-slate-500 mb-6">Споредба помеѓу брзината/конкурентноста (Live MathKahoot) наспроти длабоко размислување (Домашни Задачи) во последните 5 сесии.</p>
                
                <div className="h-72 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        { date: '10 Апр', kahoot: 82, assignment: 78 },
                        { date: '12 Апр', kahoot: 88, assignment: 80 },
                        { date: '14 Апр', kahoot: 76, assignment: 88 },
                        { date: '16 Апр', kahoot: 90, assignment: 86 },
                        { date: 'Тековно', kahoot: 95, assignment: 92 },
                      ]}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.2} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                      <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickFormatter={(val) => `${val}%`}/>
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }}/>
                      <Line 
                        type="monotone" 
                        name="🚀 Live MathKahoot (Брзина & Конкурентност)" 
                        dataKey="kahoot" 
                        stroke="#8b5cf6" 
                        strokeWidth={4}
                        activeDot={{ r: 8 }} 
                      />
                      <Line 
                        type="monotone" 
                        name="📚 Домашни & Тестови (Длабока Анализа)" 
                        dataKey="assignment" 
                        stroke="#10b981" 
                        strokeWidth={4} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bloom Matrix */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-purple-500" />
                  Блумова Когнитивна Матрица
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Дистрибуција на когнитивен капацитет според активните невролошки центри при решавање.</p>
                
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                      { bloom: 'Remember', value: 95, fullMark: 100 },
                      { bloom: 'Understand', value: 80, fullMark: 100 },
                      { bloom: 'Apply', value: 65, fullMark: 100 },
                      { bloom: 'Analyze', value: 40, fullMark: 100 },
                      { bloom: 'Evaluate', value: 25, fullMark: 100 },
                      { bloom: 'Create', value: 10, fullMark: 100 },
                    ]}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="bloom" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                      <Radar
                        name="Усвоеност"
                        dataKey="value"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              Задачи и Тестови
            </h3>
            {userProfile?.role === 'teacher' && (
              <Button onClick={openAssignModal} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Нова Задача
              </Button>
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
              <p className="text-slate-500 dark:text-slate-400">Нема доделени задачи во оваа училница.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map(assignment => (
                <div key={assignment.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-lg">{assignment.title}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Рок: {new Date(assignment.dueDate).toLocaleDateString('mk-MK')}</span>
                      <span>{assignment.taskIds.length} прашања</span>
                    </div>
                  </div>
                  <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30">
                    {userProfile?.role === 'teacher' ? 'Прегледај резултати' : 'Реши'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Ученици ({classroom.studentIds.length})
          </h3>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {userProfile?.role === 'teacher' ? (
              students.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  Сеуште нема ученици во оваа училница. Споделете го кодот <b>{classroom.inviteCode}</b>.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[300px] overflow-y-auto">
                  {students.map(student => (
                    <li key={student.uid} className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                        {student.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white text-sm">{student.displayName}</div>
                        <div className="text-xs text-slate-500">{student.email}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">
                Вие сте член на оваа училница.
              </div>
            )}
          </div>

          {userProfile?.role === 'teacher' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-6 mt-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-indigo-600" />
                Мастерство на Класот
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={classMasteryData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Radar
                      name="Мастерство"
                      dataKey="A"
                      stroke="#4f46e5"
                      fill="#4f46e5"
                      fillOpacity={0.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
                Класот е најслаб во <strong>Анализа</strong>. Препорачано е да доделите повеќе задачи од оваа област.
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Assign Task Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Додели Нова Задача
              </h2>
              <button 
                onClick={() => setIsAssignModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Наслов на задачата</label>
                  <input 
                    type="text" 
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Пр. Тест по Алгебра 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Рок за решавање</label>
                  <input 
                    type="date" 
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Изберете задачи од библиотеката ({selectedTaskIds.size} избрани)</label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {libraryTasks.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Нема задачи во библиотеката.</p>
                  ) : (
                    libraryTasks.map(task => (
                      <div 
                        key={task.id}
                        onClick={() => task.id && toggleTaskSelection(task.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-colors flex gap-3 ${
                          task.id && selectedTaskIds.has(task.id) 
                            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' 
                            : 'bg-white border-slate-200 hover:border-indigo-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-indigo-700'
                        }`}
                      >
                        <div className="pt-0.5">
                          {task.id && selectedTaskIds.has(task.id) ? (
                            <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-slate-900 dark:text-white">{task.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">{task.original_text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                Откажи
              </Button>
              <Button 
                onClick={handleCreateAssignment} 
                disabled={!assignmentTitle || !dueDate || selectedTaskIds.size === 0 || isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Додели Задача
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
