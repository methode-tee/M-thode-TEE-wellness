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

    const webhookSecret =
      Deno.env.get("STRIPE_WEBHOOK_RECIPES_SECRET") ||
      Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      return new Response("MISSING_WEBHOOK_SECRET", { status: 500 });
    }

    const rawBody = await req.text();

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret
    );

    if (event.type !== "checkout.session.completed") {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // Ce webhook ne traite QUE les recettes.
    if (metadata.purchase_type !== "recipe") {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = metadata.user_id;
    const recipeId = metadata.recipe_id;
    const userEmail = metadata.user_email || session.customer_email || "";

    if (!userId || !recipeId) {
      return new Response(
        JSON.stringify({
          error: "MISSING_RECIPE_METADATA",
          metadata,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getAdminClient();

    // Déblocage réel de la recette.
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

    if (purchaseError) {
      return new Response(
        JSON.stringify({
          error: "RECIPE_PURCHASE_INSERT_FAILED",
          details: purchaseError.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // IMPORTANT :
    // On ne bloque jamais le déblocage recette avec une insertion dans payments.
    // Les protocoles gardent leur ancien webhook séparé.
    return new Response(
      JSON.stringify({
        received: true,
        unlocked: true,
        recipe_id: recipeId,
        user_id: userId,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
