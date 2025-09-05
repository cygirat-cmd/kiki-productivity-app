import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function cors(origin: string | null) {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
  let allow = allowedOrigin || "*";
  
  // If no specific origin configured, allow localhost on common dev ports
  if (!allowedOrigin && origin) {
    const localhostPorts = ["5173", "8080", "8081", "8082", "3000", "4000"];
    const isLocalhost = localhostPorts.some(port => 
      origin === `http://localhost:${port}` || origin === `https://localhost:${port}`
    );
    allow = isLocalhost ? origin : "*";
  }
  
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", allow);
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Vary", "Origin");
  h.set("Content-Type", "application/json");
  return h;
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers });

  try {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "server not configured" }, 500);

    const form = await req.formData().catch(() => null);
    if (!form) return json({ error: "invalid form-data" }, 400);

    const guestId = String(form.get("guest_id") || "").trim();
    const task = String(form.get("task") || "Untitled").slice(0, 200);
    const file = form.get("file") as File | null;

    if (!guestId) return json({ error: "missing guest_id" }, 400);
    if (!file) return json({ error: "missing file" }, 400);
    if (!ALLOWED.has(file.type)) return json({ error: "invalid mime", mime: file.type }, 415);
    if (file.size > MAX_BYTES) return json({ error: "file too large", size: file.size }, 413);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Rate-limit: 5 uploadów / 15 min / guest_id
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: hits2, error: rlErr2 } = await sb
      .from("guest_upload_log")
      .select("id")
      .eq("guest_id", guestId)
      .gte("created_at", since);
    if (rlErr2) return json({ error: "ratelimit query failed", details: rlErr2 }, 500);
    if ((hits2?.length || 0) >= 5) return json({ error: "rate-limited" }, 429);

    // 1) utwórz verification (gość)
    const { data: ver, error: verErr } = await sb
      .from("verifications")
      .insert({
        // id generuje DB jeśli masz default gen_random_uuid(); jeśli nie – przekażemy po select
        guest_id: guestId,
        user_id: null,
        task,
        status: "trial",
        review_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, guest_id")
      .single();

    if (verErr) return json({ error: "insert verification failed", details: verErr }, 500);

    // 2) upload
    const ext = file.type === "image/png" ? "png" : (file.type === "image/webp" ? "webp" : "jpg");
    const storagePath = `guests/${guestId}/owner_${ver.id}_${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage
      .from("proofs")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upErr) return json({ error: "upload failed", details: upErr }, 500);

    // 3) update rekord
    const { error: updErr } = await sb
      .from("verifications")
      .update({ photo_storage_path: storagePath, photo_uploaded_at: new Date().toISOString() })
      .eq("id", ver.id);
    if (updErr) return json({ error: "db update failed", details: updErr }, 500);

    // 4) log rate-limit
    await sb.from("guest_upload_log").insert({ guest_id: guestId });

    // 5) signed url
    const { data: signed, error: sErr } = await sb.storage
      .from("proofs")
      .createSignedUrl(storagePath, 3600);
    if (sErr) return json({ ok: true, verificationId: ver.id, path: storagePath, preview: null, warn: "signed url failed", details: sErr });

    // 6) (opcjonalnie) review token
    let reviewToken: string | null = null;
    try {
      const { data: tok, error: tokErr } = await sb.rpc("create_review_token", {
        p_verification_id: ver.id,  // TEXT lub UUID – Twój wariant funkcji obsłuży
        p_ttl_seconds: 86400,
      });
      if (!tokErr) reviewToken = tok as string;
    } catch { /* ignore */ }

    return json({ ok: true, verificationId: ver.id, path: storagePath, preview: signed.signedUrl, reviewToken });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});