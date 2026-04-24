import { useMemo } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';

// Cosine similarity function
function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function useTaskFilters() {
  const store = useLibraryStore();
  const {
    tasks,
    difficultyFilter,
    sourceFilter,
    tagFilter,
    gradeFilter,
    folderFilter,
    dokFilter,
    sortDifficulty,
    searchQuery,
    searchMode,
    semanticQueryEmbedding,
    customOrder
  } = store;

  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap(task => task.tags || []))).sort(), [tasks]);
  const allGrades = useMemo(() => Array.from(new Set(tasks.map(task => task.grade_level).filter(Boolean))).sort(), [tasks]);
  const allFolders = useMemo(() => Array.from(new Set(tasks.map(task => task.folder_name).filter(Boolean))).sort(), [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.map(task => {
      let isMatch = true;
      let semanticScore = 0;

      const matchesDifficulty = difficultyFilter === 'all' || task.difficulty === difficultyFilter;
      const matchesFolder = folderFilter === 'all' || task.folder_name === folderFilter;
      const matchesTag = tagFilter.length === 0 || (task.tags && task.tags.some(tag => tagFilter.includes(tag)));
      const matchesGrade = gradeFilter.length === 0 || (task.grade_level && gradeFilter.includes(task.grade_level));
      const matchesDok = dokFilter.length === 0 || (task.dok_level && dokFilter.includes(task.dok_level));
      
      const matchesSource = sourceFilter === 'all' || 
        (sourceFilter === 'url' && task.source_url && !task.source_url.includes('Слика')) ||
        (sourceFilter === 'image' && task.source_url && task.source_url.includes('Слика'));
      
      if (!(matchesDifficulty && matchesFolder && matchesTag && matchesGrade && matchesDok && matchesSource)) {
         isMatch = false;
      }

      if (isMatch) {
         if (searchMode === 'keyword') {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = 
              searchQuery === '' || 
              task.title.toLowerCase().includes(searchLower) ||
              task.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
              (task.folder_name && task.folder_name.toLowerCase().includes(searchLower)) ||
              task.original_text.toLowerCase().includes(searchLower);
            
            if (!matchesSearch) isMatch = false;
         } else if (searchMode === 'semantic') {
            // Semantic mode logic
            if (semanticQueryEmbedding && task.embedding) {
               semanticScore = cosineSimilarity(semanticQueryEmbedding, task.embedding);
               if (semanticScore < 0.35) { // Set a reasonable threshold for similarity
                  isMatch = false;
               }
            } else if (semanticQueryEmbedding && !task.embedding) {
               // If embedding search is requested, but task has no embedding, we hide it or show at bottom
               // Decided: hide it
               isMatch = false;
            } else if (!semanticQueryEmbedding && searchQuery) {
               // If there is query but embedding not loaded yet, just show all or show nothing till it loads?
               // Hide nothing temporarily
            }
         }
      }

      return { task, isMatch, semanticScore };
    }).filter(t => t.isMatch);
  }, [tasks, difficultyFilter, folderFilter, tagFilter, gradeFilter, dokFilter, sourceFilter, searchQuery, searchMode, semanticQueryEmbedding]);

  const sortedAndFilteredTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // 1. Semantic Score always takes highest priority if semantic search is active & query exists
      if (searchMode === 'semantic' && semanticQueryEmbedding) {
         return b.semanticScore - a.semanticScore;
      }

      // 2. Fall back to standard sorts
      if (sortDifficulty !== 'none') {
        const difficultyScore = { easy: 1, medium: 2, hard: 3 };
        const scoreA = difficultyScore[a.task.difficulty as keyof typeof difficultyScore] || 0;
        const scoreB = difficultyScore[b.task.difficulty as keyof typeof difficultyScore] || 0;
        return sortDifficulty === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      
      if (customOrder.length > 0 && a.task.id && b.task.id) {
        const idxA = customOrder.indexOf(a.task.id);
        const idxB = customOrder.indexOf(b.task.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      
      return 0;
    }).map(t => t.task); // Strip the wrapper object
  }, [filteredTasks, sortDifficulty, customOrder, searchMode, semanticQueryEmbedding]);

  return {
    ...store,
    allTags,
    allGrades,
    allFolders,
    filteredTasks: filteredTasks.map(t => t.task),
    sortedAndFilteredTasks,
  };
}
