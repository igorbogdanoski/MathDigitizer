import { describe, it, expect } from 'vitest';
import {
  SOLUTION_MARKER,
  formatOcrEditorText,
  parseOcrEditorText,
  buildOcrTaskPayload,
  buildOcrEmbeddingText,
  OCR_CONFIDENCE_WARNING_THRESHOLD,
} from './savePayload';
import { MathTask } from '../../lib/schema';

const task = (over: Partial<MathTask> = {}): Partial<MathTask> => ({
  title: 'Линеарна равенка',
  original_text: 'Реши ја равенката $2x+3=7$.',
  solution_steps: ['Одземи 3: $2x=4$', 'Подели со 2: $x=2$'],
  tags: ['равенки'],
  curriculum_topic: 'Линеарни равенки',
  ...over,
});

describe('formatOcrEditorText', () => {
  it('joins statement and solution with the marker', () => {
    expect(formatOcrEditorText(task())).toBe(
      'Реши ја равенката $2x+3=7$.\n\n' + SOLUTION_MARKER + '\nОдземи 3: $2x=4$\nПодели со 2: $x=2$'
    );
  });

  it('omits the marker when there is no solution', () => {
    expect(formatOcrEditorText(task({ solution_steps: [] }))).toBe('Реши ја равенката $2x+3=7$.');
    expect(formatOcrEditorText(task({ solution_steps: ['  ', ''] }))).toBe('Реши ја равенката $2x+3=7$.');
  });

  it('handles a missing task', () => {
    expect(formatOcrEditorText(null)).toBe('');
  });
});

describe('parseOcrEditorText', () => {
  it('is the exact inverse of formatOcrEditorText', () => {
    const source = task();
    const parsed = parseOcrEditorText(formatOcrEditorText(source));
    expect(parsed.original_text).toBe(source.original_text);
    expect(parsed.solution_steps).toEqual(source.solution_steps);
  });

  it('treats text with no marker as a pure statement', () => {
    const parsed = parseOcrEditorText('Само задача $x=1$');
    expect(parsed.original_text).toBe('Само задача $x=1$');
    expect(parsed.solution_steps).toEqual([]);
  });

  it('recognizes the marker in the other UI languages', () => {
    expect(parseOcrEditorText('Task\n\n**Solution:**\nstep 1').solution_steps).toEqual(['step 1']);
    expect(parseOcrEditorText('Detyra\n\n**Zgjidhja:**\nhapi 1').solution_steps).toEqual(['hapi 1']);
  });

  it('drops blank lines between steps', () => {
    const parsed = parseOcrEditorText(`Задача\n\n${SOLUTION_MARKER}\nЧекор 1\n\n   \nЧекор 2\n`);
    expect(parsed.solution_steps).toEqual(['Чекор 1', 'Чекор 2']);
  });
});

describe('buildOcrTaskPayload', () => {
  it('keeps the solution out of original_text (regression: the two were glued)', () => {
    const source = task();
    const payload = buildOcrTaskPayload(source, formatOcrEditorText(source), { authorUid: 'u1' });

    expect(payload.original_text).toBe('Реши ја равенката $2x+3=7$.');
    expect(payload.original_text).not.toContain('Подели со 2');
    expect(payload.solution_steps).toEqual(['Одземи 3: $2x=4$', 'Подели со 2: $x=2$']);
  });

  it('persists teacher edits to both the statement and the steps', () => {
    const payload = buildOcrTaskPayload(
      task(),
      `Реши ја равенката $3x=9$.\n\n${SOLUTION_MARKER}\nПодели со 3: $x=3$`,
      { authorUid: 'u1' }
    );

    expect(payload.original_text).toBe('Реши ја равенката $3x=9$.');
    expect(payload.solution_steps).toEqual(['Подели со 3: $x=3$']);
  });

  it('keeps the model steps when the editor text carries no solution', () => {
    const payload = buildOcrTaskPayload(task(), 'Само нов текст на задачата', { authorUid: 'u1' });
    expect(payload.original_text).toBe('Само нов текст на задачата');
    expect(payload.solution_steps).toEqual(task().solution_steps);
  });

  it('stamps author and creation time, and carries the embedding when given', () => {
    const payload = buildOcrTaskPayload(task(), formatOcrEditorText(task()), {
      authorUid: 'teacher-9',
      createdAt: '2026-08-23T10:00:00.000Z',
      embedding: [0.1, 0.2],
    });

    expect(payload.author_uid).toBe('teacher-9');
    expect(payload.created_at).toBe('2026-08-23T10:00:00.000Z');
    expect(payload.embedding).toEqual([0.1, 0.2]);
  });

  it('preserves model metadata such as confidence and evidence', () => {
    const payload = buildOcrTaskPayload(
      task({ extraction_confidence: 88, evidence_quote: 'цитат', difficulty: 'easy' }),
      formatOcrEditorText(task()),
      { authorUid: 'u1' }
    );

    expect(payload.extraction_confidence).toBe(88);
    expect(payload.evidence_quote).toBe('цитат');
    expect(payload.difficulty).toBe('easy');
  });

  it('does not add an embedding field when none was generated', () => {
    const payload = buildOcrTaskPayload(task(), 'текст', { authorUid: 'u1' });
    expect('embedding' in payload).toBe(false);
  });
});

describe('buildOcrEmbeddingText', () => {
  it('includes title, statement, steps, tags and topic', () => {
    const text = buildOcrEmbeddingText(task());
    expect(text).toContain('Линеарна равенка');
    expect(text).toContain('2x+3=7');
    expect(text).toContain('Подели со 2');
    expect(text).toContain('равенки');
    expect(text).toContain('Линеарни равенки');
    expect(text).not.toMatch(/\s{2,}/);
  });

  it('survives a task with only a statement', () => {
    expect(buildOcrEmbeddingText({ original_text: 'x' })).toBe('x');
  });
});

describe('OCR_CONFIDENCE_WARNING_THRESHOLD', () => {
  it('matches the extraction badge threshold used elsewhere in the app', () => {
    expect(OCR_CONFIDENCE_WARNING_THRESHOLD).toBe(70);
  });
});
