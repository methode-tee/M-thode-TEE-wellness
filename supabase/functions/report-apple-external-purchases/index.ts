import { getAdminClient } from "../_shared/auth.ts";
import { sendAppleReport } from "../_shared/apple-external-reporting.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("METHOD_NOT_ALLOWED", { status: 405 });
    const expected = Deno.env.get("APPLE_REPORT_CRON_SECRET");
    if (!expected || req.headers.get("x-cron-secret") !== expected) return new Response("UNAUTHORIZED", { status: 401 });
    const supabase = getAdminClient();
    const now = new Date().toISOString();

    // Une fois le token expiré, crée NO_LINE_ITEM seulement s'il n'a aucune transaction mise en file.
    const { data: expiredTokens } = await supabase.from("apple_external_purchase_tokens").select("id,external_purchase_id,environment,intent_id")
      .lt("token_expiration_date", now).eq("report_status", "pending").limit(50);
    for (const token of expiredTokens || []) {
      const { count } = await supabase.from("apple_external_purchase_reports").select("id", { count: "exact", head: true }).eq("token_id", token.id);
      if (!count) {
        const requestIdentifier = crypto.randomUUID();
        await supabase.from("apple_external_purchase_reports").insert({
          token_id: token.id, intent_id: token.intent_id, request_identifier: requestIdentifier,
          report_kind: "no_purchase", apple_payload: { requestIdentifier, externalPurchaseId: token.external_purchase_id, status: "NO_LINE_ITEM" }, status: "pending",
        });
      }
    }

    const { data: queue, error } = await supabase.from("apple_external_purchase_reports")
      .select("*,apple_external_purchase_tokens(environment)").in("status", ["pending","failed"])
      .lte("next_attempt_at", now).order("created_at", { ascending: true }).limit(25);
    if (error) throw error;
    let reported = 0, failed = 0;
    for (const row of queue || []) {
      await supabase.from("apple_external_purchase_reports").update({ status: "processing", updated_at: now }).eq("id", row.id);
      try {
        const response = await sendAppleReport(row.apple_payload, row.apple_external_purchase_tokens.environment);
        await supabase.from("apple_external_purchase_reports").update({ status: "reported", apple_response: response, reported_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
        await supabase.from("apple_external_purchase_tokens").update({ report_status: "reported", reported_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.token_id);
        reported++;
      } catch (e) {
        const attempts = Number(row.attempts || 0) + 1;
        const delayMinutes = Math.min(1440, Math.pow(2, Math.min(attempts, 8)) * 5);
        await supabase.from("apple_external_purchase_reports").update({ status: "failed", attempts, last_error: String(e), next_attempt_at: new Date(Date.now()+delayMinutes*60000).toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
        failed++;
      }
    }
    return new Response(JSON.stringify({ ok: true, selected: queue?.length || 0, reported, failed }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
