import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Simple UUID generator for guest IDs
function generateGuestId(): string {
  return 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

type Slot = 'hair' | 'hat' | 'glasses' | 'mask' | 'shirt' | 'jacket' | 'backpack' | 'cape' | 'wings';

type GuestState = {
  guestId: string;
  ownedLocal: Set<number>;
  favoritesLocal: Set<number>;
  equippedLocal: Partial<Record<Slot, number | null>>;
  cartLocal: number[];
  provisionalReceipts: Array<{
    type: 'crate' | 'purchase';
    token: string;
    ts: number;
  }>;
  migrationCompleted: boolean; // Flag to prevent re-adding demo items
  migrationEverCompleted: boolean; // Persistent flag - never resets
};

type GuestActions = {
  // Core guest actions
  initGuestSession: () => void;
  clearGuestSession: () => void;
  
  // Provisional ownership
  addProvisionalItem: (itemId: number) => void;
  removeProvisionalItem: (itemId: number) => void;
  checkProvisionalOwnership: (itemId: number) => boolean;
  
  // Provisional favorites
  toggleProvisionalFavorite: (itemId: number) => void;
  isProvisionalFavorite: (itemId: number) => boolean;
  
  // Provisional equipment
  equipProvisionalItem: (slot: Slot, itemId: number | null) => void;
  getProvisionalEquipped: (slot: Slot) => number | null;
  
  // Cart management
  addToCart: (itemId: number) => void;
  removeFromCart: (itemId: number) => void;
  clearCart: () => void;
  
  // Token management
  addProvisionalReceipt: (type: 'crate' | 'purchase', token: string) => void;
  getProvisionalReceipts: () => Array<{ type: 'crate' | 'purchase'; token: string; ts: number; }>;
  clearExpiredReceipts: () => void;
  
  // Get guest state for migration
  getGuestState: () => GuestState;
};

type GuestStore = GuestState & GuestActions;

export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      // Initial state
      guestId: '',
      ownedLocal: new Set(),
      favoritesLocal: new Set(),
      equippedLocal: {},
      cartLocal: [],
      provisionalReceipts: [],
      migrationCompleted: false,
      migrationEverCompleted: false,

      // Initialize guest session with unique ID
      initGuestSession: () => {
        const currentState = get();
        if (!currentState.guestId) {
          set({ guestId: generateGuestId() });
        }
      },

      // Clear all guest data
      clearGuestSession: () => {
        const currentState = get();
        set({
          guestId: '',
          ownedLocal: new Set(),
          favoritesLocal: new Set(),
          equippedLocal: {},
          cartLocal: [],
          provisionalReceipts: [],
          migrationCompleted: true, // Mark migration as completed
          migrationEverCompleted: true // Persistent flag - never resets
        });
      },

      // Add item to provisional ownership
      addProvisionalItem: (itemId: number) => {
        const state = get();
        const newOwnedLocal = new Set(state.ownedLocal);
        newOwnedLocal.add(itemId);
        set({ ownedLocal: newOwnedLocal });
      },

      // Remove item from provisional ownership
      removeProvisionalItem: (itemId: number) => {
        const state = get();
        const newOwnedLocal = new Set(state.ownedLocal);
        newOwnedLocal.delete(itemId);
        
        // Also remove from favorites and equipment if present
        const newFavoritesLocal = new Set(state.favoritesLocal);
        newFavoritesLocal.delete(itemId);
        
        const newEquippedLocal = { ...state.equippedLocal };
        Object.keys(newEquippedLocal).forEach(slot => {
          if (newEquippedLocal[slot as Slot] === itemId) {
            newEquippedLocal[slot as Slot] = null;
          }
        });
        
        set({ 
          ownedLocal: newOwnedLocal,
          favoritesLocal: newFavoritesLocal,
          equippedLocal: newEquippedLocal
        });
      },

      // Check if item is provisionally owned
      checkProvisionalOwnership: (itemId: number) => {
        return get().ownedLocal.has(itemId);
      },

      // Toggle provisional favorite
      toggleProvisionalFavorite: (itemId: number) => {
        const state = get();
        const newFavoritesLocal = new Set(state.favoritesLocal);
        
        if (newFavoritesLocal.has(itemId)) {
          newFavoritesLocal.delete(itemId);
        } else {
          newFavoritesLocal.add(itemId);
        }
        
        set({ favoritesLocal: newFavoritesLocal });
      },

      // Check if item is provisionally favorited
      isProvisionalFavorite: (itemId: number) => {
        return get().favoritesLocal.has(itemId);
      },

      // Equip item provisionally
      equipProvisionalItem: (slot: Slot, itemId: number | null) => {
        const state = get();
        set({
          equippedLocal: {
            ...state.equippedLocal,
            [slot]: itemId
          }
        });
      },

      // Get provisionally equipped item
      getProvisionalEquipped: (slot: Slot) => {
        return get().equippedLocal[slot] || null;
      },

      // Add item to cart
      addToCart: (itemId: number) => {
        const state = get();
        if (!state.cartLocal.includes(itemId)) {
          set({ cartLocal: [...state.cartLocal, itemId] });
        }
      },

      // Remove item from cart
      removeFromCart: (itemId: number) => {
        const state = get();
        set({ cartLocal: state.cartLocal.filter(id => id !== itemId) });
      },

      // Clear cart
      clearCart: () => {
        set({ cartLocal: [] });
      },

      // Add provisional receipt
      addProvisionalReceipt: (type: 'crate' | 'purchase', token: string) => {
        const state = get();
        set({
          provisionalReceipts: [
            ...state.provisionalReceipts,
            { type, token, ts: Date.now() }
          ]
        });
      },

      // Get all provisional receipts
      getProvisionalReceipts: () => {
        return get().provisionalReceipts;
      },

      // Clear expired receipts (older than 24 hours)
      clearExpiredReceipts: () => {
        const state = get();
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        set({
          provisionalReceipts: state.provisionalReceipts.filter(
            receipt => (now - receipt.ts) < dayInMs
          )
        });
      },

      // Get complete guest state for migration
      getGuestState: () => {
        const state = get();
        return {
          guestId: state.guestId,
          ownedLocal: state.ownedLocal,
          favoritesLocal: state.favoritesLocal,
          equippedLocal: state.equippedLocal,
          cartLocal: state.cartLocal,
          provisionalReceipts: state.provisionalReceipts,
          migrationCompleted: state.migrationCompleted,
          migrationEverCompleted: state.migrationEverCompleted
        };
      }
    }),
    {
      name: 'guest-store',
      partialize: (state) => ({
        guestId: state.guestId,
        ownedLocal: Array.from(state.ownedLocal), // Convert Set to Array for persistence
        favoritesLocal: Array.from(state.favoritesLocal),
        equippedLocal: state.equippedLocal,
        cartLocal: state.cartLocal,
        provisionalReceipts: state.provisionalReceipts,
        migrationCompleted: state.migrationCompleted,
        migrationEverCompleted: state.migrationEverCompleted
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Sets after rehydration
          state.ownedLocal = new Set(state.ownedLocal as any);
          state.favoritesLocal = new Set(state.favoritesLocal as any);
        }
      }
    }
  )
);