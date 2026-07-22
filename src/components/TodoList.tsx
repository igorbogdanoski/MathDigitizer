import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CheckCircle2, Circle, Clock, Plus, Trash2, Calendar as CalendarIcon, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { generateSpeech } from '../lib/gemini';
import { useToast } from '../contexts/ToastContext';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string | null;
  userId: string;
  createdAt: string;
}

interface TodoListProps {
  user: any;
  onTaskComplete?: () => void;
}

export const TodoList: React.FC<TodoListProps> = ({ user, onTaskComplete }) => {
  const { t } = useTranslation('common');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) {
      setTodos([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'todos'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTodos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Todo[];
      
      // Sort in memory: incomplete first, then by due date, then by creation
      fetchedTodos.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });

      setTodos(fetchedTodos);
      setLoading(false);
    }, (error) => {
      console.error("Грешка при вчитување на задачи:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || !user) return;

    try {
      await addDoc(collection(db, 'todos'), {
        text: newTask.trim(),
        completed: false,
        dueDate: dueDate || null,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      setNewTask('');
      setDueDate('');
    } catch (error) {
      console.error("Грешка при додавање задача:", error);
    }
  };

  const toggleComplete = async (todo: Todo) => {
    try {
      const newCompletedState = !todo.completed;
      await updateDoc(doc(db, 'todos', todo.id), {
        completed: newCompletedState
      });
      if (newCompletedState && onTaskComplete) {
        onTaskComplete();
      }
    } catch (error) {
      console.error("Грешка при ажурирање:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (error) {
      console.error("Грешка при бришење:", error);
    }
  };

  const handlePlayAudio = async (todo: Todo) => {
    if (playingId === todo.id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    setIsGeneratingAudio(todo.id);
    try {
      const base64Audio = await generateSpeech(todo.text);
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      
      audio.onended = () => setPlayingId(null);
      audio.play();
      
      setAudioElement(audio);
      setPlayingId(todo.id);
    } catch (error) {
      console.error("Error playing audio:", error);
      showToast("Грешка при генерирање на аудио.", 'error');
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  const isOverdue = (dateString: string | null) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
        <p>Мора да се најавите за да ги користите задачите (To-Do).</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-blue-600" />
          Мои Задачи
        </h2>
        
        <form onSubmit={handleAddTodo} className="flex flex-col sm:flex-row gap-3">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Што треба да се сработи?"
            className="flex-1"
          />
          <div className="flex gap-3">
            <div className="relative">
              <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                title={t('ariaDeadline')}
                aria-label={t('ariaDeadline')}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="pl-9 h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              />
            </div>
            <Button type="submit" disabled={!newTask.trim()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Додај
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Вчитување...</div>
        ) : todos.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Немате активни задачи. Одлично!</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {todos.map(todo => (
              <li 
                key={todo.id} 
                className={`p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${todo.completed ? 'opacity-60 bg-slate-50/50' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => toggleComplete(todo)}
                  className="flex-shrink-0 focus:outline-none"
                >
                  {todo.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-300 hover:text-blue-500 transition-colors" />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-slate-900 font-medium truncate ${todo.completed ? 'line-through text-slate-500' : ''}`}>
                    {todo.text}
                  </p>
                  {todo.dueDate && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${
                      todo.completed ? 'text-slate-400' : 
                      isOverdue(todo.dueDate) ? 'text-red-500 font-medium' : 'text-slate-500'
                    }`}>
                      <Clock className="w-3 h-3" />
                      Рок: {new Date(todo.dueDate).toLocaleDateString('mk-MK')}
                      {isOverdue(todo.dueDate) && !todo.completed && ' (Изминат)'}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePlayAudio(todo)}
                    disabled={isGeneratingAudio === todo.id}
                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    title={playingId === todo.id ? "Паузирај" : "Слушни"}
                  >
                    {isGeneratingAudio === todo.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : playingId === todo.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTodo(todo.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('ariaDelete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
