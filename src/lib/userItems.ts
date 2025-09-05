import { supabase } from './supabaseClient';
import { type NormalizedItem } from './supaShop';

// Helper function to get user from localStorage (bypasses hanging Supabase auth)
function getUserFromLocalStorage() {
  try {
    const authKey = `sb-hwriwdbzervvmfpuzjqj-auth-token`;
    const authData = localStorage.getItem(authKey);
    
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.expires_at && parsed.expires_at > Date.now() / 1000) {
        return parsed.user;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting user from localStorage:', error);
    return null;
  }
}

export type UserEquipped = Partial<Record<
  'hair'|'hat'|'glasses'|'mask'|'shirt'|'jacket'|'backpack'|'cape'|'wings',
  number | null
>>;

export type UserOutfit = {
  id: number;
  name: string;
  created_at: string;
  items: UserEquipped;
};

export type OwnedItemsOptions = {
  slot?: string;
  page?: number;
  limit?: number;
};

// Get user's owned items with full item details
export async function getOwnedItems(options: OwnedItemsOptions = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { slot, page = 1, limit = 50 } = options;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('user_items')
    .select(`
      item_id,
      acquired_at,
      source,
      items!inner (
        id, name, slot_id, rarity, price, tags, created_at,
        item_render_props (*),
        item_assets (url, kind)
      )
    `)
    .eq('user_id', user.id)
    .eq('items.is_published', true);

  if (slot) {
    query = query.eq('items.slot_id', slot);
  }

  const { data, error, count } = await query
    .order('acquired_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const items: (NormalizedItem & { acquired_at: string; source: string })[] = (data || []).map((row: any) => {
    const item = row.items;
    return {
      id: item.id,
      name: item.name,
      slot: item.slot_id,
      rarity: item.rarity,
      price: item.price,
      tags: item.tags || [],
      acquired_at: row.acquired_at,
      source: row.source,
      renderProps: {
        socket: item.item_render_props?.socket || 'head',
        dx: item.item_render_props?.dx || 0,
        dy: item.item_render_props?.dy || 0,
        scale: item.item_render_props?.scale || 1,
        baseDeg: item.item_render_props?.base_deg || 0,
        biasDeg: item.item_render_props?.bias_deg || 0,
        pivotDX: item.item_render_props?.pivot_dx || 0,
        pivotDY: item.item_render_props?.pivot_dy || 0,
        ...(item.item_render_props?.extras || {})
      },
      assets: {
        thumb: item.item_assets?.find((a: any) => a.kind === 'thumb')?.url,
        front: item.item_assets?.find((a: any) => a.kind === 'front')?.url,
        back: item.item_assets?.find((a: any) => a.kind === 'back')?.url,
      }
    };
  });

  return {
    items,
    total: count || 0,
    page,
    limit
  };
}

