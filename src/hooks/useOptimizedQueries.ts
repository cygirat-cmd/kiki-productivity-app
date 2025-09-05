/**
 * Optimized React Query hooks for better performance and caching
 * Reduces unnecessary re-renders and API calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enhancedSupabase, VerificationRecord } from '../lib/supabaseClient';
import { storage, petStorage, tasksStorage, verificationsStorage } from '../utils/optimizedStorage';
import { STORAGE_KEYS } from '../constants';

// Query keys for consistent caching
export const queryKeys = {
  pet: ['pet'] as const,
  tasks: ['tasks'] as const,
  verifications: ['verifications'] as const,
  userProfile: ['userProfile'] as const,
  stats: ['stats'] as const,
  premiumStatus: (userId: string) => ['premiumStatus', userId] as const,
} as const;

/**
 * Hook for pet data with local storage integration
 */
export function usePet() {
  return useQuery({
    queryKey: queryKeys.pet,
    queryFn: () => petStorage.get(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for tasks with optimistic updates
 */
export function useTasks() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => tasksStorage.get(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  const addTaskMutation = useMutation({
    mutationFn: async (newTask: any) => {
      const currentTasks = await tasksStorage.get();
      const updatedTasks = [...currentTasks, newTask];
      await tasksStorage.set(updatedTasks);
      return updatedTasks;
    },
    onMutate: async (newTask) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(queryKeys.tasks);

      // Optimistically update
      queryClient.setQueryData(queryKeys.tasks, (old: any[] = []) => [...old, newTask]);

      return { previousTasks };
    },
    onError: (err, newTask, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKeys.tasks, context?.previousTasks);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<any> }) => {
      const currentTasks = await tasksStorage.get();
      const updatedTasks = currentTasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      );
      await tasksStorage.set(updatedTasks);
      return updatedTasks;
    },
    onMutate: async ({ taskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      const previousTasks = queryClient.getQueryData(queryKeys.tasks);

      queryClient.setQueryData(queryKeys.tasks, (old: any[] = []) =>
        old.map(task => task.id === taskId ? { ...task, ...updates } : task)
      );

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(queryKeys.tasks, context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const currentTasks = await tasksStorage.get();
      const updatedTasks = currentTasks.filter(task => task.id !== taskId);
      await tasksStorage.set(updatedTasks);
      return updatedTasks;
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      const previousTasks = queryClient.getQueryData(queryKeys.tasks);

      queryClient.setQueryData(queryKeys.tasks, (old: any[] = []) =>
        old.filter(task => task.id !== taskId)
      );

      return { previousTasks };
    },
    onError: (err, taskId, context) => {
      queryClient.setQueryData(queryKeys.tasks, context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });

  return {
    ...query,
    addTask: addTaskMutation.mutate,
    updateTask: updateTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    isAddingTask: addTaskMutation.isPending,
    isUpdatingTask: updateTaskMutation.isPending,
    isDeletingTask: deleteTaskMutation.isPending,
  };
}

/**
 * Hook for verifications with real-time updates
 */
export function useVerifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.verifications,
    queryFn: () => verificationsStorage.get(),
    staleTime: 1 * 60 * 1000, // 1 minute (more frequent for real-time feel)
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for updates
    refetchOnWindowFocus: true,
  });

  const checkVerificationStatusMutation = useMutation({
    mutationFn: async (verificationId: string) => {
      const { data } = await enhancedSupabase.getVerification(verificationId);
      return data;
    },
    onSuccess: (updatedVerification) => {
      if (updatedVerification) {
        queryClient.setQueryData(queryKeys.verifications, (old: VerificationRecord[] = []) =>
          old.map(v => v.id === updatedVerification.id ? updatedVerification : v)
        );
      }
    },
  });

  const addVerificationMutation = useMutation({
    mutationFn: async (verification: VerificationRecord) => {
      const current = await verificationsStorage.get();
      const updated = [...current, verification];
      await verificationsStorage.set(updated);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verifications });
    },
  });

  return {
    ...query,
    checkStatus: checkVerificationStatusMutation.mutate,
    addVerification: addVerificationMutation.mutate,
    isCheckingStatus: checkVerificationStatusMutation.isPending,
  };
}

