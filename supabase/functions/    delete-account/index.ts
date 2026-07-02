import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "MISSING_SERVER_CONFIG" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "INVALID_SESSION" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "SUPPRIMER") return json({ error: "CONFIRMATION_REQUIRED" }, 400);

    const user = userData.user;
    const userId = user.id;
    const email = (user.email || "").toLowerCase();
    const now = new Date().toISOString();

    const results: Record<string, string> = {};
    async function safeDelete(table: string, column: string, value: string | null | undefined) {
      if (!value) return;
      try {
        const { error } = await admin.from(table).delete().eq(column, value);
        if (error) results[`${table}.${column}`] = error.message;
      } catch (e) {
        results[`${table}.${column}`] = String(e?.message || e);
      }
    }

    async function safeAnonymize(table: string, column: string, value: string | null | undefined, patch: Record<string, unknown>) {
      if (!value) return;
      try {
        const { error } = await admin.from(table).update(patch).eq(column, value);
        if (error) results[`${table}.${column}`] = error.message;
      } catch (e) {
        results[`${table}.${column}`] = String(e?.message || e);
      }
    }

    // Données applicatives liées au compte.
    await safeDelete("push_subscriptions", "user_id", userId);
    await safeDelete("protocol_progress", "user_id", userId);
    await safeDelete("user_protocols", "user_id", userId);
    await safeDelete("member_profiles", "user_id", userId);
    await safeDelete("recipe_purchases", "user_id", userId);
    await safeDelete("recipe_purchases", "user_email", email);
    await safeDelete("profiles", "id", userId);

    // Paiements : on évite de supprimer brutalement l’historique comptable, on retire l’identification utilisateur quand les colonnes existent.
    await safeAnonymize("payments", "user_id", userId, {
      user_id: null,
      user_email: null,
      metadata: { deleted_account: true, deleted_at: now },
    });
    await safeAnonymize("payments", "user_email", email, {
      user_id: null,
      user_email: null,
      metadata: { deleted_account: true, deleted_at: now },
    });

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) return json({ error: deleteError.message, details: results }, 500);

    return json({ ok: true, deleted: true, details: results });
  } catch (err) {
    return json({ error: err?.message || "DELETE_ACCOUNT_FAILED" }, 500);
  }
});