// Check if user owns an item
export async function checkOwnership(itemId: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('user_items')
    .select('item_id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .maybeSingle();

  return !error && !!data;
}

// Add item to user's inventory
export async function addItemToInventory(itemId: number, source: string = 'shop') {
  const user = getUserFromLocalStorage();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_items')
    .upsert({
      user_id: user.id,
      item_id: itemId,
      source
    }, {
      onConflict: 'user_id,item_id',
      ignoreDuplicates: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Toggle favorite status for an item
export async function toggleFavorite(itemId: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if already favorited
  const { data: existing } = await supabase
    .from('user_favorites')
    .select('item_id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .single();

  if (existing) {
    // Remove favorite
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('item_id', itemId);
    
    if (error) throw error;
    return false;
  } else {
    // Add favorite
    const { error } = await supabase
      .from('user_favorites')
      .insert({
        user_id: user.id,
        item_id: itemId
      });
    
    if (error) throw error;
    return true;
  }
}

// Get user's favorite item IDs
export async function getFavorites(): Promise<number[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select('item_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => row.item_id);
}

// Get user's equipped items
export async function getEquipped(): Promise<UserEquipped> {
  const user = getUserFromLocalStorage();
  if (!user) return {};

  const { data, error } = await supabase
    .from('user_equipped')
    .select('slot_id, item_id')
    .eq('user_id', user.id);

  if (error) throw error;

  const equipped: UserEquipped = {};
  (data || []).forEach(row => {
    if (row.slot_id && row.item_id) {
      equipped[row.slot_id as keyof UserEquipped] = row.item_id;
    }
  });

  return equipped;
}

// Equip an item to a slot
export async function equip(slotId: string, itemId: number | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  if (itemId !== null) {
    // Check ownership first
    const owned = await checkOwnership(itemId);
    if (!owned) throw new Error('Item not owned');
  }

  const { error } = await supabase
    .from('user_equipped')
    .upsert({
      user_id: user.id,
      slot_id: slotId,
      item_id: itemId,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

// Save current equipped set as an outfit
export async function saveOutfit(name: string, equipped: UserEquipped) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Create outfit record
  const { data: outfit, error: outfitError } = await supabase
    .from('user_outfits')
    .insert({
      user_id: user.id,
      name
    })
    .select('id')
    .single();

  if (outfitError) throw outfitError;

  // Insert outfit items
  const outfitItems = Object.entries(equipped)
    .filter(([_, itemId]) => itemId !== null)
    .map(([slotId, itemId]) => ({
      outfit_id: outfit.id,
      slot_id: slotId,
      item_id: itemId
    }));

  if (outfitItems.length > 0) {
    const { error: itemsError } = await supabase
      .from('user_outfit_items')
      .insert(outfitItems);

    if (itemsError) throw itemsError;
  }

  return outfit.id;
}

// Load outfit and apply to equipped slots
export async function loadOutfit(outfitId: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get outfit items
  const { data, error } = await supabase
    .from('user_outfit_items')
    .select(`
      slot_id,
      item_id,
      user_outfits!inner (user_id)
    `)
    .eq('outfit_id', outfitId)
    .eq('user_outfits.user_id', user.id);

  if (error) throw error;

  // Clear current equipped items
  await supabase
    .from('user_equipped')
    .delete()
    .eq('user_id', user.id);

  // Apply outfit items
  if (data && data.length > 0) {
    const equipItems = data.map(row => ({
      user_id: user.id,
      slot_id: row.slot_id,
      item_id: row.item_id,
      updated_at: new Date().toISOString()
    }));

    const { error: equipError } = await supabase
      .from('user_equipped')
      .insert(equipItems);

    if (equipError) throw equipError;
  }
}

// Delete an outfit
export async function deleteOutfit(outfitId: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('user_outfits')
    .delete()
    .eq('id', outfitId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// Get user's saved outfits
export async function getUserOutfits(): Promise<UserOutfit[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_outfits')
    .select(`
      id,
      name,
      created_at,
      user_outfit_items (
        slot_id,
        item_id
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(outfit => ({
    id: outfit.id,
    name: outfit.name,
    created_at: outfit.created_at,
    items: outfit.user_outfit_items.reduce((acc, item) => {
      if (item.slot_id && item.item_id) {
        acc[item.slot_id as keyof UserEquipped] = item.item_id;
      }
      return acc;
    }, {} as UserEquipped)
  }));
}

// Get user's ownership and favorites state (for store initialization)
export async function getUserState() {
  const user = getUserFromLocalStorage();
  if (!user) return { ownedIds: new Set<number>(), favoriteIds: new Set<number>(), equipped: {} };

  const [ownedResult, favoritesResult, equippedResult] = await Promise.all([
    supabase.from('user_items').select('item_id').eq('user_id', user.id),
    supabase.from('user_favorites').select('item_id').eq('user_id', user.id),
    getEquipped()
  ]);

  if (ownedResult.error) throw ownedResult.error;
  if (favoritesResult.error) throw favoritesResult.error;

  return {
    ownedIds: new Set((ownedResult.data || []).map(row => row.item_id)),
    favoriteIds: new Set((favoritesResult.data || []).map(row => row.item_id)),
    equipped: equippedResult
  };
}