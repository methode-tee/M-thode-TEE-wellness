import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit, logSecurityEvent } from "../_shared/security.ts";

const MAX_AGE_MINUTES = 30;
const ALLOWED_STATUSES = new Set(["redirecting", "completed", "cancelled", "failed", "expired"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");

    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "resolve_external_purchase_intent", 30, 60);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "resolve").trim();
    const supabase = getAdminClient();

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

      const update: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (typeof body.stripe_checkout_url === "string" && body.stripe_checkout_url) {
        update.stripe_checkout_url = body.stripe_checkout_url;
      }

      const { error: updateError } = await supabase
        .from("external_purchase_intents")
        .update(update)
        .eq("id", intentId);
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    query = email
      ? query.or(`user_id.eq.${user.id},user_email.ilike.${email}`)
      : query.eq("user_id", user.id);

    const { data: rows, error } = await query;
    if (error) throw error;

    const intent = Array.isArray(rows) && rows.length ? rows[0] : null;

    await logSecurityEvent(user.id, "external_purchase_intent_resolved", {
      intentId: intent?.id || null,
      matched: !!intent,
    });

    return new Response(JSON.stringify({ ok: true, intent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    const status = message === "RATE_LIMITED" ? 429 : (message === "AUTH_REQUIRED" || message === "INVALID_TOKEN" ? 401 : 400);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
