import React from 'react'
import { usePetStore } from './petStore'
import { useTaskStore } from './taskStore'
import { useTimerStore } from './timerStore'

// Export all stores
export { usePetStore, type Pet } from './petStore'
export { useTaskStore, type Task, type Category, type Subtask } from './taskStore'
export { useTimerStore, type TaskTimer, type SessionStats } from './timerStore'

// Export a combined hook for convenience
export const useStores = () => ({
  pet: usePetStore(),
  tasks: useTaskStore(),
  timer: useTimerStore(),
})

// Migration helper to move data from localStorage to stores
export const migrateFromLocalStorage = () => {
  const { setPet, setCoins, setPauseTokens, setInsurance, equipItem } = usePetStore.getState()
  const { tasks, categories } = useTaskStore.getState()
  const { sessionStats, updateSessionStats } = useTimerStore.getState()
  
  try {
    // Migrate pet data
    const savedPet = localStorage.getItem('kiki-pet')
    if (savedPet) {
      const pet = JSON.parse(savedPet)
      
      // Check if this pet should be dead
      const isDead = sessionStorage.getItem('pet-is-dead') === 'true'
      const deadPetName = sessionStorage.getItem('dead-pet-name')
      
      if (isDead && pet.name === deadPetName) {
        console.log('🚫 Migration blocked - pet is marked as dead:', pet.name)
        // Don't migrate dead pet, just remove from localStorage
        localStorage.removeItem('kiki-pet')
      } else {
        // Safe to migrate living pet
        setPet(pet)
        localStorage.removeItem('kiki-pet')
      }
    }
    
    // Migrate coins
    const savedCoins = localStorage.getItem('kiki-coins')
    if (savedCoins) {
      setCoins(JSON.parse(savedCoins))
      localStorage.removeItem('kiki-coins')
    }
    
    // Migrate pause tokens
    const savedTokens = localStorage.getItem('pause-tokens') || localStorage.getItem('kiki-pause-tokens')
    if (savedTokens) {
      setPauseTokens(JSON.parse(savedTokens))
      localStorage.removeItem('pause-tokens')
      localStorage.removeItem('kiki-pause-tokens')
    }
    
    // Migrate equipped items from old format if exists
    const savedEquipped = localStorage.getItem('kiki-equipped-items')
    if (savedEquipped) {
      const equipped = JSON.parse(savedEquipped)
      Object.entries(equipped).forEach(([slot, item]: [string, any]) => {
        if (item) {
          equipItem(parseInt(slot), item)
        }
      })
      localStorage.removeItem('kiki-equipped-items')
    }
    
    // Migrate insurance
    const savedInsurance = localStorage.getItem('pet-insurance')
    if (savedInsurance) {
      setInsurance(JSON.parse(savedInsurance))
      localStorage.removeItem('pet-insurance')
    }
    
    // Migrate session stats
    const savedStats = localStorage.getItem('session-stats')
    if (savedStats) {
      updateSessionStats(JSON.parse(savedStats))
      localStorage.removeItem('session-stats')
    }
    
    // Note: Tasks and categories migration would need to be handled separately
    // as they have different structure in localStorage vs store
    
    console.log('✅ Successfully migrated data from localStorage to Zustand stores')
  } catch (error) {
    console.error('❌ Error migrating data from localStorage:', error)
  }
}

// Simple initialization - just run migration if needed
export const initializeStores = () => {
  // Check for old localStorage data and migrate
  const hasOldData = localStorage.getItem('kiki-pet') || 
                    localStorage.getItem('kiki-coins') ||
                    localStorage.getItem('pause-tokens') ||
                    localStorage.getItem('kiki-pause-tokens') ||
                    localStorage.getItem('kiki-equipped-items')
  
  if (hasOldData) {
    console.log('🔄 Found old localStorage data, migrating to Zustand...')
    migrateFromLocalStorage()
  } else {
    console.log('✅ No old localStorage data found')
  }
}