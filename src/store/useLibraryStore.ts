import { create } from 'zustand';
import { MathTask } from '../lib/schema';

interface LibraryState {
  // Tasks
  tasks: MathTask[];
  setTasks: (tasks: MathTask[]) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;

  // Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  difficultyFilter: string;
  setDifficultyFilter: (filter: string) => void;
  sourceFilter: string;
  setSourceFilter: (filter: string) => void;
  tagFilter: string[];
  setTagFilter: (tags: string[]) => void;
  gradeFilter: string[];
  setGradeFilter: (grades: string[]) => void;
  dokFilter: number[];
  setDokFilter: (doks: number[]) => void;
  sortDifficulty: 'none' | 'asc' | 'desc';
  setSortDifficulty: (sort: 'none' | 'asc' | 'desc') => void;
  searchHistory: string[];
  setSearchHistory: (history: string[]) => void;
  customOrder: string[];
  setCustomOrder: (order: string[]) => void;
  clearFilters: () => void;
  saveSearchToHistory: (query: string) => void;

  // UI State
  zoomedImage: string | null;
  setZoomedImage: (image: string | null) => void;
  collapsedSteps: Record<string, boolean>;
  setCollapsedSteps: (steps: Record<string, boolean>) => void;
  toggleStep: (stepKey: string) => void;
  expandedPrompts: Record<string, boolean>;
  setExpandedPrompts: (prompts: Record<string, boolean>) => void;
  togglePrompt: (id: string) => void;
  copiedFormula: string | null;
  setCopiedFormula: (formula: string | null) => void;
  copiedText: string | null;
  setCopiedText: (text: string | null) => void;
  copiedAllText: string | null;
  setCopiedAllText: (text: string | null) => void;
  draggedTaskId: string | null;
  setDraggedTaskId: (taskId: string | null) => void;
  
  // Selection Mode
  isSelectionMode: boolean;
  setIsSelectionMode: (isSelectionMode: boolean) => void;
  selectedForTest: Set<string>;
  setSelectedForTest: (selected: Set<string>) => void;
  toggleTaskSelection: (taskId: string) => void;
  showTestGenerator: boolean;
  setShowTestGenerator: (show: boolean) => void;
  
  // Active Tasks
  activeTutorTask: MathTask | null;
  setActiveTutorTask: (task: MathTask | null) => void;
  activeGraphTask: MathTask | null;
  setActiveGraphTask: (task: MathTask | null) => void;
  activeSolverTask: MathTask | null;
  setActiveSolverTask: (task: MathTask | null) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  
  // Practice Mode
  practiceMode: Record<string, boolean>;
  setPracticeMode: (mode: Record<string, boolean>) => void;
  practiceTimer: Record<string, number>;
  setPracticeTimer: (timer: Record<string, number>) => void;
  timerActive: Record<string, boolean>;
  setTimerActive: (active: Record<string, boolean>) => void;
  selectedSteps: Record<string, Set<number>>;
  setSelectedSteps: (steps: Record<string, Set<number>>) => void;

  // Actions
  isGeneratingSimilar: Record<string, boolean>;
  setIsGeneratingSimilar: (isGeneratingSimilar: Record<string, boolean>) => void;
  isGeneratingDifferentiated: Record<string, boolean>;
  setIsGeneratingDifferentiated: (isGeneratingDifferentiated: Record<string, boolean>) => void;
  deletingTaskIds: Set<string>;
  setDeletingTaskIds: (deletingTaskIds: Set<string>) => void;
  isGeneratingImage: Record<string, boolean>;
  setIsGeneratingImage: (isGeneratingImage: Record<string, boolean>) => void;
  generatedImages: Record<string, string>;
  setGeneratedImages: (generatedImages: Record<string, string>) => void;
  isGeneratingTagFormulas: Record<string, boolean>;
  setIsGeneratingTagFormulas: (isGeneratingTagFormulas: Record<string, boolean>) => void;
  tagFormulas: Record<string, Record<string, string>>;
  setTagFormulas: (tagFormulas: Record<string, Record<string, string>>) => void;
  isModernizingContext: Record<string, boolean>;
  setIsModernizingContext: (isModernizingContext: Record<string, boolean>) => void;
  isGeneratingConsistency: Record<string, boolean>;
  setIsGeneratingConsistency: (isGeneratingConsistency: Record<string, boolean>) => void;
  isGeneratingPrerequisites: Record<string, boolean>;
  setIsGeneratingPrerequisites: (isGeneratingPrerequisites: Record<string, boolean>) => void;
  generationStyle: 'traditional' | 'real-world' | 'modern';
  setGenerationStyle: (style: 'traditional' | 'real-world' | 'modern') => void;
  isCommandCenterOpen: boolean;
  setIsCommandCenterOpen: (isOpen: boolean) => void;
  editingTask: MathTask | null;
  setEditingTask: (task: MathTask | null) => void;
  onTaskUpdated?: (task: MathTask) => void;
  setOnTaskUpdated: (callback?: (task: MathTask) => void) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  isLoading: true,
  setIsLoading: (isLoading) => set({ isLoading }),

