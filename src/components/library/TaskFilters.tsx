import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, ChevronDown, ArrowUpDown, X, History as HistoryIcon, CheckSquare, Square, FileText, Download, FileSpreadsheet, Plus, BookOpen, Zap, Brain, Loader2, Trash2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { MathTask } from '../../lib/schema';
import { exportToMarkdown, exportToWord } from '../../lib/export';
import { useTaskFilters } from '../../hooks/useTaskFilters';
import { GenerationStyleToggle } from '../GenerationStyleToggle';
import { generateTaskEmbedding } from '../../lib/gemini';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

interface TaskFiltersProps {
  filters: ReturnType<typeof useTaskFilters>;
  tasks: MathTask[];
  isSelectionMode: boolean;
  setIsSelectionMode: (val: boolean) => void;
  selectedForTest: Set<string>;
  setSelectedForTest: (val: Set<string>) => void;
  setShowTestGenerator: (val: boolean) => void;
  setShowWorksheetModal: (val: boolean) => void;
  handleExportCSV: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  filters,
  tasks,
  isSelectionMode,
  setIsSelectionMode,
  selectedForTest,
  setSelectedForTest,
  setShowTestGenerator,
  setShowWorksheetModal,
  handleExportCSV
}) => {
  const {
    searchQuery, setSearchQuery,
    searchMode, setSearchMode,
    isSemanticSearching, setIsSemanticSearching,
    setSemanticQueryEmbedding,
    difficultyFilter, setDifficultyFilter,
    sourceFilter, setSourceFilter,
    tagFilter, setTagFilter,
    gradeFilter, setGradeFilter,
    dokFilter, setDokFilter,
    folderFilter, setFolderFilter,
    allFolders,
    sortDifficulty, setSortDifficulty,
    searchHistory, saveSearchToHistory, setSearchHistory,
    clearFilters,
    allTags, allGrades,
    sortedAndFilteredTasks
  } = filters;

  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isDokDropdownOpen, setIsDokDropdownOpen] = useState(false);
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);
  const { showToast } = useToast();
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const dokDropdownRef = useRef<HTMLDivElement>(null);
  const gradeDropdownRef = useRef<HTMLDivElement>(null);

  const missingEmbeddingsCount = tasks.filter(t => !t.embedding).length;

  const handleGenerateMissingEmbeddings = async () => {
    if (!confirm(`Дали сте сигурни дека сакате да генерирате embeddings за ${missingEmbeddingsCount} задачи? Ова може да потрае и ќе користи квота од АИ.`)) {
      return;
    }
    
    setIsGeneratingEmbeddings(true);
    let successCount = 0;
    
    // We do it sequentially or tiny batches to not hit rate limits easily
    const tasksToProcess = tasks.filter(t => !t.embedding && t.id);
    for (const task of tasksToProcess) {
      try {
        const textToEmbed = `${task.title} ${task.original_text} ${(task.solution_steps || []).join(' ')} ${(task.tags || []).join(' ')} ${task.curriculum_topic || ''}`;
        const embedding = await generateTaskEmbedding(textToEmbed);
        await updateDoc(doc(db, 'tasks', task.id!), { embedding });
        successCount++;
        // Small arbitrary delay
        await new Promise(r => setTimeout(r, 600));
      } catch (err) {
        console.error("Embedding generate failed for task " + task.id, err);
      }
    }
    
    showToast(`Успешно генерирани ${successCount} од ${missingEmbeddingsCount} задачи.`, 'success');
    setIsGeneratingEmbeddings(false);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Дали сте сигурни дека сакате да избришете ${selectedForTest.size} задачи? Оваа акција е неповратна.`)) {
      return;
    }
    for (const taskId of selectedForTest) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
      } catch (err) {
        console.error("Failed to delete task " + taskId, err);
      }
    }
    setSelectedForTest(new Set());
    showToast('Задачите се успешно избришани.', 'success');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
      if (dokDropdownRef.current && !dokDropdownRef.current.contains(event.target as Node)) {
         setIsDokDropdownOpen(false);
      }
      if (gradeDropdownRef.current && !gradeDropdownRef.current.contains(event.target as Node)) {
         setIsGradeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
       setSemanticQueryEmbedding(null);
       return;
    }
    saveSearchToHistory(searchQuery);

    if (searchMode === 'semantic') {
       setIsSemanticSearching(true);
       try {
          const emb = await generateTaskEmbedding(searchQuery);
          setSemanticQueryEmbedding(emb);
       } catch (error) {
          console.error("Failed to fetch embedding", error);
          showToast("Неуспешно генерирање на семантички слика. Пробајте повторно.", 'error');
       } finally {
          setIsSemanticSearching(false);
       }
    }
  };

  return (
    <Card className="mb-6 border-slate-200 shadow-xl shadow-blue-900/5 rounded-[2rem] bg-white dark:bg-slate-800 relative z-10">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6">
          {/* Top Row: Search and Selection Mode */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full max-w-2xl flex flex-col gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  {isSemanticSearching ? (
                     <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  ) : searchMode === 'semantic' ? (
                     <Brain className="w-5 h-5 text-purple-500" />
                  ) : (
                     <Search className="w-5 h-5 text-indigo-400" />
                  )}
                </div>
                <Input
                  type="text"
                  placeholder={searchMode === 'semantic' ? "Семантичко пребарување (пр. задачи со триаголници и Питагорова теорема)..." : "Текстуално пребарување..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-12 h-14 text-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 transition-colors rounded-2xl shadow-inner text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSemanticQueryEmbedding(null); }}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <div className="flex items-center ml-2 border bg-slate-100 rounded-lg max-w-max p-1">
                 <button
                    type="button"
                    onClick={() => { setSearchMode('keyword'); setSemanticQueryEmbedding(null); }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${searchMode === 'keyword' ? 'bg-white text-indigo-700 shadow flex items-center gap-1' : 'text-slate-500 flex items-center gap-1'}`}
                 >
                    <Search className="w-3 h-3" /> Текстуално (Fuzzy)
                 </button>
                 <button
                    type="button"
                    onClick={() => setSearchMode('semantic')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${searchMode === 'semantic' ? 'bg-white text-purple-700 shadow flex items-center gap-1' : 'text-slate-500 flex items-center gap-1'}`}
                    title="Користи Вештачка Интелигенција за пребарување по значење"
                 >
                    <Brain className="w-3 h-3" /> Семантичко
                 </button>
              </div>
              
              {searchMode === 'semantic' && missingEmbeddingsCount > 0 && (
                <div className="flex justify-start ml-2">
                   <button 
                     type="button"
                     onClick={handleGenerateMissingEmbeddings}
                     disabled={isGeneratingEmbeddings}
                     className="text-[10px] text-orange-500 hover:text-orange-700 underline flex items-center gap-1"
                   >
                     {isGeneratingEmbeddings ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                     {isGeneratingEmbeddings ? 'Генерирање: почекајте...' : `Ажурирај ${missingEmbeddingsCount} неиндексирани задачи`}
                   </button>
                </div>
              )}
              
              {/* Search History Dropdown */}
              {searchQuery === '' && searchHistory.length > 0 && (
                <div className="absolute z-20 top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Скорешни пребарувања</span>
                    <button onClick={() => { setSearchHistory([]); localStorage.removeItem('searchHistory'); }} className="text-xs text-slate-400 hover:text-slate-600">Избриши</button>
                  </div>
                  <ul>
                    {searchHistory.map((query, idx) => (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={() => setSearchQuery(query)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <HistoryIcon className="w-4 h-4 text-slate-400" />
                          {query}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={isSelectionMode ? "default" : "outline"}
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) setSelectedForTest(new Set());
                }}
                className={isSelectionMode ? "bg-indigo-600 hover:bg-indigo-700" : ""}
              >
                {isSelectionMode ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                {isSelectionMode ? 'Заврши селекција' : 'Селектирај'}
              </Button>
              
              {!isSelectionMode && (
                <Button
                  variant="outline"
                  onClick={() => document.dispatchEvent(new CustomEvent('open-create-task-modal'))}
                  className="hidden sm:flex border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  title="Креирај задача рачно"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Нова Задача
                </Button>
              )}

              {isSelectionMode && selectedForTest.size > 0 && (
                <div className="flex gap-2 items-center flex-wrap">
                  <Button
                    variant="default"
                    onClick={() => setShowTestGenerator(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Генерирај Тест ({selectedForTest.size})
                  </Button>

                  <Button
                    variant="default"
                    onClick={() => setShowWorksheetModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Работен Лист ({selectedForTest.size})
                  </Button>

                  <Button
                    variant="default"
                    onClick={() => document.dispatchEvent(new CustomEvent('open-lesson-plan-modal'))}
                    className="bg-orange-600 hover:bg-orange-700 hidden lg:flex"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Дневна Подготовка ({selectedForTest.size})
                  </Button>

                  <Button
                    variant="default"
                    onClick={async () => {
                       const evt = new CustomEvent('generate-live-session');
                       document.dispatchEvent(evt);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 hidden lg:flex"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Жива Училница
                  </Button>
                  
                  <Button
                    variant="default"
                    onClick={() => {
                       const evt = new CustomEvent('export-to-flashcards');
                       document.dispatchEvent(evt);
                    }}
                    className="bg-sky-600 hover:bg-sky-700 hidden lg:flex"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Quizlet ({selectedForTest.size})
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleBulkDelete}
                    className="flex text-white bg-red-600 hover:bg-red-700 hover:text-white border-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Избриши ({selectedForTest.size})
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-4 items-end">
             {/* Generation Style - The pedagogical switch */}
             <div className="flex-shrink-0 min-w-[280px]">
                <GenerationStyleToggle />
             </div>

             <div className="flex flex-wrap gap-3 items-center flex-1">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setDifficultyFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${difficultyFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Сите
              </button>
              <button
                onClick={() => setDifficultyFilter('easy')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${difficultyFilter === 'easy' ? 'bg-green-100 text-green-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Лесни
              </button>
              <button
                onClick={() => setDifficultyFilter('medium')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${difficultyFilter === 'medium' ? 'bg-yellow-100 text-yellow-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Средни
              </button>
              <button
                onClick={() => setDifficultyFilter('hard')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${difficultyFilter === 'hard' ? 'bg-red-100 text-red-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Тешки
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${sourceFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Сите Извори
              </button>
              <button
                onClick={() => setSourceFilter('url')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${sourceFilter === 'url' ? 'bg-blue-100 text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                URL/Видео
              </button>
              <button
                onClick={() => setSourceFilter('image')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${sourceFilter === 'image' ? 'bg-purple-100 text-purple-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Слика/Ракопис
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 min-w-[300px]">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              
              <div className="relative w-full sm:w-40">
                <select
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[right_8px_center] bg-[length:16px_16px]"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")' }}
                >
                  <option value="all">Сите Папки</option>
                  {allFolders.map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                </select>
              </div>
              
              <div className="relative w-full sm:flex-1" ref={gradeDropdownRef}>
                <button 
                  onClick={() => setIsGradeDropdownOpen(!isGradeDropdownOpen)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-left flex justify-between items-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="truncate">{gradeFilter.length === 0 ? 'Сите одделенија' : gradeFilter.join(', ')}</span>
                  <ChevronDown className="w-4 h-4 ml-2 opacity-50 flex-shrink-0" />
                </button>
                {isGradeDropdownOpen && (
                  <div className="absolute z-10 top-full left-0 mt-1 w-full sm:w-48 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-slate-100 flex gap-2">
                      <button onClick={() => setGradeFilter(allGrades)} className="text-xs text-blue-600 hover:underline">Селектирај сите</button>
                      <button onClick={() => setGradeFilter([])} className="text-xs text-slate-500 hover:underline">Деселектирај сите</button>
                    </div>
                    {allGrades.map(grade => (
                      <label key={grade} className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={gradeFilter.includes(grade)}
                          onChange={(e) => {
                            if (e.target.checked) setGradeFilter([...gradeFilter, grade]);
                            else setGradeFilter(gradeFilter.filter(g => g !== grade));
                          }}
                          className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">{grade}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="relative w-full sm:flex-1" ref={tagDropdownRef}>
                <button 
                  onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-left flex justify-between items-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="truncate">{tagFilter.length === 0 ? 'Сите области' : tagFilter.join(', ')}</span>
                  <ChevronDown className="w-4 h-4 ml-2 opacity-50 flex-shrink-0" />
                </button>
                {isTagDropdownOpen && (
                  <div className="absolute z-10 top-full left-0 mt-1 w-full sm:w-48 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-slate-100 flex gap-2">
                      <button onClick={() => setTagFilter(allTags)} className="text-xs text-blue-600 hover:underline">Селектирај сите</button>
                      <button onClick={() => setTagFilter([])} className="text-xs text-slate-500 hover:underline">Деселектирај сите</button>
                    </div>
                    {allTags.map(tag => (
                      <label key={tag} className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={tagFilter.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) setTagFilter([...tagFilter, tag]);
                            else setTagFilter(tagFilter.filter(t => t !== tag));
                          }}
                          className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">{tag}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative w-full sm:flex-1" ref={dokDropdownRef}>
                <button 
                  onClick={() => setIsDokDropdownOpen(!isDokDropdownOpen)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-left flex justify-between items-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="truncate">{dokFilter.length === 0 ? 'Сите DoK нивоа' : `${dokFilter.length} избрани`}</span>
                  <ChevronDown className="w-4 h-4 ml-2 opacity-50 flex-shrink-0" />
                </button>
                {isDokDropdownOpen && (
                  <div className="absolute z-10 top-full left-0 mt-1 w-full sm:w-48 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-slate-100 flex gap-2">
                      <button onClick={() => setDokFilter([1,2,3,4])} className="text-xs text-blue-600 hover:underline">Селектирај сите</button>
                      <button onClick={() => setDokFilter([])} className="text-xs text-slate-500 hover:underline">Деселектирај сите</button>
                    </div>
                    {[1, 2, 3, 4].map(level => (
                      <label key={level} className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={dokFilter.includes(level)}
                          onChange={(e) => {
                            if (e.target.checked) setDokFilter([...dokFilter, level]);
                            else setDokFilter(dokFilter.filter(l => l !== level));
                          }}
                          className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">Ниво {level}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                const nextSort = sortDifficulty === 'none' ? 'asc' : sortDifficulty === 'asc' ? 'desc' : 'none';
                setSortDifficulty(nextSort);
              }}
              className="ml-auto"
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Тежина {sortDifficulty === 'asc' ? '↑' : sortDifficulty === 'desc' ? '↓' : ''}
            </Button>

            {(searchQuery || difficultyFilter !== 'all' || sourceFilter !== 'all' || tagFilter.length > 0 || gradeFilter.length > 0 || dokFilter.length > 0 || folderFilter !== 'all' || sortDifficulty !== 'none') && (
              <Button variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4 mr-2" />
                Исчисти филтри
              </Button>
            )}

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => exportToWord(sortedAndFilteredTasks, 'math-tasks.docx')} title="Експортирај во Word (Docx)">
                <FileText className="w-4 h-4 mr-2 text-blue-600" />
                Word
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToMarkdown(sortedAndFilteredTasks)} title="Експортирај во Markdown">
                <Download className="w-4 h-4 mr-2" />
                MD
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV} title="Експортирај во CSV">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                CSV
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
    </Card>
  );
};

