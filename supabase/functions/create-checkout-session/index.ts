import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/auth.ts";
import { rateLimit, logSecurityEvent } from "../_shared/security.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");

    const user = await getUserFromRequest(req);
    await rateLimit(user.id, "create_checkout_session", 12, 60);

    const body = await req.json();
    const purchaseType = body.purchase_type;
    const appUrl = (Deno.env.get("APP_URL") || "https://methodetee.app").replace(/\/$/, "");
    const supabase = getAdminClient();

    let lineItem;
    const metadata: Record<string, string> = {
      user_id: user.id,
      user_email: user.email || "",
      purchase_type: purchaseType,
    };

    if (purchaseType === "app_access") {
      const priceId = Deno.env.get("APP_ACCESS_PRICE_ID");
      if (priceId) {
        lineItem = { price: priceId, quantity: 1 };
      } else {
        lineItem = {
          price_data: {
            currency: "eur",
            product_data: { name: "Méthode Tee — Accès privé" },
            unit_amount: Number(Deno.env.get("APP_ACCESS_PRICE_CENTS") || 500),
          },
          quantity: 1,
        };
      }
    } else if (purchaseType === "protocol") {
      const protocolId = body.protocol_id;
      if (!protocolId) throw new Error("MISSING_PROTOCOL_ID");

      const { data: protocol, error } = await supabase
        .from("protocols")
        .select("*")
        .eq("id", protocolId)
        .maybeSingle();

      if (error || !protocol) throw new Error("PROTOCOL_NOT_FOUND");
      metadata.protocol_id = protocol.id;

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
    } else {
      throw new Error("INVALID_PURCHASE_TYPE");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email || undefined,
      line_items: [lineItem],
      metadata,
      success_url: purchaseType === "protocol" && metadata.protocol_id
        ? `${appUrl}/protocol.html?id=${metadata.protocol_id}&payment=success`
        : `${appUrl}/dashboard.html?payment=success`,
      cancel_url: purchaseType === "protocol" && metadata.protocol_id
        ? `${appUrl}/protocols.html?payment=cancelled`
        : `${appUrl}/index.html?payment=cancelled`,
      allow_promotion_codes: true,
    });

    await logSecurityEvent(user.id, "checkout_created", { purchaseType, sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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
