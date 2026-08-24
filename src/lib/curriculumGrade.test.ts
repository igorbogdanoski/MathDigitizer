import { describe, it, expect } from 'vitest';
import { resolveGradeToken, isOtherGrade } from './curriculumGrade';
import { CURRICULUM_INDEX } from './curriculumIndex';

describe('resolveGradeToken', () => {
  it('passes a canonical token straight through', () => {
    for (const grade of CURRICULUM_INDEX) {
      expect(resolveGradeToken(grade.grade), grade.grade).toBe(grade.grade);
    }
  });

  it('reads the official level labels back to their own token', () => {
    // The labels are what a teacher sees on screen, so they are what gets
    // copied into a free-text field. Every one that names a single programme
    // must resolve to that programme.
    const ambiguousByDesign = (label: string) => /изборен/.test(label);

    const failures = CURRICULUM_INDEX
      .filter(grade => !ambiguousByDesign(grade.level_label))
      .filter(grade => resolveGradeToken(grade.level_label) !== grade.grade)
      .map(grade => `${grade.level_label} -> ${resolveGradeToken(grade.level_label)} (want ${grade.grade})`);

    expect(failures).toEqual([]);
  });

  it('reads primary grades written as digits, romans or words', () => {
    expect(resolveGradeToken('7')).toBe('7');
    expect(resolveGradeToken('VII одделение')).toBe('7');
    expect(resolveGradeToken('седмо одделение')).toBe('7');
    expect(resolveGradeToken('7 одд')).toBe('7');
  });

  it('resolves a secondary year only when the track is named', () => {
    expect(resolveGradeToken('II година гимназија')).toBe('2год');
    expect(resolveGradeToken('II година МИГ')).toBe('2год-миг');
    expect(resolveGradeToken('I година — стручно 3-годишно')).toBe('1год-струк3');
  });

  it('refuses a secondary year with no track', () => {
    // Four programmes have a first year. Choosing one would align a task
    // against a programme the student does not follow — and look deliberate.
    expect(resolveGradeToken('прва година')).toBeNull();
    expect(resolveGradeToken('I година')).toBeNull();
    expect(resolveGradeToken('2 година средно')).toBeNull();
  });

  it('refuses a gymnasium elective', () => {
    // Five electives share their years; only the subject separates them, and a
    // grade hint does not carry a subject.
    expect(resolveGradeToken('II година гимназија — Алгебра (изборен)')).toBeNull();
  });

  it('refuses what it cannot read, rather than guessing', () => {
    expect(resolveGradeToken('')).toBeNull();
    expect(resolveGradeToken(undefined)).toBeNull();
    expect(resolveGradeToken('математика')).toBeNull();
    expect(resolveGradeToken('12 одделение')).toBeNull();
  });
});

describe('isOtherGrade', () => {
  it('excludes a programme the hint names as different', () => {
    expect(isOtherGrade('7', '8')).toBe(true);
    expect(isOtherGrade('VII одделение', '7')).toBe(false);
  });

  it('excludes nothing when the hint cannot be resolved', () => {
    // An unreadable hint must leave retrieval as wide as it was, not empty it.
    expect(isOtherGrade('прва година', '1год')).toBe(false);
    expect(isOtherGrade(undefined, '7')).toBe(false);
  });
});
