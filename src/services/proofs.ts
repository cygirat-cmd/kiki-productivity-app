import { supabase, VerificationInsert } from '../lib/supabaseClient'
import { VerificationRecord } from '../lib/supabaseClient'
import { validateImageHeuristics, HeuristicResult } from './heuristics'
import { scoreProofWithAI, AIScoreResult } from './optimizedAI'

// Helper function to generate UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Type definitions
export interface UploadProofParams {
  userId: string
  taskId: string
  arrayBuffer: ArrayBuffer
  isPremium: boolean
  mime?: string
}

export interface UploadProofResult {
  verificationId: string
  storagePath: string
  status: 'pending' | 'trial' | 'approved' | 'rejected'
  signedUrl?: string // For trial mode
  reviewToken?: string // For friend review links (RPC-based)
  reviewDeadline?: string // For trial mode
  reason?: string // For rejected proofs
  aiScore?: number // For premium users
}

export interface VerificationResult {
  status: 'approved' | 'rejected' | 'trial'
  signedUrl?: string
  reviewDeadline?: string
  aiScore?: number
  reason?: string
}

export interface SetVerificationResultParams {
  verificationId: string
  aiScore: number
}

/**
 * Upload proof with hybrid verification flow
 * 1. Upload to Storage
 * 2. Run heuristics validation
 * 3. If premium and heuristics pass, run AI scoring
 * 4. Return final result with status
 */
