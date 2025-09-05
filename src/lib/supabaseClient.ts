/**
 * Unified Supabase Client - Single source of truth
 * Consolidated from multiple supabase configuration files
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV_VARS, TIMEOUTS, API_CONFIG, VERIFICATION_STATUS } from '@/constants';

// Environment validation
const SUPABASE_URL = import.meta.env[ENV_VARS.SUPABASE_URL];
const SUPABASE_ANON_KEY = import.meta.env[ENV_VARS.SUPABASE_ANON_KEY];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration. Check your environment variables.');
}

// Type definitions
export interface VerificationRecord {
  id: string;
  user_id: string | null;
  guest_id: string | null;
  task: string;
  photo_storage_path: string | null;
  photo_url?: string | null;
  status: typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];
  reason?: string | null;
  review_deadline: string | null;
  created_at: string;
  updated_at: string;
  photo_uploaded_at: string | null;
  user_agent?: string | null;
}

export interface VerificationInsert {
  id: string;
  user_id?: string | null;
  guest_id?: string | null;
  task: string;
  photo_storage_path: string;
  status: typeof VERIFICATION_STATUS.PENDING;
  reason?: string;
  review_deadline?: string;
  created_at: string;
  user_agent?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  last_sync: string;
}

export interface KikiSaveData {
  id?: string;
  user_id: string;
  pet_data: Record<string, unknown>;
  tasks_data: Record<string, unknown>[];
  cemetery_data: Record<string, unknown>[];
  coins: number;
  pause_tokens: number;
  owned_items: string[];
  session_stats: Record<string, unknown>;
  last_sync: string;
}

// Connection configuration
const supabaseConfig = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-client-info': 'kiki-productivity-app'
    }
  },
  db: {
    schema: 'public'
  }
};

// Create singleton client instance
let supabaseInstance: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfig);
  }
  return supabaseInstance;
}

export const supabase = createSupabaseClient();

// Enhanced wrapper with retry logic and error handling
class SupabaseWrapper {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= API_CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === API_CONFIG.MAX_RETRY_ATTEMPTS) {
          throw lastError;
        }

        const delay = API_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // Authentication methods
  async signUp(email: string, password: string) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.auth.signUp({ email, password });
      if (error) throw error;
      return { data, error: null };
    });
  }

  async signIn(email: string, password: string) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { data, error: null };
    });
  }

  async signOut() {
    return this.withRetry(async () => {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      return { error: null };
    });
  }

  async getCurrentUser() {
    return this.client.auth.getUser();
  }

  // Storage methods
  async uploadProofImage(path: string, file: ArrayBuffer, options: { contentType?: string; upsert?: boolean } = {}) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.storage
        .from('proofs')
        .upload(path, file, {
          contentType: options.contentType || 'image/jpeg',
          upsert: options.upsert || false
        });
      
      if (error) throw error;
      return { data, error: null };
    });
  }

  async createSignedUrl(path: string, expiresIn: number = 86400) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.storage
        .from('proofs')
        .createSignedUrl(path, expiresIn);
      
      if (error) throw error;
      return { data, error: null };
    });
  }

  // Database methods
  async insertVerification(verification: VerificationInsert) {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('verifications')
        .insert(verification)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    });
  }

  async updateVerification(id: string, updates: Partial<VerificationRecord>) {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('verifications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { data, error: null };
    });
  }

  async getVerification(id: string) {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('verifications')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return { data, error: null };
    });
  }

  // Cloud save methods
  async saveKikiToCloud(saveData: Omit<KikiSaveData, 'id' | 'user_id'>) {
    const { data: user } = await this.getCurrentUser();
    if (!user.user) throw new Error('User not authenticated');

    const fullSaveData: Omit<KikiSaveData, 'id'> = {
      user_id: user.user.id,
      ...saveData,
      last_sync: new Date().toISOString()
    };

    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('kiki_saves')
        .upsert(fullSaveData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return { data, error: null };
    });
  }

  async loadKikiFromCloud() {
    const { data: user } = await this.getCurrentUser();
    if (!user.user) throw new Error('User not authenticated');

    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('kiki_saves')
        .select('*')
        .eq('user_id', user.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return { data, error };
    });
  }

  // RPC methods
  async createReviewToken(verificationId: string, ttlSeconds: number = 86400) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.rpc('create_review_token', {
        p_verification_id: verificationId,
        p_ttl_seconds: ttlSeconds
      });

      if (error) throw error;
      return { data, error: null };
    });
  }

  async getVerificationStats(daysBack: number = 7) {
    return this.withRetry(async () => {
      const { data, error } = await this.client.rpc('get_verification_stats', {
        days_back: daysBack
      });

      if (error) throw error;
      return { data: data || {}, error: null };
    });
  }

  // Cleanup methods
  async cleanupOldVerifications(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return this.withRetry(async () => {
      const { data: toDelete } = await this.client
        .from('verifications')
        .select('photo_storage_path')
        .lt('created_at', cutoffDate.toISOString());

      if (toDelete && toDelete.length > 0) {
        const pathsToDelete = toDelete
          .filter(record => record.photo_storage_path)
          .map(record => record.photo_storage_path);

        if (pathsToDelete.length > 0) {
          await this.client.storage.from('proofs').remove(pathsToDelete);
        }
      }

      const { data, error } = await this.client
        .from('verifications')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;
      return { deletedCount: data?.length || 0, error: null };
    });
  }
}

// Export enhanced wrapper
export const enhancedSupabase = new SupabaseWrapper(supabase);

// Legacy compatibility exports
export const signUp = enhancedSupabase.signUp.bind(enhancedSupabase);
export const signIn = enhancedSupabase.signIn.bind(enhancedSupabase);
export const signOut = enhancedSupabase.signOut.bind(enhancedSupabase);
export const getCurrentUser = enhancedSupabase.getCurrentUser.bind(enhancedSupabase);
export const saveKikiToCloud = enhancedSupabase.saveKikiToCloud.bind(enhancedSupabase);
export const loadKikiFromCloud = enhancedSupabase.loadKikiFromCloud.bind(enhancedSupabase);
export const cleanupOldVerifications = enhancedSupabase.cleanupOldVerifications.bind(enhancedSupabase);

// Connection health check
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('verifications').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}