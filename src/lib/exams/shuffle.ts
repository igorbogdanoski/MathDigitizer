/**
 * Exam fairness helpers (EXPERT_LEVEL_MASTER_PLAN, 5.3).
 *
 * Questions and options are shuffled per student, but *deterministically*: the
 * same student always sees the same paper, so a reload never reorders it and a
 * teacher reviewing a submission sees exactly what the student saw. The seed is
 * derived from the exam and the student, so two students get different papers.
 */

/** FNV-1a — small, fast, and stable across runs and machines. */
export function hashSeed(...parts: string[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

/** mulberry32 — a tiny seeded PRNG; identical sequence for an identical seed. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates driven by a seeded PRNG; never mutates the input. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = createSeededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface ShuffleableQuestion {
  id?: string;
  options?: string[];
  correctIndex?: number;
  [key: string]: unknown;
}

export interface ShuffledQuestion extends ShuffleableQuestion {
  /** Index in the teacher's original ordering — needed to grade and to report. */
  originalIndex: number;
  /**
   * Original option index for each displayed position. Answers are stored as
   * the ORIGINAL index, so the teacher's answer key keeps working no matter how
   * the student's options were arranged.
   */
  optionOrder?: number[];
}

/**
 * Builds one student's paper: questions in a per-student order, and each
 * question's options shuffled with `correctIndex` moved to follow its option.
 */
export function buildStudentPaper<T extends ShuffleableQuestion>(
  questions: readonly T[],
  examId: string,
  studentId: string
): Array<T & ShuffledQuestion> {
  const withIndex = questions.map((question, originalIndex) => ({ ...question, originalIndex }));
  const ordered = seededShuffle(withIndex, hashSeed(examId, studentId, 'questions'));

  return ordered.map(question => {
    if (!Array.isArray(question.options) || question.options.length === 0) {
      return question as T & ShuffledQuestion;
    }

    const seed = hashSeed(examId, studentId, 'options', String(question.id ?? question.originalIndex));
    const positions = seededShuffle(question.options.map((_, i) => i), seed);
    const options = positions.map(i => question.options![i]);

    const correctIndex = typeof question.correctIndex === 'number'
      ? positions.indexOf(question.correctIndex)
      : question.correctIndex;

    return { ...question, options, correctIndex } as T & ShuffledQuestion;
  });
}

/**
 * Section-aware variant for real exam papers.
 *
 * A paper is a flat list where `type: 'section'` rows are headings. Shuffling
 * the whole list would move questions out from under their heading, so each
 * section's questions are shuffled among themselves and the headings stay put.
 */
export function shuffleWithinSections<T extends ShuffleableQuestion & { type?: string }>(
  questions: readonly T[],
  examId: string,
  studentId: string
): Array<T & ShuffledQuestion> {
  const withIndex = questions.map((question, originalIndex) => ({ ...question, originalIndex }));
  const out: Array<T & ShuffledQuestion> = [];
  let buffer: Array<T & ShuffledQuestion> = [];
  let sectionCount = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const seed = hashSeed(examId, studentId, 'section', String(sectionCount));
    out.push(...seededShuffle(buffer, seed).map(q => shuffleOptions(q, examId, studentId)));
    buffer = [];
  };

  for (const question of withIndex as Array<T & ShuffledQuestion>) {
    if (question.type === 'section') {
      flush();
      sectionCount++;
      out.push(question);
      continue;
    }
    buffer.push(question);
  }
  flush();

  return out;
}

function shuffleOptions<T extends ShuffleableQuestion & ShuffledQuestion>(
  question: T,
  examId: string,
  studentId: string
): T {
  if (!Array.isArray(question.options) || question.options.length === 0) return question;

  const seed = hashSeed(examId, studentId, 'options', String(question.id ?? question.originalIndex));
  const positions = seededShuffle(question.options.map((_, i) => i), seed);

  return {
    ...question,
    options: positions.map(i => question.options![i]),
    optionOrder: positions,
    correctIndex: typeof question.correctIndex === 'number'
      ? positions.indexOf(question.correctIndex)
      : question.correctIndex,
  };
}

/**
 * Macedonian 1–5 grade scale.
 * Boundaries follow the usual school thresholds; a score below 50% is a 1.
 */
export const GRADE_THRESHOLDS: Array<{ min: number; grade: 1 | 2 | 3 | 4 | 5 }> = [
  { min: 90, grade: 5 },
  { min: 75, grade: 4 },
  { min: 60, grade: 3 },
  { min: 50, grade: 2 },
  { min: 0, grade: 1 },
];

/** Maps earned points to the 1–5 grade, guarding against a zero-point exam. */
export function pointsToGrade(earned: number, total: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(earned) || !Number.isFinite(total) || total <= 0) return 1;
  const percent = (Math.max(0, earned) / total) * 100;
  return (GRADE_THRESHOLDS.find(t => percent >= t.min)?.grade ?? 1);
}

export type ExamAvailability =
  | { open: true }
  | { open: false; reason: 'not-published' | 'not-started' | 'closed' };

export interface ExamWindow {
  status?: string;
  /**
   * Epoch milliseconds (the stored form — Firestore rules cannot parse date
   * strings). ISO strings are accepted too, for older documents.
   */
  opens_at?: number | string;
  due_at?: number | string;
}

/**
 * Whether a student may open an exam right now.
 *
 * Enforced on the client for the UI and mirrored in Firestore rules — the rules
 * are the real gate, this is what stops the student wasting time on a closed paper.
 */
export function evaluateExamAvailability(exam: ExamWindow, now: Date = new Date()): ExamAvailability {
  if (exam.status && exam.status !== 'published' && exam.status !== 'open') {
    return { open: false, reason: 'not-published' };
  }

  const nowMs = now.getTime();
  const opensAt = parseTime(exam.opens_at);
  if (opensAt !== null && nowMs < opensAt) return { open: false, reason: 'not-started' };

  const dueAt = parseTime(exam.due_at);
  if (dueAt !== null && nowMs > dueAt) return { open: false, reason: 'closed' };

  return { open: true };
}

function parseTime(value?: number | string): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
