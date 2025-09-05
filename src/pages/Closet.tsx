import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Home as HomeIcon, Clock, ShoppingBag, Cat, Shirt, RotateCcw } from "lucide-react";
import { type NormalizedItem } from "@/lib/supaShop";
import { useUserItemsStore } from "@/store/userItemsStore";
import { useGuestStore } from "@/store/guestStore";
import { useToast } from "@/hooks/useToast";
import { OutfitManager } from "@/components/OutfitManager";
import KikiStage from "@/components/KikiStage";
import SlotChips from "@/components/SlotChips";
import FilterBar from "@/components/FilterBar";
import ItemGrid from "@/components/ItemGrid";
import ItemSheet from "@/components/ItemSheet";
import { useClosetItems } from "@/hooks/useClosetItems";
import { useClosetFilters } from "@/hooks/useClosetFilters";

const Closet = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [previewItem, setPreviewItem] = useState<NormalizedItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<NormalizedItem | null>(null);
  const [isItemSheetOpen, setIsItemSheetOpen] = useState(false);
  
  const {
    ownedIds,
    favoriteIds,
    isAuthenticated,
    loadUserState,
    equipItem,
    toggleFavorite
  } = useUserItemsStore();

  const {
    toggleProvisionalFavorite,
    equipProvisionalItem
  } = useGuestStore();

  // Filter state management
  const {
    searchTerm,
    selectedSlots,
    filterState,
    sortBy,
    rarityFilter,
    setSearchTerm,
    setFilterState,
    setSortBy,
    setRarityFilter,
    handleSlotToggle,
    resetFilters,
    hasActiveFilters
  } = useClosetFilters();

  // Items data with filtering
  const {
    items: filteredItems,
    isLoading,
    isError,
    stats,
    isOwned,
    isFavorited,
    isEquipped
  } = useClosetItems({
    searchTerm,
    selectedSlots,
    filterState,
    sortBy,
    rarityFilter
  });

  // Load user state on component mount
  useEffect(() => {
    if (isAuthenticated) {
      loadUserState();
    }
  }, [isAuthenticated, loadUserState]);

  const handleEquipItem = async (item: NormalizedItem) => {
    if (!isOwned(item)) {
      toast({
        title: "Item not owned",
        description: "Purchase this item in the shop first",
        variant: "destructive"
      });
      return;
    }

    try {
      const currentlyEquipped = isEquipped(item);
      
      if (currentlyEquipped) {
        // Unequip item
        if (isAuthenticated) {
          await equipItem(item.slot, null);
        } else {
          equipProvisionalItem(item.slot, null);
        }
        
        toast({
          title: "Item unequipped",
          description: `${item.name} has been removed`
        });
      } else {
        // Equip item
        if (isAuthenticated) {
          await equipItem(item.slot, item.id);
        } else {
          equipProvisionalItem(item.slot, item.id);
        }
        
        toast({
          title: "Item equipped",
          description: `${item.name} is now equipped`
        });
      }
      
      // Clear preview
      setPreviewItem(null);
    } catch (error) {
      toast({
        title: "Failed to equip",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleToggleFavorite = async (item: NormalizedItem) => {
    try {
      if (isAuthenticated) {
        await toggleFavorite(item.id);
        const isFav = isFavorited(item);
        toast({
          title: isFav ? "Removed from favorites" : "Added to favorites",
          description: `${item.name} ${isFav ? 'unfavorited' : 'favorited'}`
        });
      } else {
        toggleProvisionalFavorite(item.id);
        const isFav = isFavorited(item);
        toast({
          title: isFav ? "Removed from favorites" : "Added to favorites",
          description: `${item.name} ${isFav ? 'unfavorited' : 'favorited'} (guest mode)`
        });
      }
    } catch (error) {
      toast({
        title: "Failed to update favorite",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handlePreviewItem = (item: NormalizedItem) => {
    if (!isOwned(item)) {
      // For unowned items, redirect to shop
      navigate('/shop');
      return;
    }
    
    setPreviewItem(item);
    toast({
      title: "Preview mode",
      description: `Previewing ${item.name}. Tap equip to confirm.`
    });
  };
  
  const handleItemTap = (item: NormalizedItem) => {
    if (isOwned(item)) {
      // For owned items, preview first
      handlePreviewItem(item);
    } else {
      // For unowned items, open item sheet
      setSelectedItem(item);
      setIsItemSheetOpen(true);
    }
  };
  
  const handleItemLongPress = (item: NormalizedItem) => {
    setSelectedItem(item);
    setIsItemSheetOpen(true);
  };
  
  const handlePurchase = (item: NormalizedItem) => {
    navigate('/shop');
    setIsItemSheetOpen(false);
  };
  
  const handleClearPreview = () => {
    setPreviewItem(null);
  };

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-6 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">😵</div>
          <h3 className="text-lg font-semibold mb-2">Oops!</h3>
          <p className="text-muted-foreground mb-4">Error loading closet items</p>
          <Button onClick={() => window.location.reload()} className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 pb-20">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-40">
        <div className="flex items-center justify-between p-4 max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/kiki")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Closet</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shirt className="w-4 h-4" />
              {stats.filteredItems}
            </Badge>
            {isAuthenticated && <OutfitManager />}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto">
        {/* Kiki Stage */}
        <div className="px-4 py-2">
          <KikiStage 
            previewItem={previewItem}
            className="mb-4"
          />
          
          {/* Preview Controls */}
          {previewItem && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500 text-white">
                  Preview
                </Badge>
                <span className="text-sm font-medium">{previewItem.name}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleEquipItem(previewItem)}
                >
                  Equip
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearPreview}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Filters */}
        <div className="px-4 space-y-3 mb-4">
          {/* Slot Chips */}
          <SlotChips
            selectedSlots={selectedSlots}
            onSlotToggle={handleSlotToggle}
          />
          
          {/* Filter Bar */}
          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterState={filterState}
            onFilterChange={setFilterState}
            sortBy={sortBy}
            onSortChange={setSortBy}
            rarityFilter={rarityFilter}
            onRarityChange={setRarityFilter}
            ownedCount={stats.totalOwned}
            favoritesCount={stats.totalFavorites}
          />
          
          {/* Reset Filters */}
          {hasActiveFilters && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset filters
              </Button>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <ItemGrid
              items={filteredItems}
              isOwned={isOwned}
              isFavorited={isFavorited}
              isEquipped={isEquipped}
              previewItem={previewItem}
              onItemTap={handleItemTap}
              onFavoriteToggle={handleToggleFavorite}
              onItemLongPress={handleItemLongPress}
            />
          )}
        </div>
      </div>

      {/* Item Detail Sheet */}
      <ItemSheet
        item={selectedItem}
        isOpen={isItemSheetOpen}
        onClose={() => setIsItemSheetOpen(false)}
        isOwned={selectedItem ? isOwned(selectedItem) : false}
        isFavorited={selectedItem ? isFavorited(selectedItem) : false}
        isEquipped={selectedItem ? isEquipped(selectedItem) : false}
        onEquip={handleEquipItem}
        onPreview={handlePreviewItem}
        onFavoriteToggle={handleToggleFavorite}
        onPurchase={handlePurchase}
      />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border z-30">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/home")}>
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/board")}>
            <Clock className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/kiki")}>
            <Cat className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/shop")}>
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Closet;