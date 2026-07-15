import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit, logSecurityEvent } from "../_shared/security.ts";

const VALID_TYPES = new Set(["protocol", "recipe", "app_access"]);
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");

    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "create_external_purchase_intent", 20, 60);

    const body = await req.json().catch(() => ({}));
    const purchaseType = String(body.purchase_type || "").trim();
    if (!VALID_TYPES.has(purchaseType)) throw new Error("INVALID_PURCHASE_TYPE");

    const supabase = getAdminClient();
    let itemId: string | null = null;
    let itemLabel = "Accès Méthode Tee";

    if (purchaseType === "protocol") {
      itemId = String(body.protocol_id || body.item_id || "").trim();
      if (!itemId) throw new Error("MISSING_PROTOCOL_ID");
      const { data: protocol, error } = await supabase
        .from("protocols")
        .select("id,title")
        .eq("id", itemId)
        .maybeSingle();
      if (error || !protocol) throw new Error("PROTOCOL_NOT_FOUND");
      itemLabel = protocol.title || "Protocole Méthode Tee";
    }

    if (purchaseType === "recipe") {
      itemId = String(body.recipe_id || body.item_id || "").trim();
      if (!itemId) throw new Error("MISSING_RECIPE_ID");
      const { data: recipe, error } = await supabase
        .from("recipes")
        .select("id,title,is_premium,active")
        .eq("id", itemId)
        .eq("active", true)
        .maybeSingle();
      if (error || !recipe) throw new Error("RECIPE_NOT_FOUND");
      if (!recipe.is_premium) throw new Error("RECIPE_IS_FREE");
      itemLabel = recipe.title || "Recette Méthode Tee";
    }

    // Une seule intention active à la fois par utilisateur : on évite les ambiguïtés
    // sans toucher aux vrais achats ni aux webhooks Stripe.
    await supabase
      .from("external_purchase_intents")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "pending");

    const publicToken = randomToken();
    const tokenHash = await sha256Hex(publicToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: intent, error: insertError } = await supabase
      .from("external_purchase_intents")
      .insert({
        user_id: user.id,
        user_email: user.email || null,
        purchase_type: purchaseType,
        item_id: itemId,
        item_label: itemLabel,
        status: "pending",
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id,purchase_type,item_id,item_label,status,created_at")
      .single();

    if (insertError) throw insertError;

    await logSecurityEvent(user.id, "external_purchase_intent_created", {
      purchaseType,
      itemId,
      intentId: intent.id,
    });

    const appUrl = (Deno.env.get("APP_URL") || "https://methodetee.app").replace(/\/$/, "");
    return new Response(JSON.stringify({
      ok: true,
      intent,
      checkout_url: `${appUrl}/checkout.html?intent=${encodeURIComponent(intent.id)}&token=${encodeURIComponent(publicToken)}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: message === "RATE_LIMITED" ? 429 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
