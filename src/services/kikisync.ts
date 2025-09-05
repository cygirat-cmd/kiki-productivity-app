import { supabase } from '@/lib/supabaseClient';
import { usePetStore, useTimerStore } from '@/store';
import type { Pet } from '@/store';
import { isValidUuid, generateValidUuid } from '@/utils/uuidFixer';

/**
 * Wait for a valid Supabase session with retry logic
 */
async function waitForValidSession(maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Debug: log full session structure
    console.log(`🔍 Session debug attempt ${attempt}:`, { 
      session: session, 
      user: session?.user,
      sessionKeys: session ? Object.keys(session) : 'no session',
      error: error?.message 
    });
    
    if (!error && session?.user) {
      console.log(`✅ Valid session found on attempt ${attempt}`);
      return { session, error: null };
    }
    
    console.log(`⏳ Session not ready on attempt ${attempt}/${maxRetries}:`, { 
      hasSession: !!session, 
      hasUser: !!session?.user, 
      error: error?.message 
    });
    
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Final attempt
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

export interface SyncData {
  pet: Pet | null;
  stats: {
    totalSessions: number;
    pausesUsed: number;
    totalFocusTime: number;
    averageSessionLength: number;
    longestSession: number;
    tasksCompleted: number;
    lastSessionDate?: string;
    coins: number;
    dna: number;
    pauseTokens: number;
    insurance: boolean;
  };
  equippedItems: Record<number, any>;
  familyTree?: any[];
}

export interface SyncResult {
  success: boolean;
  error?: string;
  synced_at?: string;
  pet_id?: string;
}

/**
 * Upload full Kiki data to cloud storage
 */
export async function uploadKikiToCloud(): Promise<SyncResult> {
  try {
    // Wait for valid session with retry logic
    console.log('🔄 Waiting for valid session before upload...');
    const { session, error: sessionError } = await waitForValidSession();
    if (sessionError || !session?.user) {
      console.error('Upload session check failed after retries:', { sessionError, hasUser: !!session?.user });
      return { success: false, error: 'Not authenticated' };
    }

    // Get current state from stores
    const petState = usePetStore.getState();
    const timerState = useTimerStore.getState();
    
    const pet = petState.pet;
    if (!pet) {
      return { success: false, error: 'No pet to sync' };
    }

    // Fix pet ID if it's invalid UUID format
    let petId = pet.id;
    if (petId && !isValidUuid(petId)) {
      console.log(`Invalid pet ID detected: ${petId}, generating new UUID`);
      petId = generateValidUuid();
      // Update the pet store with the new valid ID
      petState.updatePet({ id: petId });
    }

    // Prepare pet data with cloud ID if exists
    const petData = {
      id: petId || null, // Keep existing cloud ID if available
      name: pet.name,
      type: pet.type,
      adoptedAt: pet.adoptedAt,
      streak: pet.streak,
      lastTaskDate: pet.lastTaskDate,
      sessionsCompleted: pet.sessionsCompleted || 0,
      mutations: pet.mutations || [],
      usedAdRevival: pet.usedAdRevival || false
    };

    // Prepare stats data (combine pet store and timer store)
    const statsData = {
      totalSessions: timerState.sessionStats.totalSessions,
      pausesUsed: timerState.sessionStats.pausesUsed,
      totalFocusTime: timerState.sessionStats.totalFocusTime,
      averageSessionLength: timerState.sessionStats.averageSessionLength,
      longestSession: timerState.sessionStats.longestSession,
      tasksCompleted: timerState.sessionStats.tasksCompleted,
      lastSessionDate: timerState.sessionStats.lastSessionDate,
      coins: petState.coins,
      dna: petState.dna,
      pauseTokens: petState.pauseTokens,
      insurance: petState.insurance
    };

    // Prepare equipped items
    const equippedData = petState.equippedItems;

    console.log('🔄 Uploading Kiki to cloud:', {
      petName: pet.name,
      petId: pet.id,
      coins: petState.coins,
      streak: pet.streak,
      totalSessions: timerState.sessionStats.totalSessions,
      equippedItems: equippedData,
      hasEquippedItems: Object.keys(equippedData || {}).length > 0
    });

    // Call RPC to sync data
    const { data, error } = await supabase.rpc('sync_pet_to_cloud', {
      p_pet_data: petData,
      p_user_stats: statsData,
      p_equipped_items: equippedData
    });

    if (error) {
      console.error('Failed to sync pet to cloud:', error);
      return { success: false, error: error.message };
    }

    // Update local pet with cloud ID if we got one back
    if (data?.pet_id && !pet.id) {
      petState.updatePet({ id: data.pet_id });
    }

    console.log('✅ Pet synced to cloud successfully:', data);
    
    // Log debug information if available
    if (data?.debug) {
      console.log('🐛 Sync debug information:');
      data.debug.forEach((step: any, index: number) => {
        console.log(`   ${index + 1}. ${step.step}:`, step);
      });
    }

    return {
      success: true,
      synced_at: data.synced_at,
      pet_id: data.pet_id
    };

  } catch (error: any) {
    console.error('Sync upload error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Download full Kiki data from cloud storage
 */
export async function downloadKikiFromCloud(): Promise<SyncResult & { data?: SyncData }> {
  try {
    // Wait for valid session with retry logic
    console.log('🔄 Waiting for valid session before download...');
    const { session, error: sessionError } = await waitForValidSession();
    if (sessionError || !session?.user) {
      console.error('Download session check failed after retries:', { sessionError, hasUser: !!session?.user });
      return { success: false, error: 'Not authenticated' };
    }

    console.log('🔽 Downloading Kiki from cloud...');

    // Call RPC to get data
    const { data, error } = await supabase.rpc('get_user_kiki_data');

    console.log('🔍 Raw RPC response:', { data, error, hasData: !!data, dataType: typeof data });

    if (error) {
      console.error('Failed to download kiki from cloud:', error);
      return { success: false, error: error.message };
    }

    console.log('🔍 Data structure check:', {
      hasData: !!data,
      dataSuccess: data?.success,
      dataError: data?.error,
      hasPet: !!data?.pet,
      hasStats: !!data?.stats,
      dataKeys: data ? Object.keys(data) : 'no data'
    });

    if (!data?.success) {
      console.log('❌ Download failed - data not successful:', data);
      return { success: false, error: data?.error || 'No data returned' };
    }

    console.log('📥 Kiki data received from cloud:', {
      hasPet: !!data.pet,
      petName: data.pet?.name,
      coins: data.stats?.coins,
      familyTreeSize: data.familyTree?.length || 0
    });

    // Apply data to local stores
    const petStore = usePetStore.getState();
    const timerStore = useTimerStore.getState();

    // Update pet store
    if (data.pet) {
      petStore.setPet({
        id: data.pet.id,
        name: data.pet.name,
        type: data.pet.type,
        adoptedAt: data.pet.adoptedAt,
        streak: data.pet.streak,
        lastTaskDate: data.pet.lastTaskDate,
        sessionsCompleted: data.pet.sessionsCompleted,
        mutations: data.pet.mutations,
        usedAdRevival: data.pet.usedAdRevival
      });
    }

    // Update stats
    if (data.stats) {
      petStore.setCoins(data.stats.coins || 0);
      petStore.setDna(data.stats.dna || 0);
      petStore.setPauseTokens(data.stats.pauseTokens || 0);
      petStore.setInsurance(data.stats.insurance || false);
      
      // Update timer stats
      timerStore.updateSessionStats({
        totalSessions: data.stats.totalSessions || 0,
        pausesUsed: data.stats.pausesUsed || 0,
        totalFocusTime: data.stats.totalFocusTime || 0,
        averageSessionLength: data.stats.averageSessionLength || 0,
        longestSession: data.stats.longestSession || 0,
        tasksCompleted: data.stats.tasksCompleted || 0,
        lastSessionDate: data.stats.lastSessionDate
      });
    }

    // Update equipped items
    if (data.equippedItems) {
      // Clear all current items
      [1, 2, 3, 4].forEach(slot => petStore.removeItem(slot));
      
      // Set equipped items from cloud
      Object.entries(data.equippedItems).forEach(([slot, item]) => {
        if (item) {
          petStore.equipItem(parseInt(slot), item);
        }
      });
    }

    console.log('✅ Kiki data applied to local stores');

    return {
      success: true,
      synced_at: data.synced_at,
      data: {
        pet: data.pet,
        stats: data.stats,
        equippedItems: data.equippedItems,
        familyTree: data.familyTree
      }
    };

  } catch (error: any) {
    console.error('Sync download error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Add dead pet to family tree
 */
export async function addPetToFamilyTree(
  deadPet: Pet, 
  deathReason: string, 
  parentId?: string
): Promise<boolean> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      console.warn('Not authenticated - cannot add to family tree');
      return false;
    }

    // Mark pet as dead in database
    if (deadPet.id) {
      const { error: updateError } = await supabase
        .from('pets')
        .update({
          death_date: new Date().toISOString(),
          death_reason: deathReason,
          is_current: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', deadPet.id)
        .eq('user_id', session.session.user.id);

      if (updateError) {
        console.error('Failed to update dead pet:', updateError);
      }
    }

    // Add to family tree if not already there
    const { error: treeError } = await supabase
      .from('family_tree')
      .upsert({
        user_id: session.session.user.id,
        pet_id: deadPet.id,
        parent_id: parentId || null,
        relationship: parentId ? 'child' : 'founder',
        generation: deadPet.generation || 1
      }, {
        onConflict: 'pet_id'
      });

    if (treeError) {
      console.error('Failed to add to family tree:', treeError);
      return false;
    }

    console.log('✅ Pet added to family tree:', deadPet.name);
    return true;

  } catch (error) {
    console.error('Error adding pet to family tree:', error);
    return false;
  }
}

/**
 * Auto-sync on important events
 */
export function setupAutoSync() {
  // Sync when pet data changes significantly
  const originalUpdatePet = usePetStore.getState().updatePet;
  usePetStore.setState({
    updatePet: (updates) => {
      originalUpdatePet(updates);
      
      // Auto-sync if streak or significant data changed
      if (updates.streak !== undefined || updates.sessionsCompleted !== undefined) {
        setTimeout(() => uploadKikiToCloud(), 1000); // Debounced upload
      }
    }
  });

  // Sync when coins/dna changes
  const originalAddCoins = usePetStore.getState().addCoins;
  usePetStore.setState({
    addCoins: (amount) => {
      originalAddCoins(amount);
      setTimeout(() => uploadKikiToCloud(), 2000); // Debounced upload
    }
  });
}