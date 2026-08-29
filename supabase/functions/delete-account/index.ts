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

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "INVALID_SESSION" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "SUPPRIMER") return json({ error: "CONFIRMATION_REQUIRED" }, 400);

    const allowedReasons = new Set(["not_provided", "completed_need", "no_longer_use", "not_found", "privacy", "technical", "other"]);
    const reasonCode = allowedReasons.has(String(body?.reason || "")) ? String(body.reason) : "not_provided";
    const appVersion = String(body?.app_version || "").slice(0, 32) || null;

    const user = userData.user;
    const userId = user.id;
    const email = (user.email || "").toLowerCase();
    const now = new Date().toISOString();
    const details: Record<string, string> = {};

    async function safeRows(table: string, columns: string) {
      try {
        const { data } = await admin.from(table).select(columns).eq("user_id", userId);
        return Array.isArray(data) ? data : [];
      } catch (_) {
        return [];
      }
    }

    // La photographie produit est calculée avant toute suppression. Elle ne
    // conserve ni l'identifiant Auth, ni l'e-mail, ni une adresse IP.
    const [protocolAccesses, protocolProgress, appleTransactions, stripePayments, recipePurchases] = await Promise.all([
      safeRows("user_protocols", "protocol_id,apple_transaction_id"),
      safeRows("protocol_progress", "protocol_id,current_day,total_days"),
      safeRows("apple_iap_transactions", "id"),
      safeRows("payments", "id"),
      safeRows("recipe_purchases", "stripe_session_id,apple_transaction_id"),
    ]);
    const protocolIds = [...new Set(
      [...protocolAccesses, ...protocolProgress]
        .map((row: Record<string, unknown>) => String(row.protocol_id || ""))
        .filter((value: string) => /^[0-9a-f-]{36}$/i.test(value)),
    )];
    const completedProtocolCount = protocolProgress.filter((row: Record<string, unknown>) =>
      Number(row.total_days || 0) > 0 && Number(row.current_day || 0) >= Number(row.total_days || 0)
    ).length;
    const hadApplePurchase = appleTransactions.length > 0 || protocolAccesses.some((row: Record<string, unknown>) => row.apple_transaction_id) || recipePurchases.some((row: Record<string, unknown>) => row.apple_transaction_id);
    const hadStripePurchase = stripePayments.length > 0 || recipePurchases.some((row: Record<string, unknown>) => row.stripe_session_id);
    const purchaseOrigin = hadApplePurchase && hadStripePurchase ? "mixed" : hadApplePurchase ? "apple" : hadStripePurchase ? "stripe" : "none";

    // Historique produit strictement anonyme : le UUID ci-dessous est aléatoire
    // et ne peut pas être relié au compte supprimé.
    try {
      const { error } = await admin.from("account_deletions").insert({
        anonymous_user_hash: crypto.randomUUID(),
        had_protocol: protocolIds.length > 0,
        protocol_ids: protocolIds,
        purchase_origin: purchaseOrigin,
        completed_protocol_count: completedProtocolCount,
        exit_reason: reasonCode,
        app_version: appVersion,
        deleted_at: now,
      });
      if (error) details.account_deletions = error.message;
    } catch (error) {
      details.account_deletions = String(error instanceof Error ? error.message : error);
    }

    async function safeDelete(table: string, column: string, value?: string | null) {
      if (!value) return;
      try {
        const { error } = await admin.from(table).delete().eq(column, value);
        if (error) details[`${table}.${column}`] = error.message;
      } catch (error) {
        details[`${table}.${column}`] = String(error instanceof Error ? error.message : error);
      }
    }

    async function safeAnonymize(table: string, column: string, value: string | null | undefined, patch: Record<string, unknown>) {
      if (!value) return;
      try {
        const { error } = await admin.from(table).update(patch).eq(column, value);
        if (error) details[`${table}.${column}`] = error.message;
      } catch (error) {
        details[`${table}.${column}`] = String(error instanceof Error ? error.message : error);
      }
    }

    // Les fichiers du bucket ne sont pas supprimés par la cascade SQL.
    // On les efface avant le compte afin de ne jamais créer de média orphelin.
    async function purgeFoodMedia() {
      const bucket = admin.storage.from("food-media");
      const paths: string[] = [];
      const folders = [userId];
      while (folders.length) {
        const prefix = folders.pop()!;
        let offset = 0;
        while (true) {
          const { data, error } = await bucket.list(prefix, {
            limit: 100,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
          if (error) {
            const message = String(error.message || error).toLowerCase();
            // Une ancienne installation peut ne pas encore avoir ce bucket.
            // L'absence du bucket signifie qu'aucun média repas n'est à purger.
            if (message.includes("bucket not found") || message.includes("resource not found")) return;
            throw error;
          }
          const rows = data || [];
          rows.forEach((entry) => {
            if (!entry?.name) return;
            const path = `${prefix}/${entry.name}`;
            if (entry.id) paths.push(path);
            else folders.push(path);
          });
          if (rows.length < 100) break;
          offset += rows.length;
        }
      }
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await bucket.remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
    }

    try {
      await purgeFoodMedia();
    } catch (error) {
      return json({
        error: "PRIVATE_MEDIA_DELETE_FAILED",
        message: "Les médias privés n’ont pas tous pu être supprimés. Le compte est conservé afin de permettre une nouvelle tentative.",
        details: String(error instanceof Error ? error.message : error),
      }, 500);
    }

    // Tables historiques sans cascade garantie dans toutes les installations.
    await safeDelete("push_subscriptions", "user_id", userId);
    await safeDelete("protocol_progress", "user_id", userId);
    await safeDelete("user_protocols", "user_id", userId);
    await safeDelete("member_profiles", "user_id", userId);
    await safeDelete("recipe_purchases", "user_id", userId);
    await safeDelete("recipe_purchases", "user_email", email);

    // Les tables récentes référencent auth.users ON DELETE CASCADE : la
    // suppression Auth efface notamment repas, suivis, parcours et journal.
    // L’historique comptable est uniquement anonymisé.
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
    if (deleteError) return json({ error: deleteError.message, details }, 500);
    return json({ ok: true, deleted: true, details });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "DELETE_ACCOUNT_FAILED" }, 500);
  }
});
