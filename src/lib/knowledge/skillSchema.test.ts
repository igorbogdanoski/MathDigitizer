import { describe, it, expect } from 'vitest';
import {
  MAX_CONCEPTS,
  MAX_MISCONCEPTIONS,
  MAX_TAKEAWAYS,
  buildChapterSkillSchema,
  formatChapterSkill,
  isChapterSkillEmpty,
  normalizeChapterSkill,
} from './skillSchema';

const full = {
  coreIdea: 'Дропките со ист именител се собираат преку броителите.',
  concepts: [{ term: 'Именител', definition: 'Бројот под дропната црта.' }],
  methods: [{ name: 'Собирање со ист именител', whenToUse: 'Кога именителите се еднакви', how: 'Собери ги броителите.' }],
  misconceptions: [{ mistake: 'Ги собира и именителите', why: 'Именителот кажува на колку делови, не колку делови.' }],
  workedExample: '2/5 + 1/5 = 3/5',
  takeaways: ['Проверувај го именителот прво.'],
};

describe('normalizeChapterSkill', () => {
  it('keeps a well-formed response and carries the chapter identity', () => {
    const skill = normalizeChapterSkill(full, 3, 'Дропки');

    expect(skill.chapterIndex).toBe(3);
    expect(skill.chapterTitle).toBe('Дропки');
    expect(skill.concepts).toHaveLength(1);
    expect(skill.misconceptions[0].why).toContain('Именителот');
  });

  it('drops an entry that is missing half of itself', () => {
    // A concept with no definition renders as though the book said nothing
    // about the term — worse than the chapter simply having fewer concepts.
    const skill = normalizeChapterSkill(
      {
        ...full,
        concepts: [
          { term: 'Именител', definition: '' },
          { term: '', definition: 'нешто' },
          { term: 'Броител', definition: 'Бројот над цртата.' },
        ],
        misconceptions: [{ mistake: 'Нешто', why: '   ' }],
      },
      0,
      'Гл',
    );

    expect(skill.concepts.map(c => c.term)).toEqual(['Броител']);
    expect(skill.misconceptions).toEqual([]);
  });

  it('drops a method that names itself instead of saying how', () => {
    const skill = normalizeChapterSkill(
      { ...full, methods: [{ name: 'Собирање', whenToUse: 'Секогаш', how: '' }] },
      0,
      'Гл',
    );
    expect(skill.methods).toEqual([]);
  });

  it('caps each list so one chapter cannot crowd out the rest', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({
      term: `поим${i}`, definition: `значење${i}`,
    }));

    const skill = normalizeChapterSkill(
      {
        ...full,
        concepts: many(MAX_CONCEPTS + 5),
        takeaways: Array.from({ length: MAX_TAKEAWAYS + 4 }, (_, i) => `клуч${i}`),
        misconceptions: Array.from({ length: MAX_MISCONCEPTIONS + 3 }, (_, i) => ({
          mistake: `г${i}`, why: `з${i}`,
        })),
      },
      0,
      'Гл',
    );

    expect(skill.concepts).toHaveLength(MAX_CONCEPTS);
    expect(skill.takeaways).toHaveLength(MAX_TAKEAWAYS);
    expect(skill.misconceptions).toHaveLength(MAX_MISCONCEPTIONS);
  });

  it('survives a response that is nothing like the schema', () => {
    // The parse must not be where a bad model response becomes a crash.
    for (const junk of [null, undefined, 'text', 42, [], { concepts: 'not a list' }]) {
      const skill = normalizeChapterSkill(junk, 0, 'Гл');
      expect(skill.concepts).toEqual([]);
      expect(skill.chapterTitle).toBe('Гл');
    }
  });

  it('keeps an empty worked example rather than inventing one', () => {
    const skill = normalizeChapterSkill({ ...full, workedExample: '' }, 0, 'Гл');
    expect(skill.workedExample).toBe('');
  });
});

describe('isChapterSkillEmpty', () => {
  it('is false when the chapter yielded real content', () => {
    expect(isChapterSkillEmpty(normalizeChapterSkill(full, 0, 'Гл'))).toBe(false);
  });

  it('is true for a chapter that produced only a core idea', () => {
    // Usually a title page or an index that segmentation could not tell from
    // content. Storing it costs a retrieval slot and returns nothing.
    const skill = normalizeChapterSkill({ coreIdea: 'Содржина на книгата.' }, 0, 'Гл');
    expect(isChapterSkillEmpty(skill)).toBe(true);
  });
});

describe('formatChapterSkill', () => {
  it('renders every section the chapter has', () => {
    const rendered = formatChapterSkill(normalizeChapterSkill(full, 0, 'Дропки'));

    expect(rendered).toContain('Дропки');
    expect(rendered).toContain('Типични грешки');
    expect(rendered).toContain('2/5 + 1/5 = 3/5');
  });

  it('omits a section the chapter has nothing for', () => {
    // An empty heading spends tokens teaching the model that blank sections
    // are normal output.
    const rendered = formatChapterSkill(
      normalizeChapterSkill({ ...full, misconceptions: [], workedExample: '' }, 0, 'Гл'),
    );

    expect(rendered).not.toContain('Типични грешки');
    expect(rendered).not.toContain('Решен пример');
  });
});

describe('buildChapterSkillSchema', () => {
  it('requires every section, so a chapter cannot silently return half', () => {
    const schema = buildChapterSkillSchema() as any;

    expect(schema.required).toEqual(
      expect.arrayContaining(['coreIdea', 'concepts', 'methods', 'misconceptions', 'takeaways']),
    );
  });

  it('tells the model not to invent a worked example', () => {
    const schema = buildChapterSkillSchema() as any;
    expect(schema.properties.workedExample.description).toContain('не измислувај');
  });
});
