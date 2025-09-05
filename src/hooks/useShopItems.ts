import { useQuery } from '@tanstack/react-query';
import { fetchPublicItems, type Filters } from '@/lib/supaShop';

export function useShopItems(filters: Filters) {
  return useQuery({
    queryKey: ['items', filters],
    queryFn: () => fetchPublicItems(filters),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: true,
  });
}

// Hook specifically for closet (all owned items)
export function useClosetItems(options: Filters = {}) {
  return useShopItems(options);
}