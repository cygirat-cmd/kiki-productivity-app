import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Import sharp for server-side image processing
// Note: In Deno environment, you might need to use a different image processing library
// This is a conceptual implementation - adjust based on your deployment environment

interface ProcessProofRequest {
  verificationId: string
  userId: string
  taskId: string
  imageBuffer: string // base64 encoded
  isPremium: boolean
}

interface HeuristicResult {
  isValid: boolean
  reason?: string
  confidence: number
  metrics: {
    brightness: number
    contrast: number
    blurScore: number
    colorfulness: number
    edgeCount: number
  }
}

// Basic heuristic validation (simplified for Edge Function)
function validateImageHeuristics(buffer: Uint8Array): HeuristicResult {
  const size = buffer.length
  
  // Very basic checks since we don't have full image processing in Edge Function
  if (size < 1000) {
    return {
      isValid: false,
      reason: 'invalid image: file too small',
      confidence: 0.9,
      metrics: { brightness: 0, contrast: 0, blurScore: 0, colorfulness: 0, edgeCount: 0 }
    }
  }
  
  if (size > 10 * 1024 * 1024) { // 10MB
    return {
      isValid: false,
      reason: 'invalid image: file too large', 
      confidence: 0.9,
      metrics: { brightness: 128, contrast: 0.5, blurScore: 50, colorfulness: 0.5, edgeCount: 500 }
    }
  }
  
  // Check for basic image file signatures
  const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8
  const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
  const isWebP = buffer[8] === 0x57 && buffer[9] === 0x45 // "WE" from "WEBP"
  
  if (!isJPEG && !isPNG && !isWebP) {
    return {
      isValid: false,
      reason: 'invalid image: unsupported format',
      confidence: 0.8,
      metrics: { brightness: 0, contrast: 0, blurScore: 0, colorfulness: 0, edgeCount: 0 }
    }
  }
  
  // Basic brightness check by sampling first few KB
  let brightnessSample = 0
  const sampleSize = Math.min(1024, buffer.length)
  for (let i = 0; i < sampleSize; i += 4) {
    brightnessSample += buffer[i] || 0
  }
  brightnessSample = brightnessSample / (sampleSize / 4)
  
  if (brightnessSample < 10) {
    return {
      isValid: false,
      reason: 'invalid image: too dark',
      confidence: 0.7,
      metrics: { brightness: brightnessSample, contrast: 0.1, blurScore: 0, colorfulness: 0.1, edgeCount: 50 }
    }
  }
  
  if (brightnessSample > 245) {
    return {
      isValid: false,
      reason: 'invalid image: too bright/overexposed',
      confidence: 0.7,
      metrics: { brightness: brightnessSample, contrast: 0.1, blurScore: 0, colorfulness: 0.1, edgeCount: 50 }
    }
  }
  
  // If we get here, basic validation passed
  return {
    isValid: true,
    confidence: 0.6, // Lower confidence since we can't do full analysis
    metrics: {
      brightness: brightnessSample,
      contrast: 0.5,
      blurScore: 30,
      colorfulness: 0.3,
      edgeCount: 300
    }
  }
}

