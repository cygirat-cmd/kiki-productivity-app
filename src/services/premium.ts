import { supabase } from '../lib/supabaseClient';

/**
 * Check if user has premium status with RPC fallback to direct table query
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    // 1) RPC najpierw
    const { data: rpcData, error: rpcError } = await supabase.rpc('is_user_premium', { 
      check_user_id: userId  // named parameter (TEXT in DB)
    });
    if (!rpcError) return !!rpcData;

    // 2) Fallback na tabelę user_profiles
    if (rpcError?.code === 'PGRST202') {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_premium,premium_expires_at')
        .eq('id', userId)
        .maybeSingle();
      
      if (error || !data) return false;
      
      if (data.premium_expires_at) {
        return data.is_premium && new Date(data.premium_expires_at) > new Date();
      }
      
      return !!data.is_premium;
    }

    // inne błędy → traktuj jako free
    return false;
  } catch (error) {
    console.error('Premium check error:', error);
    return false;
  }
}