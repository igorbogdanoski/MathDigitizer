export interface KnowledgeGap {
  concept: string; // The mathematical concept (e.g., "fractions", "pythagorean theorem")
  severity: 'low' | 'medium' | 'high';
  frequency: number; // How many times this mistake occurred
  last_detected: string; // ISO date string
}

export interface StudentProfile {
  id?: string;
  student_identifier: string; // Full Name or UID
  teacher_uid: string;
  knowledge_gaps: KnowledgeGap[];
  last_evaluated: string;
  total_evaluations: number;
  bloom_level_distribution?: Record<string, number>; // Historical tracking of bloom level performance
}

export interface GradedSubmission {
  id?: string;
  student_identifier: string;
  teacher_uid: string;
  task_id?: string;
  score: number;
  bloom_level_assessed?: string; // Legacy support
  pedagogical_evaluation?: {
    framework: 'bloom' | 'dok' | 'solo';
    level: string;
    reason: string;
  };
  identified_weaknesses: string[]; // List of concepts the student struggled with on this test
  rubric_breakdown?: {
    concept: { score: number, comment: string };
    execution: { score: number, comment: string };
    presentation: { score: number, comment: string };
  };
  feedback_summary: string;
  created_at: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'student';
  isPro?: boolean;
  trialStartedAt?: string;
  proStartedAt?: string;       // ISO — when isPro was first set to true
  proEndsAt?: string;          // ISO — reserved for future subscription expiry
  paymentChannel?: 'bank' | 'paypal' | 'stripe';
  createdAt: string;
}

export interface CognitiveTelemetryStep {
  step_text: string;
  is_correct: boolean;
  time_spent_seconds: number;
  hints_requested: number;
  ai_feedback?: string;
  timestamp: string;
}

export type BloomTaxonomyLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface TaskAttempt {
  id?: string;
  user_id: string; // The student UID
  task_id: string; // ID of the solved task
  start_time: string;
  end_time?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  steps_taken: CognitiveTelemetryStep[];
  total_time_spent: number;
  total_hints_used: number;
  mistake_count: number;
  curriculum_topic?: string; // Cache topic for fast aggregation in Factory
  curriculum_topic_id?: string; // Cache of curriculum_refs[0].topic_id for fast aggregation
  tags?: string[];
  cognitive_score?: number; // Calculated field based on hints/time/errors
}

export interface PedagogicalInsight {
  common_pitfalls: string[];
  socratic_questions: string[];
  modern_context_suggestion?: string;
  modeling_scenario?: string;
  teaching_strategy?: string;
  prerequisites?: string[];
  hints?: string[];
  differentiated_learning?: { support: string; extension: string };
  quality_score?: number;
}

/** Една мапирана врска задача → наставна тема (БРО curriculum) */
export interface CurriculumRef {
  education_track: string; // 'primary' | 'secondary_general' | 'secondary_math_info' | 'secondary_vocational'
  grade: string; // '1'..'9' | '1год' | '2год' etc.
  topic_id: string; // e.g. 'mk-7-algebarski-izrazi'
  topic_name: string; // for display
  outcome_codes: string[]; // e.g. ['МА.7.5.2']
  confidence?: number; // 0-1
  source: 'ai' | 'manual';
}

export interface LessonArchitectStep {
  time: string;
  title: string;
  desc: string;
}

export interface LessonArchitectScript {
  socratic_hook: string;
  metaphoric_bridge: string;
  instructional_sequence: LessonArchitectStep[];
}

export interface MathTask {
  id?: string;
  evidence_quote?: string; // ANTI-HALLUCINATION: Exact quote from the source video/doc mapping to this task
  extraction_confidence?: number; // Model self-reported clarity score 1-100 for the source material
  source_timestamp?: string; // The time (e.g. 04:15) or Page (e.g. Page 3) where the task is found
  illustration_prompt?: string; // English prompt ONLY for real-world scenarios (cars, apples, physics situations) via Image AI
  geogebra_commands?: string[]; // Array of GeoGebra commands for geometry and plotting
  math_graphic_config?: any; // JSON config representing geometric or mathematical graphs (triangles, functions)
  type?: 'theory' | 'task';
  title: string;
  original_text: string;
  solution_steps: string[];
  latex_formulas: string[];
  embedding?: number[]; // Vector embedding for semantic search
  source_url: string;
  detected_language?: 'mk' | 'en' | 'tr' | 'al' | string; // Automatic language detection
  tags: string[];
  misconceptions?: { mistake: string; teacher_reaction: string }[];
  difficulty: 'easy' | 'medium' | 'hard';
  dok_level?: number;
  bloom_taxonomy?: BloomTaxonomyLevel;
  grade_level?: string;
  curriculum_topic?: string;
  curriculum_refs?: CurriculumRef[]; // Structured mapping to official БРО curriculum topics
  hints?: string[];
  pedagogical_insights?: PedagogicalInsight;
  author_uid?: string;
  folder_id?: string;
  folder_name?: string;
  created_at?: string;
  teacher_notes?: string; // Teacher's personal opinion, stance, or manual intervention
  related_task_ids?: string[]; // IDs for Knowledge Graph links
  lesson_architect_script?: LessonArchitectScript; // Saved output from Pedagogue Command Center's Lesson Architect tab
  prerequisite_task_ids?: string[]; // Specifically for "Task A is prerequisite forTask B"
  ingestion_snapshot?: {
    source_kind: 'url' | 'text' | 'file' | 'pdf' | 'image';
    parser_path: string;
    highest_severity: 'none' | 'low' | 'medium' | 'high';
    sanitized: boolean;
    finding_ids: string[];
    finding_count: number;
    generated_at: string;
  };
}

