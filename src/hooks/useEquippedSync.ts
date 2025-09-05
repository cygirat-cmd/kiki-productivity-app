import { useEffect } from 'react';
import { useUserItemsStore } from '@/store/userItemsStore';
import { useGuestStore } from '@/store/guestStore';
import { usePetStore } from '@/store/petStore';
import { fetchItemsPage } from '@/lib/supaShop';

// Map slot names to slot numbers for legacy compatibility
const SLOT_NAME_TO_NUMBER: Record<string, number> = {
  'hair': 1,
  'hat': 2, 
  'glasses': 3,
  'mask': 4,
  'shirt': 5,
  'jacket': 6,
  'backpack': 7,
  'cape': 8,
  'wings': 9
};

// Map slot numbers to slot names
const SLOT_NUMBER_TO_NAME: Record<number, string> = {
  1: 'hair',
  2: 'hat',
  3: 'glasses', 
  4: 'mask',
  5: 'shirt',
  6: 'jacket',
  7: 'backpack',
  8: 'cape',
  9: 'wings'
};

/**
 * Hook that syncs equipped items between new Supabase system and legacy PetStore
 * This ensures AnimatedKiki and other legacy components still work
 */
export function useEquippedSync() {
  const { isAuthenticated, equipped: userEquipped } = useUserItemsStore();
  const { equippedLocal: guestEquipped } = useGuestStore();
  const { equipItem: equipLegacyItem, equippedItems: legacyEquipped } = usePetStore();

  useEffect(() => {
    const syncEquippedItems = async () => {
      try {
        // Get current equipped items from appropriate store
        const currentEquipped = isAuthenticated ? userEquipped : guestEquipped;
        
        // Convert to legacy format for AnimatedKiki
        const legacyUpdates: Record<number, any> = {};
        
        for (const [slotName, itemId] of Object.entries(currentEquipped)) {
          const slotNumber = SLOT_NAME_TO_NUMBER[slotName];
          
          if (itemId && slotNumber) {
            try {
              // Fetch item details from Supabase
              const { items } = await fetchItemsPage({
                limit: 1,
                page: 1,
                search: '',
                itemIds: [itemId]
              });
              
              const item = items[0];
              if (item) {
                legacyUpdates[slotNumber] = {
                  id: item.id,
                  name: item.name,
                  icon: '👑', // Default icon
                  rarity: item.rarity || 'common'
                };
              }
            } catch (error) {
              console.warn(`Failed to fetch item ${itemId} for sync:`, error);
            }
          } else if (slotNumber) {
            // Clear slot if no item equipped
            legacyUpdates[slotNumber] = null;
          }
        }
        
        // Apply updates to legacy store
        for (const [slotNumber, itemData] of Object.entries(legacyUpdates)) {
          const slot = parseInt(slotNumber);
          const currentLegacyItem = legacyEquipped[slot];
          
          // Only update if different
          if (JSON.stringify(currentLegacyItem) !== JSON.stringify(itemData)) {
            equipLegacyItem(slot, itemData);
          }
        }
        
      } catch (error) {
        console.error('Equipment sync failed:', error);
      }
    };

    // Sync when equipped items change
    syncEquippedItems();
  }, [userEquipped, guestEquipped, isAuthenticated, equipLegacyItem, legacyEquipped]);

  return {
    // Helper to convert legacy slot number to new slot name
    getSlotName: (slotNumber: number) => SLOT_NUMBER_TO_NAME[slotNumber],
    // Helper to convert new slot name to legacy slot number  
    getSlotNumber: (slotName: string) => SLOT_NAME_TO_NUMBER[slotName]
  };
}