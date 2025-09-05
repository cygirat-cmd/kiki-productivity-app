import { saveKikiToCloud, getCurrentUser } from '@/lib/supabaseClient';
import { uploadKikiToCloud, addPetToFamilyTree } from '@/services/kikisync';
import { usePetStore } from '@/store';
import { REFETCH_INTERVALS, STORAGE_KEYS } from '@/constants';
import { 
  getPetFromStorage,
  getTasksFromStorage,
  getCemeteryFromStorage,
  getCoinsFromStorage,
  getPauseTokensFromStorage,
  getOwnedItemsFromStorage,
  getSessionStatsFromStorage,
  setLastCloudSyncToStorage
} from '@/utils/helpers';

let isSyncing = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN = REFETCH_INTERVALS.THIRTY_SECONDS; // 30 seconds between syncs

export const autoSyncToCloud = async () => {
  // Don't sync if already syncing or too recent
  const now = Date.now();
  if (isSyncing || (now - lastSyncTime) < SYNC_COOLDOWN) {
    return;
  }

  try {
    // Check if user is authenticated
    const { data: user } = await getCurrentUser();
    if (!user.user) {
      return; // Not authenticated, skip sync
    }

    isSyncing = true;
    lastSyncTime = now;

    // Use new Kiki sync system for comprehensive sync
    const syncResult = await uploadKikiToCloud();
    
    if (syncResult.success) {
      setLastCloudSyncToStorage(new Date().toISOString());
      console.log('✅ Full Kiki data auto-synced to cloud successfully');
    } else {
      console.log('⚠️ Auto-sync failed:', syncResult.error);
      
      // Fallback to old sync system if new one fails
      try {
        const saveData = {
          pet_data: getPetFromStorage(),
          tasks_data: getTasksFromStorage(),
          cemetery_data: getCemeteryFromStorage(),
          coins: getCoinsFromStorage(),
          pause_tokens: getPauseTokensFromStorage(),
          owned_items: getOwnedItemsFromStorage(),
          session_stats: getSessionStatsFromStorage()
        };

        const { error } = await saveKikiToCloud(saveData);
        if (!error) {
          console.log('✅ Fallback sync succeeded');
        }
      } catch (fallbackError) {
        console.log('⚠️ Fallback sync also failed:', fallbackError);
      }
    }
  } catch (err) {
    console.log('⚠️ Auto-sync error:', err);
  } finally {
    isSyncing = false;
  }
};

// Sync on key game events
export const syncOnTaskComplete = () => {
  // Small delay to ensure localStorage is updated
  setTimeout(() => {
    autoSyncToCloud();
  }, 1000);
};

export const syncOnPetDeath = () => {
  // Immediate sync for critical events
  autoSyncToCloud();
};