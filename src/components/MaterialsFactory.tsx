import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { MathTask } from '../lib/schema';
import { 
  BookOpen, FileText, Presentation, Target, FileQuestion, Download, Plus, Search, 
  Filter, CheckSquare, Square, FileJson, FileType, Layers, ClipboardList, 
  GraduationCap, ChevronDown, ChevronUp, X, Sparkles, Wand2, ArrowRight
} from 'lucide-react';
import { exportToJson, exportToWord } from '../lib/export';
import { generateDifferentiatedTest, generateEducationalMaterial, MaterialType } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { MaterialPreview } from './MaterialPreview';
import { Button } from './ui/Button';
import { MathRenderer } from './MathRenderer';
import { Edit3, Check, Printer } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../contexts/AuthContext';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';
import { captureError } from '../lib/observability';
import { WorkflowSteps } from './WorkflowSteps';
import { useModalA11y } from '../hooks/useModalA11y';

export default function MaterialsFactory() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userProfile } = useAuth();
  const setEditingTask = useLibraryStore(state => state.setEditingTask);
  const [tasks, setTasks] = useState<MathTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<MaterialType>('worksheet');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const [targetGrade, setTargetGrade] = useState<string>('Сите Одделенија / Мешано');
  const [targetLanguage, setTargetLanguage] = useState<'mk' | 'en' | 'ru' | 'tr'>('mk');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<any>(null);

  const [isGeneratingDiff, setIsGeneratingDiff] = useState(false);
  const [diffResult, setDiffResult] = useState<{groupA: MathTask[], groupB: MathTask[], groupC: MathTask[]} | null>(null);

  const diffResultModalRef = useModalA11y<HTMLDivElement>(() => setDiffResult(null), !!diffResult);

  const handleGenerateMaterial = async () => {
    if (selectedTasks.size === 0) {
      showToast('Ве молам изберете барем една задача од библиотеката.', 'info');
      return;
    }
    
    setIsGenerating(true);
    try {
      const tasksToProcess = tasks.filter(t => t.id && selectedTasks.has(t.id));
      const result = await generateEducationalMaterial(tasksToProcess, selectedType, targetGrade, targetLanguage);
      setGeneratedMaterial(result);
      showToast('Материјалот е успешно генериран!', 'success');
    } catch (error) {
      captureError(error, { name: 'materials.generate', path: '/factory', details: { selectedType, taskCount: selectedTasks.size } });
      showToast('Настана грешка при генерирањето. Обидете се повторно.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDifferentiated = async () => {
    if (selectedTasks.size === 0) return;
    setIsGeneratingDiff(true);
    try {
      const tasksToExport = tasks.filter(t => t.id && selectedTasks.has(t.id));
      const result = await generateDifferentiatedTest(tasksToExport);
      setDiffResult(result);
      showToast('Диференцираниот тест е успешно генериран!', 'success');
    } catch (error) {
      captureError(error, { name: 'materials.differentiated-test', path: '/factory', details: { taskCount: selectedTasks.size } });
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
        captureError(error, { name: 'materials.fetch-tasks', path: '/factory' });
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, []);

  const materialTypes: { id: MaterialType; name: string; icon: any; description: string; color: string; iconBg: string }[] = [
    { id: 'worksheet', name: 'Работен лист', icon: FileText, description: 'Задачи за вежбање на час или домашно', color: 'text-blue-600', iconBg: 'bg-blue-100' },
    { id: 'test', name: 'Тест / Проверка', icon: Target, description: 'Оценување со бодови и решенија за наставникот', color: 'text-rose-600', iconBg: 'bg-rose-100' },
    { id: 'collection', name: 'Збирка задачи', icon: BookOpen, description: 'Сеопфатна збирка поделена по теми и тежина', color: 'text-emerald-600', iconBg: 'bg-emerald-100' },
    { id: 'quiz', name: 'Интерактивен квиз', icon: FileQuestion, description: 'Квиз во живо за учениците (Kahoot стил)', color: 'text-purple-600', iconBg: 'bg-purple-100' },
    { id: 'presentation', name: 'Презентација', icon: Presentation, description: 'Слајдови со теорија и задачи за на час', color: 'text-orange-600', iconBg: 'bg-orange-100' },
    { id: 'flashcards', name: 'Флешкарти', icon: Layers, description: 'Картички за брзо повторување на концепти', color: 'text-pink-600', iconBg: 'bg-pink-100' },
    { id: 'homework', name: 'Домашна работа', icon: ClipboardList, description: 'Задачи за самостојна работа дома', color: 'text-teal-600', iconBg: 'bg-teal-100' },
    { id: 'study_guide', name: 'Водич за учење', icon: GraduationCap, description: 'Детален преглед на теорија и клучни задачи', color: 'text-amber-600', iconBg: 'bg-amber-100' },
  ];

  if (!hasProAccess(userProfile)) {
    return (
      <ProFeatureGate
        featureName="Materials Factory"
        description="Фабриката за материјали е Pro модул. Отклучете го за генерација на работни листови, тестови и презентации на production ниво."
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      <WorkflowSteps current="factory" />

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-6xl bg-slate-900 p-8 md:p-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[100px] -mr-48 -mt-48 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[80px] -ml-32 -mb-32 rounded-full"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
              <span>AI Материјали од Светска Класа</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
              Materials <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Factory</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Трансформирајте ја вашата библиотека со задачи во професионални работни листови, квизови или презентации за неколку секунди со помош на вештачка интелигенција.
            </p>
          </div>
          
          <div className="flex-shrink-0 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 text-center min-w-[200px]">
            <div className="text-4xl font-black text-white mb-1">{tasks.length}</div>
            <div className="text-sm text-slate-400 font-medium uppercase tracking-widest">Достапни задачи</div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-2xl font-bold text-indigo-400">{selectedTasks.size}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Селектирани</div>
            </div>
          </div>
        </div>
      </div>

      {/* Избор на тип на материјал */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">1. Подготовка на материјалот</h2>
        </div>
        
        {/* Settings Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Јазик:</span>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value as any)}
              title="Избери јазик"
              className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="mk">Македонски</option>
              <option value="en">English (Англиски)</option>
              <option value="ru">Русский (Руски)</option>
              <option value="tr">Türkçe (Турски)</option>
            </select>
          </div>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block mx-2"></div>
          
          <div className="flex items-center gap-3">
             <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Одделение / Година:</span>
             <select
               value={targetGrade}
               onChange={(e) => setTargetGrade(e.target.value)}
               title="Избери одделение"
               className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 min-w-40"
             >
               <option value="Сите Одделенија / Мешано">Сите Одделенија / Мешано</option>
               <option value="I Одделение">I Одделение</option>
               <option value="II Одделение">II Одделение</option>
               <option value="III Одделение">III Одделение</option>
               <option value="IV Одделение">IV Одделение</option>
               <option value="V Одделение">V Одделение</option>
               <option value="VI Одделение">VI Одделение</option>
               <option value="VII Одделение">VII Одделение</option>
               <option value="VIII Одделение">VIII Одделение</option>
               <option value="IX Одделение">IX Одделение</option>
               <option value="I Година (Средно)">I Година (Средно)</option>
               <option value="II Година (Средно)">II Година (Средно)</option>
               <option value="III Година (Средно)">III Година (Средно)</option>
               <option value="IV Година (Средно)">IV Година (Средно)</option>
             </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {materialTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            return (
              <motion.button
                key={type.id}
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedType(type.id)}
                className={`p-6 rounded-5xl border-2 text-left transition-all relative overflow-hidden group ${
                  isSelected 
                    ? 'border-indigo-600 bg-white dark:bg-slate-800 shadow-xl ring-4 ring-indigo-500/10' 
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 p-4">
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  </div>
                )}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${type.iconBg} ${type.color}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className={`text-xl font-bold mb-2 transition-colors ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                  {type.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {type.description}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Работна површина */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">2. Изберете задачи од библиотека</h2>
          </div>
          
          <div className="flex items-center gap-3">
             <Button 
                onClick={handleGenerateMaterial}
                disabled={selectedTasks.size === 0 || isGenerating}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 px-8 shadow-lg shadow-indigo-600/20 font-bold text-lg group"
              >
                {isGenerating ? (
                   <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                ) : (
                  <Wand2 className="w-6 h-6 mr-3 group-hover:animate-pulse" />
                )}
                {isGenerating ? 'Се генерира...' : 'Генерирај Материјал'}
              </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-6xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
          {/* Toolbar */}
          <div className="border-b border-slate-100 dark:border-slate-700 p-6 bg-slate-50/50 dark:bg-slate-800/50 flex flex-wrap gap-6 items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Пребарај задачи по наслов или текст..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Filter className="w-4 h-4" />
                Филтри
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl hover:bg-indigo-100 transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                Избери ги сите
              </button>
              <button 
                onClick={handleClearSelections}
                disabled={selectedTasks.size === 0}
                className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Поништи
              </button>
              
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleGenerateDifferentiated}
                  disabled={selectedTasks.size === 0 || isGeneratingDiff}
                  className="w-12 h-12 flex items-center justify-center text-purple-600 bg-purple-50 dark:bg-purple-900/30 rounded-xl hover:bg-purple-100 transition-colors disabled:opacity-50"
                  title="Диференциран Тест"
                >
                  {isGeneratingDiff ? <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div> : <Layers className="w-6 h-6" />}
                </button>
                <button 
                  onClick={handleExportWord}
                  disabled={selectedTasks.size === 0}
                  className="w-12 h-12 flex items-center justify-center text-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
                  title="Word Export"
                >
                  <FileType className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 bg-slate-50/50 dark:bg-slate-900/50">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-slate-500 font-medium">Вчитување на библиотеката...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-6xl flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Библиотеката е празна</h3>
                <p className="text-slate-500 max-w-sm mb-8">
                  За да креирате едукативни материјали, прво треба да дигитализирате задачи со помош на AI екстракција.
                </p>
                <Button 
                  onClick={() => navigate('/extract')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Започни Екстракција
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedTasks).map(([topic, topicTasks]) => {
                  const isCollapsed = collapsedTopics[topic];
                  return (
                    <div key={topic} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <button 
                        onClick={() => toggleTopic(topic)}
                        className="w-full flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 group"
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                            <BookOpen className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{topic}</h3>
                            <p className="text-xs text-slate-500 font-bold">{topicTasks.length} {topicTasks.length === 1 ? 'задача' : 'задачи'}</p>
                          </div>
                        </div>
                        {isCollapsed ? (
                          <ChevronDown className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        ) : (
                          <ChevronUp className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        )}
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white dark:bg-slate-800"
                          >
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {topicTasks.map((task) => {
                                const isSelected = task.id ? selectedTasks.has(task.id) : false;
                                return (
                                  <div 
                                    key={task.id}
                                    onClick={() => task.id && toggleTaskSelection(task.id)}
                                    className={`relative flex flex-col p-5 rounded-2xl border-2 transition-all cursor-pointer group ${
                                      isSelected 
                                        ? 'bg-indigo-50/30 border-indigo-500 dark:bg-indigo-900/10' 
                                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                    }`}
                                  >
                                    <div className="absolute top-4 right-4 animate-in fade-in zoom-in duration-300 flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTask(task);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                        title="Уреди задача"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      {isSelected ? (
                                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                          <CheckSquare className="w-3.5 h-3.5 text-white" />
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-700 group-hover:border-indigo-400"></div>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mb-3 pr-8 text-xs">
                                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                        task.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                        task.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                        'bg-rose-100 text-rose-700'
                                      }`}>
                                        {task.difficulty === 'easy' ? 'Лесна' : task.difficulty === 'medium' ? 'Средна' : 'Тешка'}
                                      </span>
                                      {task.dok_level && (
                                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                                          DOK {task.dok_level}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">{task.title}</h4>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                      <MathRenderer content={task.original_text} />
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
            )}
          </div>
        </div>
      </div>

      {/* Differentiated Test Results Modal */}
      <AnimatePresence>
        {diffResult && (
          <div
            ref={diffResultModalRef}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-6xl shadow-2xl w-full max-w-6xl my-8 border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 items-start">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 text-[10px] font-black uppercase tracking-wider mb-4 border border-purple-500/20">
                     <Layers className="w-3 h-3" />
                     Диференцирана Настава
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Диференциран Тест</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xl">AI генерираше 3 верзии на вашиот тест базирани на когнитивната подготвеност на различни групи ученици.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => window.print()} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold h-14 px-6 rounded-2xl shadow-lg print:hidden">
                    <Printer className="w-5 h-5 mr-2" />
                    Принтај (PDF)
                  </Button>
                  <Button onClick={() => {
                    exportToWord([...diffResult.groupA, ...diffResult.groupB, ...diffResult.groupC], 'differentiated_test.doc');
                  }} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-14 px-8 rounded-2xl shadow-lg print:hidden">
                    <Download className="w-5 h-5 mr-3" />
                    Експорт (Word)
                  </Button>
                  <button onClick={() => setDiffResult(null)} aria-label="Затвори диференциран тест" title="Затвори" className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm print:hidden">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 dark:bg-slate-900 print:block print:w-full print:bg-white">
                {/* Group A */}
                <div className="space-y-6 print:mb-10 print:break-inside-avoid">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xl border-2 border-emerald-200">1</div>
                    <div>
                      <h3 className="text-xl font-black text-emerald-800">Знаење и Разбирање</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Блумова Таксономија - Ниво 1</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {diffResult.groupA.map((task, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/40 relative overflow-hidden group print:border-slate-300">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="font-black mb-3 text-emerald-900 dark:text-emerald-100">{idx + 1}. {task.title}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{task.original_text}</div>
                          </div>
                          <div className="shrink-0 flex flex-col items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity print:opacity-100">
                            <QRCodeSVG value={`https://youtu.be/search?q=${encodeURIComponent(task.title || '')}`} size={48} className="rounded-sm" />
                            <span className="text-[9px] uppercase font-bold text-slate-400">Решение</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group B */}
                <div className="space-y-6 print:mb-10 print:break-inside-avoid">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl border-2 border-blue-200">2</div>
                    <div>
                      <h3 className="text-xl font-black text-blue-800">Примена</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Блумова Таксономија - Ниво 2</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {diffResult.groupB.map((task, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/40 relative print:border-slate-300">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="font-black mb-3 text-blue-900 dark:text-blue-100">{idx + 1}. {task.title}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{task.original_text}</div>
                          </div>
                          <div className="shrink-0 flex flex-col items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity print:opacity-100">
                            <QRCodeSVG value={`https://youtu.be/search?q=${encodeURIComponent(task.title || '')}`} size={48} className="rounded-sm" />
                            <span className="text-[9px] uppercase font-bold text-slate-400">Решение</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group C */}
                <div className="space-y-6 print:mb-10 print:break-inside-avoid">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xl border-2 border-purple-200">3</div>
                    <div>
                      <h3 className="text-xl font-black text-purple-800">Анализа и Синтеза</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Блумова Таксономија - Ниво 3</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {diffResult.groupC.map((task, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-900/40 relative print:border-slate-300">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="font-black mb-3 text-purple-900 dark:text-purple-100">{idx + 1}. {task.title}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{task.original_text}</div>
                          </div>
                          <div className="shrink-0 flex flex-col items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity print:opacity-100">
                            <QRCodeSVG value={`https://youtu.be/search?q=${encodeURIComponent(task.title || '')}`} size={48} className="rounded-sm" />
                            <span className="text-[9px] uppercase font-bold text-slate-400">Решение</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Material Preview Modal */}
      {generatedMaterial && (
        <MaterialPreview 
          type={selectedType}
          data={generatedMaterial}
          onClose={() => setGeneratedMaterial(null)}
          onDownload={(finalData) => {
            if (selectedType === 'quiz' || selectedType === 'flashcards' || selectedType === 'presentation') {
              exportToJson(finalData, `material_${selectedType}.json`);
            } else {
              // For documents, we convert the finalData structure to a virtual task array for the existing exporter
              // or handle it as a direct HTML-to-doc conversion if we add that later.
              // For now, export the JSON including edits.
              exportToJson(finalData, `material_${selectedType}.json`);
            }
            showToast('Материјалот е подготвен за преземање.', 'success');
          }}
        />
      )}
    </div>
  );
}
