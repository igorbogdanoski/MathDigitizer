import React, { useRef } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useGamification } from '../../contexts/GamificationContext';
import { useToast } from '../../contexts/ToastContext';
import { InteractiveSolver } from '../InteractiveSolver';
import { MathTask, StudentProgress } from '../../lib/schema';

interface TaskSolveModalProps {
  task: MathTask;
  assignmentId: string;
  onClose: () => void;
  onComplete: () => void;
}

export const TaskSolveModal: React.FC<TaskSolveModalProps> = ({
  task,
  assignmentId,
  onClose,
  onComplete,
}) => {
  const { user } = useAuth();
  const { awardXP, updateQuestProgress } = useGamification();
  const { showToast } = useToast();
  const isWriting = useRef(false);

  const handleSolveComplete = async (xp: number) => {
    if (!user || isWriting.current) return;
    isWriting.current = true;
    try {
      const existing = await getDocs(
        query(
          collection(db, 'student_progress'),
          where('studentId', '==', user.uid),
          where('assignmentId', '==', assignmentId),
          where('taskId', '==', task.id)
        )
      );
      if (existing.empty) {
        const progressDoc: Omit<StudentProgress, 'id'> = {
          studentId: user.uid,
          assignmentId,
          taskId: task.id!,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };
        await addDoc(collection(db, 'student_progress'), progressDoc);
      }
      await awardXP(xp);
      updateQuestProgress('solve');
      showToast(`Браво! Задачата е завршена! +${xp} XP`, 'success');
      onComplete();
    } catch (err) {
      console.error('Failed to write StudentProgress:', err);
    } finally {
      isWriting.current = false;
    }
  };

  return (
    <InteractiveSolver
      task={task}
      onClose={onClose}
      onComplete={handleSolveComplete}
    />
  );
};
