/**
 * Whether an outcome code exists in today's corpus
 * (EXPERT_LEVEL_MASTER_PLAN, 9.3).
 *
 * Answered from the light index rather than the corpus: this only needs to know
 * *whether* a code exists, and pulling 571 KB of outcome prose to answer a set
 * membership question would put it back into every analytics bundle.
 */
import { CURRICULUM_INDEX } from './curriculumIndex';

let codes: Set<string> | null = null;

/** Every outcome code in the corpus. Built once, on first use. */
export function currentOutcomeCodes(): ReadonlySet<string> {
  if (!codes) {
    codes = new Set<string>();
    for (const grade of CURRICULUM_INDEX)
      for (const topic of grade.topics)
        for (const code of topic.outcome_codes) codes.add(code);
  }
  return codes;
}

export function isCurrentOutcomeCode(code: string): boolean {
  return currentOutcomeCodes().has(code);
}
