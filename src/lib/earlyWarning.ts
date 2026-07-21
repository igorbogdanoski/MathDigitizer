/**
 * Early Warning System — Детекција на ученици во ризик
 *
 * Анализира оцени, активност и други фактори за да идентификува
 * ученици кои можеби имаат потреба од дополнителна поддршка.
 */

import type {
  GradeEntry,
  StudentRiskProfile,
  RiskFactors,
  RiskLevel,
  EarlyWarningConfig,
  RiskAnalysisResult,
  Intervention,
} from './schema';

// ─── Default Configuration ───────────────────────────────────────────────────

export const DEFAULT_EARLY_WARNING_CONFIG: EarlyWarningConfig = {
  decliningGradeThreshold: 0.5,
  missingAssignmentThreshold: 3,
  inactivityDaysThreshold: 7,
  lowGradeThreshold: 2.5,
  failedTestThreshold: 2,
  weights: {
    decliningGrades: 0.25,
    missingAssignments: 0.20,
    lowEngagement: 0.20,
    lowGrades: 0.25,
    failedTests: 0.10,
  },
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Пресметува просечна оценка од низа на оцени
 */
export function calculateAverageGrade(grades: number[]): number {
  if (grades.length === 0) return 0;
  return grades.reduce((sum, g) => sum + g, 0) / grades.length;
}

/**
 * Детектира тренд на оцени (improving, stable, declining)
 */
export function detectGradeTrend(
  grades: { grade: number; date: string }[]
): 'improving' | 'stable' | 'declining' {
  if (grades.length < 3) return 'stable';

  const sorted = [...grades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const half = Math.floor(sorted.length / 2);
  const firstHalf = calculateAverageGrade(sorted.slice(0, half).map(g => g.grade));
  const secondHalf = calculateAverageGrade(sorted.slice(half).map(g => g.grade));

  const diff = secondHalf - firstHalf;
  if (diff > 0.3) return 'improving';
  if (diff < -0.3) return 'declining';
  return 'stable';
}

/**
 * Пресметува денови од последна активност
 */
export function daysSinceLastActivity(lastActivityDate: string | Date): number {
  const last = new Date(lastActivityDate);
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Пресметува ризик скор (0-100)
 */
export function calculateRiskScore(
  factors: RiskFactors,
  config: EarlyWarningConfig = DEFAULT_EARLY_WARNING_CONFIG
): number {
  let score = 0;

  // Declining grades
  if (factors.decliningGrades) {
    score += config.weights.decliningGrades * 100;
  }

  // Missing assignments
  const missingRatio = Math.min(
    factors.missingAssignments / config.missingAssignmentThreshold,
    1
  );
  score += config.weights.missingAssignments * missingRatio * 100;

  // Low engagement (inactivity)
  if (factors.lowEngagement) {
    const inactivityRatio = Math.min(
      factors.timeSinceLastActivity / config.inactivityDaysThreshold,
      1
    );
    score += config.weights.lowEngagement * inactivityRatio * 100;
  }

  // Low grades
  if (factors.averageGrade < config.lowGradeThreshold) {
    const gradeRatio = 1 - factors.averageGrade / 5; // MK scale 1-5
    score += config.weights.lowGrades * gradeRatio * 100;
  }

  // Failed tests
  const failedRatio = Math.min(
    factors.failedTests / config.failedTestThreshold,
    1
  );
  score += config.weights.failedTests * failedRatio * 100;

  return Math.round(Math.min(score, 100));
}

/**
 * Конвертира ризик скор во ниво (low, medium, high)
 */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Генерира препорачани интервенции врз основа на факторите
 */
export function generateRecommendedInterventions(
  factors: RiskFactors,
  riskLevel: RiskLevel
): string[] {
  const interventions: string[] = [];

  if (riskLevel === 'high') {
    interventions.push('Итна средба со наставник (1-on-1)');
    interventions.push('Контакт со родител/старател');
  }

  if (factors.decliningGrades) {
    interventions.push('Дополнителни вежби за слаби теми');
    interventions.push('Преглед на претходни тестови за грешки');
  }

  if (factors.missingAssignments > 0) {
    interventions.push('План за надоместување на пропуштени задачи');
    interventions.push('Проверка на разбирање на материјалот');
  }

  if (factors.lowEngagement) {
    interventions.push('Мотивациска средба');
    interventions.push('Вклучување во групни активности');
  }

  if (factors.averageGrade < 2.5) {
    interventions.push('Диференцирани задачи (support ниво)');
    interventions.push('Peer tutoring (ученик-ментор)');
  }

  if (factors.failedTests >= 2) {
    interventions.push('Дополнителна подготовка за следен тест');
    interventions.push('Модифицирани задачи за вежбање');
  }

  // Ако нема специфични интервенции, додај генеричка
  if (interventions.length === 0 && riskLevel !== 'low') {
    interventions.push('Мониторинг на напредок');
  }

  return interventions;
}

// ─── Main Analysis Functions ─────────────────────────────────────────────────

/**
 * Анализира ризик за еден ученик
 */
export function analyzeStudentRisk(
  studentId: string,
  studentName: string,
  classroomId: string,
  gradeEntries: GradeEntry[],
  config: EarlyWarningConfig = DEFAULT_EARLY_WARNING_CONFIG
): StudentRiskProfile {
  const grades = gradeEntries.map(e => e.grade);
  const averageGrade = calculateAverageGrade(grades);

  const gradeHistory = gradeEntries.map(e => ({
    grade: e.grade,
    date: e.gradedAt,
  }));
  const gradeTrend = detectGradeTrend(gradeHistory);

  // Пресметај фактори
  const lastActivity = gradeEntries.length > 0
    ? gradeEntries.reduce((latest, e) =>
        new Date(e.gradedAt) > new Date(latest.gradedAt) ? e : latest
      ).gradedAt
    : new Date().toISOString();

  const timeSinceLastActivity = daysSinceLastActivity(lastActivity);

  const failedTests = gradeEntries.filter(e =>
    e.category === 'test' && e.grade < 2
  ).length;

  const factors: RiskFactors = {
    decliningGrades: gradeTrend === 'declining',
    missingAssignments: 0, // TODO: Calculate from assignment data
    lowEngagement: timeSinceLastActivity > config.inactivityDaysThreshold,
    timeSinceLastActivity,
    averageGrade,
    gradeTrend,
    failedTests,
  };

  const riskScore = calculateRiskScore(factors, config);
  const riskLevel = scoreToRiskLevel(riskScore);
  const recommendedInterventions = generateRecommendedInterventions(factors, riskLevel);

  return {
    studentId,
    studentName,
    classroomId,
    riskLevel,
    riskScore,
    factors,
    recommendedInterventions,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Анализира ризик за сите ученици во одделение
 */
export function analyzeClassroomRisk(
  classroomId: string,
  allGradeEntries: GradeEntry[],
  config: EarlyWarningConfig = DEFAULT_EARLY_WARNING_CONFIG
): RiskAnalysisResult {
  // Групирај оцени по ученик
  const byStudent = new Map<string, { name: string; entries: GradeEntry[] }>();

  allGradeEntries.forEach(entry => {
    if (!byStudent.has(entry.studentId)) {
      byStudent.set(entry.studentId, { name: entry.studentName, entries: [] });
    }
    byStudent.get(entry.studentId)!.entries.push(entry);
  });

  // Анализирај секој ученик
  const students: StudentRiskProfile[] = [];
  byStudent.forEach((data, studentId) => {
    const profile = analyzeStudentRisk(
      studentId,
      data.name,
      classroomId,
      data.entries,
      config
    );
    students.push(profile);
  });

  // Сортирај по ризик (high first)
  students.sort((a, b) => b.riskScore - a.riskScore);

  // Пресметај статистика
  const lowRisk = students.filter(s => s.riskLevel === 'low').length;
  const mediumRisk = students.filter(s => s.riskLevel === 'medium').length;
  const highRisk = students.filter(s => s.riskLevel === 'high').length;

  // Топ интервенции
  const interventionCounts = new Map<string, number>();
  students.forEach(s => {
    s.recommendedInterventions.forEach(i => {
      interventionCounts.set(i, (interventionCounts.get(i) || 0) + 1);
    });
  });

  const topInterventions = Array.from(interventionCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalStudents: students.length,
    lowRisk,
    mediumRisk,
    highRisk,
    students,
    topInterventions,
  };
}

// ─── Intervention Helpers ────────────────────────────────────────────────────

/**
 * Креира интервенција за ученик
 */
export function createIntervention(
  studentId: string,
  studentName: string,
  classroomId: string,
  type: Intervention['type'],
  description: string,
  assignedBy: string
): Omit<Intervention, 'id'> {
  return {
    studentId,
    studentName,
    classroomId,
    type,
    description,
    assignedAt: new Date().toISOString(),
    assignedBy,
    status: 'pending',
  };
}

/**
 * Мапирање на типови на интервенции
 */
export const INTERVENTION_TYPES: Record<Intervention['type'], string> = {
  extra_practice: 'Дополнителни вежби',
  one_on_one: 'Индивидуална средба',
  parent_contact: 'Контакт со родител',
  peer_tutoring: 'Peer tutoring',
  modified_tasks: 'Модифицирани задачи',
};
