import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { MathTask } from '../../lib/schema';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { X, Save, Plus, Trash2, Loader2, BookOpen, Edit3 } from 'lucide-react';
import { motion } from 'motion/react';

interface CreateTaskModalProps {
  onClose: () => void;
  onSuccess: () => void;
  editTask?: MathTask; // If provided, modal acts as "Edit" instead of "Create"
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSuccess, editTask }) => {
  const [title, setTitle] = useState(editTask?.title || '');
  const [originalText, setOriginalText] = useState(editTask?.original_text || '');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(editTask?.difficulty || 'medium');
  const [gradeLevel, setGradeLevel] = useState(editTask?.grade_level || '');
  const [folderName, setFolderName] = useState(editTask?.folder_name || '');
  const [tags, setTags] = useState<string[]>(editTask?.tags || []);
  const [currentTag, setCurrentTag] = useState('');
  const [steps, setSteps] = useState<string[]>(editTask?.solution_steps && editTask.solution_steps.length > 0 ? editTask.solution_steps : ['']);
  const [hints, setHints] = useState<string[]>(editTask?.hints || []);
  const [currentHint, setCurrentHint] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  // Focus lock implementation placeholder if needed


  const handleAddStep = () => {
    setSteps([...steps, '']);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length > 1) {
      const newSteps = [...steps];
      newSteps.splice(index, 1);
      setSteps(newSteps);
    }
  };

  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAddHint = () => {
    if (currentHint.trim()) {
      setHints([...hints, currentHint.trim()]);
      setCurrentHint('');
    }
  };

  const handleRemoveHint = (index: number) => {
    const newHints = [...hints];
    newHints.splice(index, 1);
    setHints(newHints);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !originalText) return;
    
    setIsSaving(true);
    try {
      if (editTask && editTask.id) {
        // Update existing task
        const taskRef = doc(db, 'tasks', editTask.id);
        const updateData: any = {
          title,
          original_text: originalText,
          solution_steps: steps.filter(s => s.trim() !== ''),
          difficulty,
          grade_level: gradeLevel,
          tags,
          hints
        };
        if (folderName.trim()) {
           updateData.folder_name = folderName.trim();
           updateData.folder_id = folderName.trim().toLowerCase().replace(/\s+/g, '-');
        } else {
           updateData.folder_name = null;
           updateData.folder_id = null;
        }
        await updateDoc(taskRef, updateData);
      } else {
        // Create new task
        const newTask: Omit<MathTask, 'id'> = {
          title,
          original_text: originalText,
          solution_steps: steps.filter(s => s.trim() !== ''),
          latex_formulas: [],
          nanobanana_prompt: '',
          difficulty,
          grade_level: gradeLevel,
          ...((folderName.trim()) ? {
            folder_name: folderName.trim(),
            folder_id: folderName.trim().toLowerCase().replace(/\s+/g, '-')
          } : {}),
          tags,
          hints,
          source_url: 'Рачно внесена',
          author_uid: auth.currentUser?.uid,
          created_at: new Date().toISOString()
        };

        await addDoc(collection(db, 'tasks'), newTask);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Грешка при зачувување на задачата.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8 overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-indigo-600">
            {editTask ? <Edit3 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            <h2 className="text-lg font-bold">{editTask ? 'Уреди задача' : 'Рачно додавање задача'}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <form id="create-task-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Наслов</label>
                <Input 
                  required 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="пр. Линеарна равенка со една непозната" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Текст на задачата</label>
                <textarea 
                  required 
                  value={originalText}
                  onChange={e => setOriginalText(e.target.value)}
                  className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm"
                  placeholder="пр. Реши ја равенката: 2x + 5 = 15"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Тежина</label>
                  <select 
                    value={difficulty}
                    onChange={(e: any) => setDifficulty(e.target.value)}
                    className="w-full text-sm h-10 px-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="easy">Лесна</option>
                    <option value="medium">Средна</option>
                    <option value="hard">Тешка</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Одделение</label>
                  <Input 
                    value={gradeLevel} 
                    onChange={e => setGradeLevel(e.target.value)} 
                    placeholder="пр. 8 Одделение" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Папка</label>
                  <Input 
                    value={folderName} 
                    onChange={e => setFolderName(e.target.value)} 
                    placeholder="Сите Папки" 
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Тагови (Области)</label>
              <div className="flex gap-2">
                <Input 
                  value={currentTag} 
                  onChange={e => setCurrentTag(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Додади таг..." 
                />
                <Button type="button" onClick={handleAddTag} variant="outline">Додади</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="text-blue-400 hover:text-blue-600"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 mb-1 border-b pb-2">Чекори за решавање</label>
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                    {idx + 1}
                  </div>
                  <textarea 
                    value={step}
                    onChange={e => handleStepChange(idx, e.target.value)}
                    className="flex-1 min-h-[60px] p-2 text-sm rounded-lg border border-slate-200 font-mono"
                    placeholder={`Чекор ${idx + 1}...`}
                  />
                  <button 
                    type="button" 
                    onClick={() => handleRemoveStep(idx)}
                    className="p-2 text-red-400 hover:text-red-600 h-fit"
                    disabled={steps.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddStep} className="w-full border-dashed">
                <Plus className="w-4 h-4 mr-2" />
                Нов Чекор
              </Button>
            </div>

            {/* Hints */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-1">Помош / Насоки (Hints)</label>
              <div className="flex gap-2">
                <Input 
                  value={currentHint} 
                  onChange={e => setCurrentHint(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddHint())}
                  placeholder="Кратка помош за ученикот..." 
                />
                <Button type="button" onClick={handleAddHint} variant="outline">Додади</Button>
              </div>
              {hints.length > 0 && (
                <div className="space-y-2 mt-2">
                  {hints.map((hint, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-amber-50 text-amber-800 p-2 rounded text-sm">
                      <span>{idx + 1}. {hint}</span>
                      <button type="button" onClick={() => handleRemoveHint(idx)} className="text-amber-500 hover:text-amber-700"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </form>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Откажи</Button>
          <Button 
            type="submit" 
            form="create-task-form" 
            disabled={isSaving || !title || !originalText}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Се зачувува...</> : <><Save className="w-4 h-4 mr-2" /> Зачувај Задача</>}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
