/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 5; // Max 5 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Remove old requests outside window
  const validRequests = requests.filter((time: number) => now - time < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= MAX_REQUESTS) {
    return false; // Rate limited
  }
  
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);
  return true;
}

serve(async (req) => {
  // --- CORS preflight ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Review cleanup function called');
    
    // --- Supabase client z SRK (no auth validation needed) ---
    const supabaseClient = createClient(
      'https://hwriwdbzervvmfpuzjqj.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    console.log('Supabase client created with Service Role Key');

    // --- Parse body ---
    let verificationIds: string[] = [];
    let reviewToken: string = '';
    try {
      const json = await req.json();
      verificationIds = json?.verificationIds || [];
      reviewToken = json?.token || '';
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!verificationIds.length) {
      return new Response(JSON.stringify({ error: 'Missing verificationIds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate review token if provided (additional security layer)
    if (reviewToken) {
      console.log('Validating review token for cleanup request');
      
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('review_tokens')
        .select('verification_id, expires_at')
        .eq('token', reviewToken)
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ error: 'Invalid review token' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if token matches the verification being cleaned
      if (!verificationIds.includes(tokenData.verification_id)) {
        return new Response(JSON.stringify({ error: 'Token verification mismatch' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Review token validated successfully');
    }

    console.log(`Review cleanup request for verifications: ${verificationIds.join(', ')}`);

    // Get verifications to cleanup
    const { data: verificationsToCleanup, error } = await supabaseClient
      .from('verifications')
      .select('id, photo_storage_path')
      .in('id', verificationIds);

    if (error) {
      console.error('Error fetching verifications:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch verifications', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!verificationsToCleanup?.length) {
      return new Response(JSON.stringify({
        success: true, message: 'No verifications to cleanup', cleanedCount: 0, deletedFiles: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filesToDelete = verificationsToCleanup
      .map(v => v.photo_storage_path)
      .filter((p): p is string => !!p);

    let deletedFiles = 0;
    const storageErrors: string[] = [];

    // Delete storage files
    if (filesToDelete.length) {
      console.log(`Deleting ${filesToDelete.length} storage files:`, filesToDelete);
      
      for (const filePath of filesToDelete) {
        console.log(`Attempting to delete file: ${filePath}`);
        
        const { data: deleteResult, error: deleteError } = await supabaseClient
          .storage
          .from('proofs')
          .remove([filePath]);

        if (deleteError) {
          console.error(`Error deleting file ${filePath}:`, deleteError);
          storageErrors.push(`${filePath}: ${deleteError.message}`);
        } else {
          console.log(`Successfully deleted file ${filePath}:`, deleteResult);
          deletedFiles++;
        }
      }
    }

    // Delete review tokens
    const { error: tokensError } = await supabaseClient
      .from('review_tokens')
      .delete()
      .in('verification_id', verificationIds);
    if (tokensError) console.warn('Error deleting review tokens:', tokensError);

    // Delete verification records
    const { data: deletedVerifications, error: dbError } = await supabaseClient
      .from('verifications')
      .delete()
      .in('id', verificationIds)
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
      message: `Review cleanup completed: ${cleanedCount} verifications, ${deletedFiles} files deleted`,
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