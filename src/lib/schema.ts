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
  tags?: string[];
  cognitive_score?: number; // Calculated field based on hints/time/errors
}

export interface PedagogicalInsight {
  common_pitfalls: string[]; // List of student pitfalls/red flags
  socratic_questions: string[]; // List of leading questions for teachers
  modern_context_suggestion?: string; // a suggestion for a modern rewrite
  modeling_scenario?: string; // a real-life mathematical modeling scenario
  teaching_strategy?: string; // "Visual area model", "Substitution method", etc.
  prerequisites?: string[]; // ["Properties of powers", "Basic distribution"]
  quality_score?: number; // Score from 1-100 indicating extraction quality
}

export interface MathTask {
  id?: string;
  evidence_quote?: string; // ANTI-HALLUCINATION: Exact quote from the source video/doc mapping to this task
  source_timestamp?: string; // The time (e.g. 04:15) or Page (e.g. Page 3) where the task is found
  nanobanana_prompt?: string; // English prompt for generating an illustration or diagram
  type?: 'theory' | 'task';
  title: string;
  original_text: string;
  solution_steps: string[];
  latex_formulas: string[];
  embedding?: number[]; // Vector embedding for semantic search
  source_url: string;
  detected_language?: 'mk' | 'en' | 'tr' | 'al' | string; // Automatic language detection
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  dok_level?: number;
  bloom_taxonomy?: BloomTaxonomyLevel;
  grade_level?: string;
  curriculum_topic?: string;
  hints?: string[];
  pedagogical_insights?: PedagogicalInsight;
  author_uid?: string;
  folder_id?: string;
  folder_name?: string;
  created_at?: string;
  teacher_notes?: string; // Teacher's personal opinion, stance, or manual intervention
  related_task_ids?: string[]; // IDs for Knowledge Graph links
  prerequisite_task_ids?: string[]; // Specifically for "Task A is prerequisite forTask B"
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
