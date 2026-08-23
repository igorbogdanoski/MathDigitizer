import { describe, it, expect } from 'vitest';
import {
  hashSeed,
  createSeededRandom,
  seededShuffle,
  buildStudentPaper,
  shuffleWithinSections,
  pointsToGrade,
  evaluateExamAvailability,
} from './shuffle';

const questions = [
  { id: 'q1', text: 'A', options: ['a1', 'a2', 'a3', 'a4'], correctIndex: 0 },
  { id: 'q2', text: 'B', options: ['b1', 'b2', 'b3', 'b4'], correctIndex: 2 },
  { id: 'q3', text: 'C', options: ['c1', 'c2', 'c3', 'c4'], correctIndex: 3 },
  { id: 'q4', text: 'D', options: ['d1', 'd2', 'd3', 'd4'], correctIndex: 1 },
];

describe('hashSeed / createSeededRandom', () => {
  it('is stable for the same inputs', () => {
    expect(hashSeed('exam', 'student')).toBe(hashSeed('exam', 'student'));
  });

  it('separates different inputs', () => {
    expect(hashSeed('exam', 'ana')).not.toBe(hashSeed('exam', 'bojan'));
  });

  it('produces a repeatable sequence in [0,1)', () => {
    const a = Array.from({ length: 5 }, createSeededRandom(42));
    const b = Array.from({ length: 5 }, createSeededRandom(42));
    expect(a).toEqual(b);
    for (const value of a) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('seededShuffle', () => {
  it('keeps every element exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect([...seededShuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });

  it('does not mutate the input', () => {
    const items = [1, 2, 3, 4];
    seededShuffle(items, 7);
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 1)).toEqual(seededShuffle([1, 2, 3, 4, 5], 1));
    expect(seededShuffle([1, 2, 3, 4, 5], 1)).not.toEqual(seededShuffle([1, 2, 3, 4, 5], 2));
  });

  it('handles empty and single-item lists', () => {
    expect(seededShuffle([], 3)).toEqual([]);
    expect(seededShuffle(['only'], 3)).toEqual(['only']);
  });
});

describe('buildStudentPaper', () => {
  it('gives the same student the same paper every time', () => {
    expect(buildStudentPaper(questions, 'exam-1', 'ana')).toEqual(buildStudentPaper(questions, 'exam-1', 'ana'));
  });

  it('gives different students different papers', () => {
    const ana = buildStudentPaper(questions, 'exam-1', 'ana').map(q => q.id);
    const bojan = buildStudentPaper(questions, 'exam-1', 'bojan').map(q => q.id);
    expect(ana).not.toEqual(bojan);
  });

  it('keeps every question exactly once and records its original position', () => {
    const paper = buildStudentPaper(questions, 'exam-1', 'ana');
    expect(paper).toHaveLength(4);
    expect(paper.map(q => q.id).sort()).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(paper.map(q => q.originalIndex).sort()).toEqual([0, 1, 2, 3]);
  });

  it('moves correctIndex to follow the correct option', () => {
    const paper = buildStudentPaper(questions, 'exam-1', 'ana');
    for (const shuffled of paper) {
      const original = questions[shuffled.originalIndex];
      expect(shuffled.options![shuffled.correctIndex!]).toBe(original.options[original.correctIndex]);
    }
  });

  it('keeps all options, just reordered', () => {
    const paper = buildStudentPaper(questions, 'exam-1', 'ana');
    for (const shuffled of paper) {
      const original = questions[shuffled.originalIndex];
      expect([...shuffled.options!].sort()).toEqual([...original.options].sort());
    }
  });

  it('passes through open questions that carry no options', () => {
    const open = [{ id: 'o1', text: 'Докажи...' }, { id: 'o2', text: 'Пресметај...' }];
    const paper = buildStudentPaper(open, 'exam-2', 'ana');
    expect(paper.map(q => q.id).sort()).toEqual(['o1', 'o2']);
    expect(paper[0]).not.toHaveProperty('options');
  });

  it('separates papers across exams for the same student', () => {
    const first = buildStudentPaper(questions, 'exam-1', 'ana').map(q => q.id);
    const second = buildStudentPaper(questions, 'exam-2', 'ana').map(q => q.id);
    expect(first).not.toEqual(second);
  });
});

describe('shuffleWithinSections', () => {
  const paper = [
    { id: 's1', type: 'section', text: 'Дел А' },
    { id: 'a1', text: 'A1' },
    { id: 'a2', text: 'A2' },
    { id: 'a3', text: 'A3' },
    { id: 's2', type: 'section', text: 'Дел Б' },
    { id: 'b1', text: 'B1' },
    { id: 'b2', text: 'B2' },
  ];

  it('keeps section headings in their original positions', () => {
    const shuffled = shuffleWithinSections(paper, 'exam-1', 'ana');
    expect(shuffled[0].id).toBe('s1');
    expect(shuffled[4].id).toBe('s2');
  });

  it('never moves a question out of its section', () => {
    const shuffled = shuffleWithinSections(paper, 'exam-1', 'ana');
    expect(shuffled.slice(1, 4).map(q => q.id).sort()).toEqual(['a1', 'a2', 'a3']);
    expect(shuffled.slice(5).map(q => q.id).sort()).toEqual(['b1', 'b2']);
  });

  it('is deterministic per student and differs across students', () => {
    expect(shuffleWithinSections(paper, 'exam-1', 'ana')).toEqual(shuffleWithinSections(paper, 'exam-1', 'ana'));

    const someoneDiffers = ['bojan', 'cveta', 'dime', 'elena'].some(
      student => shuffleWithinSections(paper, 'exam-1', student).map(q => q.id).join() !==
        shuffleWithinSections(paper, 'exam-1', 'ana').map(q => q.id).join()
    );
    expect(someoneDiffers).toBe(true);
  });

  it('shuffles options and keeps correctIndex pointing at the same answer', () => {
    const withOptions = [
      { id: 's1', type: 'section', text: 'Дел А' },
      { id: 'q1', options: ['w', 'x', 'y', 'z'], correctIndex: 2 },
    ];
    const [, question] = shuffleWithinSections(withOptions, 'exam-1', 'ana');
    expect(question.options![question.correctIndex!]).toBe('y');
  });

  it('exposes the option permutation so answers store the original index', () => {
    const withOptions = [{ id: 'q1', options: ['w', 'x', 'y', 'z'], correctIndex: 2 }];
    const [question] = shuffleWithinSections(withOptions, 'exam-1', 'ana');

    expect(question.optionOrder).toHaveLength(4);
    // Displayed option i is the teacher's option optionOrder[i]
    question.optionOrder!.forEach((original, displayed) => {
      expect(question.options![displayed]).toBe(withOptions[0].options[original]);
    });
    // And the remapped correctIndex agrees with the permutation
    expect(question.optionOrder![question.correctIndex!]).toBe(2);
  });

  it('records the original index so answers can still be graded', () => {
    const shuffled = shuffleWithinSections(paper, 'exam-1', 'ana');
    expect(shuffled.map(q => q.originalIndex).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('handles a paper with no sections at all', () => {
    const flat = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];
    expect(shuffleWithinSections(flat, 'e', 's').map(q => q.id).sort()).toEqual(['q1', 'q2', 'q3']);
  });
});

describe('pointsToGrade', () => {
  it('maps the Macedonian 1-5 scale', () => {
    expect(pointsToGrade(95, 100)).toBe(5);
    expect(pointsToGrade(80, 100)).toBe(4);
    expect(pointsToGrade(65, 100)).toBe(3);
    expect(pointsToGrade(52, 100)).toBe(2);
    expect(pointsToGrade(30, 100)).toBe(1);
  });

  it('is exact on the boundaries', () => {
    expect(pointsToGrade(90, 100)).toBe(5);
    expect(pointsToGrade(89.9, 100)).toBe(4);
    expect(pointsToGrade(50, 100)).toBe(2);
    expect(pointsToGrade(49.9, 100)).toBe(1);
  });

  it('works on any point total, not just 100', () => {
    expect(pointsToGrade(18, 20)).toBe(5);
    expect(pointsToGrade(13, 20)).toBe(3);
  });

  it('never divides by zero or returns garbage', () => {
    expect(pointsToGrade(10, 0)).toBe(1);
    expect(pointsToGrade(NaN, 100)).toBe(1);
    expect(pointsToGrade(-5, 100)).toBe(1);
  });
});

describe('evaluateExamAvailability', () => {
  const now = new Date('2026-08-23T12:00:00.000Z');

  it('opens a published exam inside its window', () => {
    expect(evaluateExamAvailability({
      status: 'published',
      opens_at: '2026-08-23T08:00:00.000Z',
      due_at: '2026-08-23T18:00:00.000Z',
    }, now)).toEqual({ open: true });
  });

  it('blocks a draft exam', () => {
    expect(evaluateExamAvailability({ status: 'draft' }, now)).toEqual({ open: false, reason: 'not-published' });
  });

  it('blocks before the opening time', () => {
    expect(evaluateExamAvailability({ status: 'published', opens_at: '2026-08-23T18:00:00.000Z' }, now))
      .toEqual({ open: false, reason: 'not-started' });
  });

  it('blocks after the deadline', () => {
    expect(evaluateExamAvailability({ status: 'published', due_at: '2026-08-23T08:00:00.000Z' }, now))
      .toEqual({ open: false, reason: 'closed' });
  });

  it('accepts epoch milliseconds, which is the stored form', () => {
    expect(evaluateExamAvailability({
      status: 'open',
      opens_at: Date.parse('2026-08-23T08:00:00.000Z'),
      due_at: Date.parse('2026-08-23T18:00:00.000Z'),
    }, now)).toEqual({ open: true });

    expect(evaluateExamAvailability({ status: 'open', due_at: Date.parse('2026-08-23T08:00:00.000Z') }, now))
      .toEqual({ open: false, reason: 'closed' });
  });

  it('stays open for an exam with no window set (legacy data)', () => {
    expect(evaluateExamAvailability({}, now)).toEqual({ open: true });
  });

  it('ignores unparseable timestamps rather than locking the student out', () => {
    expect(evaluateExamAvailability({ status: 'published', due_at: 'наскоро' }, now)).toEqual({ open: true });
  });
});
