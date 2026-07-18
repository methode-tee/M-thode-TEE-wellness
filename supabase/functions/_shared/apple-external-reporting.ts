import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6?target=deno";
import { getAdminClient } from "./auth.ts";

export function centsToMilliunits(cents: number) { return Math.max(0, Math.round(Number(cents || 0) * 10)); }
export function productIdentifier(metadata: Record<string,string>) {
  if (metadata.purchase_type === "recipe") return `recipe.${metadata.recipe_id || "unknown"}`;
  if (metadata.purchase_type === "protocol") return `protocol.${metadata.protocol_id || "unknown"}`;
  return "app_access";
}

export async function selectActiveToken(userId: string, intentId?: string | null) {
  const supabase = getAdminClient();
  const now = new Date().toISOString();
  let q = supabase.from("apple_external_purchase_tokens").select("*")
    .eq("user_id", userId).gt("token_expiration_date", now)
    .order("token_type", { ascending: false }) // SERVICES avant ACQUISITION
    .order("token_creation_date", { ascending: false }).limit(1);
  if (intentId) q = q.eq("intent_id", intentId);
  let { data, error } = await q.maybeSingle();
  if ((!data || error) && intentId) {
    const fallback = await supabase.from("apple_external_purchase_tokens").select("*")
      .eq("user_id", userId).gt("token_expiration_date", now)
      .order("token_type", { ascending: false }).order("token_creation_date", { ascending: false }).limit(1).maybeSingle();
    data = fallback.data; error = fallback.error;
  }
  if (error) throw error;
  return data;
}

export async function queuePurchaseReport(eventId: string, session: any) {
  const metadata = session.metadata || {};
  const userId = metadata.user_id;
  if (!userId) return { queued: false, reason: "missing_user_id" };
  const token = await selectActiveToken(userId, metadata.intent_id || null);
  if (!token) return { queued: false, reason: "no_active_apple_token" };
  const amount = centsToMilliunits(session.amount_total || 0);
  const currency = String(session.currency || "eur").toUpperCase();
  const taxCountry = Deno.env.get("APPLE_TAX_COUNTRY") || "FRA";
  const lineItemId = crypto.randomUUID();
  const payload = {
    requestIdentifier: crypto.randomUUID(),
    externalPurchaseId: token.external_purchase_id,
    status: "LINE_ITEM",
    lineItems: [{
      lineItemId,
      creationDate: Number(session.created || Math.floor(Date.now()/1000)) * 1000,
      eventType: "BUY",
      productType: "ONE_TIME_BUY",
      productIdentifier: productIdentifier(metadata),
      quantity: 1,
      pricingCurrency: currency,
      reportingCurrency: currency,
      amountTaxExclusive: amount,
      amountTaxInclusive: amount,
      netAmountTaxExclusive: amount,
      taxAmount: 0,
      taxCountry,
    }],
  };
  const supabase = getAdminClient();
  const { error } = await supabase.from("apple_external_purchase_reports").upsert({
    token_id: token.id,
    intent_id: metadata.intent_id || token.intent_id || null,
    request_identifier: payload.requestIdentifier,
    report_kind: "purchase",
    stripe_event_id: eventId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
    line_item_id: lineItemId,
    apple_payload: payload,
    status: "pending",
  }, { onConflict: "token_id,report_kind,stripe_event_id", ignoreDuplicates: true });
  if (error) throw error;
  return { queued: true };
}

export async function queueRefundReport(eventId: string, charge: any) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return { queued: false, reason: "missing_payment_intent" };
  const supabase = getAdminClient();
  const { data: purchase, error } = await supabase.from("apple_external_purchase_reports")
    .select("*,apple_external_purchase_tokens(*)").eq("report_kind", "purchase")
    .eq("stripe_payment_intent_id", paymentIntentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!purchase) return { queued: false, reason: "purchase_report_not_found" };
  const refundedCents = Number(charge.amount_refunded || 0);
  if (refundedCents <= 0) return { queued: false, reason: "no_refund_amount" };
  const buy = purchase.apple_payload?.lineItems?.[0] || {};
  const amount = centsToMilliunits(refundedCents);
  const lineItemId = crypto.randomUUID();
  const payload = {
    requestIdentifier: crypto.randomUUID(),
    externalPurchaseId: purchase.apple_external_purchase_tokens.external_purchase_id,
    status: "LINE_ITEM",
    lineItems: [{
      lineItemId,
      creationDate: Number(charge.created || Math.floor(Date.now()/1000)) * 1000,
      eventType: "REFUND",
      referenceLineItemId: purchase.line_item_id,
      pricingCurrency: buy.pricingCurrency,
      reportingCurrency: buy.reportingCurrency,
      amountTaxExclusive: amount,
      amountTaxInclusive: amount,
      netAmountTaxExclusive: Math.max(0, Number(buy.netAmountTaxExclusive || 0) - amount),
      taxAmount: 0,
      taxCountry: buy.taxCountry,
    }],
  };
  const { error: insertError } = await supabase.from("apple_external_purchase_reports").upsert({
    token_id: purchase.token_id,
    intent_id: purchase.intent_id,
    request_identifier: payload.requestIdentifier,
    report_kind: "refund",
    stripe_event_id: eventId,
    stripe_payment_intent_id: paymentIntentId,
    line_item_id: lineItemId,
    reference_line_item_id: purchase.line_item_id,
    apple_payload: payload,
    status: "pending",
  }, { onConflict: "token_id,report_kind,stripe_event_id", ignoreDuplicates: true });
  if (insertError) throw insertError;
  return { queued: true };
}

async function appleJwt() {
  const issuer = Deno.env.get("APPLE_IAP_ISSUER_ID")!;
  const keyId = Deno.env.get("APPLE_IAP_KEY_ID")!;
  const privateKey = (Deno.env.get("APPLE_IAP_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID")!;
  if (!issuer || !keyId || !privateKey || !bundleId) throw new Error("APPLE_API_SECRETS_MISSING");
  const key = await importPKCS8(privateKey, "ES256");
  return await new SignJWT({ bid: bundleId })
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuer).setAudience("appstoreconnect-v1")
    .setIssuedAt().setExpirationTime("10m").sign(key);
}

export async function sendAppleReport(report: any, environment: string) {
  const jwt = await appleJwt();
  const base = environment === "sandbox" ? "https://api.storekit-sandbox.apple.com" : "https://api.storekit.apple.com";
  const response = await fetch(`${base}/externalPurchase/v1/reports`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  const text = await response.text();
  let body: any = text; try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) throw new Error(`APPLE_${response.status}:${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}
