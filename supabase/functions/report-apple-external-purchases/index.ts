import { getAdminClient } from "../_shared/auth.ts";
import { sendExternalPurchaseReport } from "../_shared/apple_external_purchase.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function queueExpiredTokensWithoutTransactions() {
  const supabase = getAdminClient();
  const { data: tokens, error } = await supabase
    .from("apple_external_purchase_tokens")
    .select("id,intent_id,external_purchase_id,duplicate_of_token_id")
    .lt("token_expiration_date", new Date().toISOString())
    .not("external_purchase_id", "is", null)
    .limit(100);
  if (error) throw error;

  for (const token of tokens || []) {
    const { data: existing } = await supabase
      .from("apple_external_purchase_reports")
      .select("id")
      .eq("token_id", token.id)
      .limit(1);
    if (existing?.length) continue;

    const requestIdentifier = crypto.randomUUID();
    const reportKind = token.duplicate_of_token_id ? "duplicate" : "no_purchase";
    const status = token.duplicate_of_token_id ? "DUPLICATE_TOKEN" : "NO_LINE_ITEM";

    await supabase.from("apple_external_purchase_reports").insert({
      token_id: token.id,
      intent_id: token.intent_id,
      report_kind: reportKind,
      stripe_event_id: `expired:${token.external_purchase_id}`,
      request_identifier: requestIdentifier,
      apple_payload: {
        requestIdentifier,
        externalPurchaseId: token.external_purchase_id,
        status,
      },
      status: "pending",
    });
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

    const expected = Deno.env.get("APPLE_REPORT_CRON_SECRET");
    const provided = req.headers.get("x-cron-secret") || "";
    if (!expected || provided !== expected) return json({ error: "UNAUTHORIZED" }, 401);

    await queueExpiredTokensWithoutTransactions();

    const supabase = getAdminClient();
    const { data: reports, error } = await supabase
      .from("apple_external_purchase_reports")
      .select("id,token_id,intent_id,apple_payload,attempts")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .lt("attempts", 10)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;

    let reported = 0;
    let failed = 0;

    for (const report of reports || []) {
      const { data: token, error: tokenError } = await supabase
        .from("apple_external_purchase_tokens")
        .select("external_purchase_id")
        .eq("id", report.token_id)
        .single();
      if (tokenError || !token?.external_purchase_id) continue;

      await supabase.from("apple_external_purchase_reports").update({
        status: "processing",
        attempts: Number(report.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", report.id);

      try {
        const result = await sendExternalPurchaseReport(token.external_purchase_id, report.apple_payload);
        const now = new Date().toISOString();
        await supabase.from("apple_external_purchase_reports").update({
          status: "reported",
          apple_response: result.body,
          last_error: null,
          reported_at: now,
          updated_at: now,
        }).eq("id", report.id);

        await supabase.from("apple_external_purchase_tokens").update({
          report_status: "reported",
          reported_at: now,
          last_report_error: null,
          updated_at: now,
        }).eq("id", report.token_id);

        if (report.intent_id) {
          await supabase.from("external_purchase_intents").update({
            apple_report_status: "reported",
            updated_at: now,
          }).eq("id", report.intent_id);
        }
        reported += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "APPLE_REPORT_FAILED";
        const attempts = Number(report.attempts || 0) + 1;
        const delayMinutes = Math.min(360, 2 ** Math.min(attempts, 8));
        const nextAttempt = new Date(Date.now() + delayMinutes * 60_000).toISOString();

        await supabase.from("apple_external_purchase_reports").update({
          status: "failed",
          last_error: message.slice(0, 8000),
          next_attempt_at: nextAttempt,
          updated_at: new Date().toISOString(),
        }).eq("id", report.id);

        await supabase.from("apple_external_purchase_tokens").update({
          report_status: "failed",
          report_attempts: attempts,
          last_report_error: message.slice(0, 8000),
          updated_at: new Date().toISOString(),
        }).eq("id", report.token_id);
        failed += 1;
      }
    }

    return json({ ok: true, selected: reports?.length || 0, reported, failed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "UNKNOWN_ERROR" }, 500);
  }
});
