import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/auth.ts";
import { logSecurityEvent } from "../_shared/security.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) {
    return new Response(JSON.stringify({ error: "MISSING_SIGNATURE_OR_SECRET" }), { status: 400, headers: corsHeaders });
  }

  const body = await req.text();

  try {
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    const supabase = getAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const userId = metadata.user_id;
      const purchaseType = metadata.purchase_type;
      const protocolId = metadata.protocol_id;

      if (!userId) throw new Error("MISSING_USER_ID_METADATA");

      if (purchaseType === "app_access") {
        await supabase.from("profiles").update({ has_app_access: true }).eq("id", userId);
        await logSecurityEvent(userId, "app_access_granted", { sessionId: session.id });
      }

      if (purchaseType === "protocol") {
        if (!protocolId) throw new Error("MISSING_PROTOCOL_ID_METADATA");
        await supabase.from("user_protocols").upsert({
          user_id: userId,
          protocol_id: protocolId,
          status: "active",
          purchased_at: new Date().toISOString(),
        }, { onConflict: "user_id,protocol_id" });
        await logSecurityEvent(userId, "protocol_access_granted", { sessionId: session.id, protocolId });
      }

      await supabase.from("payments").upsert({
        stripe_session_id: session.id,
        user_id: userId,
        user_email: session.customer_email,
        purchase_type: purchaseType,
        protocol_id: protocolId || null,
        amount_total: session.amount_total,
        currency: session.currency,
        status: session.payment_status,
        raw: session,
      }, { onConflict: "stripe_session_id" });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "WEBHOOK_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
