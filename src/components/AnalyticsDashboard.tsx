import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { GradedSubmission } from '../lib/schema';
import { 
  Brain, TrendingUp, AlertTriangle, 
  Activity, User, CheckCircle2, Calculator,
  TrendingDown, Users, Target, Focus, BrainCircuit,
  Compass, Zap, Layers, Microscope, Network
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  BarChart, Bar, AreaChart, Area, ComposedChart
} from 'recharts';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { generateInterventionPlan } from '../lib/gemini';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';
import { useModalA11y } from '../hooks/useModalA11y';

// Advanced Math Pedagogy Strands (Kilpatrick et al., "Adding It Up")
const MATH_STRANDS = [
  { id: 'conceptual', name: 'Концептуално', full: 'Концептуално Разбирање', color: '#8b5cf6' },
  { id: 'procedural', name: 'Процедурално', full: 'Процедурална Флуентност', color: '#0ea5e9' },
  { id: 'strategic', name: 'Стратешко', full: 'Стратешка Компетентност', color: '#10b981' },
  { id: 'adaptive', name: 'Адаптивно', full: 'Адаптивно Расудување', color: '#f59e0b' },
  { id: 'productive', name: 'Диспозиција', full: 'Продуктивна Диспозиција', color: '#ec4899' },
];

