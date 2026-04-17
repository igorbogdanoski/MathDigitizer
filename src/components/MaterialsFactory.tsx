import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MathTask } from '../lib/schema';
import { BookOpen, FileText, Presentation, Target, FileQuestion, Download, Plus, Search, Filter, CheckSquare, Square, FileJson, FileType, Layers, ClipboardList, GraduationCap, ChevronDown, ChevronUp, X } from 'lucide-react';
import { exportToJson, exportToWord } from '../lib/export';
import { generateDifferentiatedTest } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';

import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export default function MaterialsFactory() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<MathTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('worksheet');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const [isGeneratingDiff, setIsGeneratingDiff] = useState(false);
  const [diffResult, setDiffResult] = useState<{groupA: MathTask[], groupB: MathTask[], groupC: MathTask[]} | null>(null);

  const handleGenerateDifferentiated = async () => {
    if (selectedTasks.size === 0) return;
    setIsGeneratingDiff(true);
    try {
      const tasksToExport = tasks.filter(t => t.id && selectedTasks.has(t.id));
      const result = await generateDifferentiatedTest(tasksToExport);
      setDiffResult(result);
      showToast('Диференцираниот тест е успешно генериран!', 'success');
    } catch (error) {
      console.error("Грешка:", error);
      showToast('Настана грешка при генерирањето. Обидете се повторно.', 'error');
    } finally {
      setIsGeneratingDiff(false);
    }
  };

  const handleExportJson = () => {
    if (selectedTasks.size === 0) return;
    const tasksToExport = tasks.filter(t => t.id && selectedTasks.has(t.id));
    exportToJson(tasksToExport, 'math_materials.json');
    showToast('JSON датотеката е успешно преземена.', 'success');
  };

  const handleExportWord = () => {
    if (selectedTasks.size === 0) return;
    const tasksToExport = tasks.filter(t => t.id && selectedTasks.has(t.id));
    exportToWord(tasksToExport, 'math_materials.doc');
    showToast('Word документот е успешно преземен.', 'success');
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredTasks.map(t => t.id).filter(Boolean) as string[];
    setSelectedTasks(new Set(allFilteredIds));
  };

  const handleClearSelections = () => {
    setSelectedTasks(new Set());
  };

  const toggleTopic = (topic: string) => {
    setCollapsedTopics(prev => ({ ...prev, [topic]: !prev[topic] }));
  };

  const filteredTasks = tasks.filter(task => 
    searchQuery === '' || 
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.original_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const topic = task.curriculum_topic || 'Некатегоризирано';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(task);
    return acc;
  }, {} as Record<string, MathTask[]>);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const q = query(collection(db, 'tasks'), orderBy('created_at', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedTasks = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MathTask[];
        setTasks(fetchedTasks);
      } catch (error) {
        console.error("Грешка при вчитување на задачи:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, []);

  const materialTypes = [
    { id: 'worksheet', name: 'Работен лист', icon: FileText, description: 'Задачи за вежбање на час или домашно', color: 'bg-blue-100 text-blue-700' },
    { id: 'test', name: 'Тест / Проверка', icon: Target, description: 'Оценување со бодови и решенија за наставникот', color: 'bg-red-100 text-red-700' },
    { id: 'collection', name: 'Збирка задачи', icon: BookOpen, description: 'Сеопфатна збирка поделена по теми и тежина', color: 'bg-green-100 text-green-700' },
    { id: 'quiz', name: 'Интерактивен квиз', icon: FileQuestion, description: 'Квиз во живо за учениците (Kahoot стил)', color: 'bg-purple-100 text-purple-700' },
    { id: 'presentation', name: 'Презентација', icon: Presentation, description: 'Слајдови со теорија и задачи за на час', color: 'bg-orange-100 text-orange-700' },
    { id: 'flashcards', name: 'Флешкарти', icon: Layers, description: 'Картички за брзо повторување на концепти', color: 'bg-pink-100 text-pink-700' },
    { id: 'homework', name: 'Домашна работа', icon: ClipboardList, description: 'Задачи за самостојна работа дома', color: 'bg-teal-100 text-teal-700' },
    { id: 'study_guide', name: 'Водич за учење', icon: GraduationCap, description: 'Детален преглед на теорија и клучни задачи', color: 'bg-yellow-100 text-yellow-700' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Работилница за Наставници</h1>
          <p className="text-gray-600">
            Генерирајте готови едукативни материјали од вашата библиотека со задачи.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
          <span className="text-sm text-gray-500">Достапни задачи:</span>
          <span className="font-bold text-indigo-600">{tasks.length}</span>
        </div>
      </div>

      {/* Избор на тип на материјал */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {materialTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected 
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md transform scale-[1.02]' 
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${type.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className={`font-semibold mb-1 ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                {type.name}
              </h3>
              <p className="text-xs text-gray-500 line-clamp-2">
                {type.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Работна површина */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-gray-100 p-4 bg-gray-50/50 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Пребарај задачи..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              Филтри
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              Избери ги сите
            </button>
            <button 
              onClick={handleClearSelections}
              disabled={selectedTasks.size === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <X className="w-4 h-4" />
              Поништи избор
            </button>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <button 
                onClick={handleGenerateDifferentiated}
                disabled={selectedTasks.size === 0 || isGeneratingDiff}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Генерирај Диференциран Тест (3 Групи)"
              >
                {isGeneratingDiff ? (
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Layers className="w-4 h-4" />
                )}
                Диференциран Тест
              </button>
              <button 
                onClick={handleExportJson}
                disabled={selectedTasks.size === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Експортирај како JSON"
              >
                <FileJson className="w-4 h-4" />
                JSON
              </button>
              <button 
                onClick={handleExportWord}
                disabled={selectedTasks.size === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Експортирај како Word документ"
              >
                <FileType className="w-4 h-4" />
                Word
              </button>
              <button 
                disabled={selectedTasks.size === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Download className="w-4 h-4" />
                PDF ({selectedTasks.size})
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-0 flex flex-col bg-gray-50">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Библиотеката е празна</h3>
                <p className="text-gray-500 mb-6">
                  За да креирате едукативни материјали (збирки, тестови, работни листови), прво треба да извлечете и зачувате задачи во вашата библиотека.
                </p>
                <button 
                  onClick={() => navigate('/extract')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Оди кон Екстракција
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                {Object.entries(groupedTasks).map(([topic, topicTasks]) => {
                  const isCollapsed = collapsedTopics[topic];
                  return (
                    <div key={topic} className="space-y-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <button 
                        onClick={() => toggleTopic(topic)}
                        className="w-full flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">{topic}</h3>
                          <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
                            {topicTasks.length} {topicTasks.length === 1 ? 'задача' : 'задачи'}
                          </span>
                        </div>
                        {isCollapsed ? (
                          <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                        )}
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-100">
                              {topicTasks.map((task) => {
                                const isSelected = task.id ? selectedTasks.has(task.id) : false;
                                return (
                                  <div 
                                    key={task.id}
                                    onClick={() => task.id && toggleTaskSelection(task.id)}
                                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                                      isSelected 
                                        ? 'bg-indigo-50/50 border-indigo-300 shadow-sm' 
                                        : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-sm'
                                    }`}
                                  >
                                    <div className="pt-1">
                                      {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-300" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-medium text-gray-900 truncate pr-4">{task.title}</h4>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            task.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                            task.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {task.difficulty === 'easy' ? 'Лесна' : task.difficulty === 'medium' ? 'Средна' : 'Тешка'}
                                          </span>
                                          {task.grade_level && (
                                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                                              {task.grade_level}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-sm text-gray-500 line-clamp-2">{task.original_text}</p>
                                      {task.tags && task.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {task.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                              {tag}
                                            </span>
                                          ))}
                                          {task.tags.length > 3 && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                              +{task.tags.length - 3}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Differentiated Test Results Modal */}
      <AnimatePresence>
        {diffResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-6 h-6 text-purple-600" />
                    Диференциран Тест (Генериран)
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">AI генерираше 3 верзии со различна тежина врз основа на вашите избрани задачи.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => {
                    exportToWord([...diffResult.groupA, ...diffResult.groupB, ...diffResult.groupC], 'differentiated_test.doc');
                  }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    <Download className="w-4 h-4" />
                    Преземи сè (Word)
                  </button>
                  <button onClick={() => setDiffResult(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Group A */}
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                  <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2 border-b border-emerald-200 pb-2">
                    <span className="bg-emerald-200 text-emerald-800 w-6 h-6 rounded-full flex items-center justify-center text-sm">А</span>
                    Група А (Основни)
                  </h3>
                  <div className="space-y-4">
                    {diffResult.groupA.map((task, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg shadow-sm text-sm border border-emerald-100">
                        <div className="font-bold mb-1 text-emerald-900">{idx + 1}. {task.title}</div>
                        <div className="text-slate-700">{task.original_text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group B */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2 border-b border-blue-200 pb-2">
                    <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-sm">Б</span>
                    Група Б (Стандардни)
                  </h3>
                  <div className="space-y-4">
                    {diffResult.groupB.map((task, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg shadow-sm text-sm border border-blue-100">
                        <div className="font-bold mb-1 text-blue-900">{idx + 1}. {task.title}</div>
                        <div className="text-slate-700">{task.original_text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group C */}
                <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
                  <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2 border-b border-purple-200 pb-2">
                    <span className="bg-purple-200 text-purple-800 w-6 h-6 rounded-full flex items-center justify-center text-sm">В</span>
                    Група В (Напредни)
                  </h3>
                  <div className="space-y-4">
                    {diffResult.groupC.map((task, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg shadow-sm text-sm border border-purple-100">
                        <div className="font-bold mb-1 text-purple-900">{idx + 1}. {task.title}</div>
                        <div className="text-slate-700">{task.original_text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
