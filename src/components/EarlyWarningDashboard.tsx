import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  AlertTriangle, TrendingDown, TrendingUp, Minus, Users,
  Activity, Clock, CheckCircle2, XCircle, BarChart3,
  MessageSquare, Phone, BookOpen, UserCheck
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  analyzeClassroomRisk,
  DEFAULT_EARLY_WARNING_CONFIG,
  INTERVENTION_TYPES,
} from '../lib/earlyWarning';
import type { GradeEntry, StudentRiskProfile, RiskLevel, Intervention } from '../lib/schema';

// ─── Risk Level Config ───────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}> = {
  low: {
    label: 'Низок ризик',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  medium: {
    label: 'Среден ризик',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  high: {
    label: 'Висок ризик',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: <XCircle className="w-5 h-5" />,
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

  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentRiskProfile | null>(null);
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'all'>('all');

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
        showToast('Грешка при вчитување на оцени', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadGrades();
  }, [user, classroomId]);

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
      <div className="flex gap-2">
        {(['all', 'high', 'medium', 'low'] as const).map(level => (
          <Button
            key={level}
            onClick={() => setFilterRisk(level)}
            variant={filterRisk === level ? 'default' : 'outline'}
            className={filterRisk === level ? 'bg-indigo-600' : ''}
          >
            {level === 'all' ? t('all', 'Сите') : RISK_CONFIG[level].label}
          </Button>
        ))}
      </div>

      {/* Student List */}
      <div className="space-y-3">
        {filteredStudents.map(student => {
          const config = RISK_CONFIG[student.riskLevel];
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
                      {config.label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
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
                    {RISK_CONFIG[selectedStudent.riskLevel].label}
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

              {/* Interventions */}
              <div>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
