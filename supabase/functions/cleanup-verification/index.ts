import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    }
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({}, 200)

  try {
    const { token } = await req.json();

    if (!token) {
      return json({ error: "Missing token" }, 400)
    }

    // Check if service role key is available
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not available");
      return json({ error: "Service role key not configured" }, 500);
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(
      "https://hwriwdbzervvmfpuzjqj.supabase.co",
      serviceRoleKey
    );

    // Get verification data using token - this ensures we only delete the RIGHT photo
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("review_tokens")
      .select(`
        verification_id, 
        expires_at,
        verifications!inner(
          photo_storage_path,
          user_id,
          status
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return json({ error: "Invalid token" }, 401);
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return json({ error: "Token expired" }, 401);
    }

    // Get the photo path from the verification (security: only delete photos that belong to this token)
    const verification = tokenData.verifications;
    const photoPath = verification.photo_storage_path;

    if (!photoPath) {
      return json({ error: "No photo to delete" }, 404);
    }

    console.log("Attempting to delete photo:", photoPath);
    
    const { data: deleteData, error: deleteError } = await supabaseAdmin.storage
      .from("proofs")
      .remove([photoPath]);

    if (deleteError) {
      console.error("Failed to delete photo:", deleteError);
      return json({ error: "Storage deletion failed: " + deleteError.message }, 500);
    }
    
    console.log("✅ Successfully deleted photo:", photoPath, deleteData);

    return json({ success: true })
  } catch (e: any) {
    console.error("Cleanup function error:", e);
    return json({ error: e?.message || "Server error" }, 500)
  }
});