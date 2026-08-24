import { describe, it, expect } from 'vitest';
import {
  MAX_TEXT_SCORE,
  MIN_TEXT_SCORE,
  TERM_SCORE,
  formatKnowledgeContext,
  rankKnowledge,
} from './retrieval';
import { StoredChapterSkill } from './store';

const chapter = (over: Partial<StoredChapterSkill> = {}): StoredChapterSkill => ({
  chapterIndex: 0,
  chapterTitle: 'Дропки',
  coreIdea: 'Дропките се делови од целина.',
  concepts: [{ term: 'именител', definition: 'Бројот под цртата.' }],
  methods: [],
  misconceptions: [],
  workedExample: '',
  takeaways: ['Проверувај го именителот.'],
  bookId: 'uid:kniga',
  bookTitle: 'Математика 5',
  ownerId: 'uid',
  usage: { basis: 'own_work', declaredBy: 'uid', declaredAt: '2026-08-25T00:00:00.000Z' },
  createdAt: '2026-08-25T00:00:00.000Z',
  outcomeCodes: [],
  ...over,
});

describe('rankKnowledge', () => {
  it('lets an outcome the teacher linked win outright', () => {
    // That link is the only evidence here a person actually asserted. A word
    // appearing in prose must never outrank it.
    const linked = chapter({ chapterIndex: 9, chapterTitle: 'Проценти', outcomeCodes: ['МА.6.2.3'] });
    const wordy = chapter({ chapterIndex: 1, chapterTitle: 'Дропки именител броител' });

    const [best] = rankKnowledge([wordy, linked], {
      text: 'дропки именител броител',
      outcomeCodes: ['МА.6.2.3'],
    });

    expect(best.skill.chapterIndex).toBe(9);
    expect(best.matchedOn).toBe('outcome');
  });

  it('ranks a defined term above the same word in prose', () => {
    // The chapter that defines the term is about it; the other merely mentions it.
    const defines = chapter({ chapterIndex: 2, concepts: [{ term: 'дропка', definition: 'дел од целина' }] });
    const mentions = chapter({ chapterIndex: 3, concepts: [], coreIdea: 'Овде се спомнува дропка накратко.' });

    const ranked = rankKnowledge([mentions, defines], { text: 'дропка' });

    expect(ranked[0].skill.chapterIndex).toBe(2);
    expect(ranked[0].matchedOn).toBe('term');
  });

  it('drops a match too weak to be anything but noise', () => {
    const unrelated = chapter({ chapterTitle: 'Геометриски тела', coreIdea: 'Коцка и квадар.', concepts: [], takeaways: [] });
    expect(rankKnowledge([unrelated], { text: 'логаритамска функција и нејзиниот график' })).toEqual([]);
  });

  it('returns at most the requested number', () => {
    const many = Array.from({ length: 8 }, (_, i) => chapter({ chapterIndex: i }));
    expect(rankKnowledge(many, { text: 'дропки именител' }, 2)).toHaveLength(2);
  });

  it('breaks a score tie by chapter order, so results are stable', () => {
    const a = chapter({ chapterIndex: 5 });
    const b = chapter({ chapterIndex: 2 });

    expect(rankKnowledge([a, b], { text: 'именител' }, 2).map(m => m.skill.chapterIndex))
      .toEqual([2, 5]);
  });

  it('returns nothing for an empty query', () => {
    expect(rankKnowledge([chapter()], { text: '' })).toEqual([]);
    expect(rankKnowledge([chapter()], { text: '   ' })).toEqual([]);
  });

  it('returns nothing when the teacher has no distilled books', () => {
    expect(rankKnowledge([], { text: 'дропки' })).toEqual([]);
  });

  it('scores a text match as the share of query words found', () => {
    const match = rankKnowledge(
      [chapter({ concepts: [], chapterTitle: 'Дропки и делови', coreIdea: '', takeaways: [] })],
      { text: 'дропки делови целина' },
    );

    expect(match[0].score).toBeGreaterThanOrEqual(MIN_TEXT_SCORE * MAX_TEXT_SCORE);
    expect(match[0].matchedOn).toBe('text');
  });

  it('never lets word overlap outrank confirmed evidence', () => {
    // A one-word query scores a perfect hit ratio. The bands exist so that a
    // ratio cannot promote a guess above something a teacher asserted.
    const wordy = chapter({ chapterIndex: 1, concepts: [], coreIdea: 'дропка' });
    const linked = chapter({ chapterIndex: 7, concepts: [], coreIdea: '', outcomeCodes: ['МА.6.2.3'] });

    const ranked = rankKnowledge([wordy, linked], { text: 'дропка', outcomeCodes: ['МА.6.2.3'] }, 2);

    expect(ranked[0].matchedOn).toBe('outcome');
    expect(ranked[1].score).toBeLessThan(TERM_SCORE);
  });
});

describe('formatKnowledgeContext', () => {
  it('is empty when nothing matched, so no heading is spent on nothing', () => {
    expect(formatKnowledgeContext([])).toBe('');
  });

  it('subordinates the textbook to the curriculum in so many words', () => {
    // A model handed two sources with equal billing averages them, and the
    // state curriculum is not the half to compromise.
    const rendered = formatKnowledgeContext(rankKnowledge([chapter()], { text: 'именител' }));

    expect(rendered).toContain('наставната програма');
    expect(rendered).toContain('Математика 5');
    expect(rendered).toContain('Дропки');
  });
});
