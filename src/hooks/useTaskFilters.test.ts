import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTaskFilters } from './useTaskFilters';
import { useLibraryStore } from '../store/useLibraryStore';
import { MathTask } from '../lib/schema';

function makeTask(overrides: Partial<MathTask>): MathTask {
  return {
    title: 'Задача',
    original_text: 'текст',
    solution_steps: [],
    tags: [],
    difficulty: 'medium',
    ...overrides,
  } as MathTask;
}

const TASKS: MathTask[] = [
  makeTask({ id: '1', title: 'Питагорова теорема', original_text: 'Најди ја хипотенузата на правоаголен триаголник', tags: ['геометрија'], difficulty: 'easy', grade_level: 'VIII', source_url: 'https://youtube.com/x' }),
  makeTask({ id: '2', title: 'Квадратна равенка', original_text: 'Реши ја равенката x^2 - 5x + 6 = 0', tags: ['алгебра'], difficulty: 'medium', grade_level: 'IX', source_url: 'Слика' }),
  makeTask({ id: '3', title: 'Интеграли', original_text: 'Пресметај го интегралот на функцијата', tags: ['анализа'], difficulty: 'hard', grade_level: 'IV', embedding: [1, 0, 0] }),
];

describe('useTaskFilters', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      tasks: TASKS,
      difficultyFilter: 'all',
      sourceFilter: 'all',
      tagFilter: [],
      gradeFilter: [],
      folderFilter: 'all',
      dokFilter: [],
      sortDifficulty: 'none',
      searchQuery: '',
      searchMode: 'keyword',
      semanticQueryEmbedding: null,
      customOrder: [],
    });
  });

  it('returns all tasks unfiltered by default', () => {
    const { result } = renderHook(() => useTaskFilters());
    expect(result.current.sortedAndFilteredTasks).toHaveLength(3);
  });

  it('filters by difficulty', () => {
    useLibraryStore.setState({ difficultyFilter: 'easy' });
    const { result } = renderHook(() => useTaskFilters());
    expect(result.current.sortedAndFilteredTasks.map(t => t.id)).toEqual(['1']);
  });

  it('filters by source (image vs url)', () => {
    useLibraryStore.setState({ sourceFilter: 'image' });
    const { result } = renderHook(() => useTaskFilters());
    expect(result.current.sortedAndFilteredTasks.map(t => t.id)).toEqual(['2']);
  });

  it('filters by grade level', () => {
    useLibraryStore.setState({ gradeFilter: ['IX'] });
    const { result } = renderHook(() => useTaskFilters());
    expect(result.current.sortedAndFilteredTasks.map(t => t.id)).toEqual(['2']);
  });

  it('sorts by difficulty ascending and descending', () => {
    useLibraryStore.setState({ sortDifficulty: 'asc' });
    const { result: asc } = renderHook(() => useTaskFilters());
    expect(asc.current.sortedAndFilteredTasks.map(t => t.id)).toEqual(['1', '2', '3']);

    useLibraryStore.setState({ sortDifficulty: 'desc' });
    const { result: desc } = renderHook(() => useTaskFilters());
    expect(desc.current.sortedAndFilteredTasks.map(t => t.id)).toEqual(['3', '2', '1']);
  });

  it('keyword search matches by title via fuzzy search', () => {
    useLibraryStore.setState({ searchMode: 'keyword', searchQuery: 'квадратна' });
    const { result } = renderHook(() => useTaskFilters());
    expect(result.current.sortedAndFilteredTasks.map(t => t.id)).toEqual(['2']);
  });

  it('semantic search only matches tasks above the 0.35 cosine-similarity threshold and with an embedding', () => {
    useLibraryStore.setState({ searchMode: 'semantic', semanticQueryEmbedding: [1, 0, 0] });
    const { result } = renderHook(() => useTaskFilters());
    // Only task 3 has an embedding; identical-vector cosine similarity is 1.0 (>= 0.35 threshold).
    expect(result.current.sortedAndFilteredTasks.map(t => t.id)).toEqual(['3']);
  });

  it('semantic search excludes tasks below the similarity threshold', () => {
    // Orthogonal vector -> cosine similarity 0, below the 0.35 threshold.
    useLibraryStore.setState({ searchMode: 'semantic', semanticQueryEmbedding: [0, 1, 0] });
    const { result } = renderHook(() => useTaskFilters());
    expect(result.current.sortedAndFilteredTasks).toHaveLength(0);
  });

  it('exposes allTags, allGrades and allFolders derived from the task list', () => {
    const { result } = renderHook(() => useTaskFilters());
    expect(result.current.allTags).toEqual(['алгебра', 'анализа', 'геометрија']);
    expect(result.current.allGrades.sort()).toEqual(['IV', 'IX', 'VIII'].sort());
  });
});
