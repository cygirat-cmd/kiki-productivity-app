import React, { memo, useMemo } from 'react';
import { Grid } from 'react-window';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  rarity?: string;
  owned?: boolean;
}

interface VirtualShopGridProps {
  items: ShopItem[];
  onPurchase: (item: ShopItem) => void;
  canAfford: (price: number) => boolean;
  getRarityColor: (rarity: string) => string;
  className?: string;
}

interface CellData {
  items: ShopItem[];
  columnCount: number;
  onPurchase: (item: ShopItem) => void;
  canAfford: (price: number) => boolean;
  getRarityColor: (rarity: string) => string;
}

// Simple fallback component for now - full implementation would handle all shop item logic
const ShopItemCard = memo(({ 
  item, 
  onPurchase, 
  canAfford, 
  getRarityColor 
}: {
  item: ShopItem;
  onPurchase: (item: ShopItem) => void;
  canAfford: (price: number) => boolean;
  getRarityColor: (rarity: string) => string;
}) => {
  const canOpen = canAfford(item.price);

  return (
    <Card className="p-3 h-full">
      <div className="text-center space-y-2">
        <div className="text-2xl">{item.emoji}</div>
        <h3 className="font-bold text-sm">{item.name}</h3>
        <div className="flex items-center justify-center space-x-1">
          <Coins className="w-3 h-3" />
          <span className="text-sm">{item.price}</span>
        </div>
        <Button
          onClick={() => onPurchase(item)}
          disabled={!canOpen}
          size="sm"
          className="w-full text-xs"
        >
          {canOpen ? "Buy" : "Too Expensive"}
        </Button>
      </div>
    </Card>
  );
});

ShopItemCard.displayName = 'ShopItemCard';

// Virtual grid cell component
const Cell = memo(({ columnIndex, rowIndex, style, data }: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: CellData;
}) => {
  const { items, columnCount, onPurchase, canAfford, getRarityColor } = data;
  const itemIndex = rowIndex * columnCount + columnIndex;
  const item = items[itemIndex];

  if (!item) {
    return <div style={style} />;
  }

  return (
    <div style={{ ...style, padding: '8px' }}>
      <ShopItemCard
        item={item}
        onPurchase={onPurchase}
        canAfford={canAfford}
        getRarityColor={getRarityColor}
      />
    </div>
  );
});

Cell.displayName = 'VirtualShopCell';

export const VirtualShopGrid: React.FC<VirtualShopGridProps> = ({
  items = [],
  onPurchase = () => {},
  canAfford = () => false,
  getRarityColor = () => "bg-gray-500",
  className = ""
}) => {
  // Calculate grid dimensions based on screen size
  const { columnCount, cellWidth, cellHeight } = useMemo(() => {
    const isMobile = window.innerWidth < 640;
    const isTablet = window.innerWidth < 1024;
    
    let cols = 1;
    if (!isMobile && isTablet) cols = 2;
    else if (!isTablet) cols = 3;
    
    return {
      columnCount: cols,
      cellWidth: isMobile ? 300 : isTablet ? 280 : 260,
      cellHeight: 200
    };
  }, []);

  const safeItems = Array.isArray(items) ? items : [];
  const rowCount = Math.ceil(safeItems.length / columnCount);
  const gridHeight = Math.min(500, rowCount * cellHeight); // Max height limit

  const cellData: CellData = useMemo(() => ({
    items: safeItems,
    columnCount,
    onPurchase,
    canAfford,
    getRarityColor
  }), [safeItems, columnCount, onPurchase, canAfford, getRarityColor]);

  if (safeItems.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No items available</p>
      </div>
    );
  }

  // Safety checks for Grid props
  if (rowCount <= 0 || columnCount <= 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No items to display</p>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <Grid
        columnCount={columnCount}
        columnWidth={cellWidth}
        height={gridHeight}
        rowCount={rowCount}
        rowHeight={cellHeight}
        itemData={cellData}
        className="virtual-shop-grid"
        style={{
          overflowX: 'hidden' // Prevent horizontal scroll
        }}
      >
        {Cell}
      </Grid>
    </div>
  );
};

export default VirtualShopGrid;