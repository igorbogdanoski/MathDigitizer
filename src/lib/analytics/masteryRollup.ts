/**
 * Per-БРО-code mastery rollup
 * (EXPERT_LEVEL_MASTER_PLAN, 7.2).
 *
 * Analytics could show an average score per student, which tells a teacher
 * *that* someone struggles but not *with what*. This rolls graded work up by
 * outcome code and by curriculum domain, so the panel can name the weakness in
 * the language of the programme — and, via the vertical progression, name the
 * prerequisite it most likely rests on.
 *
 * Everything here is pure: the analytics view stays a renderer.
 */
import { CurriculumRef } from '../schema';
import { resolveOutcomeCode } from '../curriculumAliases';
import { isCurrentOutcomeCode } from '../curriculumCodes';
import {
  MathDomain,
  DOMAIN_LABELS,
  classifyDomain,
  gradeOfCode,
  prerequisiteStep,
} from './curriculumTaxonomy';

/** One piece of graded evidence: a score, and what it was about. */
export interface GradedEvidence {
  studentId?: string;
  studentName?: string;
  /** 0–100. */
  score: number;
  curriculum_refs?: CurriculumRef[];
  /** Free-text topic, used when the work was never classified. */
  curriculum_topic?: string;
  created_at?: string;
}

export interface CodeMastery {
  code: string;
  /** Outcome text, when the evidence carried it. */
  label: string;
  grade: string | null;
  domain: MathDomain | null;
  attempts: number;
  averageScore: number;
  /** Lowest single score seen — a red flag even when the average looks fine. */
  worstScore: number;
}

export interface DomainMastery {
  domain: MathDomain;
  label: string;
  attempts: number;
  averageScore: number;
  /** Codes inside this domain, weakest first. */
  codes: CodeMastery[];
  /** Grades this evidence came from, so the prerequisite lookup has a target. */
  grades: string[];
}

export interface MasteryRollup {
  /** Domains with evidence, weakest average first. */
  domains: DomainMastery[];
  codes: CodeMastery[];
  /** Graded work that carried no curriculum reference at all. */
  unclassifiedCount: number;
  totalEvidence: number;
  /**
   * Codes tagged before the 9.1 corpus repair that stood for several unrelated
   * outcomes at once. Their evidence is counted in `totalEvidence` but not
   * under any code: nothing in the saved ref says which outcome was meant, and
   * attributing it to one of them would put a number on a school's screen that
   * nobody can defend. Surfacing them is how a teacher knows to re-tag.
   */
  ambiguousLegacyCodes: string[];
}

const clampScore = (value: unknown): number | null => {
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.min(100, Math.max(0, score));
};

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * Rolls a set of graded submissions up by outcome code and domain.
 *
 * Work with no `curriculum_refs` is counted as unclassified rather than being
 * folded in under a guessed code — an analytics panel that invents attribution
 * is worse than one that admits the gap.
 */
