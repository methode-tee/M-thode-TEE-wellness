import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit, logSecurityEvent } from "../_shared/security.ts";

const MAX_AGE_MINUTES = 30;
const ALLOWED_STATUSES = new Set(["redirecting", "completed", "cancelled", "failed", "expired"]);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "resolve").trim();
    const supabase = getAdminClient();

    // Échange sécurisé du jeton opaque de 30 minutes contre une session web Supabase.
    // Cette branche est volontairement accessible sans JWT : la preuve est le jeton
    // aléatoire de 256 bits, stocké uniquement sous forme de hash côté serveur.
    if (action === "bootstrap") {
      const intentId = String(body.intent_id || "").trim();
      const publicToken = String(body.token || "").trim();
      if (!intentId || !publicToken) throw new Error("MISSING_BOOTSTRAP_TOKEN");

      const tokenHash = await sha256Hex(publicToken);
      const now = new Date().toISOString();
      const { data: intent, error } = await supabase
        .from("external_purchase_intents")
        .select("id,user_id,user_email,purchase_type,item_id,item_label,status,expires_at,token_hash")
        .eq("id", intentId)
        .eq("token_hash", tokenHash)
        .gt("expires_at", now)
        .in("status", ["pending", "redirecting"])
        .maybeSingle();

      if (error || !intent) throw new Error("INVALID_OR_EXPIRED_INTENT_TOKEN");
      const email = String(intent.user_email || "").trim().toLowerCase();
      if (!email) throw new Error("INTENT_EMAIL_MISSING");

      const redirectTo = `${(Deno.env.get("APP_URL") || "https://methodetee.app").replace(/\/$/, "")}/checkout.html`;
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      if (linkError || !linkData?.properties?.hashed_token) throw new Error("WEB_SESSION_BOOTSTRAP_FAILED");

      return json({
        ok: true,
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
        intent: {
          id: intent.id,
          purchase_type: intent.purchase_type,
          item_id: intent.item_id,
          item_label: intent.item_label,
          status: intent.status,
        },
      });
    }

    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "resolve_external_purchase_intent", 30, 60);

    if (action === "mark") {
      const intentId = String(body.intent_id || "").trim();
      const status = String(body.status || "").trim();
      if (!intentId) throw new Error("MISSING_INTENT_ID");
      if (!ALLOWED_STATUSES.has(status)) throw new Error("INVALID_STATUS");

      const { data: current, error: currentError } = await supabase
        .from("external_purchase_intents")
        .select("id,user_id,user_email,status")
        .eq("id", intentId)
        .maybeSingle();
      if (currentError || !current) throw new Error("INTENT_NOT_FOUND");

      const email = String(user.email || "").trim().toLowerCase();
      const ownsIntent = current.user_id === user.id || (!!email && String(current.user_email || "").trim().toLowerCase() === email);
      if (!ownsIntent) throw new Error("INTENT_FORBIDDEN");

      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (typeof body.stripe_checkout_url === "string" && body.stripe_checkout_url) update.stripe_checkout_url = body.stripe_checkout_url;
      const { error: updateError } = await supabase.from("external_purchase_intents").update(update).eq("id", intentId);
      if (updateError) throw updateError;
      return json({ ok: true });
    }

    const since = new Date(Date.now() - MAX_AGE_MINUTES * 60 * 1000).toISOString();
    const email = String(user.email || "").trim().toLowerCase();
    let query = supabase
      .from("external_purchase_intents")
      .select("id,user_id,user_email,purchase_type,item_id,item_label,status,created_at")
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    query = email ? query.or(`user_id.eq.${user.id},user_email.ilike.${email}`) : query.eq("user_id", user.id);

    const { data: rows, error } = await query;
    if (error) throw error;
    const intent = Array.isArray(rows) && rows.length ? rows[0] : null;
    await logSecurityEvent(user.id, "external_purchase_intent_resolved", { intentId: intent?.id || null, matched: !!intent });
    return json({ ok: true, intent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    const status = message === "RATE_LIMITED" ? 429 : (["AUTH_REQUIRED", "INVALID_TOKEN", "INVALID_OR_EXPIRED_INTENT_TOKEN"].includes(message) ? 401 : 400);
    return json({ error: message }, status);
  }
});