/**
 * Hook for user profile with cloud sync
 */
export function useUserProfile() {
  return useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: async () => {
      const { data } = await enhancedSupabase.getCurrentUser();
      return data.user;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for session stats with aggregation
 */
export function useSessionStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => {
      const stats = await storage.get(STORAGE_KEYS.SESSION_STATS, { 
        totalSessions: 0, 
        pausesUsed: 0,
        totalTimeWorked: 0,
        averageSessionLength: 0
      });
      return stats;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for premium status with caching
 */
export function usePremiumStatus(userId?: string) {
  return useQuery({
    queryKey: queryKeys.premiumStatus(userId || ''),
    queryFn: async () => {
      if (!userId) return false;
      
      // Call premium check function
      const { data } = await enhancedSupabase.getCurrentUser();
      if (!data.user) return false;
      
      // Check premium status from Edge Function for security
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-premium`, {
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.isPremium || false;
      }
      
      return false;
    },
    enabled: !!userId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for cloud sync operations
 */
export function useCloudSync() {
  const queryClient = useQueryClient();

  const syncToCloudMutation = useMutation({
    mutationFn: async () => {
      const [pet, tasks, stats] = await Promise.all([
        petStorage.get(),
        tasksStorage.get(),
        storage.get(STORAGE_KEYS.SESSION_STATS, {})
      ]);

      const saveData = {
        pet_data: pet || {},
        tasks_data: tasks || [],
        cemetery_data: await storage.get(STORAGE_KEYS.CEMETERY, []),
        coins: await storage.get(STORAGE_KEYS.COINS, 0),
        pause_tokens: await storage.get(STORAGE_KEYS.PAUSE_TOKENS, 0),
        owned_items: await storage.get(STORAGE_KEYS.OWNED_ITEMS, []),
        session_stats: stats
      };

      const { data } = await enhancedSupabase.saveKikiToCloud(saveData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
    },
  });

  const syncFromCloudMutation = useMutation({
    mutationFn: async () => {
      const { data } = await enhancedSupabase.loadKikiFromCloud();
      
      if (data) {
        // Update local storage with cloud data
        await Promise.all([
          petStorage.set(data.pet_data),
          tasksStorage.set(data.tasks_data),
          storage.set(STORAGE_KEYS.CEMETERY, data.cemetery_data),
          storage.set(STORAGE_KEYS.COINS, data.coins),
          storage.set(STORAGE_KEYS.PAUSE_TOKENS, data.pause_tokens),
          storage.set(STORAGE_KEYS.OWNED_ITEMS, data.owned_items),
          storage.set('kiki-session-stats', data.session_stats)
        ]);
      }
      
      return data;
    },
    onSuccess: () => {
      // Invalidate all local queries to force refresh
      queryClient.invalidateQueries();
    },
  });

  return {
    syncToCloud: syncToCloudMutation.mutate,
    syncFromCloud: syncFromCloudMutation.mutate,
    isSyncingToCloud: syncToCloudMutation.isPending,
    isSyncingFromCloud: syncFromCloudMutation.isPending,
    syncToCloudError: syncToCloudMutation.error,
    syncFromCloudError: syncFromCloudMutation.error,
  };
}

/**
 * Hook for prefetching common data
 */
export function usePrefetchCommonData() {
  const queryClient = useQueryClient();

  const prefetch = async () => {
    // Prefetch commonly used data
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.pet,
        queryFn: () => petStorage.get(),
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.tasks,
        queryFn: () => tasksStorage.get(),
        staleTime: 2 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.verifications,
        queryFn: () => verificationsStorage.get(),
        staleTime: 1 * 60 * 1000,
      }),
    ]);
  };

  return { prefetch };
}

/**
 * Hook for optimized image loading
 */
export function useOptimizedImage(imagePath?: string) {
  return useQuery({
    queryKey: ['signedUrl', imagePath],
    queryFn: async () => {
      if (!imagePath) return null;
      
      const { data } = await enhancedSupabase.createSignedUrl(imagePath, 3600); // 1 hour
      return data?.signedUrl || null;
    },
    enabled: !!imagePath,
    staleTime: 45 * 60 * 1000, // 45 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
}