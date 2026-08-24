/**
 * Resolves a grade hint to a canonical curriculum grade token
 * (EXPERT_LEVEL_MASTER_PLAN, 9.4).
 *
 * Retrieval needs to know *which programme* a task belongs to before it can
 * pull the right outcomes. The hint reaching it is not always a clean token:
 * extraction is instructed to return one, but tasks saved earlier, imported
 * material and anything a teacher typed carry `VII одделение`, `7 одд`, or just
 * `7`.
 *
 * The rule is the contract's §3, applied to grades: resolve when the hint says
 * exactly one thing, and return `null` when it does not. `прва година` names
 * four different programmes — gymnasium, мат-инф, and two vocational tracks —
 * and picking one would silently align a task against a programme its students
 * do not follow. Unfiltered retrieval is a worse answer than no filter, but a
 * *wrongly* filtered one is worse still: it looks precise.
 */
import { CURRICULUM_INDEX } from './curriculumIndex';

/** Roman numerals as they appear in the official level labels. */
const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9,
};

/** Macedonian ordinals for the nine primary grades. */
const ORDINAL: Record<string, number> = {
  прво: 1, прва: 1, први: 1,
  второ: 2, втора: 2, втори: 2,
  трето: 3, трета: 3, трети: 3,
  четврто: 4, четврта: 4, четврти: 4,
  петто: 5, петта: 5, петти: 5,
  шесто: 6, шеста: 6, шести: 6,
  седмо: 7, седма: 7, седми: 7,
  осмо: 8, осма: 8, осми: 8,
  деветто: 9, девето: 9, деветта: 9, деветти: 9,
};

let tokens: Set<string> | null = null;

function knownTokens(): ReadonlySet<string> {
  if (!tokens) tokens = new Set(CURRICULUM_INDEX.map(grade => grade.grade));
  return tokens;
}

/**
 * Secondary track markers, in the order a longer marker must win over a shorter.
 *
 * `миг` is bounded by an explicit non-letter test rather than `\b`: in
 * JavaScript `\b` is defined on ASCII word characters, so `\bмиг\b` matches
 * nothing in `II година МИГ` — the boundary it looks for does not exist between
 * a space and a Cyrillic letter.
 */
const TRACK_SUFFIXES: Array<{ match: RegExp; suffix: string }> = [
  { match: /мат[\s-]*инф|(?:^|[^\p{L}])миг(?:[^\p{L}]|$)/u, suffix: '-миг' },
  { match: /стручн\S*\s*2[\s-]*годиш\S*|двогодиш\S*/u, suffix: '-струк2' },
  { match: /стручн\S*\s*3[\s-]*годиш\S*|тригодиш\S*/u, suffix: '-струк3' },
  { match: /стручн\S*\s*4[\s-]*годиш\S*|четиригодиш\S*/u, suffix: '-струк' },
  // Bare `стручно` is the four-year programme — that is how БРО labels it, and
  // `*-струк` was already its key before the shorter tracks were imported.
  // Listed last so an explicit year count always wins.
  { match: /стручн\S*/u, suffix: '-струк' },
];

/**
 * The canonical grade token for a hint, or `null` when the hint does not name
 * exactly one programme.
 *
 * Recognised: a token already (`7`, `1год-миг`), an Arabic or Roman numeral, a
 * Macedonian ordinal, and secondary hints that also name their track.
 *
 * Deliberately unresolved: a secondary year with no track (`прва година`), a
 * gymnasium elective (five share each year and only the subject separates
 * them), and anything else.
 */
export function resolveGradeToken(hint?: string | null): string | null {
  const raw = (hint ?? '').trim();
  if (!raw) return null;

  const known = knownTokens();
  if (known.has(raw)) return raw;

  const text = raw.toLowerCase();

  // An elective names a subject, not just a year; nothing here can tell which.
  if (/изборен|изборн/.test(text)) return null;

  const isSecondary = /година|год|гимназ|стручн|средн/u.test(text);
  const track = TRACK_SUFFIXES.find(entry => entry.match.test(text));

  // The track marker is removed before the year is read. `стручно 3-годишно`
  // carries a 3 that names the programme's length, not the student's year —
  // read left to right it would turn every first-year task into a third-year one.
  const withoutTrack = track ? text.replace(track.match, ' ') : text;

  const number =
    Number(withoutTrack.match(/(?:^|[^\d])(\d)(?:[^\d]|$)/)?.[1]) ||
    ROMAN[withoutTrack.match(/\b(i{1,3}|iv|v|vi{1,3}|ix)\b/)?.[1] ?? ''] ||
    ORDINAL[Object.keys(ORDINAL).find(word => withoutTrack.includes(word)) ?? ''];

  if (!number) return null;

  if (!isSecondary) {
    // Primary runs 1–9; a bare "10" is not a grade in this system.
    const token = String(number);
    return known.has(token) ? token : null;
  }

  if (!track) {
    // `гимназија` alone is the general programme; a bare year is not — four
    // different programmes start with a first year.
    if (!/гимназ/.test(text)) return null;
    const token = `${number}год`;
    return known.has(token) ? token : null;
  }

  const token = `${number}год${track.suffix}`;
  return known.has(token) ? token : null;
}

/**
 * True when the hint resolves to a programme other than this grade's.
 *
 * Retrieval uses this to drop topics rather than to select them: an
 * unresolvable hint filters nothing, which keeps the old behaviour instead of
 * emptying the result set on a grade nobody could name.
 */
export function isOtherGrade(hint: string | null | undefined, gradeToken: string): boolean {
  const resolved = resolveGradeToken(hint);
  return resolved !== null && resolved !== gradeToken;
}
