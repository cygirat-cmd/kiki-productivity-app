import React, { useState } from 'react';
import { useShopItems } from '@/hooks/useShopItems';
import { useOwnedItems } from '@/hooks/useOwnedItems';
import { type NormalizedItem, type Filters } from '@/lib/supaShop';
import { useUserItemsStore } from '@/store/userItemsStore';
import { useGuestStore } from '@/store/guestStore';
import { usePetStore } from '@/store';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Lock, Heart, Coins } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

type ShopGridProps = {
  onItemSelect?: (item: NormalizedItem) => void;
  showFilters?: boolean;
  className?: string;
};

export function ShopGrid({ onItemSelect, showFilters = true, className = '' }: ShopGridProps) {
  const [filters, setFilters] = useState<Filters>({
    q: '',
    slot: undefined,
    rarity: undefined,
    sort: 'latest'
  });

  const { data: items = [], isLoading, isFetching, isError, error } = useShopItems(filters);

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (isError) return <ErrorState msg={String(error)} />;
  if (isLoading) return <SkeletonGrid />;
  if (items.length === 0) return <EmptyState text="Brak przedmiotów (sprawdź filtry)" />;

  return (
    <div className={`space-y-6 ${className}`}>
      {showFilters && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search items..."
              value={filters.q}
              onChange={(e) => handleFilterChange('q', e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters Row */}
          <div className="flex gap-4 flex-wrap">
            <Select
              value={filters.slot || 'all'}
              onValueChange={(value) => handleFilterChange('slot', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Slots</SelectItem>
                <SelectItem value="hair">Hair</SelectItem>
                <SelectItem value="hat">Hat</SelectItem>
                <SelectItem value="glasses">Glasses</SelectItem>
                <SelectItem value="mask">Mask</SelectItem>
                <SelectItem value="shirt">Shirt</SelectItem>
                <SelectItem value="jacket">Jacket</SelectItem>
                <SelectItem value="backpack">Backpack</SelectItem>
                <SelectItem value="cape">Cape</SelectItem>
                <SelectItem value="wings">Wings</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.rarity || 'all'}
              onValueChange={(value) => handleFilterChange('rarity', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rarities</SelectItem>
                <SelectItem value="common">Common</SelectItem>
                <SelectItem value="rare">Rare</SelectItem>
                <SelectItem value="epic">Epic</SelectItem>
                <SelectItem value="legendary">Legendary</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.sort}
              onValueChange={(value) => handleFilterChange('sort', value)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="price_asc">Price Low-High</SelectItem>
                <SelectItem value="price_desc">Price High-Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Items Grid */}
      <ItemsGrid items={items} onItemSelect={onItemSelect} />
    </div>
  );
}

function ErrorState({ msg }: { msg: string }) {
  const errorMsg = msg || 'Unknown error';
  const displayMsg = typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : String(errorMsg);
  
  return (
    <div className="text-center py-8">
      <p className="text-red-500">Error loading items: {displayMsg}</p>
      <Button 
        variant="outline" 
        onClick={() => window.location.reload()}
        className="mt-4"
      >
        Retry
      </Button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[200px]">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="aspect-square">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8 text-gray-500">
      <p>{text}</p>
    </div>
  );
}

function ItemsGrid({ items, onItemSelect }: { items: NormalizedItem[]; onItemSelect?: (item: NormalizedItem) => void; }) {
  const { ownedSet, isAuthenticated } = useOwnedItems();
  const { coins = 0 } = usePetStore();
  const { 
    isFavorite,
    purchaseItem 
  } = useUserItemsStore();
  
  const {
    isProvisionalFavorite,
    addProvisionalItem,
    addProvisionalReceipt
  } = useGuestStore();
  
  const { toast } = useToast();

  const handlePurchaseItem = async (item: NormalizedItem) => {
    const owned = ownedSet.has(item.id);
    const canBuy = !owned && (isAuthenticated ? coins >= item.price : true);
    
    if (owned) {
      toast({
        title: "Already owned",
        description: "You already own this item",
        variant: "destructive"
      });
      return;
    }

    if (isAuthenticated && coins < item.price) {
      toast({
        title: "Not enough coins",
        description: `Need ${item.price} coins, you have ${coins}`,
        variant: "destructive"
      });
      return;
    }

    try {
      if (isAuthenticated) {
        // Authenticated purchase - deduct coins first
        const { setCoins } = usePetStore.getState();
        setCoins(coins - item.price);
        
        await purchaseItem(item.id, 'shop');
        
        toast({
          title: "Item purchased!",
          description: `${item.name} added to your collection`,
        });
      } else {
        // Guest purchase - simplified flow without Supabase functions
        const tempToken = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Deduct coins from guest balance
        const { setCoins } = usePetStore.getState();
        setCoins(coins - item.price);
        
        // Add to provisional state immediately
        addProvisionalItem(item.id);
        addProvisionalReceipt('purchase', tempToken);

        toast({
          title: "Item purchased!",
          description: `${item.name} added to your collection (will sync when you log in)`,
        });
      }
      
      onItemSelect?.(item);
    } catch (error) {
      // Restore coins if authenticated purchase failed
      if (isAuthenticated) {
        const { setCoins } = usePetStore.getState();
        setCoins(coins); // Restore original coin amount
      }
      
      toast({
        title: "Purchase failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[200px]">
      {items.map((item) => {
        const owned = ownedSet.has(item.id);
        const favorited = isAuthenticated ? isFavorite(item.id) : isProvisionalFavorite(item.id);
        
        return (
          <ItemCard 
            key={item.id} 
            item={item} 
            owned={owned}
            favorited={favorited}
            isAuthenticated={isAuthenticated}
            coins={coins}
            onClick={() => handlePurchaseItem(item)}
          />
        );
      })}
    </div>
  );
}

function ItemCard({ item, owned, favorited, isAuthenticated, coins, onClick }: { 
  item: NormalizedItem; 
  owned: boolean;
  favorited: boolean;
  isAuthenticated: boolean;
  coins: number;
  onClick?: () => void;
}) {
  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800';
      case 'rare': return 'bg-blue-100 text-blue-800';
      case 'epic': return 'bg-purple-100 text-purple-800';
      case 'legendary': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card 
      className={`aspect-square cursor-pointer transition-all relative ${
        owned 
          ? 'hover:shadow-lg hover:scale-105 ring-1 ring-green-200' 
          : 'hover:shadow-lg opacity-90'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col h-full">
        {/* Item Image */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg mb-3 relative">
          {item.assets.thumb ? (
            <img 
              src={item.assets.thumb} 
              alt={item.name}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-400 text-xs">{item.slot}</span>
            </div>
          )}

          {/* Status indicators */}
          <div className="absolute top-1 right-1 flex gap-1">
            {favorited && (
              <div className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                <Heart className="h-3 w-3 fill-current" />
              </div>
            )}
            {owned && (
              <div className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                <span className="text-xs">✓</span>
              </div>
            )}
          </div>

          {/* Lock overlay for unowned items - only show for authenticated users who can't afford */}
          {!owned && isAuthenticated && coins < item.price && (
            <div className="absolute inset-0 bg-black/10 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-gray-600" />
            </div>
          )}
        </div>

        {/* Item Info */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm truncate" title={item.name}>
            {item.name}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Coins className="w-3 h-3 text-yellow-500" />
              <span className="text-sm font-bold text-green-600">
                {item.price}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {owned && (
                <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                  Owned
                </Badge>
              )}
              {item.rarity && (
                <Badge variant="secondary" className={`text-xs ${getRarityColor(item.rarity)}`}>
                  {item.rarity}
                </Badge>
              )}
            </div>
          </div>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {item.tags.slice(0, 2).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{item.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}