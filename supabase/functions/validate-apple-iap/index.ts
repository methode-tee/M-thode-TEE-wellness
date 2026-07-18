import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6?target=deno";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

function decodePayload(jws: string) {
  const part = jws.split(".")[1];
  if (!part) throw new Error("INVALID_APPLE_JWS");
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return JSON.parse(atob(padded));
}

async function appleJwt() {
  const issuer = Deno.env.get("APPLE_IAP_ISSUER_ID")!;
  const keyId = Deno.env.get("APPLE_IAP_KEY_ID")!;
  const privateKey = (Deno.env.get("APPLE_IAP_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID")!;
  if (!issuer || !keyId || !privateKey || !bundleId) throw new Error("APPLE_API_SECRETS_MISSING");
  const key = await importPKCS8(privateKey, "ES256");
  return await new SignJWT({ bid: bundleId }).setProtectedHeader({ alg:"ES256", kid:keyId, typ:"JWT" })
    .setIssuer(issuer).setAudience("appstoreconnect-v1").setIssuedAt().setExpirationTime("10m").sign(key);
}

async function fetchTransaction(transactionId: string) {
  const jwt = await appleJwt();
  for (const env of ["production", "sandbox"]) {
    const base = env === "sandbox" ? "https://api.storekit-sandbox.apple.com" : "https://api.storekit.apple.com";
    const res = await fetch(`${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, { headers:{ Authorization:`Bearer ${jwt}` } });
    if (res.ok) {
      const body = await res.json();
      return { payload: decodePayload(body.signedTransactionInfo), environment: env };
    }
    if (res.status !== 404) throw new Error(`APPLE_TRANSACTION_LOOKUP_${res.status}`);
  }
  throw new Error("APPLE_TRANSACTION_NOT_FOUND");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:corsHeaders });
  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const transactionId = String(body.transaction_id || "");
    const requestedProductId = String(body.product_id || "");
    if (!transactionId || !requestedProductId) throw new Error("TRANSACTION_AND_PRODUCT_REQUIRED");

    const { payload, environment } = await fetchTransaction(transactionId);
    const bundleId = Deno.env.get("APPLE_BUNDLE_ID");
    if (String(payload.transactionId) !== transactionId) throw new Error("TRANSACTION_ID_MISMATCH");
    if (payload.bundleId !== bundleId) throw new Error("BUNDLE_ID_MISMATCH");
    if (payload.productId !== requestedProductId) throw new Error("PRODUCT_ID_MISMATCH");
    if (payload.revocationDate) throw new Error("PURCHASE_REVOKED");
    if (payload.appAccountToken && String(payload.appAccountToken).toLowerCase() !== user.id.toLowerCase()) throw new Error("APPLE_ACCOUNT_TOKEN_MISMATCH");

    const supabase = getAdminClient();
    let purchaseType = body.purchase_type === "restore" ? null : String(body.purchase_type || "");
    let itemId = body.item_id ? String(body.item_id) : null;

    if (!purchaseType || !itemId) {
      const [{ data: protocol }, { data: recipe }] = await Promise.all([
        supabase.from("protocols").select("id").eq("apple_product_id", payload.productId).maybeSingle(),
        supabase.from("recipes").select("id").eq("apple_product_id", payload.productId).maybeSingle()
      ]);
      if (protocol) { purchaseType = "protocol"; itemId = protocol.id; }
      else if (recipe) { purchaseType = "recipe"; itemId = recipe.id; }
    }
    if (!purchaseType || !itemId || !["protocol","recipe"].includes(purchaseType)) throw new Error("APPLE_PRODUCT_NOT_MAPPED");

    const table = purchaseType === "protocol" ? "protocols" : "recipes";
    const { data: mapped } = await supabase.from(table).select("id,apple_product_id").eq("id", itemId).maybeSingle();
    if (!mapped || mapped.apple_product_id !== payload.productId) throw new Error("APPLE_PRODUCT_MAPPING_MISMATCH");

    const { data: existing } = await supabase.from("apple_iap_transactions").select("user_id,purchase_type,item_id").eq("transaction_id", transactionId).maybeSingle();
    if (existing && existing.user_id !== user.id) throw new Error("TRANSACTION_ALREADY_CLAIMED");

    await supabase.from("apple_iap_transactions").upsert({
      transaction_id: transactionId, original_transaction_id: String(payload.originalTransactionId || transactionId),
      user_id:user.id, product_id:payload.productId, purchase_type:purchaseType, item_id:itemId, environment,
      purchase_date: payload.purchaseDate ? new Date(Number(payload.purchaseDate)).toISOString() : null, raw_transaction:payload
    }, { onConflict:"transaction_id" });

    if (purchaseType === "protocol") {
      const { error } = await supabase.from("user_protocols").upsert({ user_id:user.id, protocol_id:itemId, status:"active", purchased_at:new Date().toISOString(), apple_transaction_id:transactionId, apple_original_transaction_id:String(payload.originalTransactionId || transactionId) }, { onConflict:"user_id,protocol_id" });
      if (error) throw error;
    } else {
      const { error } = await supabase.from("recipe_purchases").upsert({ user_id:user.id, user_email:user.email, recipe_id:itemId, status:"active", purchased_at:new Date().toISOString(), apple_transaction_id:transactionId, apple_original_transaction_id:String(payload.originalTransactionId || transactionId), currency:payload.currency || "EUR", amount_total:payload.price || null }, { onConflict:"user_id,recipe_id" });
      if (error) throw error;
    }
    return new Response(JSON.stringify({ ok:true, unlocked:true, purchase_type:purchaseType, item_id:itemId, product_id:payload.productId }), { headers:{...corsHeaders,"Content-Type":"application/json"} });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error:String(error?.message || error) }), { status:400, headers:{...corsHeaders,"Content-Type":"application/json"} });
  }
});
