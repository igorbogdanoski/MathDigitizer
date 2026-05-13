import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MathTask } from '../lib/schema';
import { useLibraryStore } from '../store/useLibraryStore';
import { captureError } from '../lib/observability';

export function useRealtimeTasks() {
  const queryClient = useQueryClient();
  const store = useLibraryStore();

  // 1. Initial fetch via React Query (provides caching and deduping)
  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      // NOTE: For thousands of tasks, we add limit(250) to prevent freezing/crashing and high DB costs.
      // In a fully scaled app, this should be replaced with pagination (load more).
      const q = query(collection(db, 'tasks'), orderBy('created_at', 'desc'), limit(250));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MathTask));
    },
    staleTime: Infinity, // Prevent background refetches because onSnapshot handles updates
  });

  // 2. Real-time subscription
  useEffect(() => {
    // Also limit the real-time listener to the same subset
    const q = query(collection(db, 'tasks'), orderBy('created_at', 'desc'), limit(250));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MathTask));
      
      // Update React Query cache directly
      queryClient.setQueryData(['tasks'], updatedTasks);
      
      // Update Zustand store
      const currentStore = useLibraryStore.getState();
      currentStore.setTasks(updatedTasks);
      currentStore.setIsLoading(false);
    }, (error) => {
      captureError(error, {
        name: 'realtime.tasks',
        path: '/library',
        details: { operationType: 'list', collection: 'tasks', limit: 250 },
      });
    });

    return () => unsubscribe();
  }, [queryClient]); // Removed store to prevent cyclic renders

  // Sync initial fetch to store
  useEffect(() => {
    if (tasks) {
      const currentStore = useLibraryStore.getState();
      currentStore.setTasks(tasks);
      currentStore.setIsLoading(false);
    }
  }, [tasks]);

  return { tasks, isLoading, error };
}
