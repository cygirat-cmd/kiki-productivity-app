import { useState, useCallback } from 'react';
import { type FilterState, type SortOption, type RarityFilter } from '@/components/FilterBar';

export function useClosetFilters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>(['all']);
  const [filterState, setFilterState] = useState<FilterState>('owned');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  
  // Slot management
  const handleSlotToggle = useCallback((slotId: string) => {
    setSelectedSlots(prev => {
      if (slotId === 'all') {
        // Toggle all: if all is selected, deselect everything, otherwise select all
        return prev.includes('all') ? [] : ['all'];
      } else {
        // Remove 'all' if it's selected when clicking specific slots
        const withoutAll = prev.filter(s => s !== 'all');
        
        if (withoutAll.includes(slotId)) {
          // Deselect this slot
          const result = withoutAll.filter(s => s !== slotId);
          // If no slots selected, default to 'all'
          return result.length === 0 ? ['all'] : result;
        } else {
          // Select this slot
          return [...withoutAll, slotId];
        }
      }
    });
  }, []);
  
  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedSlots(['all']);
    setFilterState('all');
    setSortBy('name');
    setRarityFilter('all');
  }, []);
  
  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);
  
  // Quick filter presets
  const showOnlyOwned = useCallback(() => {
    setFilterState('owned');
    setSelectedSlots(['all']);
  }, []);
  
  const showOnlyFavorites = useCallback(() => {
    setFilterState('favorites');
    setSelectedSlots(['all']);
  }, []);
  
  const showBySlot = useCallback((slot: string) => {
    setSelectedSlots([slot]);
    setFilterState('all');
  }, []);
  
  return {
    // Current state
    searchTerm,
    selectedSlots,
    filterState,
    sortBy,
    rarityFilter,
    
    // Setters
    setSearchTerm,
    setSelectedSlots,
    setFilterState,
    setSortBy,
    setRarityFilter,
    
    // Actions
    handleSlotToggle,
    resetFilters,
    clearSearch,
    
    // Quick presets
    showOnlyOwned,
    showOnlyFavorites,
    showBySlot,
    
    // Derived state
    hasActiveFilters: searchTerm !== '' || 
                     !selectedSlots.includes('all') || 
                     filterState !== 'all' || 
                     sortBy !== 'name' || 
                     rarityFilter !== 'all',
                     
    isSearching: searchTerm !== '',
    isFilteringBySlot: !selectedSlots.includes('all'),
    isFilteringByRarity: rarityFilter !== 'all'
  };
}