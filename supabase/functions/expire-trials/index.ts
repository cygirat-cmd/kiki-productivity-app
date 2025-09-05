import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      'https://hwriwdbzervvmfpuzjqj.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Expire trials - get expired trials first to clean up storage
    const now = new Date().toISOString()
    
    // First, get all expired trials with their storage paths
    const { data: expiredTrials, error: fetchError } = await supabaseClient
      .from('verifications')
      .select('id, photo_storage_path')
      .eq('status', 'trial')
      .lt('review_deadline', now)

    if (fetchError) {
      console.error('Error fetching expired trials:', fetchError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch expired trials',
          details: fetchError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    let deletedFiles = 0
    let failedDeletions: string[] = []

    // Delete storage files for expired trials
    if (expiredTrials && expiredTrials.length > 0) {
      const filesToDelete = expiredTrials
        .filter(trial => trial.photo_storage_path)
        .map(trial => trial.photo_storage_path)

      if (filesToDelete.length > 0) {
        console.log(`Deleting ${filesToDelete.length} storage files`)
        
        const { data: deleteData, error: deleteError } = await supabaseClient.storage
          .from('proofs')
          .remove(filesToDelete)

        if (deleteError) {
          console.error('Error deleting storage files:', deleteError)
          failedDeletions = filesToDelete
        } else {
          deletedFiles = filesToDelete.length
          console.log(`Successfully deleted ${deletedFiles} storage files`)
        }
      }
    }

    // Update database records to rejected status
    const { data, error } = await supabaseClient
      .from('verifications')
      .update({ 
        status: 'rejected',
        reason: 'trial expired'
      })
      .eq('status', 'trial')
      .lt('review_deadline', now)
      .select('id')

    if (error) {
      console.error('Error expiring trials:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to expire trials',
          details: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const expiredCount = data ? data.length : 0
    
    console.log(`Successfully expired ${expiredCount} trial verifications`)

    return new Response(
      JSON.stringify({ 
        success: true,
        expiredCount,
        deletedFiles,
        failedDeletions,
        message: `Expired ${expiredCount} trial verifications and deleted ${deletedFiles} storage files`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})