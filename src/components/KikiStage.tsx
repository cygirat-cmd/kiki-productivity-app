import { useEffect, useRef, useMemo } from "react";
import AnimatedKiki from "@/components/AnimatedKiki";
import { usePetStore } from "@/store";
import { useUserItemsStore } from "@/store/userItemsStore";
import { useGuestStore } from "@/store/guestStore";
import { type NormalizedItem } from "@/lib/supaShop";

interface KikiStageProps {
  previewItem?: NormalizedItem | null;
  className?: string;
}

export default function KikiStage({ previewItem, className = "" }: KikiStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { equippedItems: legacyEquipped, equipItem: equipLegacy, removeItem: removeLegacy } = usePetStore();
  const { isAuthenticated, equipped: userEquipped } = useUserItemsStore();
  const { equippedLocal: guestEquipped } = useGuestStore();
  
  // Get current equipped items from appropriate store
  const currentEquipped = isAuthenticated ? userEquipped : guestEquipped;
  
  // Create preview state by merging equipped + preview
  const previewEquippedState = useMemo(() => {
    if (!previewItem) return currentEquipped;
    
    return {
      ...currentEquipped,
      [previewItem.slot]: previewItem.id
    };
  }, [currentEquipped, previewItem]);
  
  // Sync preview state to legacy store for AnimatedKiki
  useEffect(() => {
    // Convert slot names to numbers and create legacy format
    const slotNameToNumber: Record<string, number> = {
      'hair': 1, 'hat': 2, 'glasses': 3, 'mask': 4, 'shirt': 5,
      'jacket': 6, 'backpack': 7, 'cape': 8, 'wings': 9
    };
    
    // Create target legacy state
    const targetLegacyState: Record<number, any> = { 1: null, 2: null, 3: null, 4: null };
    
    for (const [slotName, itemId] of Object.entries(previewEquippedState)) {
      const slotNumber = slotNameToNumber[slotName];
      if (slotNumber && itemId) {
        // For preview, we need to create a mock item object
        if (previewItem && previewItem.slot === slotName && previewItem.id === itemId) {
          targetLegacyState[slotNumber] = {
            id: previewItem.id,
            name: previewItem.name,
            icon: '👑', // Default icon
            rarity: previewItem.rarity || 'common'
          };
        } else {
          // Use existing equipped item
          const existingLegacy = legacyEquipped[slotNumber];
          if (existingLegacy?.id === itemId) {
            targetLegacyState[slotNumber] = existingLegacy;
          } else {
            // Mock item for equipped state
            targetLegacyState[slotNumber] = {
              id: itemId,
              name: 'Unknown Item',
              icon: '👑',
              rarity: 'common'
            };
          }
        }
      }
    }
    
    // Apply changes to legacy store only if different
    let hasChanges = false;
    for (const [slotNumber, targetItem] of Object.entries(targetLegacyState)) {
      const slot = parseInt(slotNumber);
      const currentLegacy = legacyEquipped[slot];
      
      if (JSON.stringify(currentLegacy) !== JSON.stringify(targetItem)) {
        hasChanges = true;
        if (targetItem) {
          equipLegacy(slot, targetItem);
        } else {
          removeLegacy(slot);
        }
      }
    }
    
    if (hasChanges) {
      console.log('🎭 KikiStage synced preview state to legacy store');
    }
  }, [previewEquippedState, legacyEquipped, equipLegacy, removeLegacy, previewItem]);
  
  return (
    <div 
      ref={stageRef}
      className={`flex items-center justify-center relative ${className}`}
      style={{ minHeight: '360px' }}
    >
      {/* AnimatedKiki uses the legacy store which we're syncing above */}
      <AnimatedKiki />
      
      {/* Preview indicator when in preview mode */}
      {previewItem && (
        <div className="absolute top-2 left-2 bg-blue-500/90 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
          Preview: {previewItem.name}
        </div>
      )}
    </div>
  );
}