import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { getAdminClient } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("METHOD_NOT_ALLOWED", { status: 405 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("MISSING_STRIPE_SIGNATURE", { status: 400 });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_RECIPES_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return new Response("MISSING_WEBHOOK_SECRET", { status: 500 });
    }

    const body = await req.text();

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};

      if (metadata.purchase_type === "recipe") {
        const userId = metadata.user_id;
        const userEmail = metadata.user_email || session.customer_email || "";
        const recipeId = metadata.recipe_id;

        if (!userId || !recipeId) {
          throw new Error("MISSING_RECIPE_METADATA");
        }

        const supabase = getAdminClient();

        const { error: purchaseError } = await supabase
          .from("recipe_purchases")
          .upsert(
            {
              user_id: userId,
              user_email: userEmail,
              recipe_id: recipeId,
              stripe_session_id: session.id,
              amount_total: session.amount_total || 0,
              currency: session.currency || "eur",
              status: "active",
              purchased_at: new Date().toISOString(),
            },
            { onConflict: "user_id,recipe_id" }
          );

        if (purchaseError) throw purchaseError;

        // Optionnel : trace dans payments si la colonne recipe_id existe.
        await supabase
          .from("payments")
          .insert({
            user_id: userId,
            user_email: userEmail,
            recipe_id: recipeId,
            stripe_session_id: session.id,
            amount_total: session.amount_total || 0,
            currency: session.currency || "eur",
            status: "paid",
            purchase_type: "recipe",
          })
          .select()
          .maybeSingle();
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
