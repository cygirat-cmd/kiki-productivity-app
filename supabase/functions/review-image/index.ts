import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Cache-Control": "no-store"
    }
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({}, 200)

  try {
    // URL param z tokenem np. /review-image/:token
    const url = new URL(req.url);
    const token = url.pathname.split("/").pop();

    if (!token) {
      return json({ error: "Missing token" }, 400)
    }

    // Validate token format (hex tokens are 64 chars)
    if (!/^[A-Fa-f0-9]{64}$/.test(token)) {
      return json({ error: "Invalid token format" }, 400)
    }

    // klient admin z service role key
    const supabaseAdmin = createClient(
      "https://hwriwdbzervvmfpuzjqj.supabase.co",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // First query: Get token data
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("review_tokens")
      .select("verification_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return json({ error: "Invalid token" }, 404)
    }

    // Check if token has expired
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return json({ error: "Token expired" }, 410)
    }

    // Second query: Get verification data
    const { data: verificationRow, error: verificationError } = await supabaseAdmin
      .from("verifications")
      .select("photo_storage_path, status")
      .eq("id", tokenRow.verification_id)
      .single();

    if (verificationError || !verificationRow) {
      return json({ error: "Verification not found" }, 404)
    }

    // Check if verification status allows image access
    if (!['trial', 'pending', 'approved', 'rejected'].includes(verificationRow.status)) {
      return json({ error: "Not accessible" }, 403)
    }

    const photoPath = verificationRow.photo_storage_path;
    if (!photoPath) {
      return json({ error: "No photo" }, 404)
    }

    // wygeneruj signed URL na 1h
    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage.from("proofs").createSignedUrl(photoPath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return json({ error: signedUrlError?.message || "Failed to generate signed URL" }, 500)
    }

    return json({ data: { signedUrl: signedUrlData.signedUrl } }, 200)
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500)
  }
});