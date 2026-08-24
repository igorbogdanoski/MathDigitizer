import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, limit, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
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
import { groupTasksByCurriculum } from '../lib/materials/grouping';
import { hasProAccess } from '../lib/saas';
import { ProFeatureGate } from './ProFeatureGate';
import { captureError } from '../lib/observability';
import { WorkflowSteps } from './WorkflowSteps';
import { useModalA11y } from '../hooks/useModalA11y';

export default function MaterialsFactory() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, userProfile } = useAuth();
  const { t } = useTranslation('materialsFactory');
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
      showToast(t('toasts.selectAtLeastOne'), 'info');
      return;
    }
    
    setIsGenerating(true);
    try {
      const tasksToProcess = tasks.filter(task => task.id && selectedTasks.has(task.id));
      const result = await generateEducationalMaterial(tasksToProcess, selectedType, targetGrade, targetLanguage);
      setGeneratedMaterial(result);
      showToast(t('toasts.materialGenerated'), 'success');
    } catch (error) {
      captureError(error, { name: 'materials.generate', path: '/factory', details: { selectedType, taskCount: selectedTasks.size } });
      showToast(t('toasts.generateError'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDifferentiated = async () => {
    if (selectedTasks.size === 0) return;
    setIsGeneratingDiff(true);
    try {
      const tasksToExport = tasks.filter(task => task.id && selectedTasks.has(task.id));
      const result = await generateDifferentiatedTest(tasksToExport);
      setDiffResult(result);
      showToast(t('toasts.diffTestGenerated'), 'success');
    } catch (error) {
      captureError(error, { name: 'materials.differentiated-test', path: '/factory', details: { taskCount: selectedTasks.size } });
      showToast(t('toasts.generateError'), 'error');
    } finally {
      setIsGeneratingDiff(false);
    }
  };

  const handleExportJson = () => {
    if (selectedTasks.size === 0) return;
    const tasksToExport = tasks.filter(task => task.id && selectedTasks.has(task.id));
    exportToJson(tasksToExport, 'math_materials.json');
    showToast(t('toasts.jsonDownloaded'), 'success');
  };

  const handleExportWord = () => {
    if (selectedTasks.size === 0) return;
    const tasksToExport = tasks.filter(task => task.id && selectedTasks.has(task.id));
    exportToWord(tasksToExport, 'math_materials.doc');
    showToast(t('toasts.wordDownloaded'), 'success');
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
    const allFilteredIds = filteredTasks.map(task => task.id).filter(Boolean) as string[];
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

  // Grouped on curriculum_refs (stable topic ids + БРО codes), not on the
  // free-text topic the model writes — see lib/materials/grouping.ts
  const taskGroups = groupTasksByCurriculum(filteredTasks);

  useEffect(() => {
    async function fetchTasks() {
      if (!user) { setLoading(false); return; }
      try {
        // Own tasks only, and bounded — this used to read every task in the
        // database on every visit.
        const q = query(
          collection(db, 'tasks'),
          where('author_uid', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(300)
        );
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
  }, [user]);

  const materialTypes: { id: MaterialType; name: string; icon: any; description: string; color: string; iconBg: string }[] = [
    { id: 'worksheet', name: t('types.worksheet.name'), icon: FileText, description: t('types.worksheet.description'), color: 'text-blue-600', iconBg: 'bg-blue-100' },
    { id: 'test', name: t('types.test.name'), icon: Target, description: t('types.test.description'), color: 'text-rose-600', iconBg: 'bg-rose-100' },
    { id: 'collection', name: t('types.collection.name'), icon: BookOpen, description: t('types.collection.description'), color: 'text-emerald-600', iconBg: 'bg-emerald-100' },
    { id: 'quiz', name: t('types.quiz.name'), icon: FileQuestion, description: t('types.quiz.description'), color: 'text-purple-600', iconBg: 'bg-purple-100' },
    { id: 'presentation', name: t('types.presentation.name'), icon: Presentation, description: t('types.presentation.description'), color: 'text-orange-600', iconBg: 'bg-orange-100' },
    { id: 'flashcards', name: t('types.flashcards.name'), icon: Layers, description: t('types.flashcards.description'), color: 'text-pink-600', iconBg: 'bg-pink-100' },
    { id: 'homework', name: t('types.homework.name'), icon: ClipboardList, description: t('types.homework.description'), color: 'text-teal-600', iconBg: 'bg-teal-100' },
    { id: 'study_guide', name: t('types.study_guide.name'), icon: GraduationCap, description: t('types.study_guide.description'), color: 'text-amber-600', iconBg: 'bg-amber-100' },
  ];

  if (!hasProAccess(userProfile)) {
    return (
      <ProFeatureGate
        featureName="Materials Factory"
        description={t('gate.description')}
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
              <span>{t('hero.badge')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
              Materials <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Factory</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </div>
          
          <div className="flex-shrink-0 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 text-center min-w-[200px]">
            <div className="text-4xl font-black text-white mb-1">{tasks.length}</div>
            <div className="text-sm text-slate-400 font-medium uppercase tracking-widest">{t('hero.availableTasks')}</div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-2xl font-bold text-indigo-400">{selectedTasks.size}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('hero.selected')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Избор на тип на материјал */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('step1.title')}</h2>
        </div>
        
        {/* Settings Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('settings.language')}</span>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value as any)}
              title={t('settings.languageTitle')}
              className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="mk">{t('languages.mk')}</option>
              <option value="en">{t('languages.en')}</option>
              <option value="ru">{t('languages.ru')}</option>
              <option value="tr">{t('languages.tr')}</option>
            </select>
          </div>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block mx-2"></div>
          
          <div className="flex items-center gap-3">
             <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('settings.grade')}</span>
             <select
               value={targetGrade}
               onChange={(e) => setTargetGrade(e.target.value)}
               title={t('settings.gradeTitle')}
               className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 min-w-40"
             >
               <option value="Сите Одделенија / Мешано">{t('grades.allMixed')}</option>
               <option value="I Одделение">{t('grades.primary', { roman: 'I' })}</option>
               <option value="II Одделение">{t('grades.primary', { roman: 'II' })}</option>
               <option value="III Одделение">{t('grades.primary', { roman: 'III' })}</option>
               <option value="IV Одделение">{t('grades.primary', { roman: 'IV' })}</option>
               <option value="V Одделение">{t('grades.primary', { roman: 'V' })}</option>
               <option value="VI Одделение">{t('grades.primary', { roman: 'VI' })}</option>
               <option value="VII Одделение">{t('grades.primary', { roman: 'VII' })}</option>
               <option value="VIII Одделение">{t('grades.primary', { roman: 'VIII' })}</option>
               <option value="IX Одделение">{t('grades.primary', { roman: 'IX' })}</option>
               <option value="I Година (Средно)">{t('grades.secondary', { roman: 'I' })}</option>
               <option value="II Година (Средно)">{t('grades.secondary', { roman: 'II' })}</option>
               <option value="III Година (Средно)">{t('grades.secondary', { roman: 'III' })}</option>
               <option value="IV Година (Средно)">{t('grades.secondary', { roman: 'IV' })}</option>
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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('step2.title')}</h2>
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
                {isGenerating ? t('step2.generating') : t('step2.generate')}
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
                  placeholder={t('step2.searchPlaceholder')} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Filter className="w-4 h-4" />
                {t('step2.filters')}
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl hover:bg-indigo-100 transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                {t('step2.selectAll')}
              </button>
              <button 
                onClick={handleClearSelections}
                disabled={selectedTasks.size === 0}
                className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                {t('step2.clear')}
              </button>
              
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleGenerateDifferentiated}
                  disabled={selectedTasks.size === 0 || isGeneratingDiff}
                  className="w-12 h-12 flex items-center justify-center text-purple-600 bg-purple-50 dark:bg-purple-900/30 rounded-xl hover:bg-purple-100 transition-colors disabled:opacity-50"
                  title={t('step2.diffTestTitle')}
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
                <p className="text-slate-500 font-medium">{t('step2.loading')}</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-6xl flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('step2.emptyTitle')}</h3>
                <p className="text-slate-500 max-w-sm mb-8">
                  {t('step2.emptyDesc')}
                </p>
                <Button 
                  onClick={() => navigate('/extract')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('step2.startExtraction')}
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {taskGroups.map((group) => {
                  const topic = group.key;
                  const topicTasks = group.tasks;
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
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{group.label}</h3>
                            <p className="text-xs text-slate-500 font-bold">
                              {topicTasks.length} {topicTasks.length === 1 ? t('step2.taskSingular') : t('step2.taskPlural')}
                            </p>
                            {/* БРО outcome codes, so the teacher sees what the
                                group actually covers rather than a bare label */}
                            {group.outcomeCodes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {group.outcomeCodes.slice(0, 4).map(code => (
                                  <span key={code} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                    {code}
                                  </span>
                                ))}
                                {group.outcomeCodes.length > 4 && (
                                  <span className="text-[10px] font-mono text-slate-400">+{group.outcomeCodes.length - 4}</span>
                                )}
                              </div>
                            )}
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
                                        title={t('step2.editTaskTitle')}
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
                                        {task.difficulty === 'easy' ? t('difficulty.easy') : task.difficulty === 'medium' ? t('difficulty.medium') : t('difficulty.hard')}
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
                     {t('diff.badge')}
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">{t('diff.title')}</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xl">{t('diff.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => window.print()} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold h-14 px-6 rounded-2xl shadow-lg print:hidden">
                    <Printer className="w-5 h-5 mr-2" />
                    {t('diff.print')}
                  </Button>
                  <Button onClick={() => {
                    exportToWord([...diffResult.groupA, ...diffResult.groupB, ...diffResult.groupC], 'differentiated_test.doc');
                  }} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-14 px-8 rounded-2xl shadow-lg print:hidden">
                    <Download className="w-5 h-5 mr-3" />
                    {t('diff.exportWord')}
                  </Button>
                  <button onClick={() => setDiffResult(null)} aria-label={t('diff.closeAria')} title={t('diff.closeTitle')} className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm print:hidden">
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
                      <h3 className="text-xl font-black text-emerald-800">{t('diff.groupA')}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">{t('diff.level1')}</p>
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
                            <span className="text-[9px] uppercase font-bold text-slate-400">{t('diff.solution')}</span>
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
                      <h3 className="text-xl font-black text-blue-800">{t('diff.groupB')}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">{t('diff.level2')}</p>
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
                            <span className="text-[9px] uppercase font-bold text-slate-400">{t('diff.solution')}</span>
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
                      <h3 className="text-xl font-black text-purple-800">{t('diff.groupC')}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">{t('diff.level3')}</p>
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
                            <span className="text-[9px] uppercase font-bold text-slate-400">{t('diff.solution')}</span>
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
            showToast(t('toasts.materialReadyDownload'), 'success');
          }}
        />
      )}
    </div>
  );
}
