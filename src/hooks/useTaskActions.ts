import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { MathTask } from '../lib/schema';
import { 
  ai, generateImage, generateSimilarTask, generateDifferentiatedTasks, 
  modernizeTaskContext, generateConsistencyTasks, generatePrerequisiteTest 
} from '../lib/gemini';
import { useLibraryStore } from '../store/useLibraryStore';
import { useQueryClient } from '@tanstack/react-query';
import { updateDoc } from 'firebase/firestore';
import { PRO_MODEL } from '../lib/ai/models';

export function useTaskActions() {
  const store = useLibraryStore();
  const queryClient = useQueryClient();

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Дали сте сигурни дека сакате да ја избришете оваа задача?')) {
      store.setDeletingTaskIds(new Set(store.deletingTaskIds).add(taskId));
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } catch (err) {
        console.error("Грешка при бришење:", err);
        const next = new Set(store.deletingTaskIds);
        next.delete(taskId);
        store.setDeletingTaskIds(next);
        alert('Настана грешка при бришење на задачата.');
      }
    }
  };

  const handleGenerateImage = async (prompt: string, task: MathTask) => {
    const taskId = task.id || '';
    store.setIsGeneratingImage({ ...store.isGeneratingImage, [taskId]: true });
    try {
      const imageUrl = await generateImage(prompt, task.grade_level);
      store.setGeneratedImages({ ...store.generatedImages, [taskId]: imageUrl });
    } catch (err) {
      console.error("Грешка при генерирање слика:", err);
      alert('Настана грешка при генерирање на визуелизацијата.');
    } finally {
      store.setIsGeneratingImage({ ...store.isGeneratingImage, [taskId]: false });
    }
  };

  const handleGenerateSimilar = async (task: MathTask) => {
    const taskId = task.id || '';
    store.setIsGeneratingSimilar({ ...store.isGeneratingSimilar, [taskId]: true });
    try {
      const newTask = await generateSimilarTask(task, store.generationStyle);
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        created_at: serverTimestamp()
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert('Успешно генерирана слична задача! Погледнете ја во библиотеката.');
    } catch (err) {
      console.error("Грешка при генерирање слична задача:", err);
      alert('Настана грешка при генерирање на слична задача.');
    } finally {
      store.setIsGeneratingSimilar({ ...store.isGeneratingSimilar, [taskId]: false });
    }
  };

  const handleGenerateDifferentiated = async (task: MathTask) => {
    const taskId = task.id || '';
    store.setIsGeneratingDifferentiated({ ...store.isGeneratingDifferentiated, [taskId]: true });
    try {
      const { easy, hard } = await generateDifferentiatedTasks(task, store.generationStyle);
      await addDoc(collection(db, 'tasks'), { ...easy, created_at: serverTimestamp() });
      await addDoc(collection(db, 'tasks'), { ...hard, created_at: serverTimestamp() });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert('Успешно генерирани диференцирани задачи (лесна и тешка)! Погледнете ги во библиотеката.');
    } catch (err) {
      console.error("Грешка при генерирање диференцирани задачи:", err);
      alert('Настана грешка при генерирање на диференцирани задачи.');
    } finally {
      store.setIsGeneratingDifferentiated({ ...store.isGeneratingDifferentiated, [taskId]: false });
    }
  };

  const handleCreateFlashcard = async (task: MathTask) => {
    if (!auth.currentUser) {
      alert('Мора да се најавите за да креирате картички.');
      return;
    }
    try {
      const newCard = {
        front: task.title,
        back: task.original_text,
        task_id: task.id,
        user_uid: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        ease_factor: 2.5,
        interval: 0,
        next_review: new Date().toISOString()
      };
      await addDoc(collection(db, 'flashcards'), newCard);
      alert('Картичката е успешно креирана! Можете да ја најдете во табулаторот „Картички“.');
    } catch (err) {
      console.error("Error creating flashcard:", err);
      alert('Грешка при креирање на картичката.');
    }
  };

  const handleGenerateTagFormulas = async (task: MathTask, taskId: string) => {
    if (!task.tags || task.tags.length === 0) return;
    store.setIsGeneratingTagFormulas({ ...store.isGeneratingTagFormulas, [taskId]: true });
    try {
      const prompt = `За секој од следните математички концепти (тагови), врати ја основната LaTeX формула која го претставува.\nТагови: ${task.tags.join(', ')}\n\nВрати СТРОГО JSON објект каде клучот е тагот, а вредноста е LaTeX формулата (без $$). Пример: {"Квадратна равенка": "ax^2 + bx + c = 0"}`;
      const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      if (response.text) {
        const formulas = JSON.parse(response.text);
        store.setTagFormulas({ ...store.tagFormulas, [taskId]: formulas });
      }
    } catch (error) {
      console.error("Error generating tag formulas:", error);
    } finally {
      store.setIsGeneratingTagFormulas({ ...store.isGeneratingTagFormulas, [taskId]: false });
    }
  };

  const handleModernizeContext = async (task: MathTask) => {
    const taskId = task.id || '';
    if (!taskId) return;
    store.setIsModernizingContext({ ...store.isModernizingContext, [taskId]: true });
    try {
      const updatedTask = await modernizeTaskContext(task);
      await updateDoc(doc(db, 'tasks', taskId), {
        title: updatedTask.title,
        original_text: updatedTask.original_text
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert('Задачата е успешно модернизирана за Gen-Z контекст!');
    } catch (err) {
      console.error("Грешка при модернизација:", err);
      alert('Настана грешка при модернизација на задачата.');
    } finally {
      store.setIsModernizingContext({ ...store.isModernizingContext, [taskId]: false });
    }
  };

  const handleGenerateConsistency = async (task: MathTask) => {
    const taskId = task.id || '';
    if (!taskId) return;
    store.setIsGeneratingConsistency({ ...store.isGeneratingConsistency, [taskId]: true });
    try {
      const newTasks = await generateConsistencyTasks(task, 3, store.generationStyle);
      for (const t of newTasks) {
        await addDoc(collection(db, 'tasks'), { ...t, created_at: serverTimestamp() });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert(`Успешно генерирани 3 задачи со наставна метода: ${task.pedagogical_insights?.teaching_strategy}!`);
    } catch (err) {
      console.error("Грешка при методолошко клонирање:", err);
      alert('Грешка при генерирање конзистентни задачи.');
    } finally {
      store.setIsGeneratingConsistency({ ...store.isGeneratingConsistency, [taskId]: false });
    }
  };

  const handleGeneratePrerequisites = async (task: MathTask) => {
    const taskId = task.id || '';
    if (!taskId) return;
    store.setIsGeneratingPrerequisites({ ...store.isGeneratingPrerequisites, [taskId]: true });
    try {
      const newTasks = await generatePrerequisiteTest(task, store.generationStyle);
      for (const t of newTasks) {
        await addDoc(collection(db, 'tasks'), { ...t, created_at: serverTimestamp() });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert('Успешно генериран дијагностички тест (пред-тест) за оваа задача!');
    } catch (err) {
      console.error("Грешка при генерирање пред-тест:", err);
      alert('Грешка при генерирање дијагностички задачи.');
    } finally {
      store.setIsGeneratingPrerequisites({ ...store.isGeneratingPrerequisites, [taskId]: false });
    }
  };

  return {
    ...store,
    handleDeleteTask, handleGenerateImage, handleGenerateSimilar,
    handleGenerateDifferentiated, handleCreateFlashcard, handleGenerateTagFormulas,
    handleModernizeContext, handleGenerateConsistency, handleGeneratePrerequisites
  };
}
