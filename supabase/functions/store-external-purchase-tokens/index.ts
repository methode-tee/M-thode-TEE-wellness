import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit } from "../_shared/security.ts";
import { decodeExternalPurchaseToken } from "../_shared/apple_external_purchase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");
    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "store_external_purchase_tokens", 10, 60);

    const body = await req.json().catch(() => ({}));
    const intentId = String(body.intent_id || "").trim();
    const supplied = [
      ["ACQUISITION", body.acquisition_token],
      ["SERVICES", body.services_token],
    ] as const;

    if (!intentId) throw new Error("MISSING_INTENT_ID");
    if (!supplied.some(([, value]) => typeof value === "string" && value.trim())) {
      throw new Error("MISSING_APPLE_TOKENS");
    }

    const supabase = getAdminClient();
    const { data: intent, error: intentError } = await supabase
      .from("external_purchase_intents")
      .select("id,user_id")
      .eq("id", intentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (intentError || !intent) throw new Error("INTENT_FORBIDDEN");

    const expectedBundle = Deno.env.get("APPLE_BUNDLE_ID") || "com.methodetee.app";
    let stored = 0;

    for (const [expectedType, raw] of supplied) {
      const tokenValue = typeof raw === "string" ? raw.trim() : "";
      if (!tokenValue) continue;

      const decoded = decodeExternalPurchaseToken(tokenValue);
      if (decoded.bundleId !== expectedBundle) throw new Error("APPLE_TOKEN_BUNDLE_MISMATCH");
      if (decoded.tokenType && decoded.tokenType !== expectedType) throw new Error("APPLE_TOKEN_TYPE_MISMATCH");

      const creationIso = new Date(decoded.tokenCreationDate).toISOString();
      const expirationIso = decoded.tokenExpirationDate
        ? new Date(decoded.tokenExpirationDate).toISOString()
        : null;

      const { data: samePeriod } = await supabase
        .from("apple_external_purchase_tokens")
        .select("id,external_purchase_id")
        .eq("user_id", user.id)
        .eq("token_type", expectedType)
        .eq("token_creation_date", creationIso)
        .is("duplicate_of_token_id", null)
        .neq("external_purchase_id", decoded.externalPurchaseId)
        .limit(1)
        .maybeSingle();

      const row = {
        user_id: user.id,
        intent_id: intentId,
        token_type: expectedType,
        token_value: tokenValue,
        external_purchase_id: decoded.externalPurchaseId,
        app_apple_id: decoded.appAppleId,
        bundle_id: decoded.bundleId,
        token_creation_date: creationIso,
        token_expiration_date: expirationIso,
        environment: decoded.externalPurchaseId.startsWith("SANDBOX_") ? "sandbox" : "production",
        duplicate_of_token_id: samePeriod?.id || null,
        updated_at: new Date().toISOString(),
      };

      const { data: saved, error } = await supabase
        .from("apple_external_purchase_tokens")
        .upsert(row, { onConflict: "token_value" })
        .select("id,external_purchase_id,duplicate_of_token_id")
        .single();
      if (error) throw error;

      if (saved.duplicate_of_token_id) {
        const requestIdentifier = crypto.randomUUID();
        await supabase.from("apple_external_purchase_reports").upsert({
          token_id: saved.id,
          intent_id: intentId,
          report_kind: "duplicate",
          stripe_event_id: `duplicate:${saved.external_purchase_id}`,
          request_identifier: requestIdentifier,
          apple_payload: {
            requestIdentifier,
            externalPurchaseId: saved.external_purchase_id,
            status: "DUPLICATE_TOKEN",
          },
          status: "pending",
          updated_at: new Date().toISOString(),
        }, { onConflict: "token_id,report_kind,stripe_event_id" });
      }

      stored += 1;
    }

    return new Response(JSON.stringify({ ok: true, stored }), { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: message === "RATE_LIMITED" ? 429 : 400,
      headers,
    });
  }
});