export function buildMasteryRollup(evidence: readonly GradedEvidence[]): MasteryRollup {
  interface Accumulator {
    label: string;
    grade: string | null;
    domain: MathDomain | null;
    scores: number[];
  }

  const byCode = new Map<string, Accumulator>();
  const ambiguous = new Set<string>();
  let unclassifiedCount = 0;
  let totalEvidence = 0;

  for (const item of evidence) {
    const score = clampScore(item?.score);
    if (score === null) continue;
    totalEvidence++;

    const refs = Array.isArray(item.curriculum_refs) ? item.curriculum_refs : [];
    const codes = refs.flatMap(ref =>
      (ref?.outcome_codes ?? []).map(code => ({ code, ref }))
    ).filter(entry => typeof entry.code === 'string' && entry.code.trim());

    if (codes.length === 0) {
      unclassifiedCount++;
      continue;
    }

    for (const { code: tagged, ref } of codes) {
      // A ref saved before the 9.1 repair may name a code that was renumbered.
      // Following the alias recovers that evidence; without it the work simply
      // vanished from the rollup while still counting toward totalEvidence.
      const resolved = resolveOutcomeCode(tagged, isCurrentOutcomeCode);
      if (resolved.status === 'ambiguous') {
        ambiguous.add(resolved.code);
        continue;
      }
      const code = resolved.code;

      let acc = byCode.get(code);
      if (!acc) {
        acc = {
          label: ref?.topic_name?.trim() || item.curriculum_topic?.trim() || code,
          grade: gradeOfCode(code) ?? ref?.grade ?? null,
          domain: classifyDomain(ref?.topic_name || item.curriculum_topic || '', []),
          scores: [],
        };
        byCode.set(code, acc);
      }
      acc.scores.push(score);
    }
  }

  const codes: CodeMastery[] = [...byCode.entries()]
    .map(([code, acc]) => ({
      code,
      label: acc.label,
      grade: acc.grade,
      domain: acc.domain,
      attempts: acc.scores.length,
      averageScore: round(acc.scores.reduce((sum, s) => sum + s, 0) / acc.scores.length),
      worstScore: Math.min(...acc.scores),
    }))
    .sort((a, b) => a.averageScore - b.averageScore || a.code.localeCompare(b.code));

  const byDomain = new Map<MathDomain, CodeMastery[]>();
  for (const code of codes) {
    if (!code.domain) continue;
    const list = byDomain.get(code.domain) ?? [];
    list.push(code);
    byDomain.set(code.domain, list);
  }

  const domains: DomainMastery[] = [...byDomain.entries()]
    .map(([domain, domainCodes]) => {
      const attempts = domainCodes.reduce((sum, c) => sum + c.attempts, 0);
      // Weighted by attempts, so one lucky answer does not lift a whole domain.
      const weighted = domainCodes.reduce((sum, c) => sum + c.averageScore * c.attempts, 0);

      return {
        domain,
        label: DOMAIN_LABELS[domain],
        attempts,
        averageScore: round(weighted / attempts),
        codes: domainCodes,
        grades: [...new Set(domainCodes.map(c => c.grade).filter(Boolean) as string[])].sort(),
      };
    })
    .sort((a, b) => a.averageScore - b.averageScore);

  return {
    domains,
    codes,
    unclassifiedCount,
    totalEvidence,
    ambiguousLegacyCodes: [...ambiguous].sort(),
  };
}

export interface WeaknessInsight {
  domain: MathDomain;
  label: string;
  averageScore: number;
  attempts: number;
  /** Weakest codes inside this domain. */
  codes: CodeMastery[];
  /** The prerequisite this weakness most likely rests on, when known. */
  prerequisite: { grade: string; concepts: string; outcomes: string } | null;
}

/** Below this average, a domain is reported as a weakness. */
export const WEAKNESS_THRESHOLD = 60;
/** Fewer attempts than this and the signal is too thin to act on. */
export const MIN_EVIDENCE = 3;

/**
 * Domains worth a teacher's attention, each with the prerequisite step to
 * revisit. Domains with too little evidence are left out rather than reported
 * on the strength of one or two answers.
 */
export function findWeaknesses(
  rollup: MasteryRollup,
  options: { threshold?: number; minEvidence?: number; limit?: number } = {}
): WeaknessInsight[] {
  const {
    threshold = WEAKNESS_THRESHOLD,
    minEvidence = MIN_EVIDENCE,
    limit = 3,
  } = options;

  return rollup.domains
    .filter(d => d.attempts >= minEvidence && d.averageScore < threshold)
    .slice(0, limit)
    .map(d => {
      // Point at the highest grade seen — that is the work they are doing now.
      const grade = d.grades[d.grades.length - 1] ?? null;
      const step = grade ? prerequisiteStep(d.domain, grade) : null;

      return {
        domain: d.domain,
        label: d.label,
        averageScore: d.averageScore,
        attempts: d.attempts,
        codes: d.codes.slice(0, 3),
        prerequisite: step ? { grade: step.grade, concepts: step.concepts, outcomes: step.outcomes } : null,
      };
    });
}

/** Rollup restricted to one student, for the per-student panel. */
export function rollupForStudent(evidence: readonly GradedEvidence[], studentId: string): MasteryRollup {
  return buildMasteryRollup(evidence.filter(item => item.studentId === studentId));
}

/**
 * Share of graded work that carries a curriculum reference.
 *
 * Surfaced in the UI: a rollup built on 20% coverage is a hint, not a finding,
 * and the teacher should be told which it is.
 */
export function classificationCoverage(rollup: MasteryRollup): number {
  if (rollup.totalEvidence === 0) return 0;
  return round(((rollup.totalEvidence - rollup.unclassifiedCount) / rollup.totalEvidence) * 100);
}
