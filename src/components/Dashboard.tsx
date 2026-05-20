import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, Star, Zap, Target, Award, TrendingUp, Users, Loader2, ChevronRight, Medal, Brain, PieChart as PieChartIcon, CheckCircle2, Circle, Activity, Paintbrush, ScanLine, Library as LibraryIcon, Wand2, Layers, AlertTriangle, Info } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { db, auth } from '../lib/firebase';
import { addDoc, collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserStats, UserProfile } from '../lib/schema';
import { motion } from 'motion/react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { TeacherDashboard } from './TeacherDashboard';
import { AvatarShop } from './AvatarShop';

import { StudentSkillTree } from './StudentSkillTree';
import { Skeleton } from './ui/Skeleton';
import { SEO } from './SEO';
import { useToast } from '../contexts/ToastContext';
import { captureError } from '../lib/observability';

type ReceiptStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

interface DashboardProps {
  userProfile?: UserProfile | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ userProfile }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<(UserStats & { displayName?: string, photoURL?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvatarShopOpen, setIsAvatarShopOpen] = useState(false);
  const [latestApprovedReceiptAt, setLatestApprovedReceiptAt] = useState<string | null>(null);
  const [hasPendingReceipt, setHasPendingReceipt] = useState(false);
  const [hasReviewedReceipt, setHasReviewedReceipt] = useState(false);
  const [hasRejectedReceipt, setHasRejectedReceipt] = useState(false);
  const previousReceiptStatusesRef = useRef<Record<string, ReceiptStatus>>({});
  const hasInitializedReceiptFeedRef = useRef(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const statsRef = doc(db, 'user_stats', auth.currentUser.uid);
    
    // Listen to user stats
    const unsubscribeStats = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data() as UserStats);
      }
    });

    // Fetch leaderboard
    const fetchLeaderboard = async () => {
      try {
        const q = query(collection(db, 'user_stats'), orderBy('xp', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        const leaders = snapshot.docs.map(doc => doc.data() as UserStats);
        setLeaderboard(leaders as any);
      } catch (err) {
        captureError(err, { name: 'dashboard.fetch-leaderboard', path: '/dashboard' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    return () => unsubscribeStats();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const receiptQuery = query(
      collection(db, 'payment_receipts'),
      where('requester_uid', '==', auth.currentUser.uid)
    );

    const unsubscribeReceipts = onSnapshot(
      receiptQuery,
      (snapshot) => {
        let approvedAt: string | null = null;
        let pending = false;
        let reviewed = false;
        let rejected = false;
        const nextStatuses: Record<string, ReceiptStatus> = {};

        snapshot.docs.forEach((receiptDoc) => {
          const receipt = receiptDoc.data() as {
            status?: string;
            reviewed_at?: string;
            created_at?: string;
          };
          const status = (receipt.status ?? 'pending') as ReceiptStatus;
          nextStatuses[receiptDoc.id] = status;

          if (hasInitializedReceiptFeedRef.current) {
            const previousStatus = previousReceiptStatusesRef.current[receiptDoc.id];
            if (status === 'approved' && previousStatus !== 'approved') {
              showToast('Вашата уплата е одобрена. Pro пристапот е активиран.', 'success');
            }
          }

          if (status === 'pending') {
            pending = true;
          }

          if (status === 'reviewed') {
            reviewed = true;
          }

          if (status === 'rejected') {
            rejected = true;
          }

          if (status === 'approved') {
            const candidate = receipt.reviewed_at ?? receipt.created_at ?? null;
            if (!candidate) return;

            if (!approvedAt || Date.parse(candidate) > Date.parse(approvedAt)) {
              approvedAt = candidate;
            }
          }
        });

        previousReceiptStatusesRef.current = nextStatuses;
        hasInitializedReceiptFeedRef.current = true;
        setLatestApprovedReceiptAt(approvedAt);
        setHasPendingReceipt(pending);
        setHasReviewedReceipt(reviewed);
        setHasRejectedReceipt(rejected);
      },
      (error) => {
        captureError(error, { name: 'dashboard.receipt-status', path: '/dashboard' });
      }
    );

    return () => unsubscribeReceipts();
  }, [showToast]);

  const formatReceiptTimestamp = (iso?: string | null) => {
    if (!iso) return null;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;

    return parsed.toLocaleString('mk-MK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLevelProgress = () => {
    if (!stats) return 0;
    const xpForNextLevel = stats.level * 1000;
    const xpInCurrentLevel = stats.xp % 1000;
    return (xpInCurrentLevel / 1000) * 100;
  };

  const masteryData = [
    { subject: 'Алгебра', A: 85, fullMark: 100 },
    { subject: 'Геометрија', A: 65, fullMark: 100 },
    { subject: 'Тригонометрија', A: 45, fullMark: 100 },
    { subject: 'Статистика', A: 70, fullMark: 100 },
    { subject: 'Логика', A: 90, fullMark: 100 },
    { subject: 'Анализа', A: 55, fullMark: 100 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="w-full h-32 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="w-full h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Render Teacher Dashboard if the user is a teacher
  if (userProfile?.role === 'teacher') {
    return <TeacherDashboard userProfile={userProfile} />;
  }

  if (userProfile?.role === 'student') {
    return <Navigate to="/student-dashboard" replace />;
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Грешка при вчитување на статистиките</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
          Вашите телеметриски податоци не може да се пронајдат. Обидете се да ја освежите страницата или да решите задача за да активирате запис.
        </p>
        <Button onClick={() => window.location.reload()}>
          Освежи Страница
        </Button>
      </div>
    );
  }

  const billingHealthBadge = useMemo(() => {
    if (latestApprovedReceiptAt) {
      return {
        label: 'Billing: Pro active',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
      };
    }

    if (hasPendingReceipt) {
      return {
        label: 'Billing: Pending review',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      };
    }

    if (hasReviewedReceipt) {
      return {
        label: 'Billing: In review stage',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
      };
    }

    if (hasRejectedReceipt) {
      return {
        label: 'Billing: Needs action',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
      };
    }

    return {
      label: 'Billing: No receipt submitted',
      className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    };
  }, [hasPendingReceipt, hasRejectedReceipt, hasReviewedReceipt, latestApprovedReceiptAt]);

  const billingCtaLabel = useMemo(() => {
    if (latestApprovedReceiptAt) return null;
    if (hasRejectedReceipt) return 'Повторно испрати доказ';
    if (hasPendingReceipt || hasReviewedReceipt) return 'Провери billing детали';
    return 'Активирај Pro и испрати доказ';
  }, [hasPendingReceipt, hasRejectedReceipt, hasReviewedReceipt, latestApprovedReceiptAt]);

  const billingGuideItems = useMemo(() => {
    return [
      {
        key: 'pending',
        title: 'Pending review',
        description: 'Тимот ја чека првата валидација.',
        isActive: hasPendingReceipt,
      },
      {
        key: 'reviewed',
        title: 'In review stage',
        description: 'Потврдата е проверена и е во финална обработка.',
        isActive: !hasPendingReceipt && hasReviewedReceipt,
      },
      {
        key: 'rejected',
        title: 'Needs action',
        description: 'Потребна е корекција или повторно праќање доказ.',
        isActive: !hasPendingReceipt && !hasReviewedReceipt && hasRejectedReceipt,
      },
      {
        key: 'none',
        title: 'No receipt submitted',
        description: 'Избери Pro план и испрати платежен доказ за активација.',
        isActive: !latestApprovedReceiptAt && !hasPendingReceipt && !hasReviewedReceipt && !hasRejectedReceipt,
      },
      {
        key: 'approved',
        title: 'Pro active',
        description: 'Се е успешно верификувано, пристапот е активен.',
        isActive: Boolean(latestApprovedReceiptAt),
      },
    ];
  }, [hasPendingReceipt, hasRejectedReceipt, hasReviewedReceipt, latestApprovedReceiptAt]);

  const activeGuideItem = useMemo(() => {
    return billingGuideItems.find((item) => item.isActive) ?? billingGuideItems[0];
  }, [billingGuideItems]);

  const trackBillingCtaClick = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      await addDoc(collection(db, 'ui_events'), {
        uid: currentUser.uid,
        eventType: 'billing_cta_click',
        source: 'dashboard_billing_health',
        currentBillingBadge: billingHealthBadge.label,
        currentGuideFocus: activeGuideItem.title,
        ctaLabel: billingCtaLabel,
        targetPath: '/pricing',
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      captureError(error, { name: 'dashboard.track-billing-cta', path: '/dashboard', details: { targetPath: '/pricing' } });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SEO 
        title="Телеметрија и Напредок" 
        description="Следете го вашиот личен напредок, нивоа, значки и образовни перформанси преку напредна DOK телеметрија." 
        keywords="телеметрија, математика, dashboard, напредок, значки, xp, едукација"
      />

      {latestApprovedReceiptAt ? (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <div className="text-sm font-black text-emerald-800 dark:text-emerald-200">Pro е активиран</div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Вашата уплата е одобрена и Pro пристапот е активен.</p>
            </div>
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Активирано: {formatReceiptTimestamp(latestApprovedReceiptAt)}
            </div>
          </div>
        </section>
      ) : null}

      {!latestApprovedReceiptAt && hasPendingReceipt ? (
        <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 md:p-5">
          <div className="text-sm font-black text-amber-800 dark:text-amber-200">Уплатата е во review</div>
          <p className="text-sm text-amber-700 dark:text-amber-300">Тимот ја проверува доставената потврда. Pro ќе се активира веднаш по одобрување.</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <AlertTriangle className="w-4 h-4 text-slate-500 dark:text-slate-300" />
            Billing Health
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${billingHealthBadge.className}`}>
              {billingHealthBadge.label}
            </span>
            {billingCtaLabel ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3"
                onClick={() => {
                  void trackBillingCtaClick();
                  navigate('/pricing');
                }}
              >
                {billingCtaLabel}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            <Info className="w-3.5 h-3.5" />
            Status guide
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-200 mb-2">
            <span className="font-semibold">Current focus:</span> {activeGuideItem.title} - {activeGuideItem.description}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {billingGuideItems.map((item) => (
              <div
                key={item.key}
                className={`rounded-lg px-2.5 py-2 border ${item.isActive ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/20 text-slate-600 dark:text-slate-300'}`}
              >
                <span className="font-semibold">{item.title}:</span> {item.description}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Header / XP Bar */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner overflow-hidden cursor-pointer" onClick={() => setIsAvatarShopOpen(true)}>
                {auth.currentUser?.photoURL ? (
                  <img src={auth.currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black">{stats.level}</span>
                )}
              </div>
              <div 
                className="absolute -bottom-2 -right-2 bg-indigo-500 rounded-full p-1.5 border border-white/30 cursor-pointer hover:bg-indigo-400 transition-colors shadow-lg"
                onClick={() => setIsAvatarShopOpen(true)}
              >
                <Paintbrush className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold">Ниво {stats.level}</h2>
                {userProfile && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white border border-white/30">
                    {String(userProfile.role) === 'teacher' ? 'Наставник' : 'Ученик'}
                  </span>
                )}
              </div>
              <p className="text-indigo-100">Вкупно XP: {stats.xp.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Прогрес до Ниво {stats.level + 1}</span>
              <span>{stats.xp % 1000} / 1000 XP</span>
            </div>
            <div className="h-4 bg-black/20 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${getLevelProgress()}%` }}
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-center">
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{stats.streak}</div>
                <div className="text-[10px] uppercase tracking-wider text-indigo-200">Дневен Streak</div>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                <Target className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{stats.tasks_completed}</div>
                <div className="text-[10px] uppercase tracking-wider text-indigo-200">Решени задачи</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full -ml-24 -mb-24 blur-2xl"></div>
      </section>

      {/* Interactive Mathematics Skill Tree */}
      <section className="mb-8">
        <StudentSkillTree currentXP={stats.xp} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Daily Quests Section */}
          <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-500" />
                Дневни Предизвици
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {stats.quests && stats.quests.date === new Date().toISOString().split('T')[0] ? (
                <div className="space-y-4">
                  {stats.quests.items.map((quest) => (
                    <div key={quest.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quest.completed ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                            {quest.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                          </div>
                          <span className={`font-semibold ${quest.completed ? 'text-slate-900 dark:text-white line-through opacity-70' : 'text-slate-900 dark:text-white'}`}>
                            {quest.title}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md">
                          +{quest.xpReward} XP
                        </span>
                      </div>
                      <div className="pl-11">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Прогрес</span>
                          <span>{quest.progress} / {quest.target}</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(quest.progress / quest.target) * 100}%` }}
                            className={`h-full ${quest.completed ? 'bg-emerald-500' : 'bg-orange-500'}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>Дневните предизвици се освежуваат...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mastery Radar Chart */}
          <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-600" />
                Мастерство по Теми
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={masteryData}>
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
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Анализа на вештини</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Вашиот најсилен предмет е <span className="font-bold text-indigo-600">Логика</span>. 
                    Потребно е повеќе вежбање во областа на <span className="font-bold text-amber-600">Тригонометрија</span>.
                  </p>
                  <div className="space-y-2">
                    {masteryData.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>{item.subject}</span>
                          <span>{item.A}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${item.A}%` }}
                            className={`h-full ${item.A > 70 ? 'bg-indigo-500' : item.A > 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full mt-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                    onClick={() => showToast("AI Tutor генерира адаптивна задача по Тригонометрија...", 'info')}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Генерирај Адаптивна Задача
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            Вашите Значки
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {stats.badges.map((badge, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ scale: 1.05 }}
                className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-center shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Medal className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{badge}</div>
              </motion.div>
            ))}
            {/* Locked Badges Placeholder */}
            {[1, 2, 3].map((_, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center opacity-50">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Star className="w-6 h-6 text-slate-300" />
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Заклучено</div>
              </div>
            ))}
          </div>

          {/* Recent Activity Placeholder */}
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Неодамнешен Напредок
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Генерирана слична задача</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Пред 2 часа</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600">+50 XP</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Завршена сесија со картички</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Пред 5 часа</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600">+120 XP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard Section */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Лидерска Табла
          </h3>
          <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                <span>Ранг / Корисник</span>
                <span>XP</span>
              </div>
            </div>
            <CardContent className="p-0">
              {leaderboard.map((leader, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    leader.uid === auth.currentUser?.uid ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-400 text-white' :
                      idx === 1 ? 'bg-slate-300 text-white' :
                      idx === 2 ? 'bg-orange-400 text-white' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        {leader.photoURL ? (
                          <img src={leader.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {leader.displayName?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                        {leader.uid === auth.currentUser?.uid ? 'Вие' : (leader.displayName || 'Корисник')}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {leader.xp.toLocaleString()}
                  </div>
                </div>
              ))}
            </CardContent>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 text-center">
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                Види ја целата табла <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <div className="mt-8 mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-500" />
          Брз Пристап на Екосистемот
        </h3>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Сите алатки на едно место</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {[
          { title: "Smart OCR", desc: "Скенирај задачи", icon: <ScanLine className="w-5 h-5 text-blue-500" />, to: "/smart-ocr", bg: "bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20", borderColor: "border-blue-100 dark:border-blue-800/50" },
          { title: "Библиотека", desc: "Банка на знаење", icon: <LibraryIcon className="w-5 h-5 text-emerald-500" />, to: "/library", bg: "bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20", borderColor: "border-emerald-100 dark:border-emerald-800/50" },
          { title: "Модул Екстракција", desc: "Од YouTube видеа", icon: <Wand2 className="w-5 h-5 text-purple-500" />, to: "/extract", bg: "bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20", borderColor: "border-purple-100 dark:border-purple-800/50" },
          { title: "Тест Фабрика", desc: "Генерирај тестови во секунда", icon: <Layers className="w-5 h-5 text-rose-500" />, to: "/mass-factory", bg: "bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20", borderColor: "border-rose-100 dark:border-rose-800/50" }
        ].map((item, idx) => (
          <Link key={idx} to={item.to} className={`flex flex-col p-4 rounded-2xl border transition-all ${item.bg} ${item.borderColor}`}>
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl w-max shadow-sm mb-3">
              {item.icon}
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">{item.title}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{item.desc}</p>
          </Link>
        ))}
      </div>

      <AvatarShop 
        isOpen={isAvatarShopOpen} 
        onClose={() => setIsAvatarShopOpen(false)} 
        currentLevel={stats.level} 
        currentAvatar={auth.currentUser?.photoURL || null} 
      />
    </div>
  );
};
