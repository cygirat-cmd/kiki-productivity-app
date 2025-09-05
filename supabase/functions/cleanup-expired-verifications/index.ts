import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for admin authorization
    const authHeader = req.headers.get('Authorization');
    const adminKey = Deno.env.get('ADMIN_CLEANUP_KEY');
    
    if (!adminKey || !authHeader || !authHeader.includes(adminKey)) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized - Admin access required for system cleanup',
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting ADMIN verification cleanup (system-wide)...');

    // Calculate cutoff dates
    const cutoffDate7Days = new Date();
    cutoffDate7Days.setDate(cutoffDate7Days.getDate() - 7);
    
    const cutoffDate24Hours = new Date();
    cutoffDate24Hours.setDate(cutoffDate24Hours.getDate() - 1);

    // Get verifications to cleanup:
    // 1. Old verifications (7+ days)
    // 2. Approved/rejected verifications older than 24h
    // 3. Expired trial verifications
    const { data: expiredVerifications, error: fetchError } = await supabaseClient
      .from('verifications')
      .select('id, photo_storage_path, status, created_at, review_deadline')
      .or(`created_at.lt.${cutoffDate7Days.toISOString()},and(status.in.(approved,rejected),created_at.lt.${cutoffDate24Hours.toISOString()}),and(status.eq.trial,review_deadline.lt.${new Date().toISOString()})`);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${expiredVerifications?.length || 0} verifications to cleanup (7+ days old, 24h+ approved/rejected, or expired trials)`);

    let cleanedCount = 0;
    let errorCount = 0;

    if (expiredVerifications && expiredVerifications.length > 0) {
      // Clean up storage files
      const storagePaths = expiredVerifications
        .filter(v => v.photo_storage_path)
        .map(v => v.photo_storage_path);

      if (storagePaths.length > 0) {
        const { data: storageResult, error: storageError } = await supabaseClient.storage
          .from('proofs')
          .remove(storagePaths);

        if (storageError) {
          console.error('Storage cleanup error:', storageError);
          errorCount += storagePaths.length;
        } else {
          console.log(`Cleaned up ${storagePaths.length} storage files`);
        }
      }

      // Clean up database records
      const verificationIds = expiredVerifications.map(v => v.id);
      
      const { data: dbResult, error: dbError } = await supabaseClient
        .from('verifications')
        .delete()
        .in('id', verificationIds);

      if (dbError) {
        console.error('Database cleanup error:', dbError);
        errorCount += verificationIds.length;
      } else {
        cleanedCount = verificationIds.length;
        console.log(`Cleaned up ${cleanedCount} verification records`);
      }
    }

    // Also clean up expired trial verifications
    const { data: expiredTrials, error: trialError } = await supabaseClient
      .from('verifications')
      .update({ 
        status: 'rejected',
        reason: 'trial expired - auto cleanup'
      })
      .eq('status', 'trial')
      .lt('review_deadline', new Date().toISOString())
      .select('id');

    let expiredTrialCount = 0;
    if (!trialError && expiredTrials) {
      expiredTrialCount = expiredTrials.length;
      console.log(`Marked ${expiredTrialCount} trials as expired`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cleaned_verifications: cleanedCount,
        expired_trials: expiredTrialCount,
        errors: errorCount,
        message: `Cleanup completed: ${cleanedCount} verifications deleted (7+ days old + 24h+ approved/rejected), ${expiredTrialCount} trials expired, ${errorCount} errors`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});