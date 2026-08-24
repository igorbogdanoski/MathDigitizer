/**
 * Which school year and quarter a date falls in.
 *
 * `SmartGrader` wrote `schoolYear: '2026/2027'` and `term: 'I'` as literals, so
 * every grade it filed carried the same year and the same quarter regardless of
 * when it was given — wrong from the second quarter of the first year, and
 * wrong about the year itself from September 2027.
 *
 * The boundaries are the ordinary Macedonian school calendar. They are constants
 * rather than a lookup because the ministry publishes the exact dates each year
 * and they move by days, not months; a quarter boundary that is a week out
 * mislabels a handful of grades, while a hardcoded year mislabels all of them.
 * Where the exact decree matters, a teacher sets the term in the gradebook.
 */

export type SchoolTerm = 'I' | 'II' | 'III' | 'IV';

/** The month (1-based) in which a new school year begins. */
export const SCHOOL_YEAR_STARTS_MONTH = 9;

/**
 * First day (month, day) of each quarter.
 *
 * Quarter I opens with the year in September; II around the start of November;
 * III after the winter break; IV in the second half of April.
 */
const QUARTER_STARTS: Array<{ term: SchoolTerm; month: number; day: number }> = [
  { term: 'I', month: 9, day: 1 },
  { term: 'II', month: 11, day: 5 },
  { term: 'III', month: 1, day: 20 },
  { term: 'IV', month: 4, day: 15 },
];

/**
 * The school year a date belongs to, as `2026/2027`.
 *
 * September onwards opens the year named for that calendar year; January to
 * August still belongs to the year that began the previous September.
 */
export function currentSchoolYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startsThisYear = date.getMonth() + 1 >= SCHOOL_YEAR_STARTS_MONTH;
  const first = startsThisYear ? year : year - 1;
  return `${first}/${first + 1}`;
}

/**
 * The quarter a date falls in.
 *
 * July and August are outside teaching. They resolve to `IV`, the quarter that
 * just ended, because work graded over the summer is almost always work from
 * the year that finished — not the one that has not started.
 */
export function currentTerm(date: Date = new Date()): SchoolTerm {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Walk the boundaries in calendar order within the school year.
  const ordered: Array<{ term: SchoolTerm; month: number; day: number }> = [
    QUARTER_STARTS[0], // September
    QUARTER_STARTS[1], // November
    QUARTER_STARTS[2], // January
    QUARTER_STARTS[3], // April
  ];

  const isAutumn = month >= SCHOOL_YEAR_STARTS_MONTH;

  if (isAutumn) {
    const second = ordered[1];
    const afterSecond = month > second.month || (month === second.month && day >= second.day);
    return afterSecond ? 'II' : 'I';
  }

  // January to August: the year is already under way.
  const third = ordered[2];
  const fourth = ordered[3];

  const beforeThird = month < third.month || (month === third.month && day < third.day);
  if (beforeThird) return 'II';

  const afterFourth = month > fourth.month || (month === fourth.month && day >= fourth.day);
  return afterFourth ? 'IV' : 'III';
}
