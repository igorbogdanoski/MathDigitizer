import { GradedSubmission } from '../../lib/schema';

/**
 * Shared types for the AnalyticsDashboard sub-components.
 */

// Advanced Math Pedagogy Strand descriptor (Kilpatrick et al., "Adding It Up")
export interface MathStrand {
  id: string;
  name: string;
  full: string;
  color: string;
}

/** Aggregated performance stats for a single student. */
export interface StudentStats {
  id: string;
  submissions: GradedSubmission[];
  averageScore: number;
  weaknesses: Record<string, number>;
}

/** Whole-class aggregate stats. */
export interface ClassStats {
  average: number;
}

/** Derived cognitive/pedagogical stats for the currently selected student. */
export interface AdvancedStudentStats {
  velocity: number;
  isStruggling: boolean;
  conceptAvg: number;
  procAvg: number;
  strategic: number;
  adaptive: number;
  disposition: number;
  primaryDeficit: string;
  loadState: string;
  zpdValue: number;
}

/** One radar point of the 5-strand proficiency chart. */
export interface ProficiencyDataPoint {
  subject: string;
  A: number;
  fullMark: number;
}

/** One point of the longitudinal trajectory chart. */
export interface LongitudinalDataPoint {
  name: string;
  score: number;
  concept: number;
  execution: number;
  velocity: number;
  date: string;
}

/** A concept weakness paired with its occurrence count. */
export interface WeaknessEntry {
  concept: string;
  count: number;
}
