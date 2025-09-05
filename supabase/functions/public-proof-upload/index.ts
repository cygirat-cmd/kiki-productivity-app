import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*"; // ustaw docelowo na produkcyjną domenę

function CORS(origin: string | null) {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", ORIGIN === "*" ? "*" : ORIGIN);
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Vary", "Origin");
  h.set("Content-Type", "application/json");
  return h;
}

Deno.serve(async (req) => {
  const headers = CORS(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const res = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers });

  try {
    const URL = Deno.env.get("SUPABASE_URL");
    const KEY = Deno.env.get("SERVICE_ROLE_KEY");
    if (!URL || !KEY) return res({ error: "server not configured" }, 500);

    // ---- 1) weź form-data
    const form = await req.formData().catch((e) => null);
    if (!form) return res({ error: "invalid form-data" }, 400);

    const token = String(form.get("token") ?? "");
    const file = form.get("file") as File | null;
    if (!token) return res({ error: "missing token" }, 400);
    if (!file) return res({ error: "missing file" }, 400);
    if (!ALLOWED.has(file.type)) return res({ error: "invalid mime", mime: file.type }, 415);
    if (file.size > MAX_BYTES) return res({ error: "file too large", size: file.size }, 413);

    const sb = createClient(URL, KEY, { auth: { persistSession: false } });

    // ---- 2) token -> verification_id
    const { data: tk, error: tkErr } = await sb
      .from("review_tokens")
      .select("verification_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tkErr) return res({ error: "token query failed", details: tkErr }, 500);
    if (!tk) return res({ error: "invalid token" }, 400);
    if (tk.expires_at && new Date(tk.expires_at) < new Date()) return res({ error: "token expired" }, 410);

    // ---- 3) weryfikacja istnieje -> user_id
    const { data: ver, error: verErr } = await sb
      .from("verifications")
      .select("id, user_id, status")
      .eq("id", tk.verification_id)
      .maybeSingle();

    if (verErr) return res({ error: "ver query failed", details: verErr }, 500);
    if (!ver) return res({ error: "verification not found" }, 404);

    // ---- 4) rate-limit: max 5 uploadów / 15 min
    const { data: recent, error: rlErr } = await sb.rpc("noop"); // placeholder, patrz niżej
    // zamiast RPC zróbmy prosty select:
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: logs, error: logErr } = await sb
      .from("verification_upload_log")
      .select("id")
      .eq("verification_id", ver.id)
      .gte("created_at", since);

    if (logErr) return res({ error: "ratelimit query failed", details: logErr }, 500);
    if ((logs?.length || 0) >= 5) return res({ error: "rate-limited" }, 429);

    // ---- 5) upload do prywatnego bucketu proofs
    const ext = file.type === "image/png" ? "png" : (file.type === "image/webp" ? "webp" : "jpg");
    const path = `${ver.user_id}/review_${ver.id}_${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage.from("proofs").upload(path, file, {
      contentType: file.type, upsert: false
    });
    if (upErr) return res({ error: "upload failed", details: upErr }, 500);

    // ---- 6) update verification + log uploadu
    const nowIso = new Date().toISOString();

    const { error: updErr } = await sb
      .from("verifications")
      .update({ photo_storage_path: path, photo_uploaded_at: nowIso })
      .eq("id", ver.id);
    if (updErr) return res({ error: "db update failed", details: updErr }, 500);

    // log anty-spam
    await sb.from("verification_upload_log").insert({ verification_id: ver.id });

    // ---- 7) podgląd
    const { data: signed, error: signErr } = await sb.storage.from("proofs").createSignedUrl(path, 3600);
    if (signErr) return res({ ok: true, path, preview: null, warn: "signed url failed", details: signErr });

    return res({ ok: true, path, preview: signed.signedUrl });
  } catch (e) {
    return res({ error: String(e) }, 500);
  }
});
