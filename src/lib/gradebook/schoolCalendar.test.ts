import { describe, it, expect } from 'vitest';
import { currentSchoolYear, currentTerm } from './schoolCalendar';

const on = (iso: string) => new Date(`${iso}T10:00:00`);

describe('currentSchoolYear', () => {
  it('opens a new year in September', () => {
    expect(currentSchoolYear(on('2026-08-31'))).toBe('2025/2026');
    expect(currentSchoolYear(on('2026-09-01'))).toBe('2026/2027');
  });

  it('keeps the spring in the year that began the previous autumn', () => {
    expect(currentSchoolYear(on('2027-02-14'))).toBe('2026/2027');
    expect(currentSchoolYear(on('2027-06-10'))).toBe('2026/2027');
  });

  it('moves on with the calendar rather than staying at 2026/2027', () => {
    // The literal this replaces would still say 2026/2027 here.
    expect(currentSchoolYear(on('2029-10-01'))).toBe('2029/2030');
    expect(currentSchoolYear(on('2031-03-01'))).toBe('2030/2031');
  });
});

describe('currentTerm', () => {
  it('runs I through IV across a school year', () => {
    expect(currentTerm(on('2026-09-15'))).toBe('I');
    expect(currentTerm(on('2026-10-31'))).toBe('I');
    expect(currentTerm(on('2026-11-20'))).toBe('II');
    expect(currentTerm(on('2026-12-20'))).toBe('II');
    expect(currentTerm(on('2027-01-10'))).toBe('II');
    expect(currentTerm(on('2027-02-10'))).toBe('III');
    expect(currentTerm(on('2027-04-01'))).toBe('III');
    expect(currentTerm(on('2027-05-10'))).toBe('IV');
    expect(currentTerm(on('2027-06-05'))).toBe('IV');
  });

  it('is exact on each boundary', () => {
    expect(currentTerm(on('2026-11-04'))).toBe('I');
    expect(currentTerm(on('2026-11-05'))).toBe('II');
    expect(currentTerm(on('2027-01-19'))).toBe('II');
    expect(currentTerm(on('2027-01-20'))).toBe('III');
    expect(currentTerm(on('2027-04-14'))).toBe('III');
    expect(currentTerm(on('2027-04-15'))).toBe('IV');
  });

  it('files summer work under the quarter that just ended', () => {
    // Work graded in July is work from the year that finished, not the one
    // that has not started.
    expect(currentTerm(on('2027-07-20'))).toBe('IV');
    expect(currentTerm(on('2027-08-25'))).toBe('IV');
  });

  it('returns one of the four quarters for every day of a year', () => {
    const seen = new Set<string>();
    for (let day = 0; day < 365; day++) {
      const date = new Date(2026, 8, 1 + day);
      const term = currentTerm(date);
      expect(['I', 'II', 'III', 'IV'], date.toISOString()).toContain(term);
      seen.add(term);
    }
    expect([...seen].sort()).toEqual(['I', 'II', 'III', 'IV']);
  });
});