export const AnalyticsDashboard: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<GradedSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Dark mode detection: theme is toggled via a `dark` class on <html> (see Layout.tsx),
  // not just OS preference, so we track it with a MutationObserver.
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Intervention Plan
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [interventionPlan, setInterventionPlan] = useState<string | null>(null);
  const isPro = hasProAccess(userProfile);
  const interventionModalRef = useModalA11y<HTMLDivElement>(() => setInterventionPlan(null), !!interventionPlan);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'graded_submissions'),
          where('teacher_uid', '==', user.uid),
          orderBy('created_at', 'asc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GradedSubmission));
        setSubmissions(data);
      } catch (error) {
        console.error("Error fetching submissions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubmissions();
  }, [user]);

  // Aggregate stats per student
  const studentStats = useMemo(() => {
    const map = new Map<string, {
      id: string;
      submissions: GradedSubmission[];
      averageScore: number;
      weaknesses: Record<string, number>;
    }>();

    submissions.forEach(sub => {
      const studentId = sub.student_identifier;
      if (!map.has(studentId)) {
        map.set(studentId, { id: studentId, submissions: [], averageScore: 0, weaknesses: {} });
      }
      
      const st = map.get(studentId)!;
      st.submissions.push(sub);
      
      sub.identified_weaknesses.forEach(w => {
        st.weaknesses[w] = (st.weaknesses[w] || 0) + 1;
      });
    });

    Array.from(map.values()).forEach(st => {
      const totalScore = st.submissions.reduce((acc, s) => acc + s.score, 0);
      st.averageScore = Math.round(totalScore / st.submissions.length);
      st.submissions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.averageScore === a.averageScore) {
        return b.submissions.length - a.submissions.length;
      }
      return b.averageScore - a.averageScore;
    });
  }, [submissions]);

  const classStats = useMemo(() => {
    if (submissions.length === 0) return { average: 0 };
    const total = submissions.reduce((acc, sub) => acc + sub.score, 0);
    return {
      average: Math.round(total / submissions.length)
    };
  }, [submissions]);

  // If no student is selected, select the first one by default
  useEffect(() => {
    if (studentStats.length > 0 && !selectedStudent) {
      setSelectedStudent(studentStats[0].id);
    }
  }, [studentStats, selectedStudent]);

  const activeStudentData = useMemo(() => {
    return studentStats.find(s => s.id === selectedStudent);
  }, [selectedStudent, studentStats]);

  const activeStudentAdvancedStats = useMemo(() => {
    if (!activeStudentData || activeStudentData.submissions.length === 0) return null;
    
    const subs = activeStudentData.submissions;
    
    // 1. Velocity (Momentum)
    let velocity = 0;
    if (subs.length >= 2) {
      const half = Math.floor(subs.length / 2);
      const firstHalf = subs.slice(0, half);
      const secondHalf = subs.slice(half);
      const firstAvg = firstHalf.reduce((acc, s) => acc + s.score, 0) / firstHalf.length || 0;
      const secondAvg = secondHalf.reduce((acc, s) => acc + s.score, 0) / secondHalf.length || 0;
      velocity = Math.round(secondAvg - firstAvg);
    } else if (subs.length === 1) {
      velocity = subs[0].score - classStats.average;
    }

    const lastTwoSubs = subs.slice(-2);
    const isStruggling = lastTwoSubs.length >= 2 && lastTwoSubs.every(s => s.score < 55) || (velocity <= -15);

    // Simulated 5-Strands based on available data 
    let conceptAvg = 0;
    let procAvg = 0;
    
    subs.forEach(s => {
      if (s.rubric_breakdown) {
        conceptAvg += s.rubric_breakdown.concept.score;
        procAvg += s.rubric_breakdown.execution.score;
      } else {
        conceptAvg += s.score;
        procAvg += s.score;
      }
    });

    conceptAvg = Math.round(conceptAvg / subs.length);
    procAvg = Math.round(procAvg / subs.length);
    
    // Extrapolate other strands for deep pedagogical modeling (using ZPD theories)
    const strategic = Math.round(Math.min(100, Math.max(0, (conceptAvg * 0.6) + (procAvg * 0.4) + (velocity > 0 ? 10 : -5))));
    const adaptive = Math.round(Math.min(100, Math.max(0, conceptAvg + (velocity * 1.5))));
    const disposition = Math.round(Math.min(100, Math.max(0, subs[subs.length-1].score + (subs.length * 2))));

    // Determine primary deficit
    const strands = [
      { id: 'conceptual', val: conceptAvg },
      { id: 'procedural', val: procAvg },
      { id: 'strategic', val: strategic },
      { id: 'adaptive', val: adaptive }
    ].sort((a,b) => a.val - b.val);

    const primaryDeficitId = strands[0].id;
    const primaryDeficitName = MATH_STRANDS.find(s => s.id === primaryDeficitId)?.full || 'Концептуално Разбирање';

    // Estimating Cognitive Load based on lowest score variance
    let variance = 0;
    if (subs.length > 1) {
       variance = subs.reduce((acc, s) => acc + Math.pow(s.score - activeStudentData.averageScore, 2), 0) / subs.length;
    }
    
    const loadState = variance > 400 ? 'Оптимално оптоварување (ZPD)' : (activeStudentData.averageScore > 85 ? 'Когнитивно Потценет' : 'Когнитивно Преоптоварување');

    return { 
      velocity, 
      isStruggling, 
      conceptAvg,
      procAvg,
      strategic,
      adaptive,
      disposition,
      primaryDeficit: primaryDeficitName,
      loadState,
      zpdValue: Math.min(100, Math.round(activeStudentData.averageScore + (100 - activeStudentData.averageScore) * 0.3)) // Zone of proximal development target (dynamic)
    };
  }, [activeStudentData, classStats]);

  const handleGenerateIntervention = async () => {
    if (!activeStudentData || !activeStudentAdvancedStats) return;
    
    setIsGeneratingPlan(true);
    setInterventionPlan(null);
    try {
      const sortedWeaknessesForPrompt = sortedWeaknesses.map(w => w.concept);
      const prompt = `Врз основа на следните податоци за ученикот:
- Име/ИД: ${activeStudentData.id}
- Генерален Просек: ${activeStudentData.averageScore}%
- Моментум (Velocity): ${activeStudentAdvancedStats.velocity}
- Главен когнитивен дефицит (Adding It Up): ${activeStudentAdvancedStats.primaryDeficit}
- Когнитивно оптоварување: ${activeStudentAdvancedStats.loadState}
- Најчести дупки: ${sortedWeaknessesForPrompt.join(', ')}

Генерирај персонализиран Сократов (Socratic) педагошки план за математичка интервенција. 
Користи висок академски стил на македонски јазик.
1. Когнитивна Дијагноза (Фокус на Zone of Proximal Development - ZPD).
2. Специфични прилагодени педагошки практики за да се премостат наведените грешки.
3. Листа на Сократови прашања кои наставникот треба да ги постави за да го подобри разбирањето на ученикот.
4. 2 Специфични задачи насочени кон ZPD (со латекс \`$inline$\` и \`$$display$$\`).
ВРАТИ САМО МАРКДАУН, БЕЗ ВОВЕД.`;

      const text = await generateInterventionPlan(prompt);
      setInterventionPlan(text);
    } catch (e) {
      console.error(e);
      showToast("Грешка при генерирање интервенција.", 'error');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const proficiencyData = useMemo(() => {
    if (!activeStudentAdvancedStats) return [];
    return [
      { subject: 'Концептуално', A: activeStudentAdvancedStats.conceptAvg, fullMark: 100 },
      { subject: 'Процедурално', A: activeStudentAdvancedStats.procAvg, fullMark: 100 },
      { subject: 'Стратешко', A: activeStudentAdvancedStats.strategic, fullMark: 100 },
      { subject: 'Адаптивно', A: activeStudentAdvancedStats.adaptive, fullMark: 100 },
      { subject: 'Диспозиција', A: activeStudentAdvancedStats.disposition, fullMark: 100 }
    ];
  }, [activeStudentAdvancedStats]);

  const longitudinalData = useMemo(() => {
    if (!activeStudentData) return [];
    let prevScore = activeStudentData.submissions[0]?.score || 0;
    return activeStudentData.submissions.map((sub, index) => {
      const vel = index === 0 ? 0 : sub.score - prevScore;
      prevScore = sub.score;
      return {
        name: 'Eval ' + (index + 1),
        score: sub.score,
        concept: sub.rubric_breakdown?.concept.score || sub.score,
        execution: sub.rubric_breakdown?.execution.score || sub.score,
        velocity: vel,
        date: new Date(sub.created_at).toLocaleDateString('mk-MK')
      };
    });
  }, [activeStudentData]);

  // Interactive ZPD Calculator State
  const [zpdAvg, setZpdAvg] = useState(50);
  const [zpdVel, setZpdVel] = useState(0);

  useEffect(() => {
    if (activeStudentData && activeStudentAdvancedStats) {
      setZpdAvg(activeStudentData.averageScore);
      setZpdVel(activeStudentAdvancedStats.velocity);
    }
  }, [activeStudentData, activeStudentAdvancedStats]);

  const calculatedZPD = useMemo(() => {
    return Math.min(100, Math.round(zpdAvg + (100 - zpdAvg) * 0.3) + (zpdVel > 0 ? Math.min(10, zpdVel) : 0));
  }, [zpdAvg, zpdVel]);

  const zpdNextSteps = useMemo(() => {
    if (zpdVel < -10 || zpdAvg < 40) return "Враќање на основни концепти. Фокус на утврдување претходно знаење преку дијагностички задачи.";
    if (zpdVel < 5) return "Консолидација со задачи од ист тип (Scaffolding). Дозирајте помош додека самостојноста не се зголеми.";
    if (zpdVel < 15) return "Внесување на нов концепт (Слаба зона на проксимален развој). Охрабрете премин кон апстрактно решавање.";
    return "Напредно проширување! Задачите нека вклучуваат реални сценарија, високо критичко мислење и самостојна евалуација.";
  }, [zpdAvg, zpdVel]);

  const sortedWeaknesses = useMemo(() => {
    if (!activeStudentData) return [];
    return Object.entries(activeStudentData.weaknesses)
      .sort((a, b) => b[1] - a[1])
      .map(([concept, count]) => ({ concept, count }));
  }, [activeStudentData]);

  if (!isPro) {
    return (
      <ProFeatureGate
        featureName="Advanced Analytics"
        description="Оваа аналитика е дел од Pro планот. Отклучете ја за подлабоки педагошки сигнали, когнитивни индикатори и интервенциски планови."
      />
    );
  }

  const getSeriesDotClass = (seriesName?: string) => {
    if (seriesName === 'Просек') return 'bg-indigo-500';
    if (seriesName === 'Евалуации') return 'bg-emerald-500';
    return 'bg-slate-400';
  };

  const getSeriesTextClass = (seriesName?: string) => {
    if (seriesName === 'Просек') return 'text-indigo-600 dark:text-indigo-400';
    if (seriesName === 'Евалуации') return 'text-emerald-600 dark:text-emerald-400';
    return 'text-slate-600 dark:text-slate-300';
  };

  if (isLoading) {
    return <div className="p-8 text-center flex items-center justify-center h-96 text-slate-500 font-mono text-sm uppercase tracking-widest animate-pulse">Анализа на когнитивниот простор...</div>;
  }

  if (submissions.length === 0) {
    return (
      <div className="p-12 text-center max-w-2xl mx-auto mt-20">
        <div className="w-24 h-24 bg-slate-900 rounded-5xl flex items-center justify-center mx-auto mb-8 shadow-2xl border border-slate-800">
          <Activity className="w-10 h-10 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Отсуство на емпириски податоци</h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          Центарот за математичка педагогија изискува првично уфрлање на евалуации преку <span className="font-bold text-indigo-600 dark:text-indigo-400">Smart Grader</span> модулот за да конструира когнитив профили на учениците.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      {/* Header Panel */}
      <div className="bg-slate-950 text-white rounded-5xl p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-800 shadow-2xl">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono uppercase tracking-[0.2em] mb-6 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Microscope className="w-4 h-4 text-indigo-400" />
            Педагошка Лабораторија (Mastery Layer)
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight md:leading-tight">
            Когнитивна Анализа & ZPD
          </h1>
          <p className="text-slate-400 text-base md:text-lg leading-relaxed max-w-xl font-light">
            Теоретски поткрепена математичка дијагностика базирана на експертската рамка <span className="italic text-slate-300">"Adding It Up"</span> на National Research Council.
          </p>
        </div>
        
        <div className="relative z-10 hidden lg:flex items-center gap-6 p-6 bg-slate-900/50 rounded-5xl border border-slate-800 backdrop-blur-xl shadow-xl">
           <div className="text-center px-4 border-r border-slate-800">
             <div className="text-5xl font-black text-indigo-400 font-mono tracking-tighter">{studentStats.length}</div>
             <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 font-bold">Следени Субјекти</div>
           </div>
           <div className="text-center px-4">
             <div className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">{classStats.average}<span className="text-2xl">%</span></div>
             <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 font-bold">Глобален Индекс</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Global Class Leaderboard Graph */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-5xl overflow-hidden shadow-sm p-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <Target className="w-7 h-7 text-rose-500" /> 
                Аналитичка Лидерска Табла
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
                Глобален ранкинг според Концептуална Совладливост (Просечен Резултат) и Моментум
              </p>
            </div>
            <div className="flex gap-2">
               <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 block"></span>
                  Просек (0-100)
               </span>
               <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 block"></span>
                  Вкупни Евалуации
               </span>
            </div>
          </div>
          
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentStats} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="id" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 800 }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 800 }} domain={[0, 100]} dx={-10} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#10b981', fontWeight: 800 }} dx={10} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-4 rounded-2xl shadow-xl">
                           <div className="font-black text-lg text-slate-800 dark:text-white mb-2">{label}</div>
                           <div className="flex flex-col gap-2">
                             {payload.map((entry: any, index: number) => (
                               <div key={index} className="flex items-center gap-3">
                                 <span className={`w-3 h-3 rounded-full ${getSeriesDotClass(entry.name)}`}></span>
                                 <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{entry.name}:</span>
                                 <span className={`text-lg font-black ${getSeriesTextClass(entry.name)}`}>{entry.value}</span>
                               </div>
                             ))}
                           </div>
                           <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10 text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center justify-between">
                             <span>Cognitive ZPD Target:</span>
                             <span className="text-indigo-500 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
                               {payload[0] && payload[0].payload ? Math.min(100, Math.round(payload[0].payload.averageScore + (100 - payload[0].payload.averageScore) * 0.3)) : 0}
                             </span>
                           </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="averageScore" name="Просек" fill="url(#colorScore)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                <Line yAxisId="right" type="monotone" dataKey={(d) => d.submissions.length} name="Евалуации" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar: Student Mastery List */}
        <div className="xl:col-span-1 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-5xl overflow-hidden shadow-sm flex flex-col xl:h-[800px] xl:sticky xl:top-6">
          <div className="p-6 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex flex-col gap-2 shrink-0">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Когнитивни Профили
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Селектирајте субјект за длабинска анализа</p>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-3 custom-scrollbar">
            {studentStats.map((student) => {
              const isSelected = selectedStudent === student.id;
              return (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all duration-300 ${
                    isSelected
                      ? 'bg-slate-900 shadow-xl shadow-slate-900/20 ring-1 ring-slate-800 scale-[1.02]'
                      : 'hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className={`font-bold transition-colors text-base ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                      {student.id}
                    </div>
                    <div className={`text-[10px] uppercase font-bold mt-1.5 tracking-wider ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                      Евалуации: {student.submissions.length}
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-sm ${
                    isSelected
                      ? 'bg-slate-800 border border-slate-700 text-white'
                      : student.averageScore >= 80 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20' :
                        student.averageScore >= 50 ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-500/20' :
                        'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-500/20'
                  }`}>
                    {student.averageScore}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content: Deep Autopsy */}
        {activeStudentData && (
          <div className="xl:col-span-3 space-y-6">
            
            {/* Vitals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Momentum Card */}
              <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${activeStudentAdvancedStats?.velocity && activeStudentAdvancedStats.velocity >= 0 ? 'bg-emerald-50 text-emerald-500 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20'}`}>
                      {activeStudentAdvancedStats?.velocity && activeStudentAdvancedStats.velocity >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Когнитивен Моментум</h4>
                    <div className="text-5xl font-black text-slate-800 dark:text-white flex items-baseline gap-1 font-mono tracking-tighter">
                      {activeStudentAdvancedStats && activeStudentAdvancedStats.velocity > 0 ? '+' : ''}{activeStudentAdvancedStats?.velocity || 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-4 bg-slate-50 dark:bg-white/5 inline-flex px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/10">Делта од почетна точка</p>
                  </div>
                </CardContent>
              </Card>

              {/* Metacognitive Status Card */}
              <Card className={`border shadow-sm rounded-5xl transition-colors relative overflow-hidden ${activeStudentAdvancedStats?.isStruggling ? 'bg-rose-950 border-rose-900' : 'bg-slate-900 border-slate-800'}`}>
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <AlertTriangle className="w-48 h-48" />
                </div>
                <CardContent className="p-8 relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${activeStudentAdvancedStats?.isStruggling ? 'bg-rose-900 text-rose-400 border-rose-800' : 'bg-slate-800 text-indigo-400 border-slate-700'}`}>
                      <Network className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                     <h4 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${activeStudentAdvancedStats?.isStruggling ? 'text-rose-400' : 'text-slate-400'}`}>
                       Метакогнитивен Статус
                     </h4>
                     <div className="text-2xl font-black text-white mt-1 leading-tight tracking-tight">
                       {activeStudentAdvancedStats?.isStruggling ? 'Критичен Аларм' : 'Оптимална Асимилација'}
                     </div>
                     <p className={`text-[11px] font-bold mt-5 inline-flex items-center px-3 py-1.5 rounded-lg border ${activeStudentAdvancedStats?.loadState.includes('Оптимално') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                        {activeStudentAdvancedStats?.loadState}
                     </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Interactive ZPD Calculator */}
            <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl overflow-hidden">
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div className="space-y-8 pr-0 md:pr-10 md:border-r border-slate-100 dark:border-white/10">
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-xl flex items-center gap-3">
                    <Calculator className="w-6 h-6 text-indigo-500" />
                    Интерактивен ZPD Калкулатор
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Тековен Просек ({zpdAvg}%)</label>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={zpdAvg} 
                        onChange={(e) => setZpdAvg(parseInt(e.target.value))}
                        title="Тековен просек"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-white/10 accent-indigo-600"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Напредок / Моментум ({zpdVel > 0 ? '+' : ''}{zpdVel})</label>
                      </div>
                      <input 
                        type="range" min="-50" max="50" value={zpdVel} 
                        onChange={(e) => setZpdVel(parseInt(e.target.value))}
                        title="Напредок и моментум"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-white/10 accent-emerald-500"
                      />
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-500/15 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                       <p className="text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                         Променете ги вредностите за да симулирате различни сценарија и да ги проверите препорачаните педагошки чекори за вашата наредна интервенција.
                       </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col h-full justify-center">
                  <h4 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Целен Капацитет (ZPD)</h4>
                  <div className="text-6xl font-black text-slate-800 dark:text-slate-100 flex items-baseline gap-2 tracking-tighter mb-6">
                    {calculatedZPD}<span className="text-3xl text-slate-300 dark:text-slate-500 font-medium">%</span>
                  </div>

                  <h4 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Предложени следни чекори</h4>
                  <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-5 border border-slate-100 dark:border-white/10 w-full mb-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-bold leading-relaxed space-y-2">
                       {zpdNextSteps}
                    </p>
                  </div>
                  <Button
                    onClick={() => { setZpdAvg(activeStudentData?.averageScore || 50); setZpdVel(activeStudentAdvancedStats?.velocity || 0); }}
                    variant="outline"
                    className="self-start text-xs rounded-xl h-8 px-4 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    Врати на реални податоци
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pedagogue Architect Control */}
            <div className="bg-indigo-600 rounded-5xl p-8 md:p-12 text-white grid grid-cols-1 md:grid-cols-2 gap-12 items-center shadow-xl shadow-indigo-600/20 relative overflow-hidden border border-indigo-500/50">
              <div className="absolute right-0 top-0 w-2/3 h-full bg-gradient-to-l from-indigo-500 to-transparent z-0 pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500 opacity-30 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] border border-white/20 mb-8 shadow-sm">
                  <BrainCircuit className="w-4 h-4" />
                  "Adding It Up" Дефицит
                </div>
                <h3 className="text-4xl md:text-5xl font-black mb-4 leading-tight tracking-tight">
                  <span className="text-indigo-200 block text-lg font-bold mb-2 uppercase tracking-widest">Примарен фокус:</span>
                  {activeStudentAdvancedStats?.primaryDeficit}
                </h3>
                <p className="text-indigo-100 text-sm leading-relaxed mb-10 max-w-sm font-medium">
                   Идентификуван е дефицит во рамката на математичка компетентност. 
                   Активирајте го <span className="text-white font-bold">Механизмот за Сократова Интервенција</span> за генерирање на прецизен ZPD план.
                </p>
                <Button 
                  onClick={handleGenerateIntervention}
                  disabled={isGeneratingPlan}
                  className="bg-white text-indigo-700 hover:bg-slate-50 border-none rounded-2xl font-black text-sm h-14 px-8 shadow-[0_0_20px_rgba(255,255,255,0.3)] w-full md:w-auto transition-transform hover:scale-105">
                  <Zap className={`w-5 h-5 mr-3 ${isGeneratingPlan ? 'animate-bounce text-amber-500' : 'text-indigo-600'}`} />
                  {isGeneratingPlan ? 'Генерирање Метакогнитивен План...' : 'Конструирај План за Интервенција'}
                </Button>
              </div>
              <div className="relative z-10 flex items-center justify-center">
                 <div className="w-full max-w-[320px] aspect-square relative bg-indigo-900/60 rounded-6xl border border-indigo-400/30 shadow-2xl backdrop-blur-xl p-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={proficiencyData}>
                        <PolarGrid stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#e0e7ff', fontWeight: 800 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Совладливост" dataKey="A" stroke="#fff" strokeWidth={3} fill="#818cf8" fillOpacity={0.65} />
                        <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Longitudinal Concept vs Procedure */}
              <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl col-span-1 md:col-span-2">
                <CardContent className="p-8 md:p-10">
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg mb-8 flex items-center gap-3 uppercase tracking-widest text-sm">
                    <TrendingUp className="w-6 h-6 text-indigo-500" /> 
                    Лонгитудинална Когнитивна Траекторија
                  </h3>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={longitudinalData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorConcept" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 }} dy={15} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 }} domain={[0, 100]} dx={-10} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#10b981', fontWeight: 700 }} domain={[-50, 50]} dx={10} />
                        <RechartsTooltip
                           contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: '16px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '16px' }}
                           itemStyle={{ fontWeight: 800, fontSize: '14px' }}
                           labelStyle={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px', fontSize: '13px', fontWeight: 700 }} />
                        <Area yAxisId="left" type="monotone" name="Концептуално Разбирање" dataKey="concept" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorConcept)" activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }} />
                        <Area yAxisId="left" type="monotone" name="Процедурална Флуентност" dataKey="execution" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorExec)" activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} />
                        <Line yAxisId="right" type="monotone" name="Моментум (Velocity)" dataKey="velocity" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 8 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Specific Knowledge Gaps Top 5 */}
              <Card className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-sm rounded-5xl md:col-span-2">
                <CardContent className="p-8 md:p-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-3 uppercase tracking-widest text-sm">
                      <Layers className="w-6 h-6 text-orange-500" />
                      Хронолошки Дупки во Знаењето
                    </h3>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10">Гранулирана Анализа на Грешки</span>
                  </div>
                  
                  {sortedWeaknesses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {sortedWeaknesses.slice(0,6).map((w, idx) => (
                        <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-400/40 hover:shadow-md transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 flex items-center justify-center font-black text-base group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/15 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 transition-colors">
                              0{idx + 1}
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-base">{w.concept}</span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-fit pl-4">
                            <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider ${w.count > 2 ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'}`}>
                              {w.count} инциденти
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 opacity-50" />
                      <p className="font-medium text-sm">Системот не детектира структурни грешки.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        )}
      </div>

      {/* Socratic Intervention Modals */}
      <AnimatePresence>
        {interventionPlan && (
          <div
            ref={interventionModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Сократов План за Интервенција"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          >
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
               onClick={() => setInterventionPlan(null)}
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-5xl bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-5xl shadow-2xl flex flex-col h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <div className="px-8 py-6 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-500/10 backdrop-blur-sm flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-3">
                    <Compass className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    Сократов План за Интервенција (ZPD)
                  </h3>
                  <div className="flex items-center gap-3 mt-3">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-sm">
                      Субјект: <span className="text-indigo-900 dark:text-indigo-100 border-b border-indigo-300 dark:border-indigo-700 ml-1">{activeStudentData?.id}</span>
                    </p>
                    <p className="text-[10px] font-mono text-white bg-indigo-600 px-2.5 py-1.5 rounded uppercase tracking-widest shadow-sm">
                      Дидактичка Скрипта
                    </p>
                  </div>
                </div>
                 <button onClick={() => setInterventionPlan(null)} aria-label="Затвори интервенциски план" title="Затвори" className="p-3 bg-white dark:bg-white/5 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-transparent text-slate-800 dark:text-slate-200 text-sm md:text-base markdown-body prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-indigo-950 dark:prose-headings:text-indigo-300 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-strong:text-indigo-900 dark:prose-strong:text-indigo-100 prose-ul:marker:text-indigo-500 dark:prose-ul:marker:text-indigo-400 prose-li:pl-2">
                 <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                   {interventionPlan}
                 </ReactMarkdown>
              </div>
              <div className="px-8 py-6 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex justify-between items-center shrink-0 rounded-b-5xl">
                 <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden md:block uppercase tracking-widest font-medium">
                   <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                   Методолошки Мотор (Gemini 3.1 Pro)
                 </div>
                 <div className="flex justify-end gap-4 w-full md:w-auto">
                   <Button onClick={() => setInterventionPlan(null)} variant="outline" className="rounded-xl font-bold px-6 h-12 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200 dark:border-white/15 dark:text-slate-200">Затвори план</Button>
                   <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-6 h-12 shadow-[0_4px_14px_rgba(79,70,229,0.39)] transition-transform hover:scale-105 active:scale-95">
                     Увези како .PDF
                   </Button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
