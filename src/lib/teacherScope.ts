/**
 * Which pupils a teacher's screens are allowed to be about.
 *
 * `TeacherDashboard` used to read `task_attempts` with no `where` clause: the
 * last 100 attempts in the entire system. Every figure on that screen — the
 * completion rate, the "neural weaknesses" list, and the cognitive alarm that
 * chooses which topic to generate an intervention for — was therefore computed
 * from other teachers' pupils, and looked authoritative while doing it. The
 * Firestore rule permits any teacher to read any attempt, so nothing failed.
 *
 * The scoping lives here rather than inline in the component so it can be
 * tested without Firebase, and so the next screen that needs "this teacher's
 * pupils" has one obvious place to get them from.
 */

/** The classroom fields this needs; the full type lives in `schema.ts`. */
export interface ScopedClassroom {
  teacherId?: string;
  studentIds?: string[];
}

/**
 * Firestore rejects an `in` filter with more than 30 values, so a teacher with
 * more pupils than that needs several queries.
 */
export const IN_FILTER_LIMIT = 30;

/** Every distinct pupil across a teacher's classrooms, in a stable order. */
export function pupilsOf(classrooms: readonly ScopedClassroom[]): string[] {
  const seen = new Set<string>();

  for (const classroom of classrooms) {
    for (const id of classroom.studentIds ?? []) {
      // A blank id would widen an `in` filter to nothing useful and, worse,
      // read as "no pupils" downstream, which is the same shape as the bug
      // this module exists to prevent.
      if (typeof id === 'string' && id.trim().length > 0) seen.add(id);
    }
  }

  return [...seen];
}

/**
 * Splits those pupils into groups an `in` filter will accept.
 *
 * An empty result means the teacher has no pupils yet — which must render as
 * an empty dashboard, never as an unfiltered query.
 */
export function pupilChunks(
  classrooms: readonly ScopedClassroom[],
  size = IN_FILTER_LIMIT,
): string[][] {
  const pupils = pupilsOf(classrooms);
  const chunks: string[][] = [];

  for (let i = 0; i < pupils.length; i += size) {
    chunks.push(pupils.slice(i, i + size));
  }

  return chunks;
}

/** Keeps only the classrooms this teacher owns, whatever the query returned. */
export function ownedBy(
  classrooms: readonly ScopedClassroom[],
  teacherId: string,
): ScopedClassroom[] {
  return classrooms.filter(classroom => classroom.teacherId === teacherId);
}
