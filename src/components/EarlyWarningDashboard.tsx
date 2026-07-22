import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  AlertTriangle, TrendingDown, TrendingUp, Minus, Users,
  Activity, Clock, CheckCircle2, XCircle, BarChart3,
  MessageSquare, Phone, BookOpen, UserCheck, Plus,
  ClipboardList, PlayCircle, XCircle as DismissIcon
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  analyzeClassroomRisk,
  DEFAULT_EARLY_WARNING_CONFIG,
  INTERVENTION_TYPES,
} from '../lib/earlyWarning';
import type { GradeEntry, StudentRiskProfile, RiskLevel, Intervention } from '../lib/schema';

// ─── Risk Level Config ───────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}> = {
  low: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  medium: {
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  high: {
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: <XCircle className="w-5 h-5" />,
  },
};

// ─── Intervention Status Config ─────────────────────────────────────────────

const STATUS_CONFIG: Record<Intervention['status'], {
  color: string;
  bgColor: string;
  label: string;
}> = {
  pending: {
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'statusPending',
  },
  in_progress: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'statusInProgress',
  },
  completed: {
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'statusCompleted',
  },
  dismissed: {
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-700/50',
    label: 'statusDismissed',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface EarlyWarningDashboardProps {
  classroomId?: string;
}

export const EarlyWarningDashboard: React.FC<EarlyWarningDashboardProps> = ({ classroomId }) => {
  const { t } = useTranslation(['earlyWarning', 'common']);
  const { user } = useAuth();
  const { showToast } = useToast();

  const RISK_LABELS: Record<RiskLevel, string> = {
    low: t('lowRisk'),
    medium: t('mediumRisk'),
    high: t('highRisk'),
  };

  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentRiskProfile | null>(null);
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'all'>('all');

  // Intervention state
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [filterStatus, setFilterStatus] = useState<Intervention['status'] | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForStudent, setCreateForStudent] = useState<StudentRiskProfile | null>(null);
  const [newType, setNewType] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingNotes, setEditingNotes] = useState<string | null>(null); // intervention id
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load grade entries
  useEffect(() => {
    if (!user || !classroomId) return;

    const loadGrades = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'grade_entries'),
          where('classroomId', '==', classroomId),
          where('gradedBy', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as GradeEntry));
        setGradeEntries(entries);
      } catch (error) {
        console.error('Error loading grades:', error);
        showToast(t('errorLoading'), 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadGrades();
  }, [user, classroomId]);

  // Real-time interventions listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'interventions'),
      where('created_by', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Intervention));
      setInterventions(items);
    }, (error) => {
      console.error('Error loading interventions:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Analyze risk
  const riskAnalysis = useMemo(() => {
    if (!classroomId || gradeEntries.length === 0) return null;
    return analyzeClassroomRisk(classroomId, gradeEntries, DEFAULT_EARLY_WARNING_CONFIG);
  }, [classroomId, gradeEntries]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    if (!riskAnalysis) return [];
    if (filterRisk === 'all') return riskAnalysis.students;
    return riskAnalysis.students.filter(s => s.riskLevel === filterRisk);
  }, [riskAnalysis, filterRisk]);

  // Intervention summary stats
  const interventionStats = useMemo(() => {
    const total = interventions.length;
    const pending = interventions.filter(i => i.status === 'pending').length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const completedThisWeek = interventions.filter(i =>
      i.status === 'completed' && i.completed_at && new Date(i.completed_at) >= weekAgo
    ).length;
    return { total, pending, completedThisWeek };
  }, [interventions]);

  // Interventions for selected student
  const studentInterventions = useMemo(() => {
    if (!selectedStudent) return [];
    let items = interventions.filter(i => i.student_id === selectedStudent.studentId);
    if (filterStatus !== 'all') {
      items = items.filter(i => i.status === filterStatus);
    }
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [interventions, selectedStudent, filterStatus]);

  // Firestore operations
  const handleCreateIntervention = useCallback(async () => {
    if (!user || !createForStudent || !newType) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const data = {
        student_id: createForStudent.studentId,
        student_name: createForStudent.studentName,
        type: newType,
        description: newDescription,
        status: 'pending' as const,
        created_at: now,
        updated_at: now,
        created_by: user.uid,
      };
      await addDoc(collection(db, 'interventions'), data);
      showToast(t('interventionCreated'), 'success');
      setShowCreateModal(false);
      setNewType('');
      setNewDescription('');
      setCreateForStudent(null);
    } catch (error) {
      console.error('Error creating intervention:', error);
      showToast(t('errorSaving'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [user, createForStudent, newType, newDescription, showToast, t]);

  const handleUpdateStatus = useCallback(async (intervention: Intervention, newStatus: Intervention['status']) => {
    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
      await updateDoc(doc(db, 'interventions', intervention.id), updates);
      showToast(t('interventionUpdated'), 'success');
    } catch (error) {
      console.error('Error updating intervention:', error);
      showToast(t('errorSaving'), 'error');
    }
  }, [showToast, t]);

  const handleSaveNote = useCallback(async (interventionId: string) => {
    try {
      await updateDoc(doc(db, 'interventions', interventionId), {
        notes: noteText,
        updated_at: new Date().toISOString(),
      });
      setEditingNotes(null);
      setNoteText('');
      showToast(t('interventionUpdated'), 'success');
    } catch (error) {
      console.error('Error saving note:', error);
      showToast(t('errorSaving'), 'error');
    }
  }, [noteText, showToast, t]);

  const TrendIcon = ({ trend }: { trend: 'improving' | 'stable' | 'declining' }) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 60) return 'text-red-600 dark:text-red-400';
    if (score >= 30) return 'text-amber-600 dark:text-amber-400';
    return 'text-green-600 dark:text-green-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('title', 'Early Warning систем')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {t('subtitle', 'Детекција на ученици во ризик')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {riskAnalysis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-600" />
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {riskAnalysis.totalStudents}
                </p>
                <p className="text-sm text-slate-500">{t('totalStudents', 'Вкупно ученици')}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {riskAnalysis.lowRisk}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">{t('lowRisk', 'Низок ризик')}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {riskAnalysis.mediumRisk}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">{t('mediumRisk', 'Среден ризик')}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {riskAnalysis.highRisk}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">{t('highRisk', 'Висок ризик')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Intervention Summary Card */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            {t('interventionSummary', 'Интервенции')}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{interventionStats.total}</p>
              <p className="text-xs text-slate-500">{t('totalInterventions', 'Вкупно интервенции')}</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{interventionStats.completedThisWeek}</p>
              <p className="text-xs text-green-600 dark:text-green-400">{t('completedThisWeek', 'Завршени оваа недела')}</p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{interventionStats.pending}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('pendingInterventions', 'Во исчекување')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Interventions */}
      {riskAnalysis && riskAnalysis.topInterventions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              {t('topInterventions', 'Најчести препорачани интервенции')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {riskAnalysis.topInterventions.map((intervention, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full"
                >
                  {intervention.type} ({intervention.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'high', 'medium', 'low'] as const).map(level => (
          <Button
            key={level}
            onClick={() => setFilterRisk(level)}
            variant={filterRisk === level ? 'default' : 'outline'}
            className={filterRisk === level ? 'bg-indigo-600' : ''}
          >
            {level === 'all' ? t('all', 'Сите') : RISK_LABELS[level]}
          </Button>
        ))}
      </div>

      {/* Student List */}
      <div className="space-y-3">
        {filteredStudents.map(student => {
          const config = RISK_CONFIG[student.riskLevel];
          const studentInterventionCount = interventions.filter(
            i => i.student_id === student.studentId && i.status !== 'dismissed'
          ).length;
          return (
            <motion.div
              key={student.studentId}
              layout
              className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => setSelectedStudent(student)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={config.color}>{config.icon}</div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {student.studentName}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {RISK_LABELS[student.riskLevel]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {studentInterventionCount > 0 && (
                    <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                      {studentInterventionCount} {t('interventionSummary', 'Интервенции')}
                    </span>
                  )}
                  <div className="text-right">
                    <p className={`text-lg font-bold ${getRiskScoreColor(student.riskScore)}`}>
                      {student.riskScore}
                    </p>
                    <p className="text-xs text-slate-500">{t('riskScore', 'Ризик скор')}</p>
                  </div>
                  <TrendIcon trend={student.factors.gradeTrend} />
                </div>
              </div>

              {/* Risk Factors */}
              <div className="flex flex-wrap gap-2 mt-3">
                {student.factors.decliningGrades && (
                  <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    {t('decliningGrades', 'Опаѓачки оцени')}
                  </span>
                )}
                {student.factors.lowEngagement && (
                  <span className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t('lowEngagement', 'Ниска активност')} ({student.factors.timeSinceLastActivity} {t('days', 'дена')})
                  </span>
                )}
                {student.factors.averageGrade < 2.5 && (
                  <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    {t('lowAverage', 'Низок просек')} ({student.factors.averageGrade.toFixed(2)})
                  </span>
                )}
                {student.factors.failedTests > 0 && (
                  <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {t('failedTests', 'Паднати тестови')} ({student.factors.failedTests})
                  </span>
                )}
              </div>

              {/* Recommended Interventions */}
              {student.recommendedInterventions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t('recommendedInterventions', 'Препорачани интервенции')}:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {student.recommendedInterventions.slice(0, 3).map((intervention, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700"
                      >
                        {intervention}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Create Intervention Button */}
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-indigo-600 border-indigo-300 hover:bg-indigo-50 dark:border-indigo-700 dark:hover:bg-indigo-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreateForStudent(student);
                    setShowCreateModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {t('createIntervention', 'Креирај интервенција')}
                </Button>
              </div>
            </motion.div>
          );
        })}

        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p>{t('noAtRiskStudents', 'Нема ученици во оваа категорија на ризик')}</p>
          </div>
        )}
      </div>

      {/* Create Intervention Modal */}
      {showCreateModal && createForStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('createIntervention', 'Креирај интервенција')} — {createForStudent.studentName}
                </h2>
                <button
                  onClick={() => { setShowCreateModal(false); setCreateForStudent(null); }}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Type select */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('interventionType', 'Тип на интервенција')}
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">{t('selectType', 'Избери тип...')}</option>
                    {createForStudent.recommendedInterventions.map((rec, i) => (
                      <option key={i} value={rec}>{rec}</option>
                    ))}
                    {Object.entries(INTERVENTION_TYPES).map(([key, label]) => (
                      <option key={key} value={label}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('interventionDescription', 'Опис')}
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder={t('descriptionPlaceholder', 'Опис на интервенцијата...')}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => { setShowCreateModal(false); setCreateForStudent(null); }}
                  >
                    {t('cancel', 'Откажи')}
                  </Button>
                  <Button
                    onClick={handleCreateIntervention}
                    disabled={!newType || isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isSaving ? '...' : t('create', 'Креирај')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedStudent.studentName}
                </h2>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ✕
                </button>
              </div>

              {/* Risk Score */}
              <div className={`p-4 rounded-xl ${RISK_CONFIG[selectedStudent.riskLevel].bgColor} mb-4`}>
                <div className="flex items-center justify-between">
                  <span className={RISK_CONFIG[selectedStudent.riskLevel].color}>
                    {RISK_LABELS[selectedStudent.riskLevel]}
                  </span>
                  <span className={`text-2xl font-bold ${getRiskScoreColor(selectedStudent.riskScore)}`}>
                    {selectedStudent.riskScore}/100
                  </span>
                </div>
              </div>

              {/* Factors */}
              <div className="space-y-3 mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t('riskFactors', 'Фактори на ризик')}
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-slate-500">{t('averageGrade', 'Просек')}:</span>{' '}
                    <span className="font-medium">{selectedStudent.factors.averageGrade.toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-slate-500">{t('trend', 'Тренд')}:</span>{' '}
                    <span className="font-medium">{selectedStudent.factors.gradeTrend}</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-slate-500">{t('lastActivity', 'Последна активност')}:</span>{' '}
                    <span className="font-medium">{selectedStudent.factors.timeSinceLastActivity} {t('days', 'дена')}</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-slate-500">{t('failedTests', 'Паднати тестови')}:</span>{' '}
                    <span className="font-medium">{selectedStudent.factors.failedTests}</span>
                  </div>
                </div>
              </div>

              {/* Recommended Interventions */}
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  {t('recommendedInterventions', 'Препорачани интервенции')}
                </h3>
                <ul className="space-y-2">
                  {selectedStudent.recommendedInterventions.map((intervention, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="text-indigo-600">•</span>
                      {intervention}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Intervention History */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-600" />
                    {t('interventionHistory', 'Историја на интервенции')}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-indigo-600 border-indigo-300 hover:bg-indigo-50 dark:border-indigo-700 dark:hover:bg-indigo-900/20"
                    onClick={() => {
                      setCreateForStudent(selectedStudent);
                      setShowCreateModal(true);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    {t('createIntervention', 'Креирај интервенција')}
                  </Button>
                </div>

                {/* Status filter */}
                <div className="flex gap-1 mb-3 flex-wrap">
                  {(['all', 'pending', 'in_progress', 'completed', 'dismissed'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        filterStatus === status
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {status === 'all' ? t('allStatuses', 'Сите статуси') : t(STATUS_CONFIG[status].label)}
                    </button>
                  ))}
                </div>

                {/* Intervention list */}
                {studentInterventions.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    {t('noInterventions', 'Нема интервенции за овој ученик')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {studentInterventions.map(intervention => {
                      const statusCfg = STATUS_CONFIG[intervention.status];
                      return (
                        <div
                          key={intervention.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {intervention.type}
                              </p>
                              {intervention.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {intervention.description}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">
                                {t('createdOn', 'Креирано')}: {new Date(intervention.created_at).toLocaleDateString()}
                              </p>
                              {intervention.completed_at && (
                                <p className="text-xs text-green-600 dark:text-green-400">
                                  {t('completedOn', 'Завршено')}: {new Date(intervention.completed_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${statusCfg.bgColor} ${statusCfg.color}`}>
                              {t(statusCfg.label)}
                            </span>
                          </div>

                          {/* Notes */}
                          {intervention.notes && editingNotes !== intervention.id && (
                            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-800 dark:text-amber-200">
                              <MessageSquare className="w-3 h-3 inline mr-1" />
                              {intervention.notes}
                            </div>
                          )}

                          {/* Notes editing */}
                          {editingNotes === intervention.id && (
                            <div className="mt-2">
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder={t('notesPlaceholder', 'Белешки и набљудувања...')}
                                rows={2}
                                className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                              />
                              <div className="flex gap-1 mt-1 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs px-2 py-1"
                                  onClick={() => { setEditingNotes(null); setNoteText(''); }}
                                >
                                  {t('cancel', 'Откажи')}
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700"
                                  onClick={() => handleSaveNote(intervention.id)}
                                >
                                  {t('saveNote', 'Зачувај')}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {intervention.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1 px-2 py-1 text-blue-600 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                                onClick={() => handleUpdateStatus(intervention, 'in_progress')}
                              >
                                <PlayCircle className="w-3 h-3" />
                                {t('markInProgress', 'Започни')}
                              </Button>
                            )}
                            {(intervention.status === 'pending' || intervention.status === 'in_progress') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1 px-2 py-1 text-green-600 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20"
                                onClick={() => handleUpdateStatus(intervention, 'completed')}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {t('markCompleted', 'Заврши')}
                              </Button>
                            )}
                            {intervention.status !== 'dismissed' && intervention.status !== 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1 px-2 py-1 text-slate-500 border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                                onClick={() => handleUpdateStatus(intervention, 'dismissed')}
                              >
                                <DismissIcon className="w-3 h-3" />
                                {t('markDismissed', 'Отфрли')}
                              </Button>
                            )}
                            {editingNotes !== intervention.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1 px-2 py-1 text-amber-600 border-amber-300 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-900/20"
                                onClick={() => {
                                  setEditingNotes(intervention.id);
                                  setNoteText(intervention.notes || '');
                                }}
                              >
                                <MessageSquare className="w-3 h-3" />
                                {t('addNote', 'Додади белешка')}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
