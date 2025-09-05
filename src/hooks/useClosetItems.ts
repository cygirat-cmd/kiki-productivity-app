import { useMemo } from 'react';
import { useShopItems } from '@/hooks/useShopItems';
import { useUserItemsStore } from '@/store/userItemsStore';
import { useGuestStore } from '@/store/guestStore';
import { type NormalizedItem } from '@/lib/supaShop';
import { type FilterState, type SortOption, type RarityFilter } from '@/components/FilterBar';

interface UseClosetItemsProps {
  searchTerm: string;
  selectedSlots: string[];
  filterState: FilterState;
  sortBy: SortOption;
  rarityFilter: RarityFilter;
}

export function useClosetItems({
  searchTerm,
  selectedSlots,
  filterState,
  sortBy,
  rarityFilter
}: UseClosetItemsProps) {
  const { 
    isAuthenticated, 
    ownedIds, 
    favoriteIds, 
    equipped,
    checkOwnership,
    isFavorite 
  } = useUserItemsStore();
  
  const { 
    checkProvisionalOwnership,
    isProvisionalFavorite,
    equippedLocal 
  } = useGuestStore();
  
  // Load items from catalog
  const { items, isLoading, isError } = useShopItems({
    search: searchTerm,
    slot: selectedSlots.includes('all') ? undefined : selectedSlots[0],
    limit: 200
  });
  
  // Helper functions
  const isOwned = (item: NormalizedItem) => 
    isAuthenticated ? checkOwnership(item.id) : checkProvisionalOwnership(item.id);
  
  const isFavorited = (item: NormalizedItem) => 
    isAuthenticated ? isFavorite(item.id) : isProvisionalFavorite(item.id);
  
  const isEquipped = (item: NormalizedItem) => {
    const currentEquipped = isAuthenticated ? equipped : equippedLocal;
    return currentEquipped[item.slot] === item.id;
  };
  
  // Filter and sort items
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    let filtered = items.filter(item => {
      // Ownership filter
      const owned = isOwned(item);
      const favorited = isFavorited(item);
      
      if (filterState === 'owned' && !owned) return false;
      if (filterState === 'favorites' && !favorited) return false;
      
      // Slot filter
      if (!selectedSlots.includes('all') && !selectedSlots.includes(item.slot)) {
        return false;
      }
      
      // Rarity filter
      if (rarityFilter !== 'all' && item.rarity !== rarityFilter) {
        return false;
      }
      
      return true;
    });
    
    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        
        case 'rarity': {
          const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
          const aRarity = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
          const bRarity = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
          return bRarity - aRarity; // Highest rarity first
        }
        
        case 'slot':
          return a.slot.localeCompare(b.slot);
        
        case 'recent':
          // Sort by creation date if available, otherwise by name
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return a.name.localeCompare(b.name);
        
        default:
          return a.name.localeCompare(b.name);
      }
    });
    
    return filtered;
  }, [items, filterState, selectedSlots, rarityFilter, sortBy, isAuthenticated, ownedIds, favoriteIds, equipped, equippedLocal]);
  
  // Stats
  const stats = useMemo(() => {
    const totalOwned = isAuthenticated ? ownedIds.size : useGuestStore.getState().ownedLocal.size;
    const totalFavorites = isAuthenticated ? favoriteIds.size : useGuestStore.getState().favoritesLocal.size;
    
    return {
      totalItems: items?.length || 0,
      filteredItems: filteredItems.length,
      totalOwned,
      totalFavorites,
      ownedInFiltered: filteredItems.filter(isOwned).length,
      favoritesInFiltered: filteredItems.filter(isFavorited).length,
      equippedInFiltered: filteredItems.filter(isEquipped).length
    };
  }, [filteredItems, items, isAuthenticated, ownedIds, favoriteIds, isOwned, isFavorited, isEquipped]);
  
  return {
    items: filteredItems,
    isLoading,
    isError,
    stats,
    // Helper functions for components
    isOwned,
    isFavorited,
    isEquipped
  };
}