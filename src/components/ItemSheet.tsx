import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter 
} from "@/components/ui/sheet";
import { Heart, ShoppingCart, Eye, X, Sparkles, Crown, Star } from "lucide-react";
import { type NormalizedItem } from "@/lib/supaShop";

interface ItemSheetProps {
  item: NormalizedItem | null;
  isOpen: boolean;
  onClose: () => void;
  isOwned: boolean;
  isFavorited: boolean;
  isEquipped: boolean;
  onEquip: (item: NormalizedItem) => void;
  onPreview: (item: NormalizedItem) => void;
  onFavoriteToggle: (item: NormalizedItem) => void;
  onPurchase?: (item: NormalizedItem) => void;
  className?: string;
}

export default function ItemSheet({ 
  item, 
  isOpen, 
  onClose, 
  isOwned, 
  isFavorited, 
  isEquipped,
  onEquip, 
  onPreview, 
  onFavoriteToggle,
  onPurchase,
  className = "" 
}: ItemSheetProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  if (!item) return null;
  
  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'rare': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'epic': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'legendary': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  const getRarityIcon = (rarity?: string) => {
    switch (rarity) {
      case 'rare': return <Star className="w-3 h-3" />;
      case 'epic': return <Sparkles className="w-3 h-3" />;
      case 'legendary': return <Crown className="w-3 h-3" />;
      default: return null;
    }
  };
  
  const handleAction = async (action: () => void | Promise<void>) => {
    setIsAnimating(true);
    try {
      await action();
    } finally {
      setTimeout(() => setIsAnimating(false), 200);
    }
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className={`rounded-t-3xl border-t max-h-[85vh] ${className}`}
      >
        <div className="flex flex-col h-full max-w-md mx-auto">
          <SheetHeader className="text-left space-y-4 pb-4">
            {/* Item Image */}
            <div className="flex items-center justify-center bg-muted/30 rounded-2xl p-6 relative">
              {item.assets.thumb ? (
                <img 
                  src={item.assets.thumb} 
                  alt={item.name}
                  className="max-w-24 max-h-24 object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-muted-foreground text-sm font-medium uppercase">
                    {item.slot.slice(0, 2)}
                  </span>
                </div>
              )}
              
              {/* Status indicators */}
              <div className="absolute top-3 right-3 flex gap-2">
                {isEquipped && (
                  <Badge className="bg-primary text-primary-foreground">
                    Equipped
                  </Badge>
                )}
                {isFavorited && (
                  <div className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                    <Heart className="h-3 w-3 fill-current" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Item Details */}
            <div className="space-y-3">
              <div>
                <SheetTitle className="text-xl font-bold">{item.name}</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground mt-1">
                  {item.description || `A ${item.rarity || 'common'} ${item.slot} item`}
                </SheetDescription>
              </div>
              
              {/* Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {item.slot}
                </Badge>
                {item.rarity && (
                  <Badge className={`text-xs flex items-center gap-1 ${getRarityColor(item.rarity)}`}>
                    {getRarityIcon(item.rarity)}
                    {item.rarity}
                  </Badge>
                )}
                {!isOwned && (
                  <Badge variant="destructive" className="text-xs">
                    Not Owned
                  </Badge>
                )}
              </div>
              
              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {item.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </SheetHeader>
          
          {/* Actions */}
          <SheetFooter className="flex-col space-y-3 pt-4">
            {isOwned ? (
              <div className="flex gap-2 w-full">
                {/* Preview Button */}
                <Button
                  variant="outline"
                  className="flex-1 flex items-center gap-2"
                  onClick={() => handleAction(() => onPreview(item))}
                  disabled={isAnimating}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </Button>
                
                {/* Equip/Unequip Button */}
                <Button
                  variant={isEquipped ? "destructive" : "default"}
                  className="flex-1 flex items-center gap-2"
                  onClick={() => handleAction(() => onEquip(item))}
                  disabled={isAnimating}
                >
                  {isEquipped ? (
                    <>
                      <X className="w-4 h-4" />
                      Unequip
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4" />
                      Equip
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                className="w-full flex items-center gap-2"
                onClick={() => handleAction(() => onPurchase?.(item))}
                disabled={isAnimating || !onPurchase}
              >
                <ShoppingCart className="w-4 h-4" />
                Purchase in Shop
              </Button>
            )}
            
            {/* Secondary Actions */}
            <div className="flex gap-2 w-full">
              {/* Favorite Toggle */}
              <Button
                variant={isFavorited ? "default" : "outline"}
                size="sm"
                className="flex-1 flex items-center gap-2"
                onClick={() => handleAction(() => onFavoriteToggle(item))}
                disabled={isAnimating}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                {isFavorited ? 'Favorited' : 'Add to Favorites'}
              </Button>
            </div>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}