import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  // 1) Dla dev możesz dać "*", ale jeśli używasz cookies/credentials – wpisz konkretny origin.
  'Access-Control-Allow-Origin': '*', // lub 'http://localhost:8082' / prod origin
  // 2) Te nagłówki muszą matchować to, co faktycznie wysyła klient
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // 3) TO CI BRAKOWAŁO
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // 4) Nie zaszkodzi – mniej preflightów
  'Access-Control-Max-Age': '86400',
  // 5) Dobrze mieć tu, ale i tak doklejamy w Response
  // 'Content-Type': 'application/json',
};

serve(async (req) => {
  // --- CORS preflight ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // --- Supabase client z SRK ---
    const supabaseClient = createClient(
      'https://hwriwdbzervvmfpuzjqj.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- Parsowanie body z fallbackiem ---
    let userId: string | undefined;
    let verificationIds: string[] | undefined;
    let cleanupAll: boolean | undefined;
    let reviewCleanup: boolean | undefined;
    try {
      const json = await req.json();
      userId = json?.userId;
      verificationIds = json?.verificationIds;
      cleanupAll = json?.cleanupAll;
      reviewCleanup = json?.reviewCleanup;
    } catch {
      // puste lub złe body → traktuj jak brakujące pola
    }

    // For review cleanup, we don't need userId - we'll get it from verification record
    if (!userId && !reviewCleanup) {
      return new Response(JSON.stringify({ error: 'Missing required field: userId (unless reviewCleanup=true)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Cleanup request for user ${userId || 'review cleanup'}`);

    let verificationsToCleanup: Array<{ id: string; photo_storage_path: string | null }> = [];

    if (verificationIds?.length) {
      // For review cleanup, don't filter by user_id - use Service Role Key privileges
      const query = supabaseClient
        .from('verifications')
        .select('id, photo_storage_path')
        .in('id', verificationIds)
        .in('status', ['trial', 'pending', 'approved', 'rejected']);
      
      // Only add user_id filter if not review cleanup
      if (userId && !reviewCleanup) {
        query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching specific verifications:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch verifications', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      verificationsToCleanup = data ?? [];
    } else if (cleanupAll && userId) {
      const { data, error } = await supabaseClient
        .from('verifications')
        .select('id, photo_storage_path')
        .eq('user_id', userId)
        .in('status', ['trial', 'pending', 'approved', 'rejected']);

      if (error) {
        console.error('Error fetching all pending verifications:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch verifications', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      verificationsToCleanup = data ?? [];
    } else {
      return new Response(JSON.stringify({ error: 'Must specify either verificationIds or cleanupAll=true' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!verificationsToCleanup.length) {
      return new Response(JSON.stringify({
        success: true, message: 'No verifications to cleanup', cleanedCount: 0, deletedFiles: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const idsToDelete = verificationsToCleanup.map(v => v.id);
    const filesToDelete = verificationsToCleanup
      .map(v => v.photo_storage_path)
      .filter((p): p is string => !!p);

    let deletedFiles = 0;
    const storageErrors: string[] = [];

    if (filesToDelete.length) {
      console.log(`Deleting ${filesToDelete.length} storage files`);
      const { error: deleteError } = await supabaseClient
        .storage
        .from('proofs')
        .remove(filesToDelete); // ścieżki RELATYWNE do bucketa

      if (deleteError) {
        console.error('Error deleting storage files:', deleteError);
        storageErrors.push(deleteError.message);
      } else {
        deletedFiles = filesToDelete.length;
      }
    }

    const { error: tokensError } = await supabaseClient
      .from('review_tokens')
      .delete()
      .in('verification_id', idsToDelete);
    if (tokensError) console.warn('Error deleting review tokens (may not exist):', tokensError);

    const { data: deletedVerifications, error: dbError } = await supabaseClient
      .from('verifications')
      .delete()
      .in('id', idsToDelete)
      .select('id');

    if (dbError) {
      console.error('Error deleting verification records:', dbError);
      return new Response(JSON.stringify({
        error: 'Failed to delete verification records',
        details: dbError.message,
        storageErrors,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanedCount = deletedVerifications?.length ?? 0;

    return new Response(JSON.stringify({
      success: true,
      cleanedCount,
      deletedFiles,
      storageErrors: storageErrors.length ? storageErrors : undefined,
      message: `Cleaned up ${cleanedCount} verifications and deleted ${deletedFiles} storage files`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});