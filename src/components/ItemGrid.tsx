import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Lock, MoreVertical } from "lucide-react";
import { type NormalizedItem } from "@/lib/supaShop";

interface ItemTileProps {
  item: NormalizedItem;
  isOwned: boolean;
  isFavorited: boolean;
  isEquipped: boolean;
  isPreview?: boolean;
  onTap: (item: NormalizedItem) => void;
  onFavoriteToggle: (item: NormalizedItem) => void;
  onLongPress: (item: NormalizedItem) => void;
  className?: string;
}

export function ItemTile({ 
  item, 
  isOwned, 
  isFavorited, 
  isEquipped, 
  isPreview = false,
  onTap, 
  onFavoriteToggle, 
  onLongPress,
  className = "" 
}: ItemTileProps) {
  
  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'rare': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'epic': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'legendary': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  const getRarityGlow = (rarity?: string) => {
    switch (rarity) {
      case 'rare': return 'shadow-blue-200/50';
      case 'epic': return 'shadow-purple-200/50';
      case 'legendary': return 'shadow-yellow-200/50';
      default: return '';
    }
  };
  
  return (
    <Card 
      className={`
        aspect-square cursor-pointer transition-all duration-200 relative group
        ${isEquipped ? 'ring-2 ring-primary bg-primary/5' : ''}
        ${isPreview ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        ${isOwned ? 'hover:shadow-lg hover:scale-105' : 'opacity-75 hover:opacity-90'}
        ${!isOwned ? 'cursor-not-allowed' : ''}
        ${getRarityGlow(item.rarity)}
        ${className}
      `}
      onClick={() => onTap(item)}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(item);
      }}
    >
      <CardContent className="p-3 flex flex-col h-full">
        {/* Item Image */}
        <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg mb-3 relative overflow-hidden">
          {item.assets.thumb ? (
            <img 
              src={item.assets.thumb} 
              alt={item.name}
              className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <span className="text-muted-foreground text-xs font-medium uppercase">
                {item.slot.slice(0, 2)}
              </span>
            </div>
          )}
          
          {/* Status Overlay */}
          <div className="absolute inset-0 flex items-start justify-between p-2">
            {/* Top Left - Status Indicators */}
            <div className="flex flex-col gap-1">
              {isEquipped && (
                <Badge className="bg-primary text-primary-foreground text-xs px-1 py-0">
                  ✓
                </Badge>
              )}
              {isPreview && (
                <Badge className="bg-blue-500 text-white text-xs px-1 py-0">
                  Preview
                </Badge>
              )}
            </div>
            
            {/* Top Right - Actions */}
            <div className="flex flex-col gap-1">
              {isFavorited && (
                <div className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                  <Heart className="h-2.5 w-2.5 fill-current" />
                </div>
              )}
            </div>
          </div>
          
          {/* Lock Overlay for unowned items */}
          {!isOwned && (
            <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center backdrop-blur-[1px]">
              <Lock className="w-6 h-6 text-white drop-shadow-sm" />
            </div>
          )}
        </div>
        
        {/* Item Info */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm leading-tight line-clamp-2" title={item.name}>
            {item.name}
          </h3>
          
          <div className="flex items-center justify-between gap-2">
            {/* Left - Category */}
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {item.slot}
            </Badge>
            
            {/* Right - Rarity */}
            {item.rarity && (
              <Badge className={`text-xs flex-shrink-0 ${getRarityColor(item.rarity)}`}>
                {item.rarity}
              </Badge>
            )}
          </div>
          
          {/* Tags (if space allows) */}
          {item.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {item.tags.slice(0, 1).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  +{item.tags.length - 1}
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Action Button (bottom right) */}
        {isOwned && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onLongPress(item);
            }}
            className="absolute bottom-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface ItemGridProps {
  items: NormalizedItem[];
  isOwned: (item: NormalizedItem) => boolean;
  isFavorited: (item: NormalizedItem) => boolean;
  isEquipped: (item: NormalizedItem) => boolean;
  previewItem?: NormalizedItem | null;
  onItemTap: (item: NormalizedItem) => void;
  onFavoriteToggle: (item: NormalizedItem) => void;
  onItemLongPress: (item: NormalizedItem) => void;
  className?: string;
}

export default function ItemGrid({ 
  items, 
  isOwned, 
  isFavorited, 
  isEquipped, 
  previewItem,
  onItemTap, 
  onFavoriteToggle, 
  onItemLongPress,
  className = "" 
}: ItemGridProps) {
  
  if (items.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-6xl">👗</div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-muted-foreground">No items found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters or search terms
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${className}`}>
      {items.map((item) => (
        <ItemTile
          key={item.id}
          item={item}
          isOwned={isOwned(item)}
          isFavorited={isFavorited(item)}
          isEquipped={isEquipped(item)}
          isPreview={previewItem?.id === item.id}
          onTap={onItemTap}
          onFavoriteToggle={onFavoriteToggle}
          onLongPress={onItemLongPress}
        />
      ))}
    </div>
  );
}