/**
 * Finding the right distilled chapter for a task
 * (EXPERT_LEVEL_MASTER_PLAN, 10.1).
 *
 * The whole point of paying the distillation cost once is that retrieval is
 * then cheap: the caller loads one chapter, not a book. Scoring is pure and
 * lives here so it can be tested without Firestore — the fetch is the caller's.
 *
 * This is a teacher's own textbook, not the state curriculum. It is offered to
 * the model as supporting material and never as the outcomes a task must meet;
 * the БРО context keeps that role. Mixing the two would let a publisher's
 * wording arrive dressed as a national standard.
 */
import { StoredChapterSkill } from './store';
import { formatChapterSkill } from './skillSchema';

export interface KnowledgeMatch {
  skill: StoredChapterSkill;
  score: number;
  /** Why it matched, for the UI and for anyone debugging a bad retrieval. */
  matchedOn: 'outcome' | 'term' | 'text';
}

/**
 * Score bands, deliberately non-overlapping.
 *
 * A one-word query makes a text match land at 1.0 on a simple hit ratio, which
 * would tie with — and on a stable sort beat — an outcome the teacher actually
 * confirmed. The evidence types are ordered, so their scores must be too: no
 * amount of word overlap can promote a guess above an assertion.
 */
export const OUTCOME_SCORE = 1;
export const TERM_SCORE = 0.8;
/** Ceiling for a text match, kept below TERM_SCORE. */
export const MAX_TEXT_SCORE = 0.7;

/** Below this, a text match is noise rather than a hit. */
export const MIN_TEXT_SCORE = 0.2;

const words = (text: string): string[] =>
  text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2);

/**
 * Ranks a teacher's distilled chapters against a task.
 *
 * An outcome code the teacher linked wins outright. That link is the one piece
 * of evidence here that a person actually asserted, and a term that merely
 * appears in the text should never outrank it.
 */
export function rankKnowledge(
  skills: readonly StoredChapterSkill[],
  query: { text: string; outcomeCodes?: readonly string[] },
  maxResults = 2,
): KnowledgeMatch[] {
  const queryWords = new Set(words(query.text));
  if (queryWords.size === 0 && !query.outcomeCodes?.length) return [];

  const wanted = new Set(query.outcomeCodes ?? []);
  const matches: KnowledgeMatch[] = [];

  for (const skill of skills) {
    if (wanted.size > 0 && skill.outcomeCodes?.some(code => wanted.has(code))) {
      matches.push({ skill, score: OUTCOME_SCORE, matchedOn: 'outcome' });
      continue;
    }

    // A defined term matching is stronger evidence than the same word turning
    // up in prose: the chapter is *about* that term.
    const terms = skill.concepts.map(c => c.term.toLowerCase());
    if (terms.some(term => queryWords.has(term))) {
      matches.push({ skill, score: TERM_SCORE, matchedOn: 'term' });
      continue;
    }

    const haystack = new Set(
      words([skill.chapterTitle, skill.coreIdea, ...skill.takeaways].join(' ')),
    );
    let hits = 0;
    for (const word of queryWords) if (haystack.has(word)) hits++;

    const overlap = queryWords.size > 0 ? hits / queryWords.size : 0;
    if (overlap >= MIN_TEXT_SCORE) {
      matches.push({ skill, score: overlap * MAX_TEXT_SCORE, matchedOn: 'text' });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || a.skill.chapterIndex - b.skill.chapterIndex)
    .slice(0, maxResults);
}

/**
 * A prompt block for the matched chapters.
 *
 * Labelled as the teacher's own material, explicitly subordinate to the БРО
 * outcomes. A model handed two sources with equal billing will average them,
 * and the state curriculum is not the half to compromise.
 */
export function formatKnowledgeContext(matches: readonly KnowledgeMatch[]): string {
  if (matches.length === 0) return '';

  const lines = [
    '─── БЕЛЕШКИ ОД УЧЕБНИКОТ НА НАСТАВНИКОТ ───',
    'Помошен материјал. Не ги заменува исходите од наставната програма —',
    'ако се разидуваат, важи наставната програма.',
    '',
  ];

  for (const match of matches) {
    lines.push(`[${match.skill.bookTitle}]`);
    lines.push(formatChapterSkill(match.skill));
    lines.push('');
  }

  lines.push('────────────────────────────────────────────');
  return lines.join('\n');
}
