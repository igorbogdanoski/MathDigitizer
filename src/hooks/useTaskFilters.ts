import { useMemo } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';

export function useTaskFilters() {
  const store = useLibraryStore();
  const {
    tasks,
    difficultyFilter,
    sourceFilter,
    tagFilter,
    gradeFilter,
    dokFilter,
    sortDifficulty,
    searchQuery,
    customOrder
  } = store;

  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap(task => task.tags || []))).sort(), [tasks]);
  const allGrades = useMemo(() => Array.from(new Set(tasks.map(task => task.grade_level).filter(Boolean))).sort(), [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesDifficulty = difficultyFilter === 'all' || task.difficulty === difficultyFilter;
      const matchesTag = tagFilter.length === 0 || (task.tags && task.tags.some(tag => tagFilter.includes(tag)));
      const matchesGrade = gradeFilter.length === 0 || (task.grade_level && gradeFilter.includes(task.grade_level));
      const matchesDok = dokFilter.length === 0 || (task.dok_level && dokFilter.includes(task.dok_level));
      
      const matchesSource = sourceFilter === 'all' || 
        (sourceFilter === 'url' && task.source_url && !task.source_url.includes('Слика')) ||
        (sourceFilter === 'image' && task.source_url && task.source_url.includes('Слика'));
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        searchQuery === '' || 
        task.title.toLowerCase().includes(searchLower) ||
        task.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
        task.original_text.toLowerCase().includes(searchLower);

      return matchesDifficulty && matchesTag && matchesGrade && matchesDok && matchesSource && matchesSearch;
    });
  }, [tasks, difficultyFilter, tagFilter, gradeFilter, dokFilter, sourceFilter, searchQuery]);

  const sortedAndFilteredTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (sortDifficulty !== 'none') {
        const difficultyScore = { easy: 1, medium: 2, hard: 3 };
        const scoreA = difficultyScore[a.difficulty as keyof typeof difficultyScore] || 0;
        const scoreB = difficultyScore[b.difficulty as keyof typeof difficultyScore] || 0;
        return sortDifficulty === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      
      if (customOrder.length > 0 && a.id && b.id) {
        const idxA = customOrder.indexOf(a.id);
        const idxB = customOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      
      return 0;
    });
  }, [filteredTasks, sortDifficulty, customOrder]);

  return {
    ...store,
    allTags,
    allGrades,
    filteredTasks,
    sortedAndFilteredTasks,
  };
}
