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
  type?: 'theory' | 'task';
  title: string;
  original_text: string;
  solution_steps: string[];
  latex_formulas: string[];
  nanobanana_prompt: string;
  source_url: string;
  source_timestamp?: string; // Add source_timestamp to map directly to YouTube or video segments e.g. [01:35]
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
  participants: Record<string, KahootParticipant>;
  created_at: number;
}
