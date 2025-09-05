import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-authorization',
};

type RollPayload = {
  jti: string;
  crateId?: number;
  itemId: number;
  iat: number;
  exp: number;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_ROLL_SECRET = Deno.env.get('SUPABASE_JWT_SECRET')!;

// client „użytkownika" – widzi auth.uid()
function userClient(req: Request) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
}

// client admin – omija RLS
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": req.headers.get("origin") ?? "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-authorization",
          "vary": "Origin"
        }
      });
    }
    
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const { token } = await req.json().catch(() => ({}));
    if (!token) return json(400, { error: 'missing_token' });

    // 1) Pobierz zalogowanego usera z nagłówka Authorization
    const supa = userClient(req);
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return json(401, { error: 'unauthorized' });

    // 2) Zweryfikuj podpis roll-tokena (HMAC)
    const secret = new TextEncoder().encode(JWT_ROLL_SECRET);
    let payload: RollPayload;
    try {
      const { payload: p } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      // basic payload guard
      if (typeof p.itemId !== 'number' || typeof p.jti !== 'string') {
        return json(400, { error: 'invalid_payload' });
      }
      payload = p as unknown as RollPayload;
    } catch (e) {
      return json(400, { error: 'invalid_token' });
    }

    // 3) Sprawdź czy token został już użyty (idempotencja)
    const { data: alreadyRedeemed } = await admin
      .from('redeemed_tokens')
      .select('jti')
      .eq('jti', payload.jti)
      .single();

    if (alreadyRedeemed) return json(200, { status: 'already_redeemed', itemId: payload.itemId });

    // 4) Sprawdź czy już masz item (dodatkowa ochrona)
    const { data: owned } = await admin
      .from('user_items')
      .select('item_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('item_id', payload.itemId);

    if (owned) return json(200, { status: 'already_owned', itemId: payload.itemId });

    // 5) Upsert do user_items (eliminuje 409)
    const { error: upErr } = await admin
      .from('user_items')
      .upsert({ 
        user_id: user.id, 
        item_id: payload.itemId,
        acquired_at: new Date().toISOString(),
        source: 'guest_migration'
      }, { 
        onConflict: 'user_id,item_id',
        ignoreDuplicates: true
      });

    if (upErr) return json(400, { error: 'insert_failed', details: upErr });

    // 6) Zapisz token jako zużyty
    await admin
      .from('redeemed_tokens')
      .upsert({
        jti: payload.jti,
        user_id: user.id,
        crate_id: payload.crateId || null,
        item_id: payload.itemId,
        token_type: 'guest_migration',
        redeemed_at: new Date().toISOString()
      }, {
        onConflict: 'jti',
        ignoreDuplicates: true
      });

    return json(200, { status: 'ok', itemId: payload.itemId });

  } catch (e) {
    return json(500, { error: 'server_error', details: String(e) });
  }
});