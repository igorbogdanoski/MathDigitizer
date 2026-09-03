import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pupilsOf, pupilChunks, ownedBy, IN_FILTER_LIMIT } from './teacherScope';

/**
 * A teacher's dashboard must be about that teacher's pupils.
 *
 * It was not. `TeacherDashboard` queried `task_attempts` with no `where`
 * clause — the last 100 attempts in the whole system — so the completion rate,
 * the struggling-pupil list and the alarm that picks a topic for an
 * intervention were all computed from other teachers' classes. The Firestore
 * rule lets any teacher read any attempt, so the query succeeded and the screen
 * looked authoritative.
 */

const classroom = (teacherId: string, studentIds: string[]) => ({ teacherId, studentIds });

describe('the pupils a teacher may see', () => {
  it('gathers them across all of the teacher\'s classrooms', () => {
    expect(pupilsOf([classroom('t1', ['a', 'b']), classroom('t1', ['c'])])).toEqual(['a', 'b', 'c']);
  });

  it('counts a pupil in two classrooms once', () => {
    expect(pupilsOf([classroom('t1', ['a', 'b']), classroom('t1', ['b', 'c'])])).toEqual(['a', 'b', 'c']);
  });

  it('is empty for a teacher with no classrooms', () => {
    expect(pupilsOf([])).toEqual([]);
  });

  it('tolerates a classroom with no pupil list at all', () => {
    expect(pupilsOf([{ teacherId: 't1' }, classroom('t1', ['a'])])).toEqual(['a']);
  });

  it('drops blank ids', () => {
    // A blank id in an `in` filter matches nothing and quietly hides a pupil.
    expect(pupilsOf([classroom('t1', ['a', '', '  ', 'b'])])).toEqual(['a', 'b']);
  });
});

describe('splitting them for Firestore', () => {
  it('keeps each group within the in-filter limit', () => {
    const pupils = Array.from({ length: 71 }, (_, i) => `s${i}`);
    const chunks = pupilChunks([classroom('t1', pupils)]);

    expect(chunks).toHaveLength(3);
    expect(Math.max(...chunks.map(chunk => chunk.length))).toBeLessThanOrEqual(IN_FILTER_LIMIT);
    expect(chunks.flat()).toHaveLength(71);
  });

  it('loses no pupil at a chunk boundary', () => {
    const pupils = Array.from({ length: IN_FILTER_LIMIT * 2 }, (_, i) => `s${i}`);

    expect(new Set(pupilChunks([classroom('t1', pupils)]).flat()).size).toBe(IN_FILTER_LIMIT * 2);
  });

  it('returns nothing for a teacher with no pupils', () => {
    // Which must render an empty dashboard. The bug was that "no pupils" and
    // "every pupil in the system" produced the same screen.
    expect(pupilChunks([])).toEqual([]);
    expect(pupilChunks([classroom('t1', [])])).toEqual([]);
  });
});

describe('ownership', () => {
  it('keeps only this teacher\'s classrooms', () => {
    const mine = classroom('t1', ['a']);
    const theirs = classroom('t2', ['b']);

    expect(ownedBy([mine, theirs], 't1')).toEqual([mine]);
    expect(pupilsOf(ownedBy([mine, theirs], 't1'))).toEqual(['a']);
  });
});

describe('no screen queries attempts across the whole system', () => {
  it('every task_attempts query is filtered', () => {
    // The guard for the actual defect. A `collection(db, "task_attempts")`
    // without a `where` in the same query is the shape that caused it.
    const source = readFileSync('src/components/TeacherDashboard.tsx', 'utf8');

    const queries = [...source.matchAll(/query\(\s*collection\(db,\s*['"]task_attempts['"]\)([\s\S]*?)\n\s*\)/g)];
    expect(queries.length, 'no task_attempts query found — did the file move?').toBeGreaterThan(0);

    for (const [whole, rest] of queries) {
      expect(rest, `unscoped query:\n${whole.slice(0, 200)}`).toMatch(/where\(/);
    }
  });
});
