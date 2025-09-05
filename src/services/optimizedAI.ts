/**
 * Optimized AI Service - Secure, efficient proof validation
 * Removes frontend API keys exposure and implements caching
 */

import { enhancedSupabase } from '../lib/supabaseClient';
import { CACHE_DURATIONS, API_CONFIG, FILE_SIZE_LIMITS, AI_THRESHOLDS } from '../constants';

// Types for AI scoring (no sensitive data in frontend)
export interface AIScoreRequest {
  imageBuffer: ArrayBuffer;
  taskDescription: string;
  userId: string;
}

export interface AIScoreResult {
  score: number; // 0-1, confidence that the proof is valid
  reasoning: string;
  model: string;
  processingTimeMs: number;
  cached: boolean;
}

// Cache for AI results to reduce costs
class AIResultCache {
  private cache = new Map<string, { result: AIScoreResult; timestamp: number }>();
  private maxAge = CACHE_DURATIONS.ONE_HOUR * 24; // 24 hours
  private maxSize = API_CONFIG.MAX_BATCH_SIZE * 10; // Max cached results

  private generateKey(imageBuffer: ArrayBuffer, taskDescription: string): string {
    // Simple hash for caching (not cryptographic)
    const data = new Uint8Array(imageBuffer.slice(0, 1024)); // First 1KB
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    return `${hash}_${taskDescription.length}`;
  }

  get(imageBuffer: ArrayBuffer, taskDescription: string): AIScoreResult | null {
    const key = this.generateKey(imageBuffer, taskDescription);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    // Mark as cached result
    return { ...cached.result, cached: true };
  }

  set(imageBuffer: ArrayBuffer, taskDescription: string, result: AIScoreResult): void {
    const key = this.generateKey(imageBuffer, taskDescription);
    
    // Clean old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      result: { ...result, cached: false },
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge
    };
  }
}

const aiCache = new AIResultCache();

/**
 * Score proof with AI - now calls secure Edge Function instead of exposing API keys
 * This prevents API key exposure and implements server-side rate limiting
 */
export async function scoreProofWithAI({
  imageBuffer,
  taskDescription,
  userId
}: AIScoreRequest): Promise<AIScoreResult> {
  const startTime = Date.now();
  
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    throw new Error('Image buffer is required and cannot be empty');
  }
  
  if (!taskDescription?.trim()) {
    throw new Error('Task description is required');
  }
  
  if (!userId?.trim()) {
    throw new Error('User ID is required for AI scoring');
  }

  // Check cache first
  const cached = aiCache.get(imageBuffer, taskDescription);
  if (cached) {
    console.log('AI score cache hit');
    return cached;
  }

  try {
    // Convert ArrayBuffer to base64 for Edge Function
    const base64 = arrayBufferToBase64(imageBuffer);
    
    // Call secure Edge Function instead of direct AI API
    const { data: session } = await enhancedSupabase.getCurrentUser();
    if (!session.user) {
      throw new Error('User must be authenticated for AI scoring');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-score-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session?.access_token}`
      },
      body: JSON.stringify({
        image_base64: base64,
        task_description: taskDescription,
        user_id: userId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI scoring failed: ${response.status} ${errorText}`);
    }

    const result = await response.json() as AIScoreResult;
    result.processingTimeMs = Date.now() - startTime;
    result.cached = false;

    // Validate result
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 1) {
      throw new Error('Invalid AI score returned');
    }

    // Cache successful result
    aiCache.set(imageBuffer, taskDescription, result);
    
    console.log(`AI scoring completed in ${result.processingTimeMs}ms, score: ${result.score}`);
    
    return result;
    
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error('AI scoring failed:', error);
    
    // Return fallback result to avoid breaking the flow
    const fallbackResult: AIScoreResult = {
      score: 0.5, // Neutral score
      reasoning: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Manual review required.`,
      model: 'fallback',
      processingTimeMs,
      cached: false
    };
    
    return fallbackResult;
  }
}

/**
 * Batch process multiple proofs for premium users
 */
export async function batchScoreProofs(
  requests: AIScoreRequest[]
): Promise<AIScoreResult[]> {
  if (requests.length === 0) {
    return [];
  }
  
  if (requests.length > API_CONFIG.MAX_BATCH_SIZE) {
    throw new Error(`Batch size cannot exceed ${API_CONFIG.MAX_BATCH_SIZE} proofs`);
  }

  // Process in parallel with controlled concurrency
  const results = await Promise.allSettled(
    requests.map(request => scoreProofWithAI(request))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Batch AI scoring failed for request ${index}:`, result.reason);
      return {
        score: 0.5,
        reasoning: `Batch processing failed: ${result.reason}`,
        model: 'fallback',
        processingTimeMs: 0,
        cached: false
      };
    }
  });
}

/**
 * Get AI service health and usage stats
 */
export async function getAIServiceStats(): Promise<{
  cacheStats: ReturnType<AIResultCache['getStats']>;
  available: boolean;
  lastError?: string;
}> {
  try {
    // Test AI service availability with a minimal request
    const testResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-health`, {
      method: 'GET'
    });
    
    return {
      cacheStats: aiCache.getStats(),
      available: testResponse.ok,
      lastError: testResponse.ok ? undefined : `HTTP ${testResponse.status}`
    };
  } catch (error) {
    return {
      cacheStats: aiCache.getStats(),
      available: false,
      lastError: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clear AI cache (useful for debugging or memory management)
 */
export function clearAICache(): void {
  aiCache.clear();
  console.log('AI cache cleared');
}

/**
 * Prefetch AI models (warm up the service)
 */
export async function warmupAIService(): Promise<boolean> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-warmup`, {
      method: 'POST'
    });
    
    return response.ok;
  } catch (error) {
    console.warn('AI service warmup failed:', error);
    return false;
  }
}

// Utility functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Image preprocessing for better AI analysis
 */
export function preprocessImageForAI(imageBuffer: ArrayBuffer): ArrayBuffer {
  // In a real implementation, you might:
  // 1. Resize large images to reduce processing time
  // 2. Normalize image format
  // 3. Apply basic filters to improve recognition
  
  // For now, return as-is but validate size
  const maxSize = FILE_SIZE_LIMITS.IMAGE_MAX_FREE; // 5MB limit
  
  if (imageBuffer.byteLength > maxSize) {
    throw new Error(`Image too large: ${(imageBuffer.byteLength / 1024 / 1024).toFixed(1)}MB. Maximum: 5MB`);
  }
  
  return imageBuffer;
}

/**
 * Smart scoring thresholds based on task type
 */
export function getScoreThresholds(taskDescription: string): {
  approveThreshold: number;
  rejectThreshold: number;
} {
  const text = taskDescription.toLowerCase();
  
  // More lenient for subjective tasks
  if (text.includes('creative') || text.includes('design') || text.includes('art')) {
    return { approveThreshold: AI_THRESHOLDS.APPROVE_CREATIVE, rejectThreshold: AI_THRESHOLDS.REJECT_CREATIVE };
  }
  
  // Stricter for objective tasks
  if (text.includes('exercise') || text.includes('measurement') || text.includes('data')) {
    return { approveThreshold: AI_THRESHOLDS.APPROVE_OBJECTIVE, rejectThreshold: AI_THRESHOLDS.REJECT_OBJECTIVE };
  }
  
  // Default thresholds
  return { approveThreshold: AI_THRESHOLDS.APPROVE_DEFAULT, rejectThreshold: AI_THRESHOLDS.REJECT_DEFAULT };
}