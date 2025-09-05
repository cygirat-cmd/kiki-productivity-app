import { supabase } from '@/lib/supabaseClient';
import { useGuestStore } from '@/store/guestStore';
import { useUserItemsStore } from '@/store/userItemsStore';
import { uploadKikiToCloud, downloadKikiFromCloud } from '@/services/kikisync';

type MigrationResult = {
  itemsAdded: number;
  favoritesAdded: number;
  outfitSaved: boolean;
  tokensRedeemed: number;
  kikisyncSuccess: boolean;
  errors: string[];
};

// Migration mutex to prevent concurrent migrations
let migrationInProgress = false;

export async function migrateGuestToUser(): Promise<MigrationResult> {
  // Check if migration is already in progress
  if (migrationInProgress) {
    return {
      itemsAdded: 0,
      favoritesAdded: 0,
      outfitSaved: false,
      tokensRedeemed: 0,
      kikisyncSuccess: false,
      errors: ['Migration already in progress']
    };
  }

  migrationInProgress = true;
  const result: MigrationResult = {
    itemsAdded: 0,
    favoritesAdded: 0,
    outfitSaved: false,
    tokensRedeemed: 0,
    kikisyncSuccess: false,
    errors: []
  };

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const guestState = useGuestStore.getState().getGuestState();
    
    if (!guestState.guestId) {
      // No guest session to migrate
      return result;
    }

    // 1. Deduplicate provisional tokens by JTI
    const uniqueTokens = new Map<string, { token: string; type: string }>();
    
    for (const receipt of guestState.provisionalReceipts) {
      try {
        // Parse JWT to get JTI without verification
        const payload = JSON.parse(atob(receipt.token.split('.')[1]));
        const jti = payload.jti;
        
        if (jti && !uniqueTokens.has(jti)) {
          uniqueTokens.set(jti, { token: receipt.token, type: receipt.type });
        }
      } catch (error) {
        result.errors.push(`Failed to parse token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 2. Redeem unique tokens
    for (const { token, type } of uniqueTokens.values()) {
      try {
        const { data, error } = await supabase.functions.invoke('redeem', {
          body: { token }
        });

        if (error) throw error;
        
        result.tokensRedeemed++;
      } catch (error) {
        result.errors.push(`Failed to redeem ${type} token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 2. Add any remaining provisional items not covered by tokens
    // (This handles edge cases where tokens might have failed but items were added locally)
    for (const itemId of guestState.ownedLocal) {
      try {
        // Check if user already owns this item
        const { data: existingItem } = await supabase
          .from('user_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_id', itemId)
          .single();

        if (!existingItem) {
          // Add item to user inventory
          const { error } = await supabase
            .from('user_items')
            .upsert({
              user_id: user.id,
              item_id: itemId,
              source: 'guest_migration',
              acquired_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,item_id',
              ignoreDuplicates: true
            });

          if (error) throw error;
          result.itemsAdded++;
        }
      } catch (error) {
        result.errors.push(`Failed to add item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 3. Migrate favorites
    for (const itemId of guestState.favoritesLocal) {
      try {
        // Check if already favorited
        const { data: existingFav } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_id', itemId)
          .single();

        if (!existingFav) {
          const { error } = await supabase
            .from('user_favorites')
            .insert({
              user_id: user.id,
              item_id: itemId
            });

          if (error) throw error;
          result.favoritesAdded++;
        }
      } catch (error) {
        result.errors.push(`Failed to add favorite ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 4. Save current equipment as an outfit if any items are equipped
    const equippedItems = Object.values(guestState.equippedLocal).filter(Boolean);
    if (equippedItems.length > 0) {
      try {
        // Create outfit from current equipment
        const { data: outfit, error: outfitError } = await supabase
          .from('user_outfits')
          .insert({
            user_id: user.id,
            name: `Guest Session ${new Date().toLocaleDateString()}`,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (outfitError) throw outfitError;

        // Add equipped items to outfit
        const outfitItems = Object.entries(guestState.equippedLocal)
          .filter(([_, itemId]) => itemId !== null)
          .map(([slot, itemId]) => ({
            outfit_id: outfit.id,
            slot_id: slot,
            item_id: itemId
          }));

        if (outfitItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('user_outfit_items')
            .insert(outfitItems);

          if (itemsError) throw itemsError;
        }

        // Apply equipment to user
        for (const [slot, itemId] of Object.entries(guestState.equippedLocal)) {
          if (itemId) {
            const { error } = await supabase
              .from('user_equipped')
              .upsert({
                user_id: user.id,
                slot_id: slot,
                item_id: itemId
              });

            if (error) throw error;
          }
        }

        result.outfitSaved = true;
      } catch (error) {
        result.errors.push(`Failed to save outfit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 5. Clear guest state after successful migration
    useGuestStore.getState().clearGuestSession();

    // 6. Reload user state to reflect changes
    await useUserItemsStore.getState().loadUserState();

    // 7. Sync full Kiki data to cloud (pet, stats, family tree)
    try {
      console.log('🔄 Syncing Kiki data to cloud after guest migration...');
      const syncResult = await uploadKikiToCloud();
      
      if (syncResult.success) {
        result.kikisyncSuccess = true;
        console.log('✅ Kiki data synced to cloud successfully');
      } else {
        result.errors.push(`Kiki sync failed: ${syncResult.error}`);
        console.warn('❌ Kiki sync failed:', syncResult.error);
      }
    } catch (error) {
      result.errors.push(`Kiki sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Kiki sync error:', error);
    }

    return result;

  } catch (error) {
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  } finally {
    // Always release mutex
    migrationInProgress = false;
  }
}

export function shouldMigrateGuest(): boolean {
  const guestState = useGuestStore.getState().getGuestState();
  
  // If migration was ever completed, never migrate again
  if (guestState.migrationEverCompleted) {
    return false;
  }
  
  return !!(
    guestState.guestId && (
      guestState.ownedLocal.size > 0 ||
      guestState.favoritesLocal.size > 0 ||
      Object.keys(guestState.equippedLocal).length > 0 ||
      guestState.provisionalReceipts.length > 0
    )
  );
}

// Initialize guest session on first load
export function initializeGuestSession() {
  const guestStore = useGuestStore.getState();
  
  // Only initialize if no guest session exists AND migration was never completed
  if (!guestStore.guestId && !guestStore.migrationEverCompleted) {
    guestStore.initGuestSession();
    
    // Give guest users some starting items for demo purposes
    // Only add these if migration was never completed before
    guestStore.addProvisionalItem(1); // hair1
    guestStore.addProvisionalItem(2); // hair2
  }
  
  // Clean up expired receipts
  guestStore.clearExpiredReceipts();
}