// Simple AI scoring mock (replace with actual AI service calls)
async function scoreWithAI(buffer: Uint8Array, taskDescription: string, userId: string): Promise<number> {
  try {
    // In production, this would call your AI service (OpenAI, Claude, etc.)
    // For now, return a mock score based on image size and randomization
    
    const baseScore = Math.random() * 0.6 + 0.2 // 0.2 to 0.8 range
    const sizeBonus = Math.min(0.2, buffer.length / (2 * 1024 * 1024)) // Bonus for larger files
    
    const finalScore = Math.max(0, Math.min(1, baseScore + sizeBonus))
    
    console.log(`Mock AI scoring for ${userId}: ${finalScore.toFixed(2)}`)
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    return finalScore
  } catch (error) {
    console.error('AI scoring failed:', error)
    return 0.5 // Neutral score on error
  }
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

    // Parse request
    const { verificationId, userId, taskId, imageBuffer, isPremium }: ProcessProofRequest = await req.json()

    if (!verificationId || !userId || !imageBuffer) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: verificationId, userId, imageBuffer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert base64 to buffer
    const buffer = new Uint8Array(
      atob(imageBuffer)
        .split('')
        .map(char => char.charCodeAt(0))
    )

    console.log(`Processing proof for user ${userId}, task ${taskId}, premium: ${isPremium}`)

    // Step 1: Run heuristics validation
    const heuristicResult = validateImageHeuristics(buffer)
    
    if (!heuristicResult.isValid) {
      // Update verification as rejected due to heuristics
      const { error: updateError } = await supabaseClient
        .from('verifications')
        .update({
          status: 'rejected',
          reason: heuristicResult.reason,
          is_premium: isPremium
        })
        .eq('id', verificationId)

      if (updateError) {
        console.error('Failed to update verification:', updateError)
        return new Response(
          JSON.stringify({ error: 'Database update failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'rejected',
          reason: heuristicResult.reason,
          metrics: heuristicResult.metrics
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Determine next step based on user type
    if (isPremium) {
      // Premium user: Run AI scoring
      const aiScore = await scoreWithAI(buffer, `Task: ${taskId}`, userId)
      
      let finalStatus: string
      let reason: string | undefined
      let signedUrl: string | undefined
      let reviewDeadline: string | undefined

      if (aiScore >= 0.8) {
        finalStatus = 'approved'
      } else if (aiScore <= 0.2) {
        finalStatus = 'rejected'
        reason = 'AI confidence too low'
      } else {
        // Trial mode for uncertain AI scores
        finalStatus = 'trial'
        const deadline = new Date()
        deadline.setHours(deadline.getHours() + 24)
        reviewDeadline = deadline.toISOString()

        // Generate signed URL for friend verification
        const verification = await supabaseClient
          .from('verifications')
          .select('photo_storage_path')
          .eq('id', verificationId)
          .single()

        if (verification.data?.photo_storage_path) {
          const { data: urlData, error: urlError } = await supabaseClient.storage
            .from('proofs')
            .createSignedUrl(verification.data.photo_storage_path, 86400)

          if (!urlError) {
            signedUrl = urlData.signedUrl
          }
        }
      }

      // Update verification record
      const updateData: any = {
        status: finalStatus,
        ai_score: aiScore,
        is_premium: isPremium
      }

      if (reason) updateData.reason = reason
      if (reviewDeadline) updateData.review_deadline = reviewDeadline

      const { error: updateError } = await supabaseClient
        .from('verifications')
        .update(updateData)
        .eq('id', verificationId)

      if (updateError) {
        console.error('Failed to update verification:', updateError)
        return new Response(
          JSON.stringify({ error: 'Database update failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const response: any = {
        success: true,
        status: finalStatus,
        aiScore,
        metrics: heuristicResult.metrics
      }

      if (reason) response.reason = reason
      if (signedUrl) response.signedUrl = signedUrl
      if (reviewDeadline) response.reviewDeadline = reviewDeadline

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      // Free user: Direct to trial mode (heuristics passed)
      const deadline = new Date()
      deadline.setHours(deadline.getHours() + 24)
      const reviewDeadline = deadline.toISOString()

      // Generate signed URL
      const verification = await supabaseClient
        .from('verifications')
        .select('photo_storage_path')
        .eq('id', verificationId)
        .single()

      let signedUrl: string | undefined
      if (verification.data?.photo_storage_path) {
        const { data: urlData, error: urlError } = await supabaseClient.storage
          .from('proofs')
          .createSignedUrl(verification.data.photo_storage_path, 86400)

        if (!urlError) {
          signedUrl = urlData.signedUrl
        }
      }

      // Update verification record
      const { error: updateError } = await supabaseClient
        .from('verifications')
        .update({
          status: 'trial',
          review_deadline: reviewDeadline,
          is_premium: isPremium
        })
        .eq('id', verificationId)

      if (updateError) {
        console.error('Failed to update verification:', updateError)
        return new Response(
          JSON.stringify({ error: 'Database update failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const response: any = {
        success: true,
        status: 'trial',
        reviewDeadline,
        metrics: heuristicResult.metrics
      }

      if (signedUrl) response.signedUrl = signedUrl

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Processing error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})