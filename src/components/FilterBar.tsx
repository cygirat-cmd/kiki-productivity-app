import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Search, SlidersHorizontal, ChevronDown, Heart, Lock } from "lucide-react";

export type FilterState = 'all' | 'owned' | 'favorites';
export type SortOption = 'name' | 'rarity' | 'slot' | 'recent';
export type RarityFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterState: FilterState;
  onFilterChange: (filter: FilterState) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  rarityFilter: RarityFilter;
  onRarityChange: (rarity: RarityFilter) => void;
  ownedCount: number;
  favoritesCount: number;
  className?: string;
}

export default function FilterBar({ 
  searchTerm, 
  onSearchChange, 
  filterState, 
  onFilterChange,
  sortBy,
  onSortChange,
  rarityFilter,
  onRarityChange,
  ownedCount,
  favoritesCount,
  className = "" 
}: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case 'name': return 'Name';
      case 'rarity': return 'Rarity';
      case 'slot': return 'Category';
      case 'recent': return 'Recent';
      default: return 'Name';
    }
  };
  
  const getRarityLabel = (rarity: RarityFilter) => {
    switch (rarity) {
      case 'all': return 'All Rarities';
      case 'common': return 'Common';
      case 'rare': return 'Rare';
      case 'epic': return 'Epic';
      case 'legendary': return 'Legendary';
      default: return 'All Rarities';
    }
  };
  
  const getRarityColor = (rarity: RarityFilter) => {
    switch (rarity) {
      case 'common': return 'text-gray-600';
      case 'rare': return 'text-blue-600';
      case 'epic': return 'text-purple-600';
      case 'legendary': return 'text-yellow-600';
      default: return 'text-foreground';
    }
  };
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search items..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-12"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSearchChange('')}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            ×
          </Button>
        )}
      </div>
      
      {/* Primary Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          variant={filterState === 'all' ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange('all')}
          className="flex-shrink-0"
        >
          All Items
        </Button>
        <Button
          variant={filterState === 'owned' ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange('owned')}
          className="flex-shrink-0 flex items-center gap-1"
        >
          <Lock className="w-3 h-3" />
          Owned
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
            {ownedCount}
          </Badge>
        </Button>
        <Button
          variant={filterState === 'favorites' ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange('favorites')}
          className="flex-shrink-0 flex items-center gap-1"
        >
          <Heart className="w-3 h-3" />
          Favorites
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
            {favoritesCount}
          </Badge>
        </Button>
        
        {/* Advanced Toggle */}
        <Button
          variant={showAdvanced ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex-shrink-0 flex items-center gap-1 ml-auto"
        >
          <SlidersHorizontal className="w-3 h-3" />
          {showAdvanced ? 'Less' : 'More'}
        </Button>
      </div>
      
      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-shrink-0 flex items-center gap-1">
                Sort: {getSortLabel(sortBy)}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onSortChange('name')}>
                Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('rarity')}>
                Rarity
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('slot')}>
                Category
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('recent')}>
                Recent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Rarity Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-shrink-0 flex items-center gap-1">
                <span className={getRarityColor(rarityFilter)}>
                  {getRarityLabel(rarityFilter)}
                </span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onRarityChange('all')}>
                All Rarities
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRarityChange('common')} className="text-gray-600">
                Common
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRarityChange('rare')} className="text-blue-600">
                Rare
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRarityChange('epic')} className="text-purple-600">
                Epic
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRarityChange('legendary')} className="text-yellow-600">
                Legendary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}