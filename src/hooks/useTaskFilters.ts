import { useMemo } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import Fuse from 'fuse.js';

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

  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap(task => task.tags || []))).filter((t): t is string => !!t).sort(), [tasks]);
  const allGrades = useMemo(() => Array.from(new Set(tasks.map(task => task.grade_level).filter((g): g is string => !!g))).sort(), [tasks]);
  const allFolders = useMemo(() => Array.from(new Set(tasks.map(task => task.folder_name).filter((f): f is string => !!f))).sort(), [tasks]);

  const fuse = useMemo(() => new Fuse(tasks, {
    keys: ['title', 'original_text', 'tags', 'folder_name'],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    let baseTasks = tasks.map(task => ({ task, isMatch: true, semanticScore: 0, fuseScore: 0 }));

    if (searchMode === 'keyword' && searchQuery.trim() !== '') {
      const results = fuse.search(searchQuery);
      const matchedData = new Map(results.map(r => [r.item.id || r.item.original_text, r]));
      
      baseTasks = baseTasks.map(bt => {
        const key = bt.task.id || bt.task.original_text;
        if (matchedData.has(key)) {
          bt.fuseScore = matchedData.get(key)!.score || 0;
        } else {
          bt.isMatch = false;
        }
        return bt;
      });
    }

    return baseTasks.map(bt => {
      if (!bt.isMatch) return bt;
      
      const { task } = bt;
      const matchesDifficulty = difficultyFilter === 'all' || task.difficulty === difficultyFilter;
      const matchesFolder = folderFilter === 'all' || task.folder_name === folderFilter;
      const matchesTag = tagFilter.length === 0 || (task.tags && task.tags.some(tag => tagFilter.includes(tag)));
      const matchesGrade = gradeFilter.length === 0 || (task.grade_level && gradeFilter.includes(task.grade_level));
      const matchesDok = dokFilter.length === 0 || (task.dok_level && dokFilter.includes(task.dok_level));
      
      const matchesSource = sourceFilter === 'all' || 
        (sourceFilter === 'url' && task.source_url && !task.source_url.includes('Слика')) ||
        (sourceFilter === 'image' && task.source_url && task.source_url.includes('Слика'));
      
      if (!(matchesDifficulty && matchesFolder && matchesTag && matchesGrade && matchesDok && matchesSource)) {
         bt.isMatch = false;
      }

      if (bt.isMatch && searchMode === 'semantic') {
        if (semanticQueryEmbedding && task.embedding) {
           bt.semanticScore = cosineSimilarity(semanticQueryEmbedding, task.embedding);
           if (bt.semanticScore < 0.35) {
              bt.isMatch = false;
           }
        } else if (semanticQueryEmbedding && !task.embedding) {
           bt.isMatch = false;
        }
      }

      return bt;
    }).filter(t => t.isMatch);
  }, [tasks, difficultyFilter, folderFilter, tagFilter, gradeFilter, dokFilter, sourceFilter, searchQuery, searchMode, semanticQueryEmbedding, fuse]);

  const sortedAndFilteredTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // 1. Semantic Score always takes highest priority if semantic search is active & query exists
      if (searchMode === 'semantic' && semanticQueryEmbedding) {
         return b.semanticScore - a.semanticScore;
      }

      // 2. Fuzzy Score
      if (searchMode === 'keyword' && searchQuery.trim() !== '') {
         return a.fuseScore - b.fuseScore; // lower fuse score is better
      }

      // 3. Fall back to standard sorts
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
  }, [filteredTasks, sortDifficulty, customOrder, searchMode, semanticQueryEmbedding, searchQuery]);

  return {
    ...store,
    allTags,
    allGrades,
    allFolders,
    filteredTasks: filteredTasks.map(t => t.task),
    sortedAndFilteredTasks,
  };
}
