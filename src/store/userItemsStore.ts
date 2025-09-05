import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  getUserState, 
  toggleFavorite as toggleFavoriteAPI, 
  equip as equipAPI,
  saveOutfit as saveOutfitAPI,
  loadOutfit as loadOutfitAPI,
  deleteOutfit as deleteOutfitAPI,
  addItemToInventory,
  type UserEquipped,
  type UserOutfit
} from '@/lib/userItems';
import { supabase } from '@/lib/supabaseClient';

type UserItemsState = {
  // State
  ownedIds: Set<number>;
  favoriteIds: Set<number>;
  equipped: UserEquipped;
  outfits: UserOutfit[];
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  loadUserState: () => Promise<void>;
  clearUserState: () => void;
  
  // Ownership
  checkOwnership: (itemId: number) => boolean;
  purchaseItem: (itemId: number, source?: string) => Promise<void>;
  
  // Favorites
  toggleFavorite: (itemId: number) => Promise<void>;
  isFavorite: (itemId: number) => boolean;
  
  // Equipment
  equipItem: (slot: keyof UserEquipped, itemId: number | null) => Promise<void>;
  getEquippedItem: (slot: keyof UserEquipped) => number | null;
  
  // Outfits
  saveCurrentOutfit: (name: string) => Promise<void>;
  loadOutfit: (outfitId: number) => Promise<void>;
  deleteOutfit: (outfitId: number) => Promise<void>;
  refreshOutfits: () => Promise<void>;
};

export const useUserItemsStore = create<UserItemsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      ownedIds: new Set(),
      favoriteIds: new Set(),
      equipped: {},
      outfits: [],
      isLoading: false,
      isAuthenticated: false,

      // Load all user state from Supabase
      loadUserState: async () => {
        try {
          set({ isLoading: true });
          
          // Get session from localStorage directly to avoid hanging Supabase calls
          const authKey = `sb-hwriwdbzervvmfpuzjqj-auth-token`;
          const authData = localStorage.getItem(authKey);
          let user = null;
          
          if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed.expires_at && parsed.expires_at > Date.now() / 1000) {
              user = parsed.user;
            }
          }
          
          if (!user) {
            set({ 
              isAuthenticated: false,
              ownedIds: new Set(),
              favoriteIds: new Set(),
              equipped: {},
              outfits: [],
              isLoading: false
            });
            return;
          }

          // User is authenticated, load their state
          try {
            const userState = await getUserState();
            
            set({ 
              ...userState,
              isAuthenticated: true,
              isLoading: false
            });
          } catch (error) {
            console.error('Failed to get user state, but user is authenticated:', error);
            // Set as authenticated but with empty state
            set({ 
              isAuthenticated: true,
              ownedIds: new Set(),
              favoriteIds: new Set(),
              equipped: {},
              outfits: [],
              isLoading: false
            });
          }
        } catch (error) {
          console.error('Failed to load user state:', error);
          set({ isLoading: false });
        }
      },

      // Clear user state on logout
      clearUserState: () => {
        set({
          ownedIds: new Set(),
          favoriteIds: new Set(),
          equipped: {},
          outfits: [],
          isAuthenticated: false,
          isLoading: false
        });
      },

      // Check if user owns an item
      checkOwnership: (itemId: number) => {
        return get().ownedIds.has(itemId);
      },

      // Purchase item and add to inventory
      purchaseItem: async (itemId: number, source = 'shop') => {
        const state = get();
        
        // Check authentication using the same method as useAuthBoot
        const authKey = `sb-hwriwdbzervvmfpuzjqj-auth-token`;
        const authData = localStorage.getItem(authKey);
        let isActuallyAuthenticated = false;
        
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            isActuallyAuthenticated = parsed.expires_at && parsed.expires_at > Date.now() / 1000;
          } catch (e) {
            isActuallyAuthenticated = false;
          }
        }
        
        if (!isActuallyAuthenticated) throw new Error('User not authenticated');
        if (state.ownedIds.has(itemId)) throw new Error('Item already owned');

        await addItemToInventory(itemId, source);
        
        // Update local state
        const newOwnedIds = new Set(state.ownedIds);
        newOwnedIds.add(itemId);
        set({ ownedIds: newOwnedIds });
      },

      // Toggle favorite status
      toggleFavorite: async (itemId: number) => {
        const state = get();
        if (!state.isAuthenticated) throw new Error('User not authenticated');

        const isFavorited = await toggleFavoriteAPI(itemId);
        
        // Update local state
        const newFavoriteIds = new Set(state.favoriteIds);
        if (isFavorited) {
          newFavoriteIds.add(itemId);
        } else {
          newFavoriteIds.delete(itemId);
        }
        set({ favoriteIds: newFavoriteIds });
      },

      // Check if item is favorited
      isFavorite: (itemId: number) => {
        return get().favoriteIds.has(itemId);
      },

      // Equip item to slot
      equipItem: async (slot: keyof UserEquipped, itemId: number | null) => {
        const state = get();
        if (!state.isAuthenticated) throw new Error('User not authenticated');
        
        if (itemId !== null && !state.ownedIds.has(itemId)) {
          throw new Error('Item not owned');
        }

        await equipAPI(slot, itemId);
        
        // Update local state
        set({
          equipped: {
            ...state.equipped,
            [slot]: itemId
          }
        });
      },

      // Get equipped item for slot
      getEquippedItem: (slot: keyof UserEquipped) => {
        return get().equipped[slot] || null;
      },

      // Save current equipped set as outfit
      saveCurrentOutfit: async (name: string) => {
        const state = get();
        if (!state.isAuthenticated) throw new Error('User not authenticated');

        await saveOutfitAPI(name, state.equipped);
        await get().refreshOutfits();
      },

      // Load outfit and equip all items
      loadOutfit: async (outfitId: number) => {
        const state = get();
        if (!state.isAuthenticated) throw new Error('User not authenticated');

        await loadOutfitAPI(outfitId);
        
        // Refresh equipped state
        const newEquipped = await import('@/lib/userItems').then(m => m.getEquipped());
        set({ equipped: newEquipped });
      },

      // Delete outfit
      deleteOutfit: async (outfitId: number) => {
        const state = get();
        if (!state.isAuthenticated) throw new Error('User not authenticated');

        await deleteOutfitAPI(outfitId);
        
        // Update local state
        set({
          outfits: state.outfits.filter(outfit => outfit.id !== outfitId)
        });
      },

      // Refresh outfits list
      refreshOutfits: async () => {
        const { getUserOutfits } = await import('@/lib/userItems');
        const outfits = await getUserOutfits();
        set({ outfits });
      }
    }),
    {
      name: 'user-items-store',
      partialize: (state) => ({
        // Don't persist user state - always load fresh from server
      })
    }
  )
);