export interface Flashcard {
  id?: string;
  front: string;
  back: string;
  task_id?: string;
  user_uid: string;
  next_review?: string;
  interval?: number;
  ease_factor?: number;
  created_at?: string;
}

export interface DailyQuest {
  id: string;
  title: string;
  target: number;
  progress: number;
  completed: boolean;
  xpReward: number;
  type: 'extract' | 'solve' | 'flashcard' | 'login';
}

export interface UserStats {
  uid: string;
  xp: number;
  level: number;
  tasks_completed: number;
  streak: number;
  last_activity?: string;
  badges: string[];
  quests?: {
    date: string;
    items: DailyQuest[];
  };
}

export interface Classroom {
  id?: string;
  name: string;
  description: string;
  teacherId: string;
  inviteCode: string;
  studentIds: string[];
  createdAt: string;
}

export interface Assignment {
  id?: string;
  classroomId: string;
  title: string;
  description: string;
  taskIds: string[];
  dueDate: string;
  createdAt: string;
}

export interface StudentProgress {
  id?: string;
  studentId: string;
  assignmentId: string;
  taskId: string;
  status: 'pending' | 'completed';
  completedAt?: string;
}

export interface KahootParticipant {
  uid: string;
  name: string;
  score: number;
  has_answered_current: boolean;
  current_answer_index?: number;
}

export interface LiveKahootSession {
  id: string; // The 6 digit PIN
  teacher_uid: string;
  quiz_data: any; // The JSON of the quiz
  status: 'lobby' | 'playing' | 'discussion' | 'finished';
  current_question_index: number;
  current_question_start_time?: number; // Epoch ms when the question started
  participants: Record<string, KahootParticipant>;
  created_at: number;
}

export interface SummativeExam {
  id: string;
  teacher_uid: string;
  test_data: any; // MakedoTestDocument
  created_at: number;
  status: 'open' | 'closed';
}

export interface SummativeAttempt {
  id: string;
  exam_id: string;
  student_name: string;
  student_uid: string;
  answers: Record<string, any>; // Map question index to student answer
  submitted_at: number;
  score?: number; // Calculated later by teacher or auto-grader
  anti_cheat?: {
    tab_switches: number;
    time_spent_seconds: number;
  };
}

// MakedoTest Formats
export type MakedoQuestionType = 
  | 'multiple' | 'true-false' | 'fill-blanks' | 'matching' 
  | 'list' | 'short-answer' | 'checklist' | 'table' 
  | 'multi-part' | 'ordering' | 'essay' | 'diagram' 
  | 'statements' | 'selection' | 'multi-match' | 'section';

export interface MakedoQuestion {
  id: string;
  type: MakedoQuestionType;
  text: string;
  options?: string[]; // for multiple, checklist
  correct?: number; // for multiple, true-false (0=True, 1=False)
  corrects?: number[]; // for checklist
  pairs?: { left: string, right: string }[]; // for matching
  items?: any[]; // for list, ordering, statements
  tableData?: any; // for table
  parts?: string[]; // for multi-part
  imageUrl?: string; // for diagram
  matches?: { s: string, a: string }[]; // for multi-match
  points?: number;
  bloom_taxonomy?: string;
  dok_level?: number;
}

export interface MakedoTestDocument {
  id?: string;
  title: string;
  grade_level: string;
  subject: string;
  questions: MakedoQuestion[];
  created_at: string;
  author_uid: string;
}

// ─── Gradebook Types ─────────────────────────────────────────────────────────

/** МК систем на оценување: 1-5 (недоволно, доволно, добро, многу добро, одлично) */
export type MKGrade = 1 | 2 | 3 | 4 | 5;

/** Категории на оцени */
export type GradeCategory = 'test' | 'homework' | 'project' | 'participation' | 'oral' | 'other';

/** Единечен запис за оценка */
export interface GradeEntry {
  id?: string;
  classroomId: string;
  studentId: string;
  studentName: string;
  taskId?: string; // Поврзано со задача од библиотеката
  taskTitle?: string;
  category: GradeCategory;
  grade: MKGrade;
  maxPoints?: number; // За процентуално оценување
  earnedPoints?: number;
  feedback?: string;
  gradedAt: string; // ISO date
  gradedBy: string; // teacher uid
  term: 'I' | 'II' | 'III' | 'IV'; // Четвртине
  schoolYear: string; // пр. "2026/2027"
}

