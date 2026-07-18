import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";

function decodeBase64UrlJson(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const json = new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)));
  return JSON.parse(json);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const intentId = String(body.intent_id || "").trim();
    if (!intentId) throw new Error("MISSING_INTENT_ID");

    const supabase = getAdminClient();
    const { data: intent, error: intentError } = await supabase
      .from("external_purchase_intents").select("id,user_id,user_email").eq("id", intentId).maybeSingle();
    if (intentError || !intent) throw new Error("INTENT_NOT_FOUND");
    const email = String(user.email || "").toLowerCase();
    const owns = intent.user_id === user.id || (!!email && String(intent.user_email || "").toLowerCase() === email);
    if (!owns) throw new Error("INTENT_FORBIDDEN");

    const incoming = [
      ["ACQUISITION", body.acquisition_token || body.acquisitionToken],
      ["SERVICES", body.services_token || body.servicesToken],
    ] as const;
    const stored: unknown[] = [];

    for (const [expectedType, raw] of incoming) {
      if (!raw || typeof raw !== "string") continue;
      const decoded = decodeBase64UrlJson(raw);
      const tokenType = String(decoded.tokenType || expectedType).toUpperCase();
      if (tokenType !== expectedType) throw new Error(`TOKEN_TYPE_MISMATCH_${expectedType}`);
      if (!decoded.externalPurchaseId || !decoded.bundleId || !decoded.tokenCreationDate || !decoded.tokenExpirationDate) {
        throw new Error(`INVALID_${expectedType}_TOKEN`);
      }
      const environment = String(decoded.externalPurchaseId).startsWith("SANDBOX") ? "sandbox" : "production";
      const row = {
        user_id: user.id,
        intent_id: intentId,
        token_type: tokenType,
        token_value: raw,
        external_purchase_id: String(decoded.externalPurchaseId),
        app_apple_id: Number(decoded.appAppleId),
        bundle_id: String(decoded.bundleId),
        token_creation_date: new Date(Number(decoded.tokenCreationDate)).toISOString(),
        token_expiration_date: new Date(Number(decoded.tokenExpirationDate)).toISOString(),
        environment,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("apple_external_purchase_tokens")
        .upsert(row, { onConflict: "token_value" }).select("id,token_type,external_purchase_id,environment").single();
      if (error) throw error;
      stored.push(data);
    }
    return json({ ok: true, stored });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TOKEN_STORAGE_ERROR";
    return json({ error: message }, message.includes("AUTH") ? 401 : 400);
  }
});
