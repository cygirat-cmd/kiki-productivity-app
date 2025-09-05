/**
 * Validate image URL to ensure it's from a trusted source
 * Prevents loading malicious external images
 */
export function validateImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    
    // Only allow Supabase Storage signed URLs
    const supabasePattern = /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\/v1\/object\/sign\//;
    
    if (!supabasePattern.test(url)) {
      console.warn('Invalid image URL - not a Supabase signed URL:', url);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Invalid image URL format:', url);
    return false;
  }
}

/**
 * Get safe image URL with fallback
 */
export function getSafeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const decodedUrl = decodeURIComponent(url);
  
  if (validateImageUrl(decodedUrl)) {
    return decodedUrl;
  }
  
  return null;
}