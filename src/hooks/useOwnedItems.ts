import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthBoot } from './useAuthBoot';
import { useGuestStore } from '@/store/guestStore';

export function useOwnedItems() {
  const { ready, session } = useAuthBoot();
  const { ownedLocal } = useGuestStore();

  // Server owned items - only when authenticated
  const serverQuery = useQuery({
    queryKey: ['owned-items', session?.user?.id],
    queryFn: async () => {
      if (!session?.user) return new Set<number>();
      
      const { data, error } = await supabase
        .from('user_items')
        .select('item_id')
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      return new Set((data ?? []).map(r => r.item_id));
    },
    enabled: ready && !!session?.user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Merge server + local owned items
  const ownedSet = new Set<number>();
  
  // Add guest cache (always available)
  ownedLocal.forEach(id => ownedSet.add(id));
  
  // Add server owned (when authenticated)
  if (session?.user && serverQuery.data) {
    serverQuery.data.forEach(id => ownedSet.add(id));
  }

  return {
    ownedSet,
    isAuthenticated: !!session?.user,
    isLoadingOwned: serverQuery.isLoading,
    serverOwned: serverQuery.data
  };
}