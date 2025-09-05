/**
 * Guest helper functions for managing unregistered users
 */

export function getGuestId(): string {
  let id = localStorage.getItem('kiki-guest-id');
  if (!id) {
    // Use crypto.randomUUID() if available, fallback to timestamp + random
    if (crypto?.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    localStorage.setItem('kiki-guest-id', id);
  }
  return id;
}

export function clearGuestId(): void {
  localStorage.removeItem('kiki-guest-id');
}

export function hasGuestId(): boolean {
  return !!localStorage.getItem('kiki-guest-id');
}

/**
 * Upload proof as guest (owner without login)
 */
export async function uploadAsGuest({ 
  file, 
  taskTitle 
}: { 
  file: File; 
  taskTitle: string;
}): Promise<{
  verificationId: string;
  path: string;
  preview: string | null;
  reviewToken?: string;
}> {
  // Check rate limit for uploads
  const { rateLimiter } = await import('@/utils/rateLimiter');
  const rateCheck = rateLimiter.checkLimit('supabase_upload', getGuestId());
  
  if (!rateCheck.allowed) {
    const waitTime = Math.ceil((rateCheck.retryAfter || 0) / 1000);
    throw new Error(`Upload rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }
  const fd = new FormData();
  fd.append('guest_id', getGuestId());
  fd.append('task', taskTitle || 'Untitled');
  fd.append('file', file);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL not configured');
  }
  if (!supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY not configured');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/guest-owner-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  
  if (!res.ok || !json.ok) {
    throw new Error(json?.error || `Upload failed (${res.status})`);
  }

  return json as {
    verificationId: string;
    path: string;
    preview: string | null;
    reviewToken?: string;
  };
}

/**
 * Get review link for guest verification
 */
export function getGuestReviewLink(reviewToken: string): string {
  return `${window.location.origin}/review?token=${reviewToken}`;
}

/**
 * Check if current user should use guest upload
 */
export async function shouldUseGuestUpload(): Promise<boolean> {
  try {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    return !session?.user;
  } catch {
    return true; // Default to guest if auth check fails
  }
}