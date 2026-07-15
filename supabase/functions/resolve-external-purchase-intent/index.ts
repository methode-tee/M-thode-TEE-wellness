import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");
    const body = await req.json().catch(() => ({}));
    const intentId = String(body.intent_id || "").trim();
    const publicToken = String(body.token || "").trim();
    if (!intentId || !publicToken) throw new Error("MISSING_INTENT_TOKEN");

    const supabase = getAdminClient();
    const tokenHash = await sha256Hex(publicToken);
    const { data: intent, error } = await supabase
      .from("external_purchase_intents")
      .select("*")
      .eq("id", intentId)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !intent) throw new Error("INTENT_NOT_FOUND");
    if (intent.status !== "pending") throw new Error("INTENT_ALREADY_USED");
    if (!intent.expires_at || new Date(intent.expires_at).getTime() < Date.now()) {
      await supabase.from("external_purchase_intents").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", intent.id);
      throw new Error("INTENT_EXPIRED");
    }

    const appUrl = (Deno.env.get("APP_URL") || "https://methodetee.app").replace(/\/$/, "");
    const metadata: Record<string, string> = {
      user_id: intent.user_id,
      user_email: intent.user_email || "",
      purchase_type: intent.purchase_type,
      external_purchase_intent_id: intent.id,
    };

    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    let successType = intent.purchase_type;
    let successId = "";

    if (intent.purchase_type === "protocol") {
      const { data: protocol, error: protocolError } = await supabase
        .from("protocols").select("*").eq("id", intent.item_id).maybeSingle();
      if (protocolError || !protocol) throw new Error("PROTOCOL_NOT_FOUND");
      metadata.protocol_id = protocol.id;
      successId = protocol.id;
      lineItem = {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Méthode Tee — ${protocol.title}`,
            description: protocol.duration_label || "Protocole privé",
            images: protocol.image_url ? [protocol.image_url] : [],
          },
          unit_amount: Number(protocol.price_cents || 500),
        },
        quantity: 1,
      };
    } else if (intent.purchase_type === "recipe") {
      const { data: recipe, error: recipeError } = await supabase
        .from("recipes").select("*").eq("id", intent.item_id).eq("active", true).maybeSingle();
      if (recipeError || !recipe) throw new Error("RECIPE_NOT_FOUND");
      if (!recipe.is_premium) throw new Error("RECIPE_IS_FREE");
      metadata.recipe_id = recipe.id;
      successId = recipe.id;
      lineItem = recipe.stripe_price_id
        ? { price: recipe.stripe_price_id, quantity: 1 }
        : {
            price_data: {
              currency: "eur",
              product_data: {
                name: `Méthode Tee — ${recipe.title}`,
                description: recipe.subtitle || recipe.category || "Recette premium",
                images: recipe.image_url ? [recipe.image_url] : [],
              },
              unit_amount: Number(recipe.price_cents || 500),
            },
            quantity: 1,
          };
    } else if (intent.purchase_type === "app_access") {
      const priceId = Deno.env.get("APP_ACCESS_PRICE_ID");
      lineItem = priceId
        ? { price: priceId, quantity: 1 }
        : {
            price_data: {
              currency: "eur",
              product_data: { name: "Méthode Tee — Accès privé" },
              unit_amount: Number(Deno.env.get("APP_ACCESS_PRICE_CENTS") || 500),
            },
            quantity: 1,
          };
    } else {
      throw new Error("INVALID_PURCHASE_TYPE");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: intent.user_email || undefined,
      line_items: [lineItem],
      metadata,
      success_url: `${appUrl}/checkout-return.html?status=success&type=${encodeURIComponent(successType)}&id=${encodeURIComponent(successId)}`,
      cancel_url: `${appUrl}/checkout-return.html?status=cancelled&type=${encodeURIComponent(successType)}&id=${encodeURIComponent(successId)}`,
      allow_promotion_codes: true,
    });

    await supabase.from("external_purchase_intents").update({
      status: "redirecting",
      stripe_checkout_url: session.url,
      token_hash: null,
      updated_at: new Date().toISOString(),
    }).eq("id", intent.id);

    return new Response(JSON.stringify({ ok: true, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
