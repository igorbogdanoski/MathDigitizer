import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient, InfiniteData } from '@tanstack/react-query';
import {
  collection, query, orderBy, onSnapshot, getDocs,
  limit, startAfter, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MathTask } from '../lib/schema';
import { useLibraryStore } from '../store/useLibraryStore';
import { captureError } from '../lib/observability';

export const TASKS_PAGE_SIZE = 25;

interface TaskPage {
  tasks: MathTask[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  count: number;
}

export function useRealtimeTasks() {
  const queryClient = useQueryClient();
  const store = useLibraryStore();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    TaskPage,
    Error,
    InfiniteData<TaskPage>,
    ['tasks'],
    QueryDocumentSnapshot<DocumentData> | null
  >({
    queryKey: ['tasks'],
    queryFn: async ({ pageParam }) => {
      const constraints = pageParam
        ? [orderBy('created_at', 'desc'), startAfter(pageParam), limit(TASKS_PAGE_SIZE)]
        : [orderBy('created_at', 'desc'), limit(TASKS_PAGE_SIZE)];
      const snap = await getDocs(query(collection(db, 'tasks'), ...constraints));
      return {
        tasks: snap.docs.map(d => ({ id: d.id, ...d.data() } as MathTask)),
        lastDoc: snap.docs[snap.docs.length - 1] ?? null,
        count: snap.size,
      };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.count === TASKS_PAGE_SIZE ? lastPage.lastDoc : undefined,
    staleTime: Infinity,
  });

  const allTasks = useMemo(() => data?.pages.flatMap(p => p.tasks) ?? [], [data]);

  // Sync accumulated pages → Zustand store
  useEffect(() => {
    store.setTasks(allTasks);
    if (!isLoading) store.setIsLoading(false);
  }, [allTasks, isLoading]);

  // Real-time listener — first page only (catches new tasks + recent edits)
  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('created_at', 'desc'), limit(TASKS_PAGE_SIZE));
    const unsub = onSnapshot(q, (snap) => {
      const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() } as MathTask));
      const lastSnap = snap.docs[snap.docs.length - 1] ?? null;
      queryClient.setQueryData<InfiniteData<TaskPage>>(['tasks'], (old) => {
        if (!old) {
          return {
            pages: [{ tasks: fresh, lastDoc: lastSnap, count: fresh.length }],
            pageParams: [null],
          };
        }
        return {
          ...old,
          pages: old.pages.map((page, i) =>
            i === 0 ? { ...page, tasks: fresh, lastDoc: lastSnap } : page
          ),
        };
      });
    }, (err) => captureError(err, { name: 'realtime.tasks', path: '/library' }));
    return () => unsub();
  }, [queryClient]);

  return {
    tasks: allTasks,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
}
