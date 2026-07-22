import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, Zap, TrendingUp, Loader2, Brain, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { db, auth } from '../lib/firebase';
import { addDoc, collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserStats, UserProfile } from '../lib/schema';
import { motion } from 'motion/react';
import { Skeleton } from './ui/Skeleton';
import { SEO } from './SEO';
import { useToast } from '../contexts/ToastContext';
import { captureError } from '../lib/observability';
import { BillingHealthSection } from './dashboard/BillingHealthSection';
import { XPLevelHeader } from './dashboard/XPLevelHeader';
import { DailyQuestsSection } from './dashboard/DailyQuestsSection';
import { BadgesGrid } from './dashboard/BadgesGrid';
import { LeaderboardPanel } from './dashboard/LeaderboardPanel';
import { QuickAccessGrid } from './dashboard/QuickAccessGrid';

// Lazy-loaded: Dashboard.tsx is a single route-level component, but a given
// visit only ever needs ONE of these three (teacher branch returns early;
// the recharts-heavy mastery chart, skill tree, and avatar-shop modal are
// only used by the non-teacher/non-student fallback view below). Keeping
// them as static imports meant every /dashboard visit paid for all three
// regardless of which branch actually rendered — this is what was pushing
// the route over its bundle budget.
const TeacherDashboard = lazy(() => import('./TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })));
const AvatarShop = lazy(() => import('./AvatarShop').then((m) => ({ default: m.AvatarShop })));
const StudentSkillTree = lazy(() => import('./StudentSkillTree').then((m) => ({ default: m.StudentSkillTree })));
const MasteryRadarChart = lazy(() => import('./dashboard/MasteryRadarChart'));

type ReceiptStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

interface DashboardProps {
  userProfile?: UserProfile | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ userProfile }) => {
  const { t, i18n } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const dateLocale = i18n.language === 'al' ? 'sq-AL' : i18n.language === 'en' ? 'en-US' : 'mk-MK';
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
              showToast(t('paymentApproved'), 'success');
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

    return parsed.toLocaleString(dateLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const masteryData = [
    { subject: t('masteryAlgebra'), A: 85, fullMark: 100 },
    { subject: t('masteryGeometry'), A: 65, fullMark: 100 },
    { subject: t('masteryTrigonometry'), A: 45, fullMark: 100 },
    { subject: t('masteryStatistics'), A: 70, fullMark: 100 },
    { subject: t('masteryLogic'), A: 90, fullMark: 100 },
    { subject: t('masteryAnalysis'), A: 55, fullMark: 100 },
  ];

  const billingHealthBadge = useMemo(() => {
    if (latestApprovedReceiptAt) {
      return {
        label: t('billingProActive'),
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
      };
    }

    if (hasPendingReceipt) {
      return {
        label: t('billingPendingReview'),
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
      };
    }

    if (hasReviewedReceipt) {
      return {
        label: t('billingInReview'),
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
      };
    }

    if (hasRejectedReceipt) {
      return {
        label: t('billingNeedsAction'),
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
      };
    }

    return {
      label: t('billingNoReceipt'),
      className: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300',
    };
  }, [hasPendingReceipt, hasRejectedReceipt, hasReviewedReceipt, latestApprovedReceiptAt, t]);

  const billingCtaLabel = useMemo(() => {
    if (latestApprovedReceiptAt) return null;
    if (hasRejectedReceipt) return t('resubmitProof');
    if (hasPendingReceipt || hasReviewedReceipt) return t('checkBillingDetails');
    return t('activateProAndSubmit');
  }, [hasPendingReceipt, hasRejectedReceipt, hasReviewedReceipt, latestApprovedReceiptAt, t]);

  const billingGuideItems = useMemo(() => {
    return [
      {
        key: 'pending',
        title: t('billingGuide.pending.title'),
        description: t('billingGuide.pending.description'),
        isActive: hasPendingReceipt,
      },
      {
        key: 'reviewed',
        title: t('billingGuide.reviewed.title'),
        description: t('billingGuide.reviewed.description'),
        isActive: !hasPendingReceipt && hasReviewedReceipt,
      },
      {
        key: 'rejected',
        title: t('billingGuide.rejected.title'),
        description: t('billingGuide.rejected.description'),
        isActive: !hasPendingReceipt && !hasReviewedReceipt && hasRejectedReceipt,
      },
      {
        key: 'none',
        title: t('billingGuide.none.title'),
        description: t('billingGuide.none.description'),
        isActive: !latestApprovedReceiptAt && !hasPendingReceipt && !hasReviewedReceipt && !hasRejectedReceipt,
      },
      {
        key: 'approved',
        title: t('billingGuide.approved.title'),
        description: t('billingGuide.approved.description'),
        isActive: Boolean(latestApprovedReceiptAt),
      },
    ];
  }, [hasPendingReceipt, hasRejectedReceipt, hasReviewedReceipt, latestApprovedReceiptAt, t]);

  const activeGuideItem = useMemo(() => {
    return billingGuideItems.find((item) => item.isActive) ?? billingGuideItems[0];
  }, [billingGuideItems]);

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

  if (userProfile?.role === 'teacher') {
    return (
      <Suspense fallback={<div className="p-8"><Skeleton className="w-full h-64 rounded-3xl" /></div>}>
        <TeacherDashboard userProfile={userProfile} />
      </Suspense>
    );
  }

  if (userProfile?.role === 'student') {
    return <Navigate to="/student-dashboard" replace />;
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-3xl border border-dashed border-slate-300 dark:border-white/10">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/15 rounded-full flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('statsErrorTitle')}</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
          {t('statsErrorDescription')}
        </p>
        <Button onClick={() => window.location.reload()}>
          {t('refreshPage')}
        </Button>
      </div>
    );
  }

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

  const handleBillingCtaClick = () => {
    void trackBillingCtaClick();
    navigate('/pricing');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SEO
        title={t('seoTitle')}
        description={t('seoDescription')}
        keywords={t('seoKeywords')}
      />

      <BillingHealthSection
        billingHealthBadge={billingHealthBadge}
        billingCtaLabel={billingCtaLabel}
        billingGuideItems={billingGuideItems}
        activeGuideItem={activeGuideItem}
        latestApprovedReceiptAt={latestApprovedReceiptAt}
        hasPendingReceipt={hasPendingReceipt}
        formatReceiptTimestamp={formatReceiptTimestamp}
        onTrackBillingCta={handleBillingCtaClick}
        t={t}
      />

      {/* Header / XP Bar */}
      <XPLevelHeader
        stats={stats}
        userProfile={userProfile}
        onOpenAvatarShop={() => setIsAvatarShopOpen(true)}
        t={t}
      />

      {/* Interactive Mathematics Skill Tree */}
      <section className="mb-8">
        <Suspense fallback={<Skeleton className="w-full h-40 rounded-3xl" />}>
          <StudentSkillTree currentXP={stats.xp} />
        </Suspense>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Daily Quests Section */}
          <DailyQuestsSection stats={stats} t={t} />

          {/* Mastery Radar Chart */}
          <Card className="border-slate-200 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-600" />
                {t('masteryByTopics')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-[300px] w-full">
                  <Suspense fallback={<Skeleton className="w-full h-full rounded-2xl" />}>
                    <MasteryRadarChart data={masteryData} />
                  </Suspense>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('skillAnalysis')}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    <Trans i18nKey="skillAnalysisText" ns="dashboard" components={{ strong: <strong className="font-bold" /> }} />
                  </p>
                  <div className="space-y-2">
                    {masteryData.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>{item.subject}</span>
                          <span>{item.A}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
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
                    onClick={() => showToast(t('aiTutorGenerating'), 'info')}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    {t('generateAdaptiveTask')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <BadgesGrid stats={stats} t={t} />

          {/* Recent Activity Placeholder */}
          <Card className="border-slate-200 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                {t('recentProgress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('generatedSimilarTask')}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{t('twoHoursAgo')}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+50 XP</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('completedFlashcardSession')}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{t('fiveHoursAgo')}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+120 XP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard Section */}
        <LeaderboardPanel
          leaderboard={leaderboard}
          currentUid={auth.currentUser?.uid}
          t={t}
        />
      </div>

      <QuickAccessGrid t={t} />

      {isAvatarShopOpen && (
        <Suspense fallback={null}>
          <AvatarShop
            isOpen={isAvatarShopOpen}
            onClose={() => setIsAvatarShopOpen(false)}
            currentLevel={stats.level}
            currentAvatar={auth.currentUser?.photoURL || null}
          />
        </Suspense>
      )}
    </div>
  );
};
