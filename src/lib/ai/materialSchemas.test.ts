import { describe, it, expect } from 'vitest';
import {
  buildMaterialResponseSchema,
  isMaterialEmpty,
  materialKind,
  normalizeMaterial,
} from './materialSchemas';

const quizQuestion = (over: Record<string, unknown> = {}) => ({
  question: 'Колку е $2+2$?',
  options: ['3', '4', '5', '6'],
  correctIndex: 1,
  ...over,
});

describe('materialKind', () => {
  it('maps each material type to its payload shape', () => {
    expect(materialKind('quiz')).toBe('quiz');
    expect(materialKind('flashcards')).toBe('flashcards');
    expect(materialKind('presentation')).toBe('presentation');
    expect(materialKind('worksheet')).toBe('document');
    expect(materialKind('test')).toBe('document');
    expect(materialKind('study_guide')).toBe('document');
  });
});

describe('buildMaterialResponseSchema', () => {
  it('requires the quiz fields the renderer depends on', () => {
    const schema = buildMaterialResponseSchema('quiz') as any;
    expect(schema.required).toContain('questions');
    expect(schema.properties.questions.items.required).toEqual(
      expect.arrayContaining(['question', 'options', 'correctIndex'])
    );
  });

  it('constrains slide types to the rendered set', () => {
    const schema = buildMaterialResponseSchema('presentation') as any;
    expect(schema.properties.slides.items.properties.type.enum).toEqual(['theory', 'example', 'task']);
  });

  it('keeps answerKey optional on documents', () => {
    const schema = buildMaterialResponseSchema('worksheet') as any;
    expect(schema.properties).toHaveProperty('answerKey');
    expect(schema.required).not.toContain('answerKey');
  });
});

describe('normalizeMaterial — quiz', () => {
  it('keeps well-formed questions', () => {
    const material = normalizeMaterial('quiz', { title: 'Квиз', questions: [quizQuestion(), quizQuestion()] });
    expect(material).toMatchObject({ kind: 'quiz', title: 'Квиз' });
    expect((material as any).questions).toHaveLength(2);
  });

  it('drops questions that do not have exactly four options', () => {
    const material = normalizeMaterial('quiz', {
      questions: [quizQuestion(), quizQuestion({ options: ['1', '2'] }), quizQuestion({ options: ['1', '2', '3', '4', '5'] })],
    });
    expect((material as any).questions).toHaveLength(1);
  });

  it('drops questions whose answer index is out of range', () => {
    const material = normalizeMaterial('quiz', {
      questions: [quizQuestion({ correctIndex: 4 }), quizQuestion({ correctIndex: -1 }), quizQuestion()],
    });
    expect((material as any).questions).toHaveLength(1);
  });

  it('drops questions with no text or non-string options', () => {
    const material = normalizeMaterial('quiz', {
      questions: [quizQuestion({ question: '   ' }), quizQuestion({ options: ['a', 'b', 'c', 4] }), quizQuestion()],
    });
    expect((material as any).questions).toHaveLength(1);
  });
});

describe('normalizeMaterial — other shapes', () => {
  it('normalizes flashcards and drops empty sides', () => {
    const material = normalizeMaterial('flashcards', {
      cards: [{ front: 'a', back: 'b' }, { front: 'c', back: '' }, null],
    });
    expect((material as any).cards).toEqual([{ front: 'a', back: 'b' }]);
  });

  it('defaults an unknown slide type to theory', () => {
    const material = normalizeMaterial('presentation', {
      slides: [{ title: 'Вовед', content: 'x', type: 'nonsense' }],
    });
    expect((material as any).slides[0].type).toBe('theory');
  });

  it('keeps sections that have either a heading or content', () => {
    const material = normalizeMaterial('worksheet', {
      sections: [{ heading: 'Дел 1', content: '' }, { heading: '', content: 'текст' }, { heading: '', content: '' }],
    });
    expect((material as any).sections).toHaveLength(2);
  });

  it('carries the answer key when present and omits it when blank', () => {
    expect(normalizeMaterial('test', { sections: [], answerKey: '1) x=2' })).toHaveProperty('answerKey', '1) x=2');
    expect(normalizeMaterial('test', { sections: [], answerKey: '   ' })).not.toHaveProperty('answerKey');
  });
});

describe('normalizeMaterial — malformed payloads', () => {
  it('never throws on garbage from the model', () => {
    for (const payload of [null, undefined, 'text', 42, [], { questions: 'nope' }]) {
      expect(() => normalizeMaterial('quiz', payload)).not.toThrow();
    }
  });

  it('falls back to a default title', () => {
    expect(normalizeMaterial('worksheet', {}).title).toBe('Материјал');
  });
});

describe('isMaterialEmpty', () => {
  it('detects an empty material of every kind', () => {
    expect(isMaterialEmpty(normalizeMaterial('quiz', { questions: [] }))).toBe(true);
    expect(isMaterialEmpty(normalizeMaterial('flashcards', { cards: [] }))).toBe(true);
    expect(isMaterialEmpty(normalizeMaterial('presentation', { slides: [] }))).toBe(true);
    expect(isMaterialEmpty(normalizeMaterial('worksheet', { sections: [] }))).toBe(true);
  });

  it('is false once there is usable content', () => {
    expect(isMaterialEmpty(normalizeMaterial('quiz', { questions: [quizQuestion()] }))).toBe(false);
  });
});
