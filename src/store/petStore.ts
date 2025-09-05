import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Pet {
  id?: string
  type: string
  name: string
  adoptedAt: string
  streak: number
  lastTaskDate?: string
  sessionsCompleted?: number
  mutations?: string[]
  usedAdRevival?: boolean
}

interface PetState {
  // State
  pet: Pet | null
  coins: number
  dna: number
  pauseTokens: number
  insurance: boolean
  equippedItems: {[key: number]: {id: number; name: string; icon: string; rarity: string} | null}
  
  // Actions
  setPet: (pet: Pet | null) => void
  updatePet: (updates: Partial<Pet>) => void
  killPet: () => void
  revivePet: (newPet: Pet) => void
  
  // Coins
  addCoins: (amount: number) => void
  spendCoins: (amount: number) => boolean
  setCoins: (amount: number) => void
  
  // DNA
  addDna: (amount: number) => void
  spendDna: (amount: number) => boolean
  setDna: (amount: number) => void
  
  // Pause tokens
  addPauseTokens: (amount: number) => void
  usePauseToken: () => boolean
  setPauseTokens: (amount: number) => void
  
  // Insurance
  setInsurance: (hasInsurance: boolean) => void
  useInsurance: () => boolean
  
  // Equipped items
  equipItem: (slot: number, item: {id: number; name: string; icon: string; rarity: string}) => void
  removeItem: (slot: number) => void
  
  // Complex actions
  incrementStreak: () => void
  completeSession: () => void
}

export const usePetStore = create<PetState>()(
  persist(
    (set, get) => ({
      // Initial state
      pet: null,
      coins: 0,
      dna: 0,
      pauseTokens: 0,
      insurance: false,
      equippedItems: { 1: null, 2: null, 3: null, 4: null },
      
      // Pet actions
      setPet: (pet) => {
        console.log('🔄 PetStore setPet called:', { 
          pet: pet ? { name: pet.name, id: pet.id } : null,
          isDead: sessionStorage.getItem('pet-is-dead') === 'true',
          deadName: sessionStorage.getItem('dead-pet-name'),
          stack: new Error().stack?.split('\n')[1]
        });
        set({ pet });
      },
      
      updatePet: (updates) => set((state) => ({
        pet: state.pet ? { ...state.pet, ...updates } : null
      })),
      
      killPet: () => {
        console.log('💀 PetStore killPet called:', {
          stack: new Error().stack?.split('\n')[1]
        });
        set({ pet: null });
      },
      
      revivePet: (newPet) => {
        console.log('💖 PetStore revivePet called:', {
          newPet: newPet ? { name: newPet.name, id: newPet.id } : null,
          stack: new Error().stack?.split('\n')[1]
        });
        set({ pet: newPet });
      },
      
      // Coins actions
      addCoins: (amount) => set((state) => ({ 
        coins: state.coins + amount 
      })),
      
      spendCoins: (amount) => {
        const state = get()
        if (state.coins >= amount) {
          set({ coins: state.coins - amount })
          return true
        }
        return false
      },
      
      setCoins: (amount) => set({ coins: amount }),
      
      // DNA actions
      addDna: (amount) => set((state) => ({ 
        dna: state.dna + amount 
      })),
      
      spendDna: (amount) => {
        const state = get()
        if (state.dna >= amount) {
          set({ dna: state.dna - amount })
          return true
        }
        return false
      },
      
      setDna: (amount) => set({ dna: amount }),
      
      // Pause tokens actions
      addPauseTokens: (amount) => set((state) => ({ 
        pauseTokens: state.pauseTokens + amount 
      })),
      
      usePauseToken: () => {
        const state = get()
        if (state.pauseTokens > 0) {
          set({ pauseTokens: state.pauseTokens - 1 })
          return true
        }
        return false
      },
      
      setPauseTokens: (amount) => set({ pauseTokens: amount }),
      
      // Insurance actions
      setInsurance: (hasInsurance) => set({ insurance: hasInsurance }),
      
      useInsurance: () => {
        const state = get()
        if (state.insurance) {
          set({ insurance: false })
          return true
        }
        return false
      },
      
      // Equipped items actions
      equipItem: (slot, item) => set((state) => ({
        equippedItems: { ...state.equippedItems, [slot]: item }
      })),
      
      removeItem: (slot) => set((state) => ({
        equippedItems: { ...state.equippedItems, [slot]: null }
      })),
      
      // Complex actions
      incrementStreak: () => set((state) => ({
        pet: state.pet ? { 
          ...state.pet, 
          streak: state.pet.streak + 1,
          lastTaskDate: new Date().toDateString()
        } : null
      })),
      
      completeSession: () => set((state) => ({
        pet: state.pet ? {
          ...state.pet,
          sessionsCompleted: (state.pet.sessionsCompleted || 0) + 1
        } : null
      }))
    }),
    {
      name: 'kiki-pet-store', // Will use separate storage from legacy
      partialize: (state) => ({
        pet: state.pet,
        coins: state.coins,
        dna: state.dna,
        pauseTokens: state.pauseTokens,
        insurance: state.insurance,
        equippedItems: state.equippedItems,
      }),
      // Custom merge function to prevent dead pets from being restored
      merge: (persistedState: any, currentState: any) => {
        const merged = { ...currentState, ...persistedState };
        
        // Check multiple death flags
        const isDead = sessionStorage.getItem('pet-is-dead') === 'true';
        const deadPetName = sessionStorage.getItem('dead-pet-name');
        const deathTimestamp = sessionStorage.getItem('death-timestamp');
        const lastDeath = localStorage.getItem('last-pet-death');
        
        console.log('🔄 Store merge function called:', {
          persistedPet: persistedState?.pet ? { name: persistedState.pet.name } : null,
          isDead,
          deadPetName,
          willBlock: persistedState?.pet && isDead && persistedState.pet.name === deadPetName
        });
        
        // If pet exists in persisted state but is marked as dead, don't restore it
        if (merged.pet && isDead && merged.pet.name === deadPetName) {
          console.log('🚫🚫🚫 BLOCKED dead pet restoration:', merged.pet.name, 'Death timestamp:', deathTimestamp);
          merged.pet = null;
        }
        
        // Additional check: if we have recent death timestamp, block any pet restoration
        if (merged.pet && lastDeath) {
          const deathTime = parseInt(lastDeath);
          const timeSinceDeath = Date.now() - deathTime;
          if (timeSinceDeath < 60000) { // 1 minute grace period
            console.log('🚫🚫🚫 BLOCKED pet restoration due to recent death:', timeSinceDeath, 'ms ago');
            merged.pet = null;
          }
        }
        
        return merged;
      }
    }
  )
)