export async function uploadProof({ 
  userId, 
  taskId, 
  arrayBuffer, 
  isPremium,
  mime = 'image/jpeg' 
}: UploadProofParams): Promise<UploadProofResult> {
  if (!userId) {
    throw new Error('userId is required')
  }
  if (!taskId) {
    throw new Error('taskId is required')
  }
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('arrayBuffer is required and cannot be empty')
  }

  const verificationId = generateUUID()
  const timestamp = Date.now()
  const fileName = `task_${taskId}_${timestamp}.jpg`
  let finalStoragePath = `${userId}/${fileName}`

  try {
    // Step 1: Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(finalStoragePath, arrayBuffer, {
        contentType: mime,
        upsert: false
      })

    if (uploadError) {
      // Handle naming conflicts
      if (uploadError.message.includes('already exists')) {
        const newTimestamp = Date.now() + Math.floor(Math.random() * 1000)
        const newFileName = `task_${taskId}_${newTimestamp}.jpg`
        const newStoragePath = `${userId}/${newFileName}`
        
        const { data: retryUploadData, error: retryUploadError } = await supabase.storage
          .from('proofs')
          .upload(newStoragePath, arrayBuffer, {
            contentType: mime,
            upsert: false
          })
        
        if (retryUploadError) {
          throw new Error(`Upload failed after retry: ${retryUploadError.message}`)
        }
        
        finalStoragePath = newStoragePath
      } else {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }
    }

    // Step 2: Run heuristics validation (always, for all users)
    console.log(`Running heuristics validation for user ${userId}, task ${taskId}`)
    const heuristicResult: HeuristicResult = await validateImageHeuristics(arrayBuffer)

    // If heuristics fail, immediately reject
    if (!heuristicResult.isValid) {
      console.log('🗄️ DB Insert payload (rejected):', {
        id: verificationId,
        user_id: userId,
        task: taskId,
        photo_storage_path: finalStoragePath,
        status: 'pending',
        reason: heuristicResult.reason || 'invalid image',
        created_at: new Date().toISOString()
      });

      const dbInsertRejected: VerificationInsert = {
        id: verificationId,
        user_id: userId,
        task: taskId,
        photo_storage_path: finalStoragePath,
        status: 'pending',
        reason: heuristicResult.reason || 'invalid image',
        created_at: new Date().toISOString()
      };

      const { data: verificationData, error: dbError } = await supabase
        .from('verifications')
        .insert(dbInsertRejected)
        .select()
        .single()

      if (dbError) {
        // Cleanup uploaded file if DB insert fails
        await supabase.storage.from('proofs').remove([finalStoragePath])
        throw new Error(`Database insert failed: ${dbError.message}`)
      }

      return {
        verificationId,
        storagePath: finalStoragePath,
        status: 'rejected',
        reason: heuristicResult.reason
      }
    }

    // Step 3: Determine next step based on user type
    let finalStatus: 'pending' | 'trial' | 'approved' | 'rejected' = 'pending'
    let aiScore: number | undefined
    let signedUrl: string | undefined
    let reviewDeadline: string | undefined
    let reason: string | undefined

    if (isPremium) {
      // Premium users: Run AI scoring
      console.log(`Running AI scoring for premium user ${userId}`)
      
      try {
        const aiResult: AIScoreResult = await scoreProofWithAI({
          imageBuffer: arrayBuffer,
          taskDescription: `Task: ${taskId}`,
          userId
        })

        aiScore = aiResult.score
        
        // Apply AI score thresholds
        if (aiScore >= 0.8) {
          finalStatus = 'approved'
        } else if (aiScore <= 0.2) {
          finalStatus = 'rejected'
          reason = 'AI confidence too low'
        } else {
          // 0.2 < score < 0.8: Trial mode
          finalStatus = 'trial'
          const deadline = new Date()
          deadline.setHours(deadline.getHours() + 24)
          reviewDeadline = deadline.toISOString()
        }
      } catch (aiError) {
        console.error('AI scoring failed:', aiError)
        // Fallback to trial mode if AI fails
        finalStatus = 'trial'
        const deadline = new Date()
        deadline.setHours(deadline.getHours() + 24)
        reviewDeadline = deadline.toISOString()
        reason = 'AI processing failed, requires friend verification'
      }
    } else {
      // Free users: Direct to trial mode (heuristics passed)
      console.log(`Free user ${userId} - directing to trial mode`)
      finalStatus = 'trial'
      const deadline = new Date()
      deadline.setHours(deadline.getHours() + 24)
      reviewDeadline = deadline.toISOString()
    }

    // Step 4: Create verification record in DB
    const dbInsert: VerificationInsert = {
      id: verificationId,
      user_id: userId,
      task: taskId,
      photo_storage_path: finalStoragePath,
      status: 'pending',
      created_at: new Date().toISOString()
    }

    if (aiScore !== undefined) {
      dbInsert.ai_score = aiScore
    }

    if (reason) {
      dbInsert.reason = reason
    }

    if (reviewDeadline) {
      dbInsert.review_deadline = reviewDeadline
    }

    console.log('🗄️ DB Insert payload (main):', dbInsert);

    const { data: verificationData, error: dbError } = await supabase
      .from('verifications')
      .insert(dbInsert)
      .select()
      .single()

    if (dbError) {
      // Cleanup uploaded file if DB insert fails
      await supabase.storage.from('proofs').remove([finalStoragePath])
      throw new Error(`Database insert failed: ${dbError.message}`)
    }

    // Step 5: Return result
    const result: UploadProofResult = {
      verificationId,
      storagePath: finalStoragePath,
      status: finalStatus
    }

    // For trial mode, generate review token and signed URL after DB insert
    if (finalStatus === 'trial') {
      try {
        // Generate review token for friend verification (RPC-based auth)
        const { data: tokenData, error: tokenError } = await supabase.rpc('create_review_token', { 
          p_verification_id: verificationId,  // string (TEXT in DB)
          p_ttl_seconds: 86400 
        });
        
        if (tokenError) {
          console.error('Failed to create review token:', tokenError);
          // Don't throw error - record was already saved, just log the issue
        } else {
          result.reviewToken = tokenData as string;
        }
        
        // Note: Image access is now handled via Edge Function
        // No need to generate signed URL here
      } catch (tokenGenError) {
        console.error('Token generation failed:', tokenGenError);
        // Continue without tokens - fallback to basic verification flow
      }
    }

    if (reviewDeadline) result.reviewDeadline = reviewDeadline
    if (reason) result.reason = reason
    if (aiScore !== undefined) result.aiScore = aiScore

    console.log(`Upload completed for user ${userId}: ${finalStatus}${aiScore !== undefined ? ` (AI: ${aiScore.toFixed(2)})` : ''}`)

    return result

  } catch (error) {
    // Cleanup ONLY if upload succeeded but DB insert failed
    if (finalStoragePath) {
      await supabase.storage.from('proofs').remove([finalStoragePath]).catch(() => {});
    }
    
    throw new Error(`Upload proof failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Set AI verification result and handle trial mode logic
 * This function is now primarily used internally by uploadProof
 * but can still be called separately if needed
 */
export async function setVerificationResult({ 
  verificationId, 
  aiScore 
}: SetVerificationResultParams): Promise<VerificationResult> {
  if (!verificationId) {
    throw new Error('verificationId is required')
  }
  if (typeof aiScore !== 'number' || aiScore < 0 || aiScore > 1) {
    throw new Error('aiScore must be a number between 0 and 1')
  }

  try {
    // Determine status based on AI score (same logic as in uploadProof)
    let status: 'approved' | 'rejected' | 'trial'
    let reviewDeadline: Date | null = null
    let reason: string | undefined
    
    if (aiScore >= 0.8) {
      status = 'approved'
    } else if (aiScore <= 0.2) {
      status = 'rejected'
      reason = 'AI confidence too low'
    } else {
      status = 'trial'
      reviewDeadline = new Date()
      reviewDeadline.setHours(reviewDeadline.getHours() + 24) // 24h from now
    }

    // Update verification record
    const updateData: any = {
      status,
      ai_score: aiScore
    }

    if (reviewDeadline) {
      updateData.review_deadline = reviewDeadline.toISOString()
    }

    if (reason) {
      updateData.reason = reason
    }

    const { data: verificationData, error: updateError } = await supabase
      .from('verifications')
      .update(updateData)
      .eq('id', verificationId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update verification: ${updateError.message}`)
    }

    // If trial mode, generate signed URL
    let signedUrl: string | undefined
    if (status === 'trial' && verificationData.photo_storage_path) {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('proofs')
        .createSignedUrl(verificationData.photo_storage_path, 86400) // 24h TTL

      if (urlError) {
        console.error('Failed to generate signed URL:', urlError.message)
        // Don't throw error, just log it - the verification update succeeded
      } else {
        signedUrl = urlData.signedUrl
      }
    }

    const result: VerificationResult = {
      status,
      aiScore
    }

    if (signedUrl) {
      result.signedUrl = signedUrl
    }

    if (reviewDeadline) {
      result.reviewDeadline = reviewDeadline.toISOString()
    }

    if (reason) {
      result.reason = reason
    }

    return result
  } catch (error) {
    throw new Error(`Set verification result failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get signed URL for verification (for friend verification)
 */
export async function getSignedUrlForVerification(
  verificationId: string, 
  ttlSec: number = 86400
): Promise<string> {
  if (!verificationId) {
    throw new Error('verificationId is required')
  }

  try {
    // Get verification record
    const { data: verification, error: fetchError } = await supabase
      .from('verifications')
      .select('photo_storage_path, status, review_deadline')
      .eq('id', verificationId)
      .single()

    if (fetchError) {
      throw new Error(`Verification not found: ${fetchError.message}`)
    }

    // Check if verification is in trial mode and not expired
    if (verification.status !== 'trial') {
      throw new Error('Verification is not in trial mode')
    }

    if (!verification.review_deadline) {
      throw new Error('No review deadline set for trial verification')
    }

    const deadline = new Date(verification.review_deadline)
    const now = new Date()

    if (deadline < now) {
      throw new Error('Review deadline has passed - trial expired')
    }

    if (!verification.photo_storage_path) {
      throw new Error('No photo storage path found for verification')
    }

    // Generate signed URL (ensure relative path to bucket)
    const relativePath = verification.photo_storage_path.startsWith('proofs/') 
      ? verification.photo_storage_path.substring(7) 
      : verification.photo_storage_path;
      
    const signed = await supabase.storage
      .from('proofs')
      .createSignedUrl(relativePath, ttlSec)

    if (signed.error) {
      console.error('❌ createSignedUrl error:', signed.error, 'path:', relativePath);
      throw new Error(`Signed URL failed: ${signed.error.message}`);
    }
    
    console.log('🔗 signedUrl:', signed.data.signedUrl);
    return signed.data.signedUrl
  } catch (error) {
    throw new Error(`Get signed URL failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Legacy approve function - now handled via RPC tokens
 * @deprecated Use BuddyReview component with RPC review_verification instead
 */
export async function approveVerification(verificationId: string): Promise<void> {
  throw new Error('Direct approval is deprecated. Use token-based review flow via /review?token=...');
}

/**
 * Legacy reject function - now handled via RPC tokens
 * @deprecated Use BuddyReview component with RPC review_verification instead
 */
export async function rejectVerification(verificationId: string): Promise<void> {
  throw new Error('Direct rejection is deprecated. Use token-based review flow via /review?token=...');
}

/**
 * Check if user has premium status
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  const { isUserPremium: checkPremium } = await import('./premium');
  return checkPremium(userId);
}

/**
 * Get verification statistics for monitoring cost/usage
 */
export async function getVerificationStats(daysBack: number = 7): Promise<any> {
  try {
    const { data, error } = await supabase
      .rpc('get_verification_stats', { 
        days_back: daysBack  // named parameter
      })

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`)
    }

    return data || {}
  } catch (error) {
    console.error('Stats fetch error:', error)
    return {}
  }
}

/**
 * Expire trials - mark expired trial verifications as rejected
 * This function should be called by a cron job or edge function
 */
export async function expireTrials(): Promise<{ expiredCount: number }> {
  try {
    const now = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('verifications')
      .update({ 
        status: 'rejected',
        reason: 'trial expired'
      })
      .eq('status', 'trial')
      .lt('review_deadline', now)
      .select('id')

    if (error) {
      throw new Error(`Failed to expire trials: ${error.message}`)
    }

    const expiredCount = data ? data.length : 0
    
    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} trial verifications`)
    }

    return { expiredCount }
  } catch (error) {
    throw new Error(`Expire trials failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get user's recent verifications for debugging/monitoring
 */
export async function getUserVerifications(userId: string, limit: number = 10): Promise<VerificationRecord[]> {
  try {
    const { data, error } = await supabase
      .from('verifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch verifications: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error('Failed to get user verifications:', error)
    return []
  }
}

/**
 * Helper function to get authenticated user session
 */
async function getAuthenticatedSession(): Promise<{ uid: string }> {
  const { data: sessionData, error: authError } = await supabase.auth.getSession();
  if (authError || !sessionData?.session?.user) {
    throw new Error('User must be authenticated');
  }
  return { uid: sessionData.session.user.id };
}

/**
 * Helper function to convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Remove data URL prefix if present (data:image/jpeg;base64,...)
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

/**
 * Extract file extension from MIME type
 */
function getExtensionFromMime(mime: string): string {
  const mimeMap: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };
  return mimeMap[mime.toLowerCase()] || 'jpg';
}

/**
 * Detect content type from base64 data or fallback to provided mime
 */
function detectContentType(base64: string, fallbackMime: string = 'image/jpeg'): string {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Check for common image signatures in base64
  if (base64.includes('data:image/')) {
    const match = base64.match(/^data:image\/([a-z]+);base64,/);
    if (match) {
      const detectedType = match[1].toLowerCase();
      // Only allow jpeg and png for security
      if (detectedType === 'jpeg' || detectedType === 'jpg') return 'image/jpeg';
      if (detectedType === 'png') return 'image/png';
    }
  }
  
  // Decode first few bytes to detect file signature
  try {
    const binaryString = atob(cleanBase64.substring(0, 20)); // Just first few chars for signature
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Check file signatures
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg'; // JPEG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'; // PNG
  } catch (error) {
    console.warn('Could not detect image type from signature, using fallback');
  }
  
  // Default to fallback (jpeg or png only)
  return fallbackMime === 'image/png' ? 'image/png' : 'image/jpeg';
}

/**
 * Save verification from base64 image data with proper auth.uid() handling
 * Converts base64 to ArrayBuffer, uploads to PRIVATE storage, and creates verification record
 */
export async function saveVerificationFromBase64({
  taskId,
  base64,
  mime = 'image/jpeg',
  status = 'pending',
  userAgent
}: {
  taskId: string;
  base64: string;
  mime?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'trial';
  userAgent?: string;
}): Promise<{
  verificationId: string;
  storagePath: string;
}> {
  if (!taskId) {
    throw new Error('taskId is required');
  }
  if (!base64) {
    throw new Error('base64 is required');
  }

  // Get authenticated user ID
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('User must be authenticated');
  }
  const uid = user.id;
  console.log('📊 Upload auth check: uid=', uid);

  // Detect proper content type from base64 data
  const detectedContentType = detectContentType(base64, mime);
  const extension = getExtensionFromMime(detectedContentType);
  
  const verificationId = generateUUID();
  const timestamp = Date.now();
  const fileName = `task_${taskId}_${timestamp}.${extension}`;
  let finalStoragePath = `${uid}/${fileName}`; // Relative path inside bucket
  
  console.log('📁 Storage path:', finalStoragePath, 'contentType:', detectedContentType);

  try {
    // Convert base64 to ArrayBuffer
    const arrayBuffer = base64ToArrayBuffer(base64);
    
    // Upload to PRIVATE Supabase Storage with detected content type
    console.log('📤 Starting upload to storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(finalStoragePath, arrayBuffer, {
        contentType: detectedContentType, // Use detected type (jpeg/png only)
        upsert: false
      });
      
    console.log('📤 Upload result:', { uploadData, uploadError, arrayBufferSize: arrayBuffer.byteLength });

    if (uploadError) {
      // Handle naming conflicts
      if (uploadError.message.includes('already exists')) {
        const newTimestamp = Date.now() + Math.floor(Math.random() * 1000);
        const newFileName = `task_${taskId}_${newTimestamp}.${extension}`;
        const newStoragePath = `${uid}/${newFileName}`;
        
        const { data: retryUploadData, error: retryUploadError } = await supabase.storage
          .from('proofs')
          .upload(newStoragePath, arrayBuffer, {
            contentType: detectedContentType,
            upsert: false
          });
        
        if (retryUploadError) {
          throw new Error(`Upload failed after retry: ${retryUploadError.message}`);
        }
        
        finalStoragePath = newStoragePath;
      } else {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }

    // Create verification record in DB with user_id = auth.uid()
    const dbInsert: VerificationInsert = {
      id: verificationId,
      user_id: uid, // This matches auth.uid() for RLS policies
      task: taskId,
      photo_storage_path: finalStoragePath,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    if (userAgent) {
      dbInsert.user_agent = userAgent;
    }

    console.log('🗄️ DB Insert payload (saveFromBase64):', dbInsert);

    const { data: verificationData, error: dbError } = await supabase
      .from('verifications')
      .insert(dbInsert)
      .select('id')
      .single();

    if (dbError) {
      // Cleanup uploaded file if DB insert fails
      await supabase.storage.from('proofs').remove([finalStoragePath]);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    const insertedId = verificationData.id;
    console.log('📊 INSERT successful: verificationId=', insertedId, 'storagePath=', finalStoragePath);
    
    // Verify the file was actually uploaded by trying to create a signed URL
    try {
      const testSigned = await supabase.storage
        .from('proofs')
        .createSignedUrl(finalStoragePath, 60); // Short TTL for test
      
      if (testSigned.error) {
        console.warn('⚠️ Upload verification failed - file may not exist:', testSigned.error);
      } else {
        console.log('✅ Upload verified - file exists in storage');
      }
    } catch (e) {
      console.warn('⚠️ Could not verify upload:', e);
    }

    return {
      verificationId: insertedId, // Return UUID from database, not generated UUID
      storagePath: finalStoragePath
    };

  } catch (error) {
    // Cleanup ONLY if upload succeeded but DB insert failed
    if (finalStoragePath) {
      await supabase.storage.from('proofs').remove([finalStoragePath]).catch(() => {});
    }
    
    throw new Error(`Save verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save verification from URI (React Native support)
 */
export async function saveVerificationFromURI({
  taskId,
  uri,
  mime = 'image/jpeg',
  status = 'pending',
  userAgent
}: {
  taskId: string;
  uri: string;
  mime?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'trial';
  userAgent?: string;
}): Promise<{
  verificationId: string;
  storagePath: string;
}> {
  if (!taskId) {
    throw new Error('taskId is required');
  }
  if (!uri) {
    throw new Error('uri is required');
  }

  // Get authenticated session
  const { uid } = await getAuthenticatedSession();
  console.log('📊 Upload (URI) auth check: uid=', uid);

  // For URI uploads, use provided mime or default to jpeg
  const contentType = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  const extension = getExtensionFromMime(contentType);
  
  const verificationId = generateUUID();
  const timestamp = Date.now();
  const fileName = `task_${taskId}_${timestamp}.${extension}`;
  const storagePath = `${uid}/${fileName}`; // Relative path inside bucket
  
  console.log('📁 Storage path (URI):', storagePath, 'contentType:', contentType);

  try {
    // Convert URI to ArrayBuffer (React Native compatible)
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    
    // Upload to PRIVATE Supabase Storage with proper content type
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(storagePath, arrayBuffer, {
        contentType: contentType, // Use validated content type
        upsert: false
      });

    let finalStoragePath = storagePath;

    if (uploadError) {
      // Handle naming conflicts
      if (uploadError.message.includes('already exists')) {
        const newTimestamp = Date.now() + Math.floor(Math.random() * 1000);
        const newFileName = `task_${taskId}_${newTimestamp}.${extension}`;
        const newStoragePath = `${uid}/${newFileName}`;
        
        const { data: retryUploadData, error: retryUploadError } = await supabase.storage
          .from('proofs')
          .upload(newStoragePath, arrayBuffer, {
            contentType: contentType,
            upsert: false
          });
        
        if (retryUploadError) {
          throw new Error(`Upload failed after retry: ${retryUploadError.message}`);
        }
        
        finalStoragePath = newStoragePath;
      } else {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }

    // Create verification record in DB with user_id = auth.uid()
    const dbInsert: VerificationInsert = {
      id: verificationId,
      user_id: uid,
      task: taskId,
      photo_storage_path: finalStoragePath,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    if (userAgent) {
      dbInsert.user_agent = userAgent;
    }

    console.log('🗄️ DB Insert payload (saveFromURI):', dbInsert);

    const { data: verificationData, error: dbError } = await supabase
      .from('verifications')
      .insert(dbInsert)
      .select('id')
      .single();

    if (dbError) {
      // Cleanup uploaded file if DB insert fails
      await supabase.storage.from('proofs').remove([finalStoragePath]);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    const insertedId = verificationData.id;
    console.log('📊 INSERT (URI) successful: verificationId=', insertedId, 'storagePath=', finalStoragePath);

    return {
      verificationId: insertedId, // Return UUID from database, not generated UUID
      storagePath: finalStoragePath
    };

  } catch (error) {
    throw new Error(`Save verification from URI failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get image source URL for verification record
 * Returns signed URL for PRIVATE storage or legacy base64 fallback
 */
export async function getVerificationImageSrc(row: any): Promise<string | null> {
  try {
    // NEW format: storage path - ALWAYS use signed URL for PRIVATE bucket
    if (row.photo_storage_path) {
      console.log('🔗 Creating signed URL for path:', row.photo_storage_path);
      
      // First, let's check if the file exists by listing it
      try {
        const { data: listData, error: listError } = await supabase.storage
          .from('proofs')
          .list(row.photo_storage_path.split('/')[0], { // List the user's folder
            limit: 100,
            search: row.photo_storage_path.split('/')[1] // Search for the specific file
          });
        
        console.log('📁 Storage list result:', { listData, listError, searchPath: row.photo_storage_path });
      } catch (listErr) {
        console.warn('📁 Could not list storage contents:', listErr);
      }
      
      const signed = await supabase.storage
        .from('proofs')
        .createSignedUrl(row.photo_storage_path, 86400); // 24 hours

      if (signed.error) {
        console.error('❌ createSignedUrl error:', signed.error, 'path:', row.photo_storage_path);
        console.error('Full error object:', JSON.stringify(signed.error));
        
        // Try to get more info about what's in storage
        const pathParts = row.photo_storage_path.split('/');
        if (pathParts.length >= 2) {
          try {
            const { data: folderContents } = await supabase.storage
              .from('proofs')
              .list(pathParts[0]);
            console.log('📂 Contents of user folder:', folderContents);
          } catch (e) {
            console.log('📂 Could not list user folder contents');
          }
        }
        
        return null;
      }
      
      console.log('🔗 signedUrl:', signed.data.signedUrl);
      return signed.data.signedUrl;
    }

    // LEGACY fallback: base64 (READ-ONLY, no new writes)
    if (row.photo && typeof row.photo === 'string') {
      if (row.photo.startsWith('data:image/')) {
        console.warn('📜 Legacy base64 image detected - read-only fallback');
        return row.photo;
      } else {
        // Assume base64 without prefix
        console.warn('📜 Legacy base64 image without prefix - read-only fallback');
        return `data:image/jpeg;base64,${row.photo}`;
      }
    }

    // LEGACY fallback: URL
    if (row.photo_url) {
      console.warn('📜 Legacy photo_url detected - read-only fallback');
      return row.photo_url;
    }

    console.log('❓ No image source found in verification record');
    return null;
  } catch (error) {
    console.error('❌ Failed to get verification image source:', error.message);
    return null;
  }
}

/**
 * Smart background sync for legacy verifications
 * Handles both old photo (base64) and new photo_storage_path formats
 */
export async function syncVerificationToCloud(verificationData: any): Promise<void> {
  try {
    // Check if user is authenticated
    let uid: string;
    try {
      ({ uid } = await getAuthenticatedSession());
      console.log('📊 Background sync auth check: uid=', uid);
    } catch (error) {
      console.warn('User not authenticated, skipping cloud sync:', error.message);
      return;
    }

    // Case 1: Legacy verification with base64 photo, no storage path
    if (verificationData.photo && !verificationData.photo_storage_path) {
      console.log('Converting legacy base64 verification to Storage format');
      
      const result = await saveVerificationFromBase64({
        taskId: verificationData.task || 'unknown',
        base64: verificationData.photo,
        status: verificationData.status || 'pending',
        userAgent: verificationData.user_agent
      });
      
      console.log('Legacy verification converted to Storage:', result);
      return;
    }

    // Case 2: New format with storage path - normal insert without photo
    const cleanData = { ...verificationData };
    delete cleanData.photo; // NEVER insert photo field
    
    // Ensure user_id is set to authenticated user
    cleanData.user_id = uid;
    
    const { error } = await supabase
      .from('verifications')
      .insert(cleanData);
      
    if (error) {
      console.error('Background sync failed:', error);
      throw error;
    }
    
    console.log('Verification synced to cloud successfully');
  } catch (error) {
    console.error('syncVerificationToCloud failed:', error);
    throw error;
  }
}

/**
 * Clean up old verification records and storage files for current authenticated user
 */
export async function cleanupOldVerifications(daysToKeep: number = 30): Promise<{ deletedCount: number }> {
  try {
    // Get authenticated user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('User not authenticated, skipping cleanup');
      return { deletedCount: 0 };
    }
    const uid = user.id;
    console.log('🧹 Cleaning up verifications for user:', uid);

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    // First, get the records to delete so we can clean up storage
    // ONLY for the current authenticated user
    const { data: toDelete, error: fetchError } = await supabase
      .from('verifications')
      .select('photo_storage_path, id')
      .eq('user_id', uid) // CRITICAL: Only current user's verifications
      .lt('created_at', cutoffDate.toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch old verifications: ${fetchError.message}`)
    }

    console.log(`Found ${toDelete?.length || 0} old verifications for user ${uid}`);

    // Delete from storage first
    if (toDelete && toDelete.length > 0) {
      const pathsToDelete = toDelete
        .filter(record => record.photo_storage_path)
        .map(record => record.photo_storage_path)

      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('proofs')
          .remove(pathsToDelete)

        if (storageError) {
          console.error('Failed to cleanup storage files:', storageError)
          // Don't throw - continue with DB cleanup
        } else {
          console.log(`Cleaned up ${pathsToDelete.length} storage files for user ${uid}`)
        }
      }

      // Then delete from database - ONLY for current user
      const verificationIds = toDelete.map(record => record.id);
      const { data, error } = await supabase
        .from('verifications')
        .delete()
        .eq('user_id', uid) // CRITICAL: Only current user's verifications
        .in('id', verificationIds) // Only the ones we found above
        .select('id')

      if (error) {
        throw new Error(`Failed to delete old verifications: ${error.message}`)
      }

      const deletedCount = data ? data.length : 0
      
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old verification records for user ${uid}`)
      }

      return { deletedCount }
    }

    return { deletedCount: 0 }
  } catch (error) {
    throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}