/** Просек по ученик */
export interface StudentAverage {
  studentId: string;
  studentName: string;
  average: number;
  totalGrades: number;
  byCategory: Record<GradeCategory, number>;
  trend: 'improving' | 'stable' | 'declining';
}

/** Цел дневник за одделение */
export interface Gradebook {
  id?: string;
  classroomId: string;
  teacherUid: string;
  schoolYear: string;
  term: 'I' | 'II' | 'III' | 'IV';
  entries: GradeEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Конфигурација за тежини на категории */
export interface GradeWeightConfig {
  test: number; // пр. 0.5 (50%)
  homework: number; // пр. 0.2 (20%)
  project: number; // пр. 0.2 (20%)
  participation: number; // пр. 0.1 (10%)
}

/** Експорт опции */
export interface GradebookExportOptions {
  format: 'excel' | 'pdf' | 'csv';
  includeAverages: boolean;
  includeFeedback: boolean;
  includeTrends: boolean;
  language: 'mk' | 'en' | 'al';
}

// ─── Task Differentiation Types ──────────────────────────────────────────────

/** Ниво на диференцијација */
export type DifferentiationLevel = 'support' | 'core' | 'extension';

/** Ниво на помош (hint) */
export type HintLevel = 1 | 2 | 3;

/** Диференцирана задача */
export interface DifferentiatedTask {
  id?: string;
  baseTaskId: string;
  baseTaskTitle: string;
  level: DifferentiationLevel;
  task: MathTask;
  scaffolding: string[]; // Чекор-по-чекор помош
  hints: {
    level1: string; // Суптилна помош (насока)
    level2: string; // Средна помош (прв чекор)
    level3: string; // Голема помош (речиси решение)
  };
  successCriteria: string[]; // Што значи "успех"
  estimatedTime: number; // минути
  prerequisites: string[]; // Потребни знаења
  createdAt: string;
}

/** Резултат од генерирање на диференцијација */
export interface DifferentiationResult {
  baseTask: MathTask;
  variants: {
    support: DifferentiatedTask;
    core: DifferentiatedTask;
    extension: DifferentiatedTask;
  };
  pedagogicalNotes: string;
  bloomLevel: string;
  dokLevel: number;
}

/** Конфигурација за диференцијација */
export interface DifferentiationConfig {
  generateSupport: boolean;
  generateExtension: boolean;
  includeHints: boolean;
  includeScaffolding: boolean;
  language: 'mk' | 'en' | 'al';
}

// ─── Early Warning System Types ──────────────────────────────────────────────

/** Ниво на ризик */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Фактори за ризик */
export interface RiskFactors {
  decliningGrades: boolean; // Оценките опаѓаат
  missingAssignments: number; // Број на пропуштени задачи
  lowEngagement: boolean; // Ниска активност
  timeSinceLastActivity: number; // Денови од последна активност
  averageGrade: number; // Просечна оценка
  gradeTrend: 'improving' | 'stable' | 'declining';
  attendanceRate?: number; // Процент на присуство (0-100)
  failedTests: number; // Број на паднати тестови (< 2.0)
}

/** Профил на ризик за ученик */
export interface StudentRiskProfile {
  studentId: string;
  studentName: string;
  classroomId: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100 (повисоко = поголем ризик)
  factors: RiskFactors;
  recommendedInterventions: string[];
  lastUpdated: string;
}

/** Интервенција */
export interface Intervention {
  id: string;
  student_id: string;
  student_name: string;
  type: string; // from recommended interventions
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  created_at: string;
  updated_at: string;
  created_by: string; // teacher uid
  completed_at?: string;
  notes?: string;
}

/** Конфигурација за Early Warning */
export interface EarlyWarningConfig {
  // Прагови за ризик
  decliningGradeThreshold: number; // пр. 0.5 (опад за 0.5 оценка)
  missingAssignmentThreshold: number; // пр. 3 (3 пропуштени)
  inactivityDaysThreshold: number; // пр. 7 (7 дена неактивност)
  lowGradeThreshold: number; // пр. 2.5 (под 2.5 е ризик)
  failedTestThreshold: number; // пр. 2 (2 паднати тестови)

  // Тежини за фактори
  weights: {
    decliningGrades: number; // пр. 0.25
    missingAssignments: number; // пр. 0.20
    lowEngagement: number; // пр. 0.20
    lowGrades: number; // пр. 0.25
    failedTests: number; // пр. 0.10
  };
}

/** Резултат од анализа на ризик */
export interface RiskAnalysisResult {
  totalStudents: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  students: StudentRiskProfile[];
  topInterventions: { type: string; count: number }[];
}