  // Filters
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  difficultyFilter: 'all',
  setDifficultyFilter: (difficultyFilter) => set({ difficultyFilter }),
  sourceFilter: 'all',
  setSourceFilter: (sourceFilter) => set({ sourceFilter }),
  tagFilter: [],
  setTagFilter: (tagFilter) => set({ tagFilter }),
  gradeFilter: [],
  setGradeFilter: (gradeFilter) => set({ gradeFilter }),
  dokFilter: [],
  setDokFilter: (dokFilter) => set({ dokFilter }),
  sortDifficulty: 'none',
  setSortDifficulty: (sortDifficulty) => set({ sortDifficulty }),
  searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
  setSearchHistory: (searchHistory) => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    set({ searchHistory });
  },
  customOrder: JSON.parse(localStorage.getItem('libraryCustomOrder') || '[]'),
  setCustomOrder: (customOrder) => {
    localStorage.setItem('libraryCustomOrder', JSON.stringify(customOrder));
    set({ customOrder });
  },
  clearFilters: () => set({
    searchQuery: '',
    difficultyFilter: 'all',
    sourceFilter: 'all',
    tagFilter: [],
    gradeFilter: [],
    dokFilter: [],
    sortDifficulty: 'none'
  }),
  saveSearchToHistory: (query) => {
    if (!query.trim()) return;
    const { searchHistory } = get();
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 5);
    get().setSearchHistory(newHistory);
  },

  // UI State
  zoomedImage: null,
  setZoomedImage: (zoomedImage) => set({ zoomedImage }),
  collapsedSteps: {},
  setCollapsedSteps: (collapsedSteps) => set({ collapsedSteps }),
  toggleStep: (stepKey) => set(state => ({
    collapsedSteps: { ...state.collapsedSteps, [stepKey]: !state.collapsedSteps[stepKey] }
  })),
  expandedPrompts: {},
  setExpandedPrompts: (expandedPrompts) => set({ expandedPrompts }),
  togglePrompt: (id) => set(state => ({
    expandedPrompts: { ...state.expandedPrompts, [id]: !state.expandedPrompts[id] }
  })),
  copiedFormula: null,
  setCopiedFormula: (copiedFormula) => set({ copiedFormula }),
  copiedText: null,
  setCopiedText: (copiedText) => set({ copiedText }),
  copiedAllText: null,
  setCopiedAllText: (copiedAllText) => set({ copiedAllText }),
  draggedTaskId: null,
  setDraggedTaskId: (draggedTaskId) => set({ draggedTaskId }),

  // Selection Mode
  isSelectionMode: false,
  setIsSelectionMode: (isSelectionMode) => set({ isSelectionMode }),
  selectedForTest: new Set(),
  setSelectedForTest: (selectedForTest) => set({ selectedForTest }),
  toggleTaskSelection: (taskId) => set(state => {
    const next = new Set(state.selectedForTest);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    return { selectedForTest: next };
  }),
  showTestGenerator: false,
  setShowTestGenerator: (showTestGenerator) => set({ showTestGenerator }),

  // Active Tasks
  activeTutorTask: null,
  setActiveTutorTask: (activeTutorTask) => set({ activeTutorTask }),
  activeGraphTask: null,
  setActiveGraphTask: (activeGraphTask) => set({ activeGraphTask }),
  activeSolverTask: null,
  setActiveSolverTask: (activeSolverTask) => set({ activeSolverTask }),
  selectedTaskId: null,
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),

  // Practice Mode
  practiceMode: {},
  setPracticeMode: (practiceMode) => set({ practiceMode }),
  practiceTimer: {},
  setPracticeTimer: (practiceTimer) => set({ practiceTimer }),
  timerActive: {},
  setTimerActive: (timerActive) => set({ timerActive }),
  selectedSteps: {},
  setSelectedSteps: (selectedSteps) => set({ selectedSteps }),

  // Actions
  isGeneratingSimilar: {},
  setIsGeneratingSimilar: (isGeneratingSimilar) => set({ isGeneratingSimilar }),
  isGeneratingDifferentiated: {},
  setIsGeneratingDifferentiated: (isGeneratingDifferentiated) => set({ isGeneratingDifferentiated }),
  deletingTaskIds: new Set(),
  setDeletingTaskIds: (deletingTaskIds) => set({ deletingTaskIds }),
  isGeneratingImage: {},
  setIsGeneratingImage: (isGeneratingImage) => set({ isGeneratingImage }),
  generatedImages: {},
  setGeneratedImages: (generatedImages) => set({ generatedImages }),
  isGeneratingTagFormulas: {},
  setIsGeneratingTagFormulas: (isGeneratingTagFormulas) => set({ isGeneratingTagFormulas }),
  tagFormulas: {},
  setTagFormulas: (tagFormulas) => set({ tagFormulas }),
  isModernizingContext: {},
  setIsModernizingContext: (isModernizingContext) => set({ isModernizingContext }),
  isGeneratingConsistency: {},
  setIsGeneratingConsistency: (isGeneratingConsistency) => set({ isGeneratingConsistency }),
  isGeneratingPrerequisites: {},
  setIsGeneratingPrerequisites: (isGeneratingPrerequisites) => set({ isGeneratingPrerequisites }),
  generationStyle: 'traditional',
  setGenerationStyle: (generationStyle) => set({ generationStyle }),
  isCommandCenterOpen: false,
  setIsCommandCenterOpen: (isCommandCenterOpen) => set({ isCommandCenterOpen }),
  editingTask: null,
  setEditingTask: (editingTask) => set({ editingTask }),
  onTaskUpdated: undefined,
  setOnTaskUpdated: (onTaskUpdated) => set({ onTaskUpdated }),
}));
