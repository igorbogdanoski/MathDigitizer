import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { GradedSubmission } from '../lib/schema';
import {
  AlertTriangle,
  Activity, TrendingUp,
  TrendingDown, Microscope, Network
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { generateInterventionPlan } from '../lib/gemini';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  ClassLeaderboardChart,
  StudentMasterySidebar,
  ZPDCalculatorPanel,
  InterventionRadarPanel,
  LongitudinalChart,
  KnowledgeGapsGrid,
  InterventionPlanModal,
  MathStrand,
  StudentStats,
  ClassStats,
  AdvancedStudentStats,
  ProficiencyDataPoint,
  LongitudinalDataPoint,
  WeaknessEntry
} from './analytics';

// Advanced Math Pedagogy Strands (Kilpatrick et al., "Adding It Up")
const MATH_STRAND_IDS = ['conceptual', 'procedural', 'strategic', 'adaptive', 'productive'] as const;
const MATH_STRAND_COLORS: Record<string, string> = {
  conceptual: '#8b5cf6',
  procedural: '#0ea5e9',
  strategic: '#10b981',
  adaptive: '#f59e0b',
  productive: '#ec4899',
};

export const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation('analytics');
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
  const studentStats = useMemo<StudentStats[]>(() => {
    const map = new Map<string, StudentStats>();

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

  const classStats = useMemo<ClassStats>(() => {
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

  const activeStudentAdvancedStats = useMemo<AdvancedStudentStats | null>(() => {
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
    const primaryDeficitName = t(`strands.${primaryDeficitId}Full`, { defaultValue: t('strands.conceptualFull') });

    // Estimating Cognitive Load based on lowest score variance
    let variance = 0;
    if (subs.length > 1) {
       variance = subs.reduce((acc, s) => acc + Math.pow(s.score - activeStudentData.averageScore, 2), 0) / subs.length;
    }

    const loadState = variance > 400 ? t('loadStates.optimal') : (activeStudentData.averageScore > 85 ? t('loadStates.underestimated') : t('loadStates.overloaded'));

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
      showToast(t('interventionError'), 'error');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const proficiencyData = useMemo<ProficiencyDataPoint[]>(() => {
    if (!activeStudentAdvancedStats) return [];
    return [
      { subject: t('strands.conceptual'), A: activeStudentAdvancedStats.conceptAvg, fullMark: 100 },
      { subject: t('strands.procedural'), A: activeStudentAdvancedStats.procAvg, fullMark: 100 },
      { subject: t('strands.strategic'), A: activeStudentAdvancedStats.strategic, fullMark: 100 },
      { subject: t('strands.adaptive'), A: activeStudentAdvancedStats.adaptive, fullMark: 100 },
      { subject: t('strands.productive'), A: activeStudentAdvancedStats.disposition, fullMark: 100 }
    ];
  }, [activeStudentAdvancedStats, t]);

  const longitudinalData = useMemo<LongitudinalDataPoint[]>(() => {
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
    if (zpdVel < -10 || zpdAvg < 40) return t('zpdSteps.step1');
    if (zpdVel < 5) return t('zpdSteps.step2');
    if (zpdVel < 15) return t('zpdSteps.step3');
    return t('zpdSteps.step4');
  }, [zpdAvg, zpdVel, t]);

  const sortedWeaknesses = useMemo<WeaknessEntry[]>(() => {
    if (!activeStudentData) return [];
    return Object.entries(activeStudentData.weaknesses)
      .sort((a, b) => b[1] - a[1])
      .map(([concept, count]) => ({ concept, count }));
  }, [activeStudentData]);

  if (!isPro) {
    return (
      <ProFeatureGate
        featureName={t('proGate.featureName')}
        description={t('proGate.description')}
      />
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center flex items-center justify-center h-96 text-slate-500 font-mono text-sm uppercase tracking-widest animate-pulse">{t('loading')}</div>;
  }

  if (submissions.length === 0) {
    return (
      <div className="p-12 text-center max-w-2xl mx-auto mt-20">
        <div className="w-24 h-24 bg-slate-900 rounded-5xl flex items-center justify-center mx-auto mb-8 shadow-2xl border border-slate-800">
          <Activity className="w-10 h-10 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{t('noData.title')}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          {t('noData.description')}
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
            {t('header.badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-tight md:leading-tight">
            {t('header.title')}
          </h1>
          <p className="text-slate-400 text-base md:text-lg leading-relaxed max-w-xl font-light">
            {t('header.description')}
          </p>
        </div>

        <div className="relative z-10 hidden lg:flex items-center gap-6 p-6 bg-slate-900/50 rounded-5xl border border-slate-800 backdrop-blur-xl shadow-xl">
           <div className="text-center px-4 border-r border-slate-800">
             <div className="text-5xl font-black text-indigo-400 font-mono tracking-tighter">{studentStats.length}</div>
             <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 font-bold">{t('header.trackedSubjects')}</div>
           </div>
           <div className="text-center px-4">
             <div className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">{classStats.average}<span className="text-2xl">%</span></div>
             <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 font-bold">{t('header.globalIndex')}</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Global Class Leaderboard Graph */}
        <ClassLeaderboardChart data={studentStats} isDark={isDark} />

        {/* Sidebar: Student Mastery List */}
        <StudentMasterySidebar students={studentStats} activeStudent={selectedStudent} onSelect={setSelectedStudent} />

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
                    <h4 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{t('momentum.title')}</h4>
                    <div className="text-5xl font-black text-slate-800 dark:text-white flex items-baseline gap-1 font-mono tracking-tighter">
                      {activeStudentAdvancedStats && activeStudentAdvancedStats.velocity > 0 ? '+' : ''}{activeStudentAdvancedStats?.velocity || 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-4 bg-slate-50 dark:bg-white/5 inline-flex px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/10">{t('momentum.deltaFromStart')}</p>
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
                       {t('metacognitive.title')}
                     </h4>
                     <div className="text-2xl font-black text-white mt-1 leading-tight tracking-tight">
                       {activeStudentAdvancedStats?.isStruggling ? t('metacognitive.criticalAlarm') : t('metacognitive.optimalAssimilation')}
                     </div>
                     <p className={`text-[11px] font-bold mt-5 inline-flex items-center px-3 py-1.5 rounded-lg border ${activeStudentAdvancedStats?.loadState.includes(t('loadStates.optimal')) ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                        {activeStudentAdvancedStats?.loadState}
                     </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Interactive ZPD Calculator */}
            <ZPDCalculatorPanel
              zpdAvg={zpdAvg}
              zpdVel={zpdVel}
              setZpdAvg={setZpdAvg}
              setZpdVel={setZpdVel}
              calculatedZPD={calculatedZPD}
              zpdNextSteps={zpdNextSteps}
              onReset={() => { setZpdAvg(activeStudentData?.averageScore || 50); setZpdVel(activeStudentAdvancedStats?.velocity || 0); }}
            />

            {/* Pedagogue Architect Control */}
            <InterventionRadarPanel
              proficiencyData={proficiencyData}
              primaryDeficit={activeStudentAdvancedStats?.primaryDeficit}
              isGeneratingPlan={isGeneratingPlan}
              onGenerate={handleGenerateIntervention}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Longitudinal Concept vs Procedure */}
              <LongitudinalChart data={longitudinalData} isDark={isDark} />

              {/* Specific Knowledge Gaps Top 5 */}
              <KnowledgeGapsGrid weaknesses={sortedWeaknesses} />

            </div>
          </div>
        )}
      </div>

      {/* Socratic Intervention Modals */}
      <InterventionPlanModal
        plan={interventionPlan}
        isOpen={!!interventionPlan}
        onClose={() => setInterventionPlan(null)}
        studentId={activeStudentData?.id}
        modalRef={interventionModalRef}
      />

    </div>
  